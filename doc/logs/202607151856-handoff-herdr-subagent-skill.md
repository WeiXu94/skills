# Handoff: herdr-subagents — print-mode refactor + docs sync

**Date:** 2026-07-15 18:56
**Status:** Round 4 code (provider dispatch, `pi` default, async/watch) implemented + verified for `c ds`. Two things pending: (1) **print-mode refactor** — stop creating a Herdr pane for print runs; (2) **docs sync** — `SKILL.md` is stale.
**Working dir:** `/Users/weixu/skills/skills/mine/herdr-subagents/`
**Next focus:** Refactor print mode to spawn the agent as a direct subprocess; then update `SKILL.md` + summary log for Round 4.

---

## Goal (unchanged from prior handoffs)

A skill + bun/ts CLI that spawns **visible Herdr panes** running `pi | claude | codex | opencode`, submits tasks, waits, collects report files. Referenced artifacts (do not re-read for history):
- Prior handoff: `doc/logs/202607141914-handoff-herdr-subagent-skill.md` (the 8 original decisions, plan).
- Summary (through Round 2): `doc/logs/202607142007-summary-herdr-subagent-skill.md` (implementation findings, smoke tests).

This handoff covers **Round 4** (provider/c-alias swap, `pi` default, async subagents) and the **print-mode refactor** the user just requested.

---

## What changed in Round 4 (already implemented + tested)

### 1. `c` alias → provider dispatch (claude)
The user's `c` command is a **zsh function** (from the shell snapshot), unavailable in herdr's non-interactive panes. So `claude` can't be launched via `c glm` inside a spawned pane. Reproduced the dispatch in TS:

- **New file `src/claudeProviders.ts`:** `resolveClaudeProvider(provider="glm"): {argv, env}`. Each provider sets `ANTHROPIC_*` env vars (resolved from `process.env` keys: `SCRP_API_KEY`, `DEEPSEEK_API_KEY`, `PACKY_CLAUDE_SALE_API_KEY`, `CLIPROXY_API_KEY`) + model flags. All include `--dangerously-skip-permissions`. Cases:
  - `glm` → `scrp-assistant` / `--effort max`, base `https://scrp-chat.econ.cuhk.edu.hk/api`
  - `official` → plain claude
  - `ds` → `deepseek-v4-pro[1m]`, base `https://api.deepseek.com/anthropic`
  - `packy` → `fable` / `--effort high`, base `https://www.packyapi.com`
  - `gpt` → `gpt-5.6-sol`, base `http://127.0.0.1:8317` (cliproxy)
- **`src/agents.ts`:** `launchArgv(lane): LaunchSpec` now returns `{argv, env}`. `pi` is the default agent (`lane.agent ?? "pi"`). `claude` dispatched through `resolveClaudeProvider`; others use `INTERACTIVE_BASE`/`PRINT_PREFIX` tables (claude removed from those). Print mode inserts `-p` after `claude`.
- **`src/types.ts`:** `agent` made optional; added `ClaudeProvider` type (`"glm"|"official"|"ds"|"packy"|"gpt"`); `provider?`, `async?`, `callbackPane?` on `Lane`; `async?`, `callbackPane?`, `modelCheck?` on `LaneResult`.

### 2. `pi` is the default agent
Omitting `agent` spawns `pi`. Verified: default-agent lane → `success`, report collected, 3.5s.

### 3. Async subagents (return immediately, callback when done)
- **`src/run.ts`:** after task submission, if `lane.async`, calls `spawnAsyncWatcher(...)` and returns immediately with `outcome:"success", reportCollected:false, async:true, agentStatus:"working", callbackPane`. The watcher is a **detached** `bun .../src/cli.ts watch <job-json>` (Bun.spawn, `stdio:"ignore"`, `detached:true`, `proc.unref()`).
- **`src/cli.ts`:** new `watch` subcommand (`cmdWatch`). Parses job JSON, waits (interactive: `waitLane`; print: `fs.statSync` file-poll), collects report+footer, posts a single `HS_ASYNC_RESULT <json>` line to `callbackPane` via `herdr pane run`. Fallback: writes `<reportFile>.async-result.json` if the callback pane is gone.
- `--async` flag added to `popFlags`; threaded into `cmdRunLane`/`cmdRunWave`.

### Round 4 verification (inside Herdr, `HERDR_ENV=1`)
| Test | Result |
|---|---|
| `launchArgv` unit: default→pi, claude/glm→correct argv+env, claude/ds→`--model deepseek-v4-pro[1m]` | ✓ |
| async (pi print, `--async`): returns in 0s, `async:true`, `callbackPane:"wQ:p1"`; watcher posted `HS_ASYNC_RESULT` back to main pane with full result (durationMs:5092, footer parsed) | ✓ |
| default agent (omit `agent`): pi spawned, success, 3455ms | ✓ |
| **claude/ds lane** (print, via skill): `success`, `ok`, footer parsed, 10098ms | ✓ |
| `c ds -p "say ok"` direct: `ok`, exit 0 | ✓ |
| claude/glm lane: timed out at 30s (empty stdout) — **glm is just slow**, not a bug; `c glm -p` also hangs at 25s. Use `ds` for fast tests. | ⚠ known |

