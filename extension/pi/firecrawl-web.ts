/**
 * firecrawl-web — multi-backend web search / fetch pi extension.
 *
 * Backends (preference order, configurable via WEB_BACKEND_ORDER):
 *   1. firecrawl — Firecrawl HTTP API, keyless ~1,000 free credits/mo per IP
 *   2. exa        — Exa MCP server, keyless free tier (MCP Streamable HTTP)
 *
 * Load balancing: when a backend hits its user/rate limit (HTTP 429, 402, or
 * error message mentioning quota/credit/limit), it enters a cooldown period and
 * the next backend is tried. After WEB_BACKEND_COOLDOWN_MS (default 60 s) the
 * backend becomes eligible again. Non-rate-limit errors (invalid params, auth
 * failures) are NOT failed over — they propagate directly to the agent.
 *
 * The Exa backend speaks MCP Streamable HTTP (no @modelcontextprotocol/sdk dep
 * — just fetch + minimal SSE parsing), matching pi's bundled-module surface so
 * this file still needs no npm install.
 *
 * Tools (same interface regardless of active backend):
 *   - websearch : search the web, returns ranked title/URL/snippet results
 *   - webfetch  : fetch a URL as clean markdown (or AI summary via Firecrawl)
 *
 * Env overrides:
 *   FIRECRAWL_API_KEY              optional key (keyless if unset)
 *   FIRECRAWL_API_URL             default https://api.firecrawl.dev/v2
 *   FIRECRAWL_WEB_MAX_RESULTS     default 5   (hard cap 10)
 *   FIRECRAWL_WEB_MIN_INTERVAL_MS default 1000 (throttle gap in ms)
 *   EXA_MCP_URL                   default https://mcp.exa.ai/mcp
 *   EXA_API_KEY                   optional Exa API key (keyless if unset)
 *   WEB_BACKEND_ORDER             default "firecrawl,exa"  (comma- or slash-separated)
 *   WEB_BACKEND_COOLDOWN_MS       default 60000   (1 minute, base cooldown)
 *   WEB_BACKEND_MAX_COOLDOWN_MS   default 300000  (5 minutes, circuit-breaker cap)
 */
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ============================================================================
// Config
// ============================================================================

// --- Firecrawl ---
const FC_API_URL = (
  process.env.FIRECRAWL_API_URL?.trim() || "https://api.firecrawl.dev/v2"
).replace(/\/+$/, "");
const RESULTS_CAP = 10; // keyless: 2 credits per <=10 results
const DEFAULT_RESULTS = clampInt(process.env.FIRECRAWL_WEB_MAX_RESULTS, 5, 1, RESULTS_CAP);
const MIN_INTERVAL_MS = clampInt(process.env.FIRECRAWL_WEB_MIN_INTERVAL_MS, 1000, 0, 60000);

// --- Exa MCP ---
const EXA_MCP_URL = (
  process.env.EXA_MCP_URL?.trim() || "https://mcp.exa.ai/mcp"
).replace(/\/+$/, "");
const EXA_MCP_TOOLS = "web_search_exa,web_fetch_exa";

// --- Load balancer ---
type BackendName = "firecrawl" | "exa";
const BACKEND_ORDER: BackendName[] = parseBackendOrder(
  process.env.WEB_BACKEND_ORDER,
  ["firecrawl", "exa"],
);
const COOLDOWN_MS = clampInt(process.env.WEB_BACKEND_COOLDOWN_MS, 60_000, 1_000, 600_000);
const MAX_COOLDOWN_MS = clampInt(process.env.WEB_BACKEND_MAX_COOLDOWN_MS, 300_000, COOLDOWN_MS, 3_600_000);

const STATUS_KEY = "firecrawl-web";

// ============================================================================
// Utilities
// ============================================================================

export function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = raw == null ? Number.NaN : Number.parseInt(raw, 10);
  const v = Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, v));
}

