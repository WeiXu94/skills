# skills

A personal collection of skills for AI coding agents (primarily Claude Code, but format is portable to pi-coding-agent, Codex CLI, Amp, Droid). Two flavors:

- **Econ research skills** — domain knowledge, workflows, and references for economics work (paper writing, model estimation, literature review, micro-survey catalogs, ideation).
- **CLI tool skills** — small command-line wrappers the agent can invoke directly, instead of running a long-lived MCP server.

## Philosophy: CLI over MCP

Inspired by [Mario Zechner](https://github.com/badlogic): give the agent a thin shell/Python CLI and let it compose tools the way a human would in a terminal. Easy to use, easy to self-customize, no daemon to babysit.

- [What if you don't need MCP?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp)
- [The pi coding agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent)

## Available skills

### Econ research

| Skill | Description |
|-------|-------------|
| [china-micro-surveys](china-micro-surveys/SKILL.md) | Catalog and metadata for Chinese micro survey datasets (CFPS, CHFS, CHARLS, etc.). |
| [econ-paper-writing](econ-paper-writing/SKILL.md) | Section-by-section guidance for drafting/polishing economics papers. |
| [economics-model](economics-model/SKILL.md) | Reference notes on widely used economic models. |
| [lit-review-assistant](lit-review-assistant/SKILL.md) | Templates for structuring literature reviews and finding gaps. |
| [matlab-econ-model-estimator](matlab-econ-model-estimator/SKILL.md) | Parameter estimation for econ models in MATLAB. |
| [research-ideation](research-ideation/SKILL.md) | Frameworks for going from phenomena to testable hypotheses. |

### Custom CLI tools (mine)

| Skill | Description |
|-------|-------------|
| [netnewswire-cli](netnewswire-cli/SKILL.md) | Read/search/manage NetNewsWire (macOS RSS reader) via AppleScript + bash. Idea adapted from [netnewswire-mcp](https://github.com/jellllly420/netnewswire-mcp); reimplemented as a shell skill so no MCP server is needed. |
| [zotero-cli](zotero-cli/SKILL.md) | `zot` — a two-command Python CLI for keyword + semantic search over a local Zotero library. Wraps the [`zotero-mcp`](https://github.com/54yyyu/zotero-mcp) ChromaDB index (delegates `update-db` to the upstream package). See also [PiaoyangGuohai1/cli-anything-zotero](https://github.com/PiaoyangGuohai1/cli-anything-zotero) for a fuller-featured Zotero CLI. |

### Upstream pi-skills

Pulled in (or symlinked) from [badlogic/pi-skills](https://github.com/badlogic/pi-skills):

| Skill | Description |
|-------|-------------|
| [brave-search](brave-search/SKILL.md) | Web search and content extraction via Brave Search. |
| [browser-tools](browser-tools/SKILL.md) | Interactive browser automation via Chrome DevTools Protocol. |
| [gccli](gccli/SKILL.md) | Google Calendar CLI for events and availability. |
| [gdcli](gdcli/SKILL.md) | Google Drive CLI for file management and sharing. |
| [gmcli](gmcli/SKILL.md) | Gmail CLI for email, drafts, and labels. |
| [transcribe](transcribe/SKILL.md) | Speech-to-text via Groq Whisper API. |
| [vscode](vscode/SKILL.md) | VS Code integration for diffs and file comparison. |
| [youtube-transcript](youtube-transcript/SKILL.md) | Fetch YouTube video transcripts. |

### Misc

| Skill | Description |
|-------|-------------|
| [karpathy-guidelines](karpathy-guidelines/SKILL.md) | Behavioral guidelines to reduce common LLM coding mistakes. |

## Installing as Claude Code skills

Claude Code only looks one level deep for `SKILL.md`, so each skill folder must sit directly under the skills directory. Symlink the ones you want:

```bash
# User-level
mkdir -p ~/.claude/skills
for s in netnewswire-cli zotero-cli econ-paper-writing lit-review-assistant \
         research-ideation china-micro-surveys economics-model \
         matlab-econ-model-estimator karpathy-guidelines \
         brave-search browser-tools gccli gdcli gmcli \
         transcribe vscode youtube-transcript; do
  ln -s "$(pwd)/$s" "$HOME/.claude/skills/$s"
done
```

Or copy individual folders into `~/.claude/skills/` if you prefer not to symlink.

## Skill format

Each skill is a folder with a `SKILL.md` that starts with frontmatter:

```markdown
---
name: skill-name
description: One-line description shown to the agent so it knows when to load this skill.
---

# Instructions
...
```

Helper scripts live alongside `SKILL.md` (e.g. `scripts/`, `references/`).

## Requirements

Per-skill setup notes:

- **netnewswire-cli** — macOS + NetNewsWire installed; uses AppleScript + bash, no extra deps.
- **zotero-cli** — Python 3.10+, `zotero-mcp-server` installed in the same interpreter, Zotero desktop running with the local API enabled. See [`zotero-cli/README.md`](zotero-cli/README.md) for setup.
- **brave-search**, **browser-tools**, **youtube-transcript** — Node.js + `npm install` in the skill directory.
- **gccli / gdcli / gmcli** — `npm install -g @mariozechner/{gccli,gdcli,gmcli}`.
- **transcribe** — `curl` + a Groq API key.
- **vscode** — VS Code with the `code` CLI on PATH.
- **matlab-econ-model-estimator** — MATLAB.

## Credits

- Mario Zechner ([@badlogic](https://github.com/badlogic)) for the pi-skills format and the CLI-over-MCP philosophy.
- [jellllly420/netnewswire-mcp](https://github.com/jellllly420/netnewswire-mcp) for the original NetNewsWire-via-AppleScript idea.
- [54yyyu/zotero-mcp](https://github.com/54yyyu/zotero-mcp) for the Zotero ChromaDB indexer that `zot` reuses.
- [PiaoyangGuohai1/cli-anything-zotero](https://github.com/PiaoyangGuohai1/cli-anything-zotero) — related Zotero CLI project.

## License

MIT (see upstream pi-skills for original components).