---

## ⚠️ Pending: print-mode refactor (the user's current request)

**User instruction (verbatim):** "if in print mode, then no need to create a pane. only create new pane when interactive mode"

**Current (wrong) behavior:** print mode wraps the agent in `sh -c '<argv...> <prompt> > <tempfile>'` and launches it via `herdr agent start` — i.e., it **creates a Herdr pane** just to host a one-shot subprocess. This is pointless (no TUI to see), and the `sh -c` wrapper is the source of the `agent_status`-is-unreliable hacks (file-size polling, auto-close workarounds) documented in the summary.

**Desired behavior:** in print mode, spawn the agent **directly as a subprocess** (`Bun.spawn`) with stdout→temp file, no Herdr pane at all. Only interactive mode (the TUI case) creates a pane via `herdr agent start`.

**Where the change lives:** `src/run.ts`, `runLane()`. The print branch currently (lines ~136-157) builds the `sh -c` argv and calls `agentStart`; then (~208-248) polls the temp file. Refactor to:
1. Print mode: `Bun.spawn` the agent argv directly (`launchArg` + the prompt as the last positional, OR piped to stdin — confirm which each agent wants; `pi -p`/`claude -p` accept the prompt as a positional arg, and also read stdin). Set `env: { ...process.env, ...providerEnv, ...lane.env }`, `cwd`, redirect `stdout` to the temp file, `stderr` to a `.err` file (for diagnostics). `await` the child with the lane timeout; collect exit code + temp file contents.
2. Interactive mode: unchanged — keep the `agentStart` → wait idle → `paneRun` flow.
3. The `pane` field in the print-mode `LaneResult` becomes `""` (no pane). The async watcher's print branch (`cmdWatch`) must match: spawn the subprocess directly too (or, simpler, the async watcher can keep using the temp-file poll since the file is written by the direct subprocess — verify the watcher still works once the pane is gone; `paneGet` for status will fail → `agentStatus:"unknown"`, which is fine).
4. `--close` is already a no-op for print mode (no pane to close); confirm that still holds.

**Constraints to honor during the refactor:**
- The bridge prompt (`prompt.ts`) instructs the agent to write `reportFile` + emit a `RESULT_JSON:` footer. In print mode the footer lands on **stdout** (the temp file), not the report file — `parseFooter` reads from whichever text we collected. Keep reading the temp stdout file for the footer; the report file is the agent's prose output. Verify `c ds` still emits the footer to stdout (it did: `RESULT_JSON: {...}` appeared in the lane's collected transcript).
- `Bun.spawn` + `await` (or poll) with timeout. Use `proc.kill()` on timeout and still read whatever partial output is in the temp file (matches the existing "timed_out + partial return" policy).
- `node:fs.statSync` was used for file-size polling because `Bun.file` caches stat. With a direct subprocess + `await`, you may not need polling at all — just `await` the child, then read the file once. Simplify if possible.
- Keep `HERDR_ENV=1` guard? Print mode with no pane arguably doesn't need Herdr at all. **Decision needed:** whether print mode still requires `HERDR_ENV=1`. Recommend: keep the guard (the skill is herdr-scoped; async callbacks still use `herdr pane run`; and interactive/print share one `runLane`). But the direct subprocess spawn itself doesn't call herdr. Confirm with user if unclear.

---

## Pending: docs sync

`SKILL.md` (last modified 14 Jul 20:30) **predates all Round 4 code**. It does not document:
- `pi` as the default agent (and `agent` being optional).
- `provider` field (claude providers: glm/official/ds/packy/gpt) — the `c`-alias replacement.
- `async` / `callbackPane` fields + `--async` flag.
- The `watch` subcommand + `HS_ASYNC_RESULT` callback contract.
- The print-mode refactor (once done).

The summary log `doc/logs/202607142007-summary-...` also stops at Round 2; append a Round 4 section (provider, pi default, async, print-mode refactor, verification table above) when the refactor lands.

**Also pending (surfaced mid-turn, not yet addressed):** user requested — **"make the herdr-subagents as a git submodule and ignore this submodule to all."** The skill dir is currently **untracked** in the `skills` repo (`git status` shows `?? skills/mine/herdr-subagents/`). The request means: turn `skills/mine/herdr-subagents/` into its **own git repo** and add it back as a **submodule** of the parent `skills` repo. "Ignore this submodule to all" is ambiguous — likely one of: (a) the parent repo should only track the submodule pointer (which submodules do naturally — contents live in the child repo), or (b) add the submodule path to a global/project `.gitignore`-style ignore so other tooling doesn't descend into it. **Clarify with user** before executing: confirm (1) the child repo should be a fresh local repo (no remote yet) vs. pushed to a GitHub remote first, and (2) what "ignore to all" precisely means. This is a hard-to-reverse repo restructure — do it as its own focused step, not bundled with the print-mode refactor. Note: `link-skills` follows symlinks into `~/skills/...`; a submodule should still work since the source dir remains on disk at the same path, but verify the symlinks still resolve after the submodule conversion.

