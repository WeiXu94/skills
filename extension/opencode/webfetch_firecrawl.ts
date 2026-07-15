/**
 * webfetch-firecrawl — opencode custom tool: fetch one URL via Firecrawl POST
 * /v2/scrape, returning clean main-content markdown. Mirrors Claude Code's
 * WebFetch and complements (does NOT override) opencode's built-in webfetch.
 *
 * Keyless by default (no API key; ~1,000 free credits/mo per IP). Set
 * FIRECRAWL_API_KEY for higher limits. Filename = tool name ("webfetch_firecrawl").
 *
 * Guardrails: calls serialized with a minimum gap (throttle) to respect the
 * keyless rate limit. Returns full content with no truncation.
 *
 * Env: FIRECRAWL_API_KEY, FIRECRAWL_API_URL, FIRECRAWL_WEB_MIN_INTERVAL_MS.
 */
import { tool } from "@opencode-ai/plugin";

const API_URL = (
	process.env.FIRECRAWL_API_URL?.trim() || "https://api.firecrawl.dev/v2"
).replace(/\/+$/, "");
const MIN_INTERVAL_MS = clampInt(process.env.FIRECRAWL_WEB_MIN_INTERVAL_MS, 1000, 0, 60000);

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
	const n = raw == null ? Number.NaN : Number.parseInt(raw, 10);
	const v = Number.isFinite(n) ? n : fallback;
	return Math.max(min, Math.min(max, v));
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

async function firecrawlScrape(body: unknown, signal: AbortSignal): Promise<any> {
	const key = process.env.FIRECRAWL_API_KEY?.trim();
	const res = await fetch(`${API_URL}/scrape`, {
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
		throw new Error(`Firecrawl /scrape ${res.status} ${res.statusText}: ${detail}${hint}`);
	}
	return payload;
}

export default tool({
	description:
		"Fetch a single URL and return its main content as clean markdown. Use when you already have a URL — the user pasted a link, said 'fetch/open/read this page', or you picked a websearch_firecrawl result to read in full. Powered by Firecrawl scrape (keyless). Returns full content with no truncation.",
	args: {
		url: tool.schema.string().describe("The URL to fetch."),
	},
	async execute(args, context) {
		const body = { url: args.url, formats: ["markdown"], onlyMainContent: true };
		const payload = await throttle(() => firecrawlScrape(body, context.abort));
		const data = payload?.data ?? payload;
		const text = data?.markdown ?? data?.content ?? `(no content returned for ${args.url})`;
		const title = data?.metadata?.title;
		const header = title ? `# ${title}\n${args.url}\n\n` : `${args.url}\n\n`;
		return { output: header + text, metadata: { title, sourceURL: args.url } };
	},
});
