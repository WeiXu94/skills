/**
 * firecrawl-web — a minimal pi extension that exposes exactly two web tools,
 * mirroring Claude Code's WebSearch / WebFetch:
 *
 *   - websearch : web search via Firecrawl POST /v2/search   (ranked results)
 *   - webfetch  : fetch one URL via Firecrawl POST /v2/scrape (clean markdown)
 *
 * Hits the Firecrawl HTTP API directly — no CLI, no skills. typebox and the pi
 * SDK are provided by pi as bundled module aliases, so this file needs no npm
 * install; just drop it in ~/.pi/agent/extensions/ (auto-discovered).
 *
 * KEYLESS by default: works with no API key (~1,000 free credits/mo per IP for
 * search + scrape). Set FIRECRAWL_API_KEY for higher limits — when present it is
 * sent as a Bearer token, otherwise no auth header is sent.
 *
 * Guardrails to stay within keyless limits:
 *   - search result count is clamped (<= 10, so each search = 2 credits)
 *   - all Firecrawl calls are serialized with a minimum gap (throttle/debounce)
 *
 * Env overrides:
 *   FIRECRAWL_API_KEY            optional key (keyless if unset)
 *   FIRECRAWL_API_URL           default https://api.firecrawl.dev/v2
 *   FIRECRAWL_WEB_MAX_RESULTS   default 5   (hard cap 10)
 *   FIRECRAWL_WEB_MIN_INTERVAL_MS default 1000 (throttle gap between calls)
 */
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ---------------------------------------------------------------- config ----
const API_URL = (
	process.env.FIRECRAWL_API_URL?.trim() || "https://api.firecrawl.dev/v2"
).replace(/\/+$/, "");
const RESULTS_CAP = 10; // keyless: 2 credits per <=10 results
const DEFAULT_RESULTS = clampInt(process.env.FIRECRAWL_WEB_MAX_RESULTS, 5, 1, RESULTS_CAP);
const MIN_INTERVAL_MS = clampInt(process.env.FIRECRAWL_WEB_MIN_INTERVAL_MS, 1000, 0, 60000);
const STATUS_KEY = "firecrawl-web";

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
	const n = raw == null ? Number.NaN : Number.parseInt(raw, 10);
	const v = Number.isFinite(n) ? n : fallback;
	return Math.max(min, Math.min(max, v));
}

function clampNum(v: number | undefined, fallback: number, min: number, max: number): number {
	const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
	return Math.max(min, Math.min(max, n));
}

