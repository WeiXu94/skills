# pi extensions

Custom [pi](https://github.com/earendil-works/pi-coding-agent) extensions used by
this skills repo. Each file is a self-contained extension — drop it into
`~/.pi/agent/extensions/` (auto-discovered) or load it on demand with
`pi -e <path>`.

## Extensions

### [`cd.ts`](./cd.ts)

Registers `/cd` to move the live session into another directory/repo without
quitting pi.

- `/cd` — print current session cwd
- `/cd <path>` — fork history into a new session whose cwd is `<path>`, then
  switch onto it (tools/skills/AGENTS.md reload for the new project)
- `/cd --new <path>` — same, but start a fresh session (no history copy)

Uses `SessionManager.forkFrom` + `ctx.switchSession`. Creates a new session
file under the target cwd's session dir; the old session file is left intact.
Supports `~` and relative paths; directory-path argument completions included.

### [`retry.ts`](./retry.ts)

Retries assistant errors by type, using an extensible `ERROR_TYPES` registry.
Each entry is a named category with regex patterns matched against the
assistant message's `errorMessage`. Today only the `"400"` (HTTP 400 Bad
Request) type is registered; append an entry to handle another error case.

- Invisible retry: strips the trailing error message and resumes via
  `agent.prompt([])` — the LLM sees the same context, no new user message.
- Exponential backoff: 2s → 4s → 8s → ... capped at 60s. Indefinite until
  success or abort.
- Abort-aware: ESC (`turn_end` `stopReason "aborted"`) and `/new`
  (`session_start`) interrupt the loop within 100ms.
- `/retry` command: `/retry` (manual trigger), `/retry status`, `/retry reset`.

Config: edit the `BASE_DELAY_MS` / `MAX_DELAY_MS` / `BACKOFF_MULTIPLIER`
constants at the top of the file.

Ported and trimmed from [monotykamary/pi-retry](https://github.com/monotykamary/pi-retry/) —
a retry extension for the pi coding agent that handles HTTP 400/413, connection
drops, credit issues, and stream exhaustion with indefinite retries and
exponential backoff. This fork keeps only the invisible-retry loop and narrows
the default scope to 400s (extensible via `ERROR_TYPES`).

### [`firecrawl-web.ts`](./firecrawl-web.ts)

Multi-backend web search & fetch with automatic rate-limit failover:

- `websearch` — search the web, returns ranked title/URL/snippet results
- `webfetch` — fetch a URL as clean markdown (or AI summary via Firecrawl)

**Backends** (preference order, set `WEB_BACKEND_ORDER=exa,firecrawl` to swap):

| # | Backend   | Protocol        | Auth    | Limits                        |
|---|-----------|-----------------|---------|-------------------------------|
| 1 | Firecrawl | HTTP API        | keyless | ~1,000 free credits/mo per IP |
| 2 | Exa       | MCP Streamable HTTP | keyless | free tier, rate-limited     |

Both backends are keyless by default. Set `FIRECRAWL_API_KEY` or `EXA_API_KEY`
for higher limits.

**Load balancing**: when a backend returns HTTP 429/402 or an error mentioning
quota/credit/rate-limit, it enters exponential cooldown (base 60 s, max 5 min)
and the next backend is tried automatically. Non-limit errors (invalid params,
auth failures) propagate directly — no pointless failover.

**Env overrides**:

| Variable                      | Default                              |
|-------------------------------|--------------------------------------|
| `FIRECRAWL_API_KEY`           | (keyless)                            |
| `FIRECRAWL_API_URL`           | `https://api.firecrawl.dev/v2`       |
| `FIRECRAWL_WEB_MAX_RESULTS`   | `5` (hard cap 10)                    |
| `FIRECRAWL_WEB_MIN_INTERVAL_MS` | `1000`                             |
| `EXA_MCP_URL`                 | `https://mcp.exa.ai/mcp`             |
| `EXA_API_KEY`                 | (keyless)                            |
| `WEB_BACKEND_ORDER`           | `firecrawl,exa`                      |
| `WEB_BACKEND_COOLDOWN_MS`     | `60000` (1 min, base cooldown)       |
| `WEB_BACKEND_MAX_COOLDOWN_MS` | `300000` (5 min, circuit-breaker cap) |

The Exa backend uses a minimal MCP Streamable HTTP client (plain `fetch` + SSE
parsing — no `@modelcontextprotocol/sdk` dependency), so the file still requires
no npm install. Each call goes through a global throttle (`MIN_INTERVAL_MS` gap)
to stay within keyless rate limits across all backends.

## Test fixtures

### [`fake-provider.ts`](./fake-provider.ts)

A minimal custom provider that POSTs to a local fake server which always
returns HTTP 400. Used to test that `retry.ts` fires on a real 400. Paired with
the in-process server inside [`retry.test.ts`](./retry.test.ts).

### [`retry.test.ts`](./retry.test.ts)

Integration test for `retry.ts`. Starts an in-process `Bun.serve` that always
returns 400, spawns `pi` with `retry.ts` + `fake-provider.ts`, and asserts the
extension retries without crashing.

```sh
bun test extension/pi/retry.test.ts
RUN_SECS=20 MIN_REQUESTS=4 bun test extension/pi/retry.test.ts
```

### [`firecrawl-web.test.ts`](./firecrawl-web.test.ts)

Unit + integration tests for `firecrawl-web.ts`. Covers SSE parsing, Exa search
result parsing, error classification (rate-limit / network / session), backend
cooldown state machine, circuit-breaker math, `withFailover` failover logic, and
`ExaMcpSession` MCP lifecycle (with mocked `fetch`). No network, no pi process
spawned — runs in ~20 ms.

```sh
bun test extension/pi/firecrawl-web.test.ts
```