**Also pending (surfaced mid-turn, not yet addressed):** user said "i want the subagent to open to new tab, and one tab with at most two pane, if full, create a new tab then two panes on the tab, and so on" — a **tab-capacity placement policy** (max 2 panes/tab, else new tab). The current `placement` field only does `split-right`/`split-down`/`new-tab`. This is a separate enhancement; not blocking the print-mode refactor. Likely belongs as a new `placement: "auto-tab"` (or a `maxPanesPerTab` option) that queries existing tab pane counts via `herdr tab list`/`pane get` before deciding. Confirm scope with user before building.

---

## File map (current state)

```
skills/mine/herdr-subagents/        # UNTRACKED in git (never committed)
  SKILL.md                          # STALE — predates Round 4, needs sync
  package.json
  bin/herdr-subagent                # bash shim → bun src/cli.ts
  examples/wave.json
  src/
    types.ts            # Lane, LaneResult, ClaudeProvider, async/callbackPane fields
    herdr.ts            # herdr() wrapper, agentStart(ws+tab), tabCreate, pane*, waitForStatus/Output, worktreeCreate
    agents.ts           # launchArgv → {argv, env}; pi default; claude via provider layer
    claudeProviders.ts  # NEW Round 4: resolveClaudeProvider (c-alias dispatch)
    models.ts           # pi model pre-check (extractModelArg, checkPiModel)
    prompt.ts           # bridgePrompt: task + report-writing + RESULT_JSON footer
    report.ts           # readReport, parseFooter, stripFooter
    wait.ts             # waitLane: 200ms poll, done-gate, workingSeen, blocked-grace
    run.ts              # runLane: ← REFACTOR print branch here; async branch + spawnAsyncWatcher
    cli.ts              # spawn|wait|collect|run-lane|run-wave|watch subcommands
```

Linked user-level: `~/.claude/skills/herdr-subagents` + `~/.agents/skills/herdr-subagents` (symlinks via `link-skills -g`).

---

## Suggested next session steps

1. **Refactor print mode in `src/run.ts`** to spawn the agent as a direct `Bun.spawn` subprocess (no Herdr pane). Keep interactive mode unchanged. Verify `c ds` print lane still returns `ok` + footer; verify a timed-out print lane still returns partial output.
2. **Update `cmdWatch`** (print branch) to match — it can either spawn the subprocess directly, or (simpler) keep polling the temp file now written by the direct subprocess. Verify async print still posts `HS_ASYNC_RESULT`.
3. **Sync `SKILL.md`** for Round 4: default `pi`, `provider`, `async`/`callbackPane`, `--async`, `watch` + `HS_ASYNC_RESULT`, print-mode = no pane.
4. **Append Round 4 to the summary log** (`doc/logs/202607142007-summary-...`).
5. (Optional, confirm scope) **Tab-capacity placement policy** (max 2 panes/tab → new tab).
6. Commit when the user asks (skill is currently untracked on a dirty `main`).

---

## Suggested skills

| Skill | Why |
|---|---|
| **herdr** (`/Users/weixu/.agents/skills/herdr/SKILL.md`) | Required for interactive spawn/wait/read + async callback (`herdr pane run`). Only when `HERDR_ENV=1`. Print-mode direct subprocess does NOT need it, but the skill overall does. |
| **grilling** (`/Users/weixu/.claude/skills/grilling/SKILL.md`) | If the print-mode guard question (keep `HERDR_ENV=1`?) or tab-capacity policy needs locking before coding. |
| **writing-great-skills** (`/Users/weixu/.agents/skills/writing-great-skills/`) | When syncing `SKILL.md` structure/triggers/recipes. |
| **handoff** | If session ends mid-refactor. |

---

## Explicit non-goals / constraints

- No exploits, malware, or attacking systems.
- Redact secrets: API keys (`SCRP_API_KEY`, `DEEPSEEK_API_KEY`, `PACKY_CLAUDE_SALE_API_KEY`, `CLIPROXY_API_KEY`) are referenced by env-var name only; never print values.
- Project CLAUDE.md: bun for ts; extensive code comments (file headers + self-explanatory); docs under `doc/logs/YYYYMMDDHHmm-<kind>-<topic>.md`.
- Use `/herdr-subagent` skill (this one) to spawn subagents when needed for full observability.

---

## One-line resume prompt for next agent

> In `skills/mine/herdr-subagents/src/run.ts`, refactor the print-mode branch of `runLane` to spawn the agent as a direct `Bun.spawn` subprocess (no Herdr pane — only interactive mode creates a pane), then sync `SKILL.md` + the summary log for Round 4 (provider dispatch, `pi` default, async/watch). Round 4 code is already in place and verified for `c ds`; `SKILL.md` is stale.