export function clampNum(
  v: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.max(min, Math.min(max, n));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse comma/slash-separated backend order string, dedup + validate. */
export function parseBackendOrder(
  raw: string | undefined,
  defaults: BackendName[],
): BackendName[] {
  if (!raw?.trim()) return defaults;
  const parts = raw.split(/[,/]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  const order: BackendName[] = [];
  for (const p of parts) {
    if (p === "firecrawl" || p === "exa") {
      if (!seen.has(p)) {
        seen.add(p);
        order.push(p);
      }
    }
  }
  return order.length > 0 ? order : defaults;
}

// ============================================================================
// Throttle — serialise every outbound call, enforce minimum gap between them.
// Applies to all backends equally; a conservative safety net for keyless usage.
// ============================================================================
let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastStart);
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    return fn();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ============================================================================
// Minimal SSE parser — for MCP Streamable HTTP (text/event-stream) responses.
// ============================================================================

/** Parse an SSE body.  Returns the parsed JSON from the first `data:` line, or
 *  null if no data event was found. */
export function parseSseJson(
  body: string,
): { json: Record<string, unknown> | null; parseError: boolean } {
  // SSE events are separated by blank lines.
  const events = body.split(/\n\n/);
  let lastData: string | null = null;

  for (const event of events) {
    const lines = event.split("\n");
    for (const line of lines) {
      if (line.startsWith("data:")) {
        // Keep the last data line (MCP sends exactly one per response).
        lastData = line.slice(5).trim();
      }
    }
  }

  if (lastData == null) return { json: null, parseError: true };
  try {
    return { json: JSON.parse(lastData), parseError: false };
  } catch {
    return { json: null, parseError: true };
  }
}

// ============================================================================
// Exa MCP session — minimal Streamable HTTP client (no SDK dependency).
//
// Lifecycle:
//   1. POST initialize → extract Mcp-Session-Id from response header.
//   2. POST notifications/initialized (no response body needed).
//   3. POST tools/call → SSE response with result or error.
//
// The session ID is carried via the `Mcp-Session-Id` header on every request
// after initialisation.  If a call fails with a session-related error the
// session is reset and re-initialised on the next use.
// ============================================================================

/** Error subclass marking a transient MCP session failure.  The caller should
 *  re-initialise the session rather than failing over to another backend. */
export class ExaSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExaSessionError";
  }
}

export class ExaMcpSession {
  private sessionId: string | null = null;
  private initPromise: Promise<void> | null = null;
  private nextId = 1;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  // -- public API ----------------------------------------------------------

  /** Ensure the MCP session is initialised (lazy + idempotent across callers). */
  async ensureInitialized(signal?: AbortSignal): Promise<void> {
    if (this.sessionId != null) return;
    if (this.initPromise != null) return this.initPromise;

    this.initPromise = this.initialize(signal);
    try {
      await this.initPromise;
    } catch (err) {
      this.initPromise = null; // allow retry on next call
      throw err;
    }
  }

