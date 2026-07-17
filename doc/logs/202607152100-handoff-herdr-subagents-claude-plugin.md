# Handoff: herdr-subagents — implement Claude Code plugin

**Date:** 2026-07-15 21:00  
**Status:** Package is npm-ready (Node, in-process pi extension). **Next focus: Claude Code plugin** mirroring `extensions/pi`.  
**Working dir:** `/Users/weixu/skills/skills/mine/herdr-subagents/`  
**Repo:** https://github.com/WeiXu94/herdr-subagents (`main` @ `ca44834`, private). Submodule of `skills` with `ignore=all`.  
**Do not publish to npm** unless user asks.

---

## Goal for next session

Implement **`extensions/claude/`** (or Claude Code’s equivalent plugin layout) so a Claude parent can:

1. Call tools like `herdr_subagent_run` / `wait` / `wave` (names TBD to match Claude conventions).
2. Get results as **native tool results**, not fake user messages via `herdr pane run`.
3. Use **in-process** `import { runLane, … } from "herdr-subagents"` (same as pi) — no `bun` CLI prefix.

Claude is currently a **worker agent** (`src/agents/claude.ts` + providers). It is **not** yet a **parent orchestrator plugin**.

---

## Two product surfaces (locked)

| Surface | How | Status |
|---|---|---|
| **1. CLI + `SKILL.md`** | Any agent shells `herdr-subagent …` | Done |
| **2. Harness plugins** | Parent tools → in-process library | **pi done; claude TODO; opencode TODO** |

Same core: `agents/` + `herdr/` + `delivery/` + `core/`.

---

## Architecture (do not re-litigate)

```
extensions/     parent plugins (pi done; claude next)
delivery/       transport only: file | user-msg
core/           run / cli / wait / report / prompt / types / models
agents/         worker launchers (pi|claude|codex|opencode)
herdr/          pane/tab middleware — only place that shells to `herdr`
```

**Invariants** (see `AGENTS.md`):

- Never call `herdr` outside `src/herdr/`.
- Print mode = direct subprocess, no pane; `pi -p` includes **`-ne`** (no extensions) so parent plugin load failures don’t kill workers.
- Async default transport = **`file`** (sidecar + drop dir). `user-msg` is legacy.
- Tool results = plain text in `content[].text` (`formatLaneResultForModel`) — not JSON-as-envelope for the model body.
- Claude **worker** providers (`provider: glm|ds|…`) reimplement the user’s `c` zsh function — children never see shell functions; only env + argv.

---

## What exists (read these, don’t rediscover)

| Path | Why |
|---|---|
| `AGENTS.md` | Layer map, edit map, done-when |
| `README.md` | Install/build/link (no publish) |
| `SKILL.md` | User-facing skill contract |
| `src/index.ts` | Public API for plugins |
| `extensions/pi/index.ts` | **Template** for Claude plugin: async factory, tools, pending map, file-poll wait, `sendMessage` follow-up pattern |
| `src/agents/claude.ts` | Worker launch + `resolveClaudeProvider` (not the parent plugin) |
| `src/delivery/` | `file` / `user-msg` only |
| Prior handoffs | `doc/logs/202607151856-handoff-…`, `202607142007-summary-…` |

**Pi extension pattern to copy:**

- Load API: package name → `dist/index.js` → `src/index.ts` (see `loadPackageApi` in `extensions/pi/index.ts`).
- Tools: run (sync/async), wait (poll sidecar/drop), wave (`Promise.allSettled` + `runLane`).
- Unawaited async: poll drop; on settle deliver as harness-native follow-up (pi: `pi.sendMessage` followUp). Claude needs the **Claude-native equivalent**.
- Install: **directory** symlink preferred:  
  `ln -sfn $PWD/extensions/pi ~/.pi/agent/extensions/herdr-subagents`  
  (file symlink broke package resolution).

**Library entry points plugins should use:**

