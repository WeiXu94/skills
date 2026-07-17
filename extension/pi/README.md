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

Exposes two web tools mirroring Claude Code's WebSearch / WebFetch:

- `websearch` — web search via Firecrawl `POST /v2/search` (ranked results)
- `webfetch` — fetch one URL via Firecrawl `POST /v2/scrape` (clean markdown)

Keyless by default (~1,000 free credits/mo per IP); set `FIRECRAWL_API_KEY` for
higher limits. Searches are serialized with a throttle gap to stay within
keyless limits.

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