  /** Call an MCP tool.  Returns {content, isError?} matching the MCP result. */
  async callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }> {
    await this.ensureInitialized(signal);

    const id = this.nextId++;
    const mcpUrl = this.buildUrl();

    const { body } = await this.post(mcpUrl, {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }, signal);

    const parsed = parseSseJson(body);

    if (parsed.json == null) {
      // Couldn't parse SSE — session may have expired on the server.
      this.reset();
      throw new ExaSessionError(
        "Exa MCP returned unparseable response; session reset",
      );
    }

    const rpc = parsed.json as Record<string, unknown>;

    // JSON-RPC protocol-level error
    if (rpc.error) {
      const err = rpc.error as Record<string, unknown>;
      const msg = String(err.message ?? "MCP error");
      if (isSessionError(msg)) {
        this.reset();
        throw new ExaSessionError(`Exa MCP session error: ${msg}`);
      }
      throw new Error(`Exa MCP error ${err.code ?? "?"}: ${msg}`);
    }

    const result = rpc.result as Record<string, unknown> | undefined;

    // Tool-level error (isError flag on the result)
    if (result?.isError) {
      const content = result.content as Array<{ type: string; text?: string }> | undefined;
      const errorText = content?.find((c) => c.type === "text")?.text ?? "Unknown error";
      throw new Error(`Exa MCP tool error: ${errorText}`);
    }

    return {
      content: (result?.content ?? []) as Array<{ type: string; text?: string }>,
    };
  }

  /** Reset the session so the next call re-initialises. */
  reset(): void {
    this.sessionId = null;
    this.initPromise = null;
  }

  // -- internals -----------------------------------------------------------

  /** Build the MCP URL with tool selection + optional API key query params. */
  private buildUrl(): string {
    const url = new URL(EXA_MCP_URL);
    url.searchParams.set("tools", EXA_MCP_TOOLS);
    if (this.apiKey) {
      url.searchParams.set("exaApiKey", this.apiKey);
    }
    return url.toString();
  }

  /** Full initialise handshake: initialize → extract session ID →
   *  parse + validate init response → send notifications/initialized. */
  private async initialize(signal?: AbortSignal): Promise<void> {
    const url = this.buildUrl();

    // 1. POST initialize — read full SSE body to also capture the
    //    Mcp-Session-Id response header.
    const initBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "firecrawl-web-ext", version: "1.0.0" },
      },
    });

    const initResp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "User-Agent": "firecrawl-web-ext/1.0",
      },
      body: initBody,
      signal,
    });

    if (!initResp.ok) {
      throw new Error(
        `Exa MCP initialize failed: HTTP ${initResp.status} ${initResp.statusText}`,
      );
    }

    // Session ID is returned as a response header.
    const sid = initResp.headers.get("mcp-session-id")?.trim();
    if (!sid) {
      throw new Error(
        "Exa MCP initialize: no Mcp-Session-Id header returned",
      );
    }

    // Parse SSE body to confirm the init result is valid.
    const initText = await initResp.text();
    const parsed = parseSseJson(initText);
    if (
      parsed.json == null ||
      (parsed.json as Record<string, unknown>).error
    ) {
      throw new Error(
        "Exa MCP initialize: invalid or error response from server",
      );
    }

    this.sessionId = sid;

    // 2. Send the mandatory `notifications/initialized` message.
    await this.post(url, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }, signal);
  }

  /** POST a JSON-RPC message to the MCP server.  Returns the raw response body. */
  private async post(
    url: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ body: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    const respBody = await resp.text();

    if (!resp.ok) {
      // 404 / 410 suggest the server lost our session — reset so the next
      // call re-initialises.
      if (resp.status === 404 || resp.status === 410) {
        this.reset();
        throw new ExaSessionError(
          `Exa MCP HTTP ${resp.status} ${resp.statusText}: ${respBody.slice(0, 200)}`,
        );
      }
      throw new Error(
        `Exa MCP HTTP ${resp.status} ${resp.statusText}: ${respBody.slice(0, 200)}`,
      );
    }

    return { body: respBody };
  }
}

// ============================================================================
// Error classification — is this error a rate/user limit (failover-worthy)?
// ============================================================================

/** True if the error looks like a user/rate/credit limit OR a transient
 *  network failure.  These are safe to fail over; the caller should try the
 *  next backend.  Non-transient errors (invalid params, auth failures) are
 *  NOT matched — they propagate directly to the agent. */