// --------------------------------------------------- throttle / debounce ----
// Serialize every Firecrawl call and enforce a minimum gap between them, so
// rapid tool calls can't blow past the keyless per-IP rate limit.
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------ firecrawl client ----
async function firecrawl(path: string, body: unknown, signal: AbortSignal | undefined): Promise<any> {
	const key = process.env.FIRECRAWL_API_KEY?.trim();
	const response = await fetch(`${API_URL}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(key ? { Authorization: `Bearer ${key}` } : {}),
		},
		body: JSON.stringify(body),
		signal,
	});

	const responseText = await response.text();
	let payload: any = null;
	try {
		payload = responseText ? JSON.parse(responseText) : null;
	} catch {
		payload = responseText;
	}

	if (!response.ok) {
		const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
		const keyless = key ? "" : " (keyless — set FIRECRAWL_API_KEY if this is a rate/credit limit)";
		throw new Error(`Firecrawl ${path} ${response.status} ${response.statusText}: ${detail}${keyless}`);
	}
	return payload;
}

function textResult(text: string, details: unknown) {
	return { content: [{ type: "text" as const, text }], details };
}

async function withStatus<T>(ctx: any, status: string, cb: () => Promise<T>): Promise<T> {
	try {
		ctx?.ui?.setStatus?.(STATUS_KEY, status);
	} catch {}
	try {
		return await cb();
	} finally {
		try {
			ctx?.ui?.setStatus?.(STATUS_KEY, undefined);
		} catch {}
	}
}

// ------------------------------------------------------------- websearch ----
const webSearchTool = defineTool({
	name: "websearch",
	label: "Web Search",
	description:
		"Search the web and return a ranked list of results (title, URL, snippet). Use this whenever you need to find pages, research a topic, look something up online, check current/recent information, or discover sources — anything you do NOT already have a URL for. Powered by Firecrawl (keyless). After searching, use webfetch on the most relevant URL to read full page content.",
	promptSnippet: "Search the web for current information",
	promptGuidelines: [
		"Use websearch when you do NOT already have a specific URL. To read a known URL, use webfetch.",
		"Keep queries focused; results are capped at 10 (default a few).",
		"This returns snippets only — call webfetch on a result URL when you need the full page.",
	],
	parameters: Type.Object({
		query: Type.String({ description: "The search query." }),
		limit: Type.Optional(
			Type.Number({ description: `Max results, 1-${RESULTS_CAP}. Default ${DEFAULT_RESULTS}.` }),
		),
		allowedDomains: Type.Optional(
			Type.Array(Type.String(), {
				description: "Only include results from these domains (hostnames).",
			}),
		),
		blockedDomains: Type.Optional(
			Type.Array(Type.String(), {
				description: "Exclude results from these domains (hostnames).",
			}),
		),
		tbs: Type.Optional(
			Type.String({
				description: "Time filter: qdr:d (past day), qdr:w (week), qdr:m (month), qdr:y (year).",
			}),
		),
	}),
	async execute(_toolCallId, params, signal, _onUpdate, ctx) {
		return withStatus(ctx, "🔥 web search", async () => {
			const limit = clampNum(params.limit, DEFAULT_RESULTS, 1, RESULTS_CAP);
			const body: Record<string, unknown> = {
				query: params.query,
				limit,
				sources: [{ type: "web" }],
			};
			if (params.allowedDomains?.length) body.includeDomains = params.allowedDomains;
			if (params.blockedDomains?.length) body.excludeDomains = params.blockedDomains;
			if (params.tbs) body.tbs = params.tbs;

			const payload = await throttle(() => firecrawl("/search", body, signal));
			const web: any[] = payload?.data?.web ?? payload?.web ?? [];
			const rows = web.slice(0, limit).map((r, i) => {
				const snippet = (r.description ?? r.snippet ?? "").toString().trim();
				return `${i + 1}. ${r.title ?? "(no title)"}\n   ${r.url ?? ""}${snippet ? `\n   ${snippet}` : ""}`;
			});
			const text = rows.length
				? `Search results for "${params.query}" (${rows.length}):\n\n${rows.join("\n\n")}`
				: `No results for "${params.query}".`;
			return textResult(text, payload);
		});
	},
});

// -------------------------------------------------------------- webfetch ----
const webFetchTool = defineTool({
	name: "webfetch",
	label: "Web Fetch",
	description:
		"Fetch a single URL and return its main content as clean markdown (or a concise summary). Use this when you already have a URL — the user pasted a link, said 'fetch/open/read this page', or you picked a websearch result to read in full. Powered by Firecrawl scrape (keyless).",
	promptSnippet: "Fetch a URL and read it as markdown",
	promptGuidelines: [
		"Use webfetch when you have a specific URL. To find a URL first, use websearch.",
		"Returns main-content markdown by default; set format: 'summary' for a concise AI summary instead.",
	],
	parameters: Type.Object({
		url: Type.String({ description: "The URL to fetch." }),
		format: Type.Optional(
			Type.Enum({ markdown: "markdown", summary: "summary" }, {
				description:
					"Content format to return. 'markdown' = full page markdown (default); 'summary' = concise AI-generated summary.",
			}),
		),
	}),
	async execute(_toolCallId, params, signal, _onUpdate, ctx) {
		return withStatus(ctx, "🔥 web fetch", async () => {
			const format = params.format ?? "markdown";
			const body = { url: params.url, formats: [format], onlyMainContent: true };
			const payload = await throttle(() => firecrawl("/scrape", body, signal));
			const data = payload?.data ?? payload;
			const field = format === "summary" ? "summary" : "markdown";
			const content: string = data?.[field] ?? data?.content ?? "";

			const text = content || `(no content returned for ${params.url})`;
			const title = data?.metadata?.title;
			const header = title ? `# ${title}\n${params.url}\n\n` : `${params.url}\n\n`;
			return textResult(header + text, { metadata: data?.metadata });
		});
	},
});

// ------------------------------------------------------------- register ----
export default function firecrawlWeb(pi: ExtensionAPI) {
	pi.registerTool(webSearchTool);
	pi.registerTool(webFetchTool);
}
