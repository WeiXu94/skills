/**
 * websearch — opencode custom tool: web search via Firecrawl POST /v2/search.
 *
 * Mirrors Claude Code's WebSearch. Keyless by default (no API key; ~1,000 free
 * credits/mo per IP). Set FIRECRAWL_API_KEY for higher limits — sent as Bearer
 * when present, otherwise no auth header. Filename = tool name ("websearch").
 *
 * Guardrails: result count clamped (<=10 => 2 credits/search); all Firecrawl
 * calls serialized with a minimum gap (throttle) to respect the keyless rate limit.
 *
 * Env: FIRECRAWL_API_KEY, FIRECRAWL_API_URL, FIRECRAWL_WEB_MAX_RESULTS,
 *      FIRECRAWL_WEB_MIN_INTERVAL_MS.
 */
import { tool } from "@opencode-ai/plugin";

const API_URL = (
	process.env.FIRECRAWL_API_URL?.trim() || "https://api.firecrawl.dev/v2"
).replace(/\/+$/, "");
const RESULTS_CAP = 10;
const DEFAULT_RESULTS = clampInt(process.env.FIRECRAWL_WEB_MAX_RESULTS, 5, 1, RESULTS_CAP);
const MIN_INTERVAL_MS = clampInt(process.env.FIRECRAWL_WEB_MIN_INTERVAL_MS, 1000, 0, 60000);

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
	const n = raw == null ? Number.NaN : Number.parseInt(raw, 10);
	const v = Number.isFinite(n) ? n : fallback;
	return Math.max(min, Math.min(max, v));
}
function clampNum(v: number | undefined, fallback: number, min: number, max: number): number {
	const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
	return Math.max(min, Math.min(max, n));
}

let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;
function throttle<T>(fn: () => Promise<T>): Promise<T> {
	const run = chain.then(async () => {
		const wait = MIN_INTERVAL_MS - (Date.now() - lastStart);
		if (wait > 0) await new Promise((r) => setTimeout(r, wait));
		lastStart = Date.now();
		return fn();
	});
	chain = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

async function firecrawlSearch(body: unknown, signal: AbortSignal): Promise<any> {
	const key = process.env.FIRECRAWL_API_KEY?.trim();
	const res = await fetch(`${API_URL}/search`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
		body: JSON.stringify(body),
		signal,
	});
	const txt = await res.text();
	let payload: any = null;
	try {
		payload = txt ? JSON.parse(txt) : null;
	} catch {
		payload = txt;
	}
	if (!res.ok) {
		const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
		const hint = key ? "" : " (keyless — set FIRECRAWL_API_KEY if this is a rate/credit limit)";
		throw new Error(`Firecrawl /search ${res.status} ${res.statusText}: ${detail}${hint}`);
	}
	return payload;
}

export default tool({
	description:
		"Search the web and return a ranked list of results (title, URL, snippet). Use whenever you need to find pages, research a topic, look something up online, or check current/recent information — anything you do NOT already have a URL for. Powered by Firecrawl (keyless). Follow up with the webfetch tool on a result URL to read full page content.",
	args: {
		query: tool.schema.string().describe("The search query."),
		limit: tool.schema
			.number()
			.int()
			.min(1)
			.max(RESULTS_CAP)
			.optional()
			.describe(`Max results, 1-${RESULTS_CAP}. Default ${DEFAULT_RESULTS}.`),
		allowedDomains: tool.schema
			.array(tool.schema.string())
			.optional()
			.describe("Only include results from these domains (hostnames)."),
		blockedDomains: tool.schema
			.array(tool.schema.string())
			.optional()
			.describe("Exclude results from these domains (hostnames)."),
		tbs: tool.schema
			.string()
			.optional()
			.describe("Time filter: qdr:d (past day), qdr:w (week), qdr:m (month), qdr:y (year)."),
	},
	async execute(args, context) {
		const limit = clampNum(args.limit, DEFAULT_RESULTS, 1, RESULTS_CAP);
		const body: Record<string, unknown> = { query: args.query, limit, sources: [{ type: "web" }] };
		if (args.allowedDomains?.length) body.includeDomains = args.allowedDomains;
		if (args.blockedDomains?.length) body.excludeDomains = args.blockedDomains;
		if (args.tbs) body.tbs = args.tbs;

		const payload = await throttle(() => firecrawlSearch(body, context.abort));
		const web: any[] = payload?.data?.web ?? payload?.web ?? [];
		const rows = web.slice(0, limit).map((r, i) => {
			const snippet = (r.description ?? r.snippet ?? "").toString().trim();
			return `${i + 1}. ${r.title ?? "(no title)"}\n   ${r.url ?? ""}${snippet ? `\n   ${snippet}` : ""}`;
		});
		const output = rows.length
			? `Search results for "${args.query}" (${rows.length}):\n\n${rows.join("\n\n")}`
			: `No results for "${args.query}".`;
		return { output, metadata: { count: rows.length, creditsUsed: payload?.creditsUsed } };
	},
});
