# Summary: herdr-subagents Claude Code parent plugin

**Date:** 2026-07-15 21:06  
**Repo:** `skills/mine/herdr-subagents`  
**Status:** Implemented under `extensions/claude/`. Not committed / not npm-published.

## What shipped

Claude Code **parent** plugin mirroring `extensions/pi` control flow:

| Piece | Path |
| --- | --- |
| Manifest | `extensions/claude/.claude-plugin/plugin.json` |
| MCP config | `extensions/claude/.mcp.json` (stdio via `tsx server.ts`) |
| Server | `extensions/claude/server.ts` |
| Skill | `extensions/claude/skills/herdr-subagents/SKILL.md` |
| Docs | `extensions/claude/README.md` + package README/SKILL/AGENTS |

Tools (same short names as pi):

- `herdr_subagent_run`
- `herdr_subagent_wait`
- `herdr_subagent_wave`

Full Claude names: `mcp__plugin_herdr-subagents_herdr-subagents__herdr_subagent_*`

## Research conclusion (important)

User linked [Agent SDK custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools) (`tool()` + `createSdkMcpServer`). That API is for **embedding** Claude via `query()` in your own process.

Claude **Code** (CLI/TUI parent) loads parent tools from **plugins → `.mcp.json` stdio MCP servers** (see plugins + MCP docs, telegram/fakechat channel plugins as templates). Implemented that shape.

## Behavior vs pi

| | pi | claude |
| --- | --- | --- |
| Registration | `pi.registerTool` in-process | stdio MCP process |
| Library | `import herdr-subagents` | same (in MCP process) |
| Sync result | tool result text | MCP tool_result text |
| Async finish | auto `sendMessage` follow-up **or** wait | **wait only** (no follow-up inject) |
| Transport | file default | file default |

## Install

```bash
cd herdr-subagents
npm install && npm run build
cd extensions/claude && npm install && cd ../..
claude --plugin-dir "$PWD/extensions/claude"
# or: ln -sfn "$PWD/extensions/claude" ~/.claude/skills/herdr-subagents-plugin
```

## Smoke verified

- `claude plugin validate extensions/claude` → pass
- MCP `tools/list` → three tools
- `herdr_subagent_run` without `HERDR_ENV` → `isError: true` + clear message

## Non-goals (still)

- npm publish
- OpenCode plugin
- Marketplace packaging (`file:../..` works for `--plugin-dir` / skills-dir only)
- Auto follow-up into Claude session (no harness API)

## Next optional steps

1. Live session smoke inside Herdr: `claude --plugin-dir …` → `/mcp` → print lane with `provider: ds`.
2. Commit on herdr-subagents `main` when user wants.
3. OpenCode plugin after Claude is stable.