export function isFailoverWorthy(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  // HTTP status codes
  if (/\b429\b/.test(lower)) return true; // Too Many Requests
  if (/\b402\b/.test(lower)) return true; // Payment Required (credits exhausted)
  if (/\b502\b/.test(lower)) return true; // Bad Gateway (transient upstream)
  if (/\b503\b/.test(lower)) return true; // Service Unavailable
  if (/\b504\b/.test(lower)) return true; // Gateway Timeout

  // Rate / credit / quota limit keywords
  const limitWords = [
    "rate limit",
    "rate exceeded",
    "too many requests",
    "quota exceeded",
    "credit limit",
    "credits exhausted",
    "exhausted", // catches "Your credits have been exhausted" etc.
    "no credits",
    "user limit",
    "usage limit",
    "monthly limit",
    "daily limit",
    "limit reached",
    "try again later",
    "slow down",
  ];
  if (limitWords.some((w) => lower.includes(w))) return true;

  // Transient network / fetch failures — safe to fail over.
  const networkWords = [
    "fetch failed",
    "network error",
    "connection refused",
    "connection reset",
    "dns lookup failed",
    "unable to connect",
    "connect timeout",
    "request timeout",
    "econnrefused",
    "enotfound",
    "econnreset",
    "etimedout",
  ];
  return networkWords.some((w) => lower.includes(w));
}

/** True if an MCP error message indicates a bad/expired server session. */
export function isSessionError(message: string): boolean {
  const lower = message.toLowerCase();
  return ["session", "not initialized", "invalid request", "unknown session"].some(
    (p) => lower.includes(p),
  );
}