```ts
import {
  runLane,
  formatLaneResultForModel,
  formatSpawnAck,
  isInsideHerdr,
  dropDir,
  DEFAULT_DELIVERY,
  type Lane,
  type LaneResult,
} from "herdr-subagents";
```

---

## Claude plugin — design checklist

### Research first (before coding)

1. **Where Claude Code plugins live** on this machine (hooks, MCP, plugin dirs, `~/.claude`, settings). Check current Claude Code docs / local install — do not invent from memory only.
2. **How custom tools are registered** for Claude Code (plugin SDK, hooks, MCP server, or skill-only). Prefer a path that yields real **tool_result** blocks to the model.
3. **Follow-up / unawaited async**: pi uses `sendMessage({ deliverAs: "followUp", triggerTurn: true })`. Find Claude’s equivalent (or fall back to wait-only + file until one exists).
4. **Reference:** [davis7dotsh/my-pi-setup extensions/subagents](https://github.com/davis7dotsh/my-pi-setup/tree/main/extensions/subagents) is pi-centric; for Claude they use Agent SDK. May or may not map 1:1 to Claude Code *parent* plugins.

### Implementation sketch (after research)

```
extensions/claude/
  index.ts or plugin entry (match Claude layout)
  package.json   # "herdr-subagents": "file:../.."
  README snippet in package README
```

- Reuse `runLane` in-process; **do not** spawn `herdr-subagent` CLI.
- Default async `delivery: "file"`; poll `reportFile.async-result.json` + `dropDir()`.
- Guard `isInsideHerdr()` / `HERDR_ENV=1`.
- Tool naming: align with Claude conventions if they differ from `herdr_subagent_*`.
- Install instructions: mirror pi (directory/plugin register, not broken single-file symlink if resolution is cwd-based).

### Explicit non-goals this session

- npm publish  
- OpenCode plugin (after Claude unless user says otherwise)  
- Changing worker `c`/provider dispatch  
- Reintroducing `delivery: "claude"` as a transport (transport stays `file` \| `user-msg`; plugin is not a transport)

---

## Local build / run (already working)

```bash
cd /Users/weixu/skills/skills/mine/herdr-subagents
npm install && npm run build
./bin/herdr-subagent --help          # node, no bun prefix
npm run test:smoke
# print lane smoke (needs HERDR_ENV=1):
./bin/herdr-subagent run-lane --mode print '{"name":"t","task":"say ok","reportFile":"/tmp/t.md"}'
```

Worker claude still: `agent: "claude", provider: "ds"` (fast) vs `glm` (slow).

---

## Suggested skills

| Skill | Why |
|---|---|
| **herdr** (`~/.agents/skills/herdr/SKILL.md`) | Interactive spawn/wait; only with `HERDR_ENV=1` |
| **writing-great-skills** | If Claude path is skill/hooks docs in `SKILL.md` rather than only a plugin |
| **fetch-fallback** | Claude Code plugin docs on GitHub if WebFetch fails |
| **handoff** | If session ends mid-plugin |

---

## Suggested next steps (ordered)

1. Discover Claude Code parent-tool/plugin mechanism on this machine + current docs.  
2. Scaffold `extensions/claude/` copying control flow from `extensions/pi/index.ts`.  
3. Wire tools → `runLane` / wait-on-file; smoke inside Herdr with `agent: "pi"` or `claude`/`ds` print child.  
4. Document install in `README.md` + short `SKILL.md` note (plugin vs CLI).  
5. Commit on herdr-subagents `main` only when user wants; do not bump parent skills pin unless asked (`ignore=all`).

---

## One-line resume prompt

> In `skills/mine/herdr-subagents`, implement a **Claude Code parent plugin** under `extensions/claude/` that in-process-imports `herdr-subagents` (`runLane`, file async delivery) like `extensions/pi`; research Claude’s tool-registration API first; do not publish npm; package already Node-ready at `ca44834`.
