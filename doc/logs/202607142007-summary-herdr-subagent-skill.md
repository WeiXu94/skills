# Summary: Herdr visible-subagent skill — implemented + smoke-tested

**Date:** 2026-07-14 20:07 (updated 20:30 — placement + model pre-check; **2026-07-15 — Round 4+5**)
**Status:** Complete through Round 5. Print mode no longer creates a pane; SKILL.md synced.
**Working dir:** `/Users/weixu/skills` (skill source) + `/Users/weixu/temp` (logs)
**Prior handoff:** `./docs/logs/202607141914-handoff-herdr-subagent-skill.md`

---

## What was built

A skill + CLI that spawns **visible Herdr panes** running `pi`/`claude`/`codex`/`opencode`, submits tasks, waits for completion, and collects report files.

**Location:** `/Users/weixu/skills/skills/mine/herdr-subagents/`
**Linked:** user-level via `link-skills -g herdr-subagents` → `~/.claude/skills/` + `~/.agents/skills/`

```
herdr-subagents/
  SKILL.md              # trigger conditions, lane contract, recipes, safety
  package.json
  bin/herdr-subagent    # bash shim → bun src/cli.ts
  examples/wave.json    # 3-lane parallel example
  src/
    types.ts            # Lane, LaneResult, outcome/status types (incl. placement, modelCheck)
    herdr.ts            # thin JSON wrapper over herdr CLI (agentStart w/ workspace+tab, tabCreate, paneGet/Read/Run, waitForStatus/Output, worktreeCreate)
    agents.ts           # per-agent launch argv (interactive + print prefixes)
    models.ts           # pi model-availability pre-check (extractModelArg, checkPiModel)
    prompt.ts           # bridgePrompt: task + report-writing + RESULT_JSON footer instruction
    report.ts           # readReport, parseFooter, stripFooter
    wait.ts             # waitLane: 200ms poll, done-gate, workingSeen, blocked-grace
    run.ts              # runLane: model-check → placement → spawn → submit → wait → collect
    cli.ts              # spawn|wait|collect|run-lane|run-wave subcommands
```

## Resolved design (8 decisions, all locked via grilling)

1. **Location:** `skills/mine/` on `main` (dirty tree accepted).
2. **Launch mode:** interactive TUI default + `--mode print` opt-in.
3. **Worktree:** opt-in per lane (`worktree: true | {path,branch,base}`).
4. **Pane lifecycle:** keep open; `--close` for cleanup.
5. **Result contract:** markdown report + optional `RESULT_JSON:` footer (soft schema).
6. **Orchestrator:** any Herdr agent.
7. **Args:** single `--args` string (shell-split).
8. **Timeout:** mark `timed_out`, leave pane open, collect partial, return it. Wave = `Promise.allSettled`.

## Key implementation findings (non-obvious, discovered during smoke testing)

1. **`herdr agent start`** is the clean spawn primitive — atomically creates pane + labels + launches agent, returns `result.agent.pane_id`. Better than `pane split` + `pane run`.

2. **agent_status is unreliable behind `sh -c`** (print mode): herdr reports `idle` while the wrapped agent is still running. Fix: in print mode, **poll the temp stdout file's size** via `fs.statSync`; non-empty = done. (Bun.file caches stat, so must use node:fs.)

3. **Print-mode panes auto-close** when the command exits. A sentinel `echo` + `herdr wait output` does NOT work (pane closes before the wait matches). The file-poll in (2) sidesteps this entirely.

4. **Interactive agents report `idle` at their initial prompt** before any task runs. A naive "wait for idle/done" returns false success. Fix: two-gate wait — `done` alone = success (unambiguous, only after working→done); `idle` = success only if `working` was seen first.

5. **200ms poll interval** is required. A 1s poll steps over fast working→done transitions (pi/grok can complete a trivial task in ~3s, with a ~2s working window). Confirmed by rapid-polling: `idle → working(~2s) → done(~5s) → idle`.

6. **2s settle delay after idle, before submitting.** Agents (pi especially) report `idle` slightly before their input box is fully live (during banner/package-notice render). Submitting in that window loses the keystrokes — the prompt appears in the transcript but the agent never processes it.

7. **`Bun.$` chaining:** `.quiet().timeout(ms)` is not a valid chain — `.timeout()` isn't a method. Used `Promise.race` with a `setTimeout` reject for the outer herdr() timeout instead.

8. **`BunFile.textSync()` doesn't exist** — only async `.text()`. Made `readReport`/`readTask`/`bridgePrompt`/`readJsonArg` async. (Initial lazy fix used `node:fs.readFileSync`; corrected to Bun's async API per user feedback. `node:fs.statSync` is still used for the print-mode file-size poll — Bun.file caches stat, so a fresh `statSync` is needed to see size changes.)

## Round 2 additions (placement + model pre-check)