// ============================================================================
// Shared result types
// ============================================================================

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface FetchResult {
  content: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Firecrawl backend
// ============================================================================

/** Thin wrapper around fetch for Firecrawl POSTs.  Returns raw body + status. */
async function firecrawlPost(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{
  body: string;
  ok: boolean;
  status: number;
  statusText: string;
}> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  const resp = await fetch(`${FC_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  const respBody = await resp.text();
  return {
    body: respBody,
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
  };
}

/** Build a descriptive Firecrawl HTTP error. */
function firecrawlError(
  path: string,
  status: number,
  statusText: string,
  body: string,
): Error {
  let detail = body;
  try {
    detail = JSON.stringify(JSON.parse(body));
  } catch {
    /* use raw body */
  }
  const keyless = process.env.FIRECRAWL_API_KEY?.trim()
    ? ""
    : " (keyless — set FIRECRAWL_API_KEY if this is a rate/credit limit)";
  return new Error(
    `Firecrawl ${path} ${status} ${statusText}: ${detail}${keyless}`,
  );
}

// -- firecrawl search -------------------------------------------------------
async function fcSearch(
  query: string,
  limit: number,
  opts: {
    allowedDomains?: string[];
    blockedDomains?: string[];
    tbs?: string;
  },
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const body: Record<string, unknown> = {
    query,
    limit,
    sources: [{ type: "web" }],
  };
  if (opts.allowedDomains?.length) body.includeDomains = opts.allowedDomains;
  if (opts.blockedDomains?.length) body.excludeDomains = opts.blockedDomains;
  if (opts.tbs) body.tbs = opts.tbs;

  const resp = await firecrawlPost("/search", body, signal);
  if (!resp.ok) throw firecrawlError("/search", resp.status, resp.statusText, resp.body);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(resp.body);
  } catch {
    /* body may be empty */
  }

  const web: Array<Record<string, unknown>> =
    ((payload?.data as Record<string, unknown>)?.web as Array<Record<string, unknown>>) ??
    (payload?.web as Array<Record<string, unknown>>) ??
    [];

  return web.slice(0, limit).map((r) => ({
    title: String(r.title ?? "(no title)"),
    url: String(r.url ?? ""),
    snippet: String(r.description ?? r.snippet ?? "").trim(),
  }));
}

// -- firecrawl fetch --------------------------------------------------------
async function fcFetch(
  url: string,
  format: string,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const body = { url, formats: [format], onlyMainContent: true };
  const resp = await firecrawlPost("/scrape", body, signal);
  if (!resp.ok) throw firecrawlError("/scrape", resp.status, resp.statusText, resp.body);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(resp.body);
  } catch {
    /* body may be empty */
  }

  const data = (payload?.data ?? payload) as Record<string, unknown> | undefined;
  const field = format === "summary" ? "summary" : "markdown";
  const content = String(data?.[field] ?? data?.content ?? "");
  const title = (data?.metadata as Record<string, unknown>)?.title as string | undefined;

  return { content, title, metadata: data?.metadata as Record<string, unknown> | undefined };
}

// ============================================================================
// Exa backend — MCP-based, keyless by default.
// ============================================================================

/** Singleton MCP session, lazily initialised. */
let exaSession: ExaMcpSession | null = null;

function getExaSession(): ExaMcpSession {
  if (!exaSession) {
    const apiKey = process.env.EXA_API_KEY?.trim() || undefined;
    exaSession = new ExaMcpSession(apiKey);
  }
  return exaSession;
}

// -- Exa search -------------------------------------------------------------

/** Parse Exa's text-format search results into structured SearchResult[].
 *
 *  Exa `web_search_exa` returns results in this format:
 *  ```
 *  Title: <title>
 *  URL: <url>
 *  Published: <date or N/A>
 *  Author: <author or N/A>
 *  Highlights:
 *  <highlight text …>
 *
 *  ---
 *  Title: <next result>
 *  …
 *  ```
 */
export function parseExaSearchResults(text: string): SearchResult[] {
  const results: SearchResult[] = [];
  // Individual results are separated by a horizontal-rule marker.
  const blocks = text.split(/\n---+\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const title = /^Title:\s*(.+)$/m.exec(trimmed)?.[1]?.trim() ?? "";
    const url = /^URL:\s*(.+)$/m.exec(trimmed)?.[1]?.trim() ?? "";

    // Snippet: everything after "Highlights:" up to ~300 chars.
    const highlightIdx = trimmed.indexOf("Highlights:");
    let snippet = "";
    if (highlightIdx >= 0) {
      snippet = trimmed.slice(highlightIdx + "Highlights:".length).trim();
      if (snippet.length > 300) snippet = snippet.slice(0, 300) + "…";
    }

    if (url) {
      results.push({ title: title || "(no title)", url, snippet });
    }
  }

  return results;
}

async function exaSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const session = getExaSession();
  const result = await session.callTool(
    "web_search_exa",
    { query, numResults: limit },
    signal,
  );
  const text = result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");

  const parsed = parseExaSearchResults(text);
  if (parsed.length > 0) return parsed;

  // If structured parsing yielded nothing, return the raw text as one result
  // so the agent still sees the data.
  return text.trim()
    ? [{ title: "(Exa results)", url: "", snippet: text.trim() }]
    : [];
}

// -- Exa fetch --------------------------------------------------------------
async function exaFetch(
  url: string,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const session = getExaSession();
  const result = await session.callTool(
    "web_fetch_exa",
    { urls: [url] },
    signal,
  );
  const text = result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");

  // Extract the first markdown heading as a candidate title.
  const titleMatch = /^#\s+(.+)$/m.exec(text);
  const title = titleMatch?.[1]?.trim();

  return { content: text, title };
}

// ============================================================================
// Load balancer — try backends in preference order with rate-limit failover.
// ============================================================================

interface BackendState {
  cooldownUntil: number; // epoch ms; 0 = available
  consecutiveErrors: number;
}

const backendStates: Record<BackendName, BackendState> = {
  firecrawl: { cooldownUntil: 0, consecutiveErrors: 0 },
  exa: { cooldownUntil: 0, consecutiveErrors: 0 },
};

/** Exponential backoff: base * 2^errors, capped at MAX_COOLDOWN_MS. */
export function computeCooldown(consecutiveErrors: number): number {
  const ms = COOLDOWN_MS * Math.pow(2, Math.min(consecutiveErrors, 4));
  return Math.min(ms, MAX_COOLDOWN_MS);
}

export function markBackendUnavailable(name: BackendName): void {
  const s = backendStates[name];
  s.consecutiveErrors++;
  s.cooldownUntil = Date.now() + computeCooldown(s.consecutiveErrors);
}

export function markBackendSuccess(name: BackendName): void {
  const s = backendStates[name];
  s.consecutiveErrors = 0;
  s.cooldownUntil = 0;
}

export function isBackendAvailable(name: BackendName): boolean {
  const s = backendStates[name];
  if (s.cooldownUntil === 0) return true;
  if (Date.now() >= s.cooldownUntil) {
    // Cooldown expired — let it be tried again.  Don't reset the error counter
    // yet; only a successful call proves it's healthy.
    s.cooldownUntil = 0;
    return true;
  }
  return false;
}

/**
 * Execute `fn` against backends in preference order, failing over on rate-limit
 * errors.
 *
 * For each backend (skipping those still in cooldown):
 *   1. Call `fn(backend)`.
 *   2. Success → clear cooldown + error count, return result.
 *   3. Rate-limit error → mark backend unavailable, advance to next.
 *   4. Other error → propagate immediately (no failover).
 *
 * If all backends are exhausted, throws an aggregate error.
 */
export async function withFailover<T>(
  fn: (backend: BackendName) => Promise<T>,
): Promise<T> {
  const errors: Array<{ backend: BackendName; error: unknown }> = [];

  for (const backend of BACKEND_ORDER) {
    if (!isBackendAvailable(backend)) continue;

    try {
      const result = await fn(backend);
      markBackendSuccess(backend);
      return result;
    } catch (err) {
      if (isFailoverWorthy(err) || err instanceof ExaSessionError) {
        markBackendUnavailable(backend);
        errors.push({ backend, error: err });
        continue; // try next backend
      }
      // Not a failover-worthy error — don't fail over.
      throw err;
    }
  }

  // Every backend either in cooldown or failed with a rate-limit error.
  if (errors.length === 0) {
    throw new Error(
      `All web backends (${BACKEND_ORDER.join(", ")}) are in cooldown. Retry later.`,
    );
  }
  const messages = errors.map(
    (e) =>
      `  [${e.backend}] ${e.error instanceof Error ? e.error.message : String(e.error)}`,
  );
  throw new Error(
    `All web backends exhausted (rate/user limit):\n${messages.join("\n")}`,
  );
}

// ============================================================================
// Shared tool helpers
// ============================================================================

function textResult(text: string, details: unknown) {
  return { content: [{ type: "text" as const, text }], details };
}

async function withStatus<T>(
  ctx: { ui?: { setStatus?: (key: string, text: string | undefined) => void } },
  status: string,
  cb: () => Promise<T>,
): Promise<T> {
  try {
    ctx?.ui?.setStatus?.(STATUS_KEY, status);
  } catch {
    /* best-effort */
  }
  try {
    return await cb();
  } finally {
    try {
      ctx?.ui?.setStatus?.(STATUS_KEY, undefined);
    } catch {
      /* best-effort */
    }
  }
}

// ============================================================================
// Tool: websearch
// ============================================================================

const webSearchTool = defineTool({
  name: "websearch",
  label: "Web Search",
  description:
    "Search the web and return a ranked list of results (title, URL, snippet). " +
    "Use this whenever you need to find pages, research a topic, look something " +
    "up online, check current/recent information, or discover sources — anything " +
    "you do NOT already have a URL for. Multi-backend (Firecrawl + Exa) with " +
    "automatic failover on rate limits. After searching, use webfetch on the " +
    "most relevant URL to read full page content.",
  promptSnippet: "Search the web for current information",
  promptGuidelines: [
    "Use websearch when you do NOT already have a specific URL. To read a known URL, use webfetch.",
    "Keep queries focused; results are capped at 10 (default a few).",
    "This returns snippets only — call webfetch on a result URL when you need the full page.",
  ],
  parameters: Type.Object({
    query: Type.String({ description: "The search query." }),
    limit: Type.Optional(
      Type.Number({
        description: `Max results, 1-${RESULTS_CAP}. Default ${DEFAULT_RESULTS}.`,
      }),
    ),
    allowedDomains: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Only include results from these domains (hostnames). Firecrawl only — Exa basic search ignores this.",
      }),
    ),
    blockedDomains: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Exclude results from these domains (hostnames). Firecrawl only — Exa basic search ignores this.",
      }),
    ),
    tbs: Type.Optional(
      Type.String({
        description:
          "Time filter: qdr:d (past day), qdr:w (week), qdr:m (month), qdr:y (year). Firecrawl only — Exa ignores this.",
      }),
    ),
  }),
  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    return withStatus(ctx, "🔍 web search", async () => {
      const limit = clampNum(params.limit, DEFAULT_RESULTS, 1, RESULTS_CAP);

      // Extra params — only meaningful for Firecrawl; safely ignored by Exa.
      const searchOpts = {
        allowedDomains: params.allowedDomains as string[] | undefined,
        blockedDomains: params.blockedDomains as string[] | undefined,
        tbs: params.tbs as string | undefined,
      };

      const results = await throttle(() =>
        withFailover(async (backend) => {
          if (backend === "firecrawl") {
            return fcSearch(
              params.query as string,
              limit,
              searchOpts,
              signal,
            );
          }
          // exa backend — basic search ignores extra opts.
          return exaSearch(params.query as string, limit, signal);
        }),
      );

      const rows = results.map((r, i) => {
        const snippet = r.snippet.trim();
        return `${i + 1}. ${r.title}\n   ${r.url}${snippet ? `\n   ${snippet}` : ""}`;
      });
      const text = rows.length
        ? `Search results for "${params.query}" (${rows.length}):\n\n${rows.join("\n\n")}`
        : `No results for "${params.query}".`;
      return textResult(text, { results });
    });
  },
});

// ============================================================================
// Tool: webfetch
// ============================================================================

const webFetchTool = defineTool({
  name: "webfetch",
  label: "Web Fetch",
  description:
    "Fetch a single URL and return its main content as clean markdown (or a " +
    "concise AI summary via the Firecrawl backend). Use this when you already " +
    "have a URL — the user pasted a link, said 'fetch/open/read this page', or " +
    "you picked a websearch result to read in full. Multi-backend (Firecrawl + " +
    "Exa) with automatic failover on rate limits.",
  promptSnippet: "Fetch a URL and read it as markdown",
  promptGuidelines: [
    "Use webfetch when you have a specific URL. To find a URL first, use websearch.",
    "Returns main-content markdown by default; set format: 'summary' for a concise AI summary (Firecrawl only).",
    "When the Exa backend serves the request, the 'summary' format is ignored — Exa always returns content as-is.",
  ],
  parameters: Type.Object({
    url: Type.String({ description: "The URL to fetch." }),
    format: Type.Optional(
      Type.Enum(
        { markdown: "markdown", summary: "summary" },
        {
          description:
            "Content format to return. 'markdown' = full page markdown (default); " +
            "'summary' = concise AI-generated summary (Firecrawl only — Exa ignores this and always returns content).",
        },
      ),
    ),
  }),
  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    return withStatus(ctx, "📄 web fetch", async () => {
      const format = (params.format as string) ?? "markdown";

      const result = await throttle(() =>
        withFailover(async (backend) => {
          if (backend === "firecrawl") {
            return fcFetch(params.url as string, format, signal);
          }
          // exa backend — always returns page content.
          return exaFetch(params.url as string, signal);
        }),
      );

      const text = result.content || `(no content returned for ${params.url})`;
      const header = result.title
        ? `# ${result.title}\n${params.url}\n\n`
        : `${params.url}\n\n`;
      return textResult(header + text, { metadata: result.metadata });
    });
  },
});

// ============================================================================
// Register
// ============================================================================

export default function firecrawlWeb(pi: ExtensionAPI) {
  pi.registerTool(webSearchTool);
  pi.registerTool(webFetchTool);
}
