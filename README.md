# skills

A personal collection of skills for AI coding agents (primarily Claude Code, but format is portable to pi-coding-agent, Codex CLI, Amp, Droid). Organized by source: my own skills live in `mine/`; skills vendored from other authors live one folder per source (`mattpocock/`, `waza/`, `baoyu/`, `karpathy/`), kept in sync from upstream.

My own skills come in two flavors:

- **Econ research skills** — domain knowledge, workflows, and references for economics work (paper writing, model estimation, literature review, micro-survey catalogs, ideation).
- **CLI tool skills** — small command-line wrappers the agent can invoke directly, instead of running a long-lived MCP server.

Vendored skills are writing, design, research, and engineering workflows — see [Vendored upstream skills](#vendored-upstream-skills).

## Philosophy: CLI over MCP

Inspired by [Mario Zechner](https://github.com/badlogic): give the agent a thin shell/Python CLI and let it compose tools the way a human would in a terminal. Easy to use, easy to self-customize, no daemon to babysit.

- [What if you don't need MCP?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp)
- [The pi coding agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent)

## Available skills

### Econ research

| Skill | Description |
|-------|-------------|
| [china-micro-surveys](mine/china-micro-surveys/SKILL.md) | Catalog and metadata for Chinese micro survey datasets (CFPS, CHFS, CHARLS, etc.). |
| [econ-paper-writing](mine/econ-paper-writing/SKILL.md) | Section-by-section guidance for drafting/polishing economics papers. |
| [economics-model](mine/economics-model/SKILL.md) | Reference notes on widely used economic models. |
| [lit-review-assistant](mine/lit-review-assistant/SKILL.md) | Templates for structuring literature reviews and finding gaps. |
| [matlab-econ-model-estimator](mine/matlab-econ-model-estimator/SKILL.md) | Parameter estimation for econ models in MATLAB. |
| [research-ideation](mine/research-ideation/SKILL.md) | Frameworks for going from phenomena to testable hypotheses. |

### Custom CLI tools (mine)

| Skill | Description |
|-------|-------------|
| [netnewswire-cli](mine/netnewswire-cli/SKILL.md) | Read/search/manage NetNewsWire (macOS RSS reader) via AppleScript + bash. Idea adapted from [netnewswire-mcp](https://github.com/jellllly420/netnewswire-mcp); reimplemented as a shell skill so no MCP server is needed. |
| [zotero-cli](mine/zotero-cli/SKILL.md) | `zot` — a two-command Python CLI for keyword + semantic search over a local Zotero library. Wraps the [`zotero-mcp`](https://github.com/54yyyu/zotero-mcp) ChromaDB index (delegates `update-db` to the upstream package). See also [PiaoyangGuohai1/cli-anything-zotero](https://github.com/PiaoyangGuohai1/cli-anything-zotero) for a fuller-featured Zotero CLI. |

### Vendored upstream skills

Pulled from other authors' repos and kept in sync via [`upstream-manifest`](upstream-manifest) + [`scripts/sync-upstream-skills.sh`](scripts/sync-upstream-skills.sh), one folder per source. Don't hand-edit these — the next sync overwrites them.

From [mattpocock/skills](https://github.com/mattpocock/skills):

| Skill | Description |
|-------|-------------|
| [writing-fragments](mattpocock/writing-fragments/SKILL.md) | Grill the user for heterogeneous writing fragments, appended to one doc as raw material for a later article. |
| [writing-shape](mattpocock/writing-shape/SKILL.md) | Shape a pile of raw material into an article — candidate openings, grow paragraph by paragraph, argue the format. |
| [writing-beats](mattpocock/writing-beats/SKILL.md) | Assemble raw material as a narrative journey of beats, choose-your-own-adventure style. |
| [writing-great-skills](mattpocock/writing-great-skills/SKILL.md) | Vocabulary and principles for writing predictable, well-formed skills. |
| [decision-mapping](mattpocock/decision-mapping/SKILL.md) | Turn a loose idea into a sequenced map of investigation tickets, driven to resolution one at a time. |
| [codebase-design](mattpocock/codebase-design/SKILL.md) | Shared vocabulary for designing deep modules — interfaces, seams, testability. |
| [improve-codebase-architecture](mattpocock/improve-codebase-architecture/SKILL.md) | Scan a codebase for deepening opportunities, present as an HTML report, then grill the chosen one. |
| [diagnosing-bugs](mattpocock/diagnosing-bugs/SKILL.md) | Diagnosis loop for hard bugs and performance regressions. |
| [grill-me](mattpocock/grill-me/SKILL.md) | A relentless interview to sharpen a plan or design. |
| [grill-with-docs](mattpocock/grill-with-docs/SKILL.md) | Like grill-me, but also writes ADRs + a glossary as decisions crystallize. |

From [tw93/Waza](https://github.com/tw93/Waza) (renamed `waza-*` for provenance):

| Skill | Description |
|-------|-------------|
| [waza-learn](waza/waza-learn/SKILL.md) | Six-phase research workflow turning unfamiliar domains or source bundles into publish-ready output. |
| [waza-design](waza/waza-design/SKILL.md) | Distinctive, production-grade UI for pages, components, typography, and screenshot-driven polish. |
| [waza-read](waza/waza-read/SKILL.md) | Fetch and summarize URLs/PDFs, or convert them to clean Markdown for downstream work. |

From [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills):

| Skill | Description |
|-------|-------------|
| [baoyu-diagram](baoyu/baoyu-diagram/SKILL.md) | Create dark-themed SVG diagrams of any type — architecture, flowchart, sequence, mind map, timeline. |

From [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills):

| Skill | Description |
|-------|-------------|
| [karpathy-guidelines](karpathy/karpathy-guidelines/SKILL.md) | Behavioral guidelines to reduce common LLM coding mistakes — surgical changes, surfaced assumptions, verifiable success criteria. |

### Misc (mine)

Workflow skills I keep and tweak (not vendored — safe to edit):

| Skill | Description |
|-------|-------------|
| [handoff](mine/handoff/SKILL.md) | Compact the current conversation into a handoff document for another agent to pick up. (Tweaked from mattpocock's.) |
| [record-as-implement](mine/record-as-implement/SKILL.md) | Implement a spec while keeping a session notes file of off-spec decisions, deviations, and tradeoffs. |

## Installing into a project

Claude Code only looks one level deep for `SKILL.md`, so a grouped folder like `mattpocock/` can't be pointed at directly — each skill must sit one level under the skills dir. The `add-skill` zsh function (in `~/.zsh_functions/`) symlinks a skill into the current project by name; the source group is resolved automatically, and the link name stays bare so it's discoverable:

```bash
add-skill econ-paper-writing           # -> .claude/skills + .agents/skills (defaults)
add-skill writing-shape claude         # single agent
add-skill waza-design claude codex pi  # multiple agents at once
```

Add `-g`/`--global` to link into your user-level dirs (`~/.claude/skills`, `~/.agents/skills`) instead of the current project:

```bash
add-skill -g writing-shape claude codex   # user-level, both agents
```

Or symlink manually — point at the skill's real `<group>/<name>` path but keep the link name bare:

```bash
mkdir -p ~/.claude/skills
ln -s ~/skills/mattpocock/writing-shape ~/.claude/skills/writing-shape
```

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
- **zotero-cli** — Python 3.10+, `zotero-mcp-server` installed in the same interpreter, Zotero desktop running with the local API enabled. See [`mine/zotero-cli/README.md`](mine/zotero-cli/README.md) for setup.
- **matlab-econ-model-estimator** — MATLAB.

## Credits

- Mario Zechner ([@badlogic](https://github.com/badlogic)) for the pi-skills format and the CLI-over-MCP philosophy.
- [jellllly420/netnewswire-mcp](https://github.com/jellllly420/netnewswire-mcp) for the original NetNewsWire-via-AppleScript idea.
- [54yyyu/zotero-mcp](https://github.com/54yyyu/zotero-mcp) for the Zotero ChromaDB indexer that `zot` reuses.
- [PiaoyangGuohai1/cli-anything-zotero](https://github.com/PiaoyangGuohai1/cli-anything-zotero) — related Zotero CLI project.

## License

MIT (see upstream pi-skills for original components).
