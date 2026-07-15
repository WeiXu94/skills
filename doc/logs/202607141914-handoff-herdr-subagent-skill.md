# Handoff: Herdr visible-subagent skill + bun/ts scripts

**Date:** 2026-07-14 19:14  
**Status:** Plan drafted; implementation not started. Open design questions unanswered.  
**Working dir:** `/Users/weixu/temp`  
**Next focus:** Lock open decisions with user, then implement skill + scripts.

---

## Goal

Build a reusable **skill + bun/ts CLI** so an orchestrator can spawn **visible Herdr panes** running `pi | claude | codex | opencode`, pass agent-specific args, wait for completion, collect **report files**, and return structured results.

Inspiration: [@oscabriel/status/2076783677552652456](https://x.com/oscabriel/status/2076783677552652456) — “Fable” (Claude Code) launches parallel lanes; each subagent is a Herdr pane running interactive `pi` in a worktree; workers write reports; orchestrator reviews.

Screenshot path from conversation (may be ephemeral):  
`/var/folders/bm/3w1vxrv56db0ghc2_zbtwc9m0000gn/T/pi-clipboard-a5ded037-3a3c-494c-bd93-787e2b4a0d4c.png`

---

## What we already know (do not re-research from scratch)

### Visibility vs `-p`
- `pi -p` / `--print` = non-interactive one-shot; can stream text in a pane, **no full TUI**.
- Full visibility (tweet style) = **interactive** `pi` (no `-p`) in a Herdr pane.
- Interactive launch example:
  ```bash
  herdr pane run <pane> 'pi --model openai-codex/gpt-5.6-sol:low --no-session'
  herdr wait agent-status <pane> --status idle --timeout 30000
  herdr pane run <pane> '<task prompt>'
  ```

### How to retrieve TUI results
Interactive TUI does **not** return a function value. Reliable pattern:
1. Bridge prompt forces write to fixed `reportFile` (+ optional `RESULT_JSON:` footer).
2. Wait `done` (background) or `idle` (seen/focused) — treat either as finished.
3. Primary: read report file.
4. Fallback: `herdr pane read` / `herdr agent read --source recent-unwrapped`.
5. Optional: session export only if not `--no-session`.

### Herdr control surface (relevant)
- Guard: only control Herdr when `HERDR_ENV=1` (see herdr skill).
- Useful commands: `herdr pane split|run|read|get|rename`, `herdr wait agent-status|output`, `herdr agent start|get|read|wait`, `herdr worktree create|open`.
- Prefer `--no-focus` for background workers.
- Parse JSON IDs; never invent pane IDs.
- `idle` vs `done`: same finished semantic; `done` = result not yet seen.

### Existing skills / tools
- Herdr skill: `/Users/weixu/.agents/skills/herdr/SKILL.md`
- Skill authoring notes: `/Users/weixu/.agents/skills/writing-great-skills/`
- Project prefs: bun for js/ts; extensive code comments; docs under `./docs/logs/YYYYMMDDHHmm-<kind>-<topic>.md`

---

## Plan snapshot (not yet implemented)

### Proposed layout
```text
~/.agents/skills/herdr-subagents/   # location still TBD
  SKILL.md
  scripts/
    package.json
    src/
      cli.ts          # spawn | wait | collect | run-lane | run-wave
      herdr.ts        # thin JSON wrapper over herdr CLI
      agents.ts       # launch argv per agent
      wait.ts
      report.ts
      types.ts
      prompt.ts       # bridge prompt template
    bin/herdr-subagent
  examples/wave.json
```

### Lane shape (draft)
```ts
type Lane = {
  name: string
  agent: 'pi' | 'claude' | 'codex' | 'opencode'
  args?: string | string[]
  cwd?: string
  worktree?: { path?: string; branch?: string; base?: string } | boolean
  taskFile?: string
  task?: string
  reportFile: string
  pane?: string
  split?: 'right' | 'down'
  label?: string
  timeoutMs?: number
  env?: Record<string, string>
}
```

### Runtime flow (draft)
1. Guard `HERDR_ENV=1`
2. Optional worktree create/open
3. Resolve pane (reuse or split+rename, no-focus)
4. Launch interactive agent binary + args
5. Wait idle → submit bridge prompt
6. Wait done|idle
7. Collect report file → transcript fallback
8. Return structured JSON; wave mode = Promise.all lanes

### v1 out of scope
- Claude Code `parallel()` / Fable-specific bridge
- Auto-merge / multi-agent debate
- `pi -p` mode (maybe later as `--mode print`)

---

## Open decisions (must resolve before coding)

User has **not** answered these yet:

1. **Install location** — global `~/.agents/skills/herdr-subagents` vs prototype under `/Users/weixu/temp` first?
2. **Launch mode** — interactive TUI only, or also print/`-p` flag?
3. **Worktree default** — always isolate, opt-in only, or cwd-only v1?
4. **Pane lifecycle** — keep open after done vs auto-close?
5. **Result contract** — freeform markdown only vs required JSON schema?
6. **Orchestrator audience** — any Herdr agent, or mainly pi orchestrating siblings?
7. **Args UX** — single `--args '...'` string vs JSON array / repeated flags?
8. **Timeout/blocked policy** — fail lane, kill pane, or partial return?

Recommended defaults if user is indifferent (not confirmed):
1. Prototype in `/Users/weixu/temp`, promote to `~/.agents/skills` when stable  
2. Interactive only in v1; optional print later  
3. Worktree opt-in  
4. Keep panes open  
5. Require markdown report + optional JSON footer; soft schema  
6. Any Herdr agent  
7. `--args` string + optional repeated `--arg`  
8. Timeout → mark failed, leave pane open, return partial transcript

---

## Conversation conclusions worth preserving

- Fable pattern: declarative `LANES[]` with `lane`, `pane`, `worktree`, `level`, `taskFile`/`reportFile`; parallel spawn; bridge prompt; sanity-check panes via `herdr agent get`.
- Full visibility is the product: right-column stacked panes, sidebar agent status, center orchestrator.
- Do **not** use `-p` if the goal is tweet-style TUI panes.
- Report files > transcript scraping for reliability.

---

## Files / artifacts

| Artifact | Path / URL | Notes |
|---|---|---|
| This handoff | `./docs/logs/202607141914-handoff-herdr-subagent-skill.md` | Current |
| Prior herdr design dump | `./docs/logs/202607061535-empty-herdr-design-system.md` | Unrelated/empty prior log; do not assume relevance |
| Tweet source | https://x.com/oscabriel/status/2076783677552652456 | Video demo of workflow |
| Herdr skill | `/Users/weixu/.agents/skills/herdr/SKILL.md` | Control API bible |
| Implementation code | — | **None yet** |

---

## Suggested next session steps

1. Invoke **grilling** (or just resolve the 8 open questions) — do not implement until location/result contract/lifecycle are locked.
2. Scaffold skill + bun package per decided location.
3. Implement primitives: `herdr.ts` wrapper → spawn/wait/collect → `run-lane` → `run-wave`.
4. Write `SKILL.md` with trigger conditions + recipes; cross-link herdr skill.
5. Smoke test only inside Herdr (`HERDR_ENV=1`): one pi lane, report file round-trip.
6. Log summary to `./docs/logs/YYYYMMDDHHmm-summary-herdr-subagent-skill.md` when done.

---

## Suggested skills

| Skill | Why |
|---|---|
| **herdr** (`/Users/weixu/.agents/skills/herdr/SKILL.md`) | Required for any real spawn/wait/read against panes; only when `HERDR_ENV=1`. |
| **grilling** (`/Users/weixu/.agents/skills/grilling/SKILL.md`) | Stress-test remaining product decisions one-by-one before coding. |
| **writing-great-skills** (`/Users/weixu/.agents/skills/writing-great-skills/`) | When authoring `SKILL.md` structure/triggers/safety. |
| **handoff** | If session ends mid-implementation, re-handoff with code paths + remaining gaps. |

Do **not** use herdr skill merely because parallelism is useful — only when controlling Herdr panes/workspaces.

---

## Explicit non-goals / constraints

- No exploits, malware, or attacking systems.
- Redact secrets if any appear in future logs (none in this conversation).
- Project AGENTS: bun for ts; extensive comments; temp dir is scratch-friendly.

---

## One-line resume prompt for next agent

> Continue herdr visible-subagent skill: plan is in this handoff; resolve the 8 open decisions with the user (or use recommended defaults if they approve), then implement bun/ts CLI + SKILL.md for spawn/wait/collect of pi/claude/codex/opencode in Herdr panes with report-file results.