**Pane placement (`lane.placement`):** default `split-right` — same workspace + same tab as the caller, split to the right (the pane appears beside the orchestrator). `split-down` splits downward in the same tab. `new-tab` creates a fresh tab via `herdr tab create` in the caller's workspace, then targets it. Implementation: `agentStart` now takes `--workspace` + `--tab` (pinned to the caller's tab by default); `tabCreate` helper added. Ignored when `lane.pane` (reuse) is set.

**Pi model pre-check (`src/models.ts`):** before spawning a `pi` lane, extract `--model <value>` from `args` and run `pi --list-models <value>`. Classify: `ok` (exactly 1 match), `ambiguous` (≥2 — suggest `provider/id`), `not-found` (0), `no-model` (no `--model`), `skipped` (`pi --list-models` failed, best-effort). Bad/ambiguous models **fail fast before any pane is spawned**. Result surfaced in `LaneResult.modelCheck`. Handles `provider/id:thinking` specs (strips the `:thinking` suffix). `pi --list-models` does fuzzy substring matching (not globs) — the parser filters "No models matching" rows by requiring a numeric context column.

9. **`pi --list-models` does NOT support globs** — only fuzzy substring matching on the search term. (Globs are for the `--models` Ctrl+P cycling flag, a different feature.) Initial code special-cased globs; dropped after testing.

## Smoke tests (all inside Herdr, HERDR_ENV=1)

| Test | Mode | Agent | Outcome | Notes |
|---|---|---|---|---|
| `collect` primitive | — | — | ✓ | footer parsed from synthetic report |
| `run-lane` | print | pi | ✓ | footer captured, 7.3s |
| `run-lane` | interactive | pi | ✓ | report written, 9.6s (after settle delay fix) |
| `run-wave` (2 lanes) | mixed | pi | ✓ | both succeeded concurrently (~8.6s wall) |
| HERDR_ENV guard | — | — | ✓ | exits 2 when env unset |
| placement `split-right` (default) | print | pi | ✓ | pane in same tab as caller (`wQ:t1`) |
| placement `new-tab` | print | pi | ✓ | pane in new tab (`wQ:t4` ≠ caller `wQ:t1`) |
| model check: valid `opencode/grok-4.5` | — | pi | ✓ | status ok, 1 match, lane runs |
| model check: valid `xai-oauth/grok-4.5` | print | pi | ✓ | status ok, success, 4.5s |
| model check: ambiguous `grok-4.5` | — | pi | ✓ | fails fast, exit 2, no pane spawned |
| model check: ambiguous `claude-sonnet-5` | — | pi | ✓ | 4 matches, suggests provider/id |
| model check: not-found `nonexistent-xyz` | — | pi | ✓ | fails fast, exit 2, no pane spawned |

Not tested: `codex`/`opencode` agents (binaries present but not exercised), `claude` interactive (login expired in this session — environment issue, not skill bug), worktree lanes, `--close`, `split-down`.

Note: `opencode/grok-4.5` resolves in the model check but the lane timed out when actually run — the `opencode` provider returns a 401 CreditsError ("No payment method"). That's a billing issue, not a skill bug; the model name was correct. The default pi model (grok-4.5 via `xai-oauth`) works.

## Follow-ups / known gaps

- **`spawn` subcommand** currently runs the full lane (v1 simplification). A truly non-blocking spawn-without-wait is a v2 concern.
- **opencode print mode** has no stable `-p` flag documented; falls back to bare `opencode` (print mode is opt-in anyway).
- **`--close` on print-mode panes** is a no-op (they auto-close); only affects interactive panes.
- **Footer emission** is aspirational in interactive mode (pi didn't emit it); print mode (pi -p) did emit it reliably. Status is always derivable from `outcome`/`agentStatus` regardless.
- **Worktree lanes** implemented but not smoke-tested (no git repo collision scenario run).

## Files touched (Rounds 1–2)

- New: `skills/mine/herdr-subagents/` (full skill, 9 source files + SKILL.md + example)
- Linked: `~/.claude/skills/herdr-subagents`, `~/.agents/skills/herdr-subagents` (symlinks)
- This summary: `./docs/logs/202607142007-summary-herdr-subagent-skill.md`
- Not committed (skills repo `main` is dirty with unrelated work; user can commit when ready).

---

## Round 4 (2026-07-15) — provider dispatch, `pi` default, async

### What landed

1. **`c` alias → provider dispatch for claude** (`src/claudeProviders.ts`). The user's `c` zsh function is unavailable in herdr's non-interactive panes / direct subprocesses, so the skill reimplements it: `resolveClaudeProvider(provider)` → `{argv, env}` with `ANTHROPIC_*` vars + model flags. Providers: `glm` (default) | `official` | `ds` | `packy` | `gpt`.
2. **`pi` is the default agent.** `lane.agent` is optional (`agent?: AgentName`); omit → `pi`.
3. **Async subagents.** `lane.async` / `--async` returns immediately with `{async:true, reportCollected:false}`. A detached `bun ... watch <job>` process waits, then posts `HS_ASYNC_RESULT <json>` to `callbackPane` via `herdr pane run`. Fallback: `<reportFile>.async-result.json`.
4. **`launchArgv` now returns `{argv, env}`** so claude provider env is threaded into both `agentStart` (interactive) and `Bun.spawn` (print).

### Round 4 verification

| Test | Result |
|---|---|
| `launchArgv` unit: default→pi, claude/glm env, claude/ds model | ✓ |
| async pi print: returns in 0s, watcher posts `HS_ASYNC_RESULT` | ✓ |
| default agent (omit `agent`): pi success | ✓ |
| claude/ds print: success + footer | ✓ |
| claude/glm: slow (not a bug; use `ds` for fast tests) | ⚠ known |

---

## Round 5 (2026-07-15) — print-mode refactor (no pane) + docs sync

### User request

> if in print mode, then no need to create a pane. only create new pane when interactive mode

### What changed

**Before (wrong):** print mode wrapped the agent in `sh -c '<argv...> <prompt> > <tempfile>'` and launched it via `herdr agent start` — creating a Herdr pane just to host a one-shot subprocess. This was the source of the `agent_status`-is-unreliable hacks (file-size polling, auto-close workarounds).

**After:**
- **Print:** `Bun.spawn([...argv, prompt], {stdout: tempFile, stderr: .err, env, cwd})` — direct subprocess, **no pane**. `LaneResult.pane = ""`. Await with timeout; `proc.kill()` on timeout; still return partial stdout.
- **Interactive:** unchanged — `herdr agent start` → wait idle → settle 2s → `pane run`.
- **Async print:** the detached watcher **owns** the subprocess (spawns + awaits + collects + posts callback). Job payload is a discriminated `WatchJob` (`kind: "print" | "interactive"`).
- **`--close`:** already a no-op for print (pane is `""`); confirmed.
- **`HERDR_ENV=1`:** still required for print mode (skill is herdr-scoped; async callbacks still use `herdr pane run`; interactive/print share one `runLane`).

### Files touched (Round 5)

- `src/run.ts` — split into `runPrintLane` / `runInteractiveLane`; new exported `spawnAndCollectPrint`; `WatchJob` type; removed `printOutFiles` map + `sh -c` wrapper + file-size poll.
- `src/cli.ts` — `cmdWatch` branches on `job.kind`; print path calls `spawnAndCollectPrint`; `--close` skips empty pane ids.
- `src/types.ts` — docs for print-mode pane=`""`, mode field comment.
- `src/agents.ts` — header/docs updated (print = direct spawn, prompt appended by run.ts).
- `SKILL.md` — full rewrite for Round 4+5 (default pi, provider, async/HS_ASYNC_RESULT, print = no pane).

### Round 5 verification (inside Herdr, `HERDR_ENV=1`)

| Test | Result |
|---|---|
| `launchArgv` unit: default→pi, print pi, print claude/ds | ✓ |
| print pi sync: `pane:""`, `outcome:success`, footer parsed, ~4.4s | ✓ |
| print claude/ds sync: `pane:""`, footer `ok`, ~6.2s | ✓ |
| async print pi: returns in 0s (`async:true`, `pane:""`); watcher posted `HS_ASYNC_RESULT` to `wQ:pX` with footer, ~3.3s | ✓ |
| print timeout: `spawnAndCollectPrint` with `sleep 10` + 1.5s timeout → `timed_out`, partial stdout `partial-before-sleep` kept | ✓ |

### Still pending (not blocking)

- Commit when the user asks (skill still untracked on a dirty `main`).

---

## Round 6 (2026-07-15) — `auto-tab` placement (max 2 panes/tab)

### User request

> i want the subagent to open to new tab, and one tab with at most two pane, if full, create a new tab then two panes on the tab, and so on

### What landed

- **`placement: "auto-tab"` is the new interactive default** (was `split-right`).
- **`maxPanesPerTab`** (default **2**) on `Lane`.
- **Worker tabs only:** labeled `hs:<lane>` so packing never touches the caller's tab or the user's other tabs.
- **Root-pane reuse:** first agent on a new worker tab launches via `pane run` into the tab's root shell (no wasted empty pane). Second agent `agent start --split`s into the same tab → exactly 2 panes = 2 agents.
- **In-process placement lock** so concurrent `run-wave` lanes don't overfill a tab.
- **Unique agent names** (`label-<base36>`) to avoid herdr `agent_name_taken` across runs.

### Files

- `src/herdr.ts` — `tabList`, `tabGet`
- `src/types.ts` — `placement` includes `auto-tab` (default docs); `maxPanesPerTab`
- `src/run.ts` — `resolvePlacement`, `launchInExistingPane`, `withPlacementLock`, `spawnInteractivePane`
- `SKILL.md` — Placement policy section

### Verification (3-lane interactive async wave)

| Check | Result |
|---|---|
| Worker tabs only (`hs:…`), caller untouched | ✓ |
| Counts `2 + 1` under max=2 | ✓ |
| No tab with `pane_count > 2` | ✓ |
| All 3 lanes `outcome:success` after unique-name fix | ✓ |
