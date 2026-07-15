# skills

A personal collection of skills for AI coding agents (primarily Claude Code, but format is portable to pi-coding-agent, Codex CLI, Amp, Droid). Organized under `skills/`: my own skills live in `skills/mine/`; skills vendored from other authors live in `skills/vendor/<source>/`, one folder per source (`mattpocock/`, `waza/`, `baoyu/`, `karpathy/`, `juliusbrussee/`, `badlogic/`), kept in sync from upstream.

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
| [china-micro-surveys](skills/mine/china-micro-surveys/SKILL.md) | Catalog and metadata for Chinese micro survey datasets (CFPS, CHFS, CHARLS, etc.). |
| [econ-paper-writing](skills/mine/econ-paper-writing/SKILL.md) | Section-by-section guidance for drafting/polishing economics papers (structural reference). |
| [econ-paper-writing-fragments](skills/mine/econ-paper-writing-fragments/SKILL.md) | Inventory scattered results — tables, figures, data, model, literature, code — into one evidence pile, each exhibit with its takeaway. |
| [econ-paper-writing-shape](skills/mine/econ-paper-writing-shape/SKILL.md) | Draft the paper section by section into `sections/*.tex` from the pile + a fixed skeleton, with the grilling tone. |
| [economics-model](skills/mine/economics-model/SKILL.md) | Reference notes on widely used economic models. |
| [lit-review-assistant](skills/mine/lit-review-assistant/SKILL.md) | Templates for structuring literature reviews and finding gaps. |
| [matlab-econ-model-estimator](skills/mine/matlab-econ-model-estimator/SKILL.md) | Parameter estimation for econ models in MATLAB. |
| [research-ideation](skills/mine/research-ideation/SKILL.md) | Frameworks for going from phenomena to testable hypotheses. |

The three `econ-paper-writing*` skills form a pipeline: `econ-paper-writing` is the structural reference, `econ-paper-writing-fragments` gathers results into a materials pile, and `econ-paper-writing-shape` drafts the paper section by section from it.

### Custom CLI tools (mine)

| Skill | Description |
|-------|-------------|
| [chrome-history-cli](skills/mine/chrome-history-cli/SKILL.md) | Search local Chrome browsing history exported by the History Trends Unlimited extension. |
| [netnewswire-cli](skills/mine/netnewswire-cli/SKILL.md) | Read/search/manage NetNewsWire (macOS RSS reader) via AppleScript + bash. Idea adapted from [netnewswire-mcp](https://github.com/jellllly420/netnewswire-mcp); reimplemented as a shell skill so no MCP server is needed. |
| [zotero-cli](skills/mine/zotero-cli/SKILL.md) | `zot` — a two-command Python CLI for keyword + semantic search over a local Zotero library. Wraps the [`zotero-mcp`](https://github.com/54yyyu/zotero-mcp) ChromaDB index (delegates `update-db` to the upstream package). See also [PiaoyangGuohai1/cli-anything-zotero](https://github.com/PiaoyangGuohai1/cli-anything-zotero) for a fuller-featured Zotero CLI. |
| [stata-cil](skills/mine/stata-cil/SKILL.md) | `statab` — batch-mode Stata wrapper that surfaces real `r(#)` exit codes (Stata's own `-e` often exits 0 on error). |

### Vendored upstream skills

Pulled from other authors' repos and kept in sync via [`upstream-manifest`](upstream-manifest) + [`scripts/sync-upstream-skills.sh`](scripts/sync-upstream-skills.sh), one folder per source under `skills/vendor/`. Don't hand-edit these — the next sync overwrites them. To customize one, copy it into `skills/mine/` and edit there: `link-skills` prefers `mine/` on a name clash, so your fork is what gets linked while the vendored copy keeps tracking upstream (see [handoff](#misc-mine)).

From [mattpocock/skills](https://github.com/mattpocock/skills):

| Skill | Description |
|-------|-------------|
| [writing-fragments](skills/vendor/mattpocock/writing-fragments/SKILL.md) | Grill the user for heterogeneous writing fragments, appended to one doc as raw material for a later article. |
| [writing-shape](skills/vendor/mattpocock/writing-shape/SKILL.md) | Shape a pile of raw material into an article — candidate openings, grow paragraph by paragraph, argue the format. |
| [writing-beats](skills/vendor/mattpocock/writing-beats/SKILL.md) | Assemble raw material as a narrative journey of beats, choose-your-own-adventure style. |
| [writing-great-skills](skills/vendor/mattpocock/writing-great-skills/SKILL.md) | Vocabulary and principles for writing predictable, well-formed skills. |
| [decision-mapping](skills/vendor/mattpocock/decision-mapping/SKILL.md) | Turn a loose idea into a sequenced map of investigation tickets, driven to resolution one at a time. |
| [domain-modeling](skills/vendor/mattpocock/domain-modeling/SKILL.md) | Build and sharpen a project's ubiquitous language; record architectural decisions as ADRs. |
| [prototype](skills/vendor/mattpocock/prototype/SKILL.md) | Build a throwaway prototype — a runnable terminal app or several UI variants — to flesh out a design. |
| [to-prd](skills/vendor/mattpocock/to-prd/SKILL.md) | Turn the current conversation into a PRD and publish it to the project issue tracker. |
| [codebase-design](skills/vendor/mattpocock/codebase-design/SKILL.md) | Shared vocabulary for designing deep modules — interfaces, seams, testability. |
| [improve-codebase-architecture](skills/vendor/mattpocock/improve-codebase-architecture/SKILL.md) | Scan a codebase for deepening opportunities, present as an HTML report, then grill the chosen one. |
| [diagnosing-bugs](skills/vendor/mattpocock/diagnosing-bugs/SKILL.md) | Diagnosis loop for hard bugs and performance regressions. |
| [grill-me](skills/vendor/mattpocock/grill-me/SKILL.md) | A relentless interview to sharpen a plan or design. |
| [grilling](skills/vendor/mattpocock/grilling/SKILL.md) | The underlying relentless-interview technique that grill-me/grill-with-docs build on. |
| [grill-with-docs](skills/vendor/mattpocock/grill-with-docs/SKILL.md) | Like grill-me, but also writes ADRs + a glossary as decisions crystallize. |
| [handoff](skills/vendor/mattpocock/handoff/SKILL.md) | Compact the conversation into a handoff doc for a fresh agent. Pristine upstream — overridden locally by [`skills/mine/handoff`](#misc-mine). |
| [setup-matt-pocock-skills](skills/vendor/mattpocock/setup-matt-pocock-skills/SKILL.md) | Configure a repo for the engineering skills — issue tracker, triage labels, domain doc layout. Run once. |

From [tw93/Waza](https://github.com/tw93/Waza) (renamed `waza-*` for provenance):

| Skill | Description |
|-------|-------------|
| [waza-learn](skills/vendor/waza/waza-learn/SKILL.md) | Six-phase research workflow turning unfamiliar domains or source bundles into publish-ready output. |
| [waza-ui](skills/vendor/waza/waza-ui/SKILL.md) | Distinctive, production-grade UI for pages, components, typography, and screenshot-driven polish. |
| [waza-read](skills/vendor/waza/waza-read/SKILL.md) | Fetch and summarize URLs/PDFs, or convert them to clean Markdown for downstream work. |

From [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills):

| Skill | Description |
|-------|-------------|
| [baoyu-diagram](skills/vendor/baoyu/baoyu-diagram/SKILL.md) | Create dark-themed SVG diagrams of any type — architecture, flowchart, sequence, mind map, timeline. |

From [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills):

| Skill | Description |
|-------|-------------|
| [karpathy-guidelines](skills/vendor/karpathy/karpathy-guidelines/SKILL.md) | Behavioral guidelines to reduce common LLM coding mistakes — surgical changes, surfaced assumptions, verifiable success criteria. |

From [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman):

| Skill | Description |
|-------|-------------|
| [caveman](skills/vendor/juliusbrussee/caveman/SKILL.md) | Ultra-compressed "caveman" communication mode — cuts tokens ~75% while keeping technical accuracy; intensity levels incl. wényán. |

### Misc (mine)

My own skills that don't fit the categories above (not vendored — safe to edit):

| Skill | Description |
|-------|-------------|
| [handoff](skills/mine/handoff/SKILL.md) | Fork of `skills/vendor/mattpocock/handoff`, tweaked to save under `./docs/<timestamp>-handoff-<topic>.md`. **Takes priority** over the vendored copy in `link-skills`. Edit freely; not synced. |
| [hyperframes](skills/mine/hyperframes/SKILL.md) | Create video compositions, animations, title cards, captions, and scene transitions in HyperFrames HTML. |
| [macos-icon](skills/mine/macos-icon/SKILL.md) | Create, refine, validate, and export macOS app icons from raster artwork. |
| [record-as-implement](skills/mine/record-as-implement/SKILL.md) | Implement a spec while keeping a session notes file of off-spec decisions, deviations, and tradeoffs. |

## Installing into a project

Claude Code only looks one level deep for `SKILL.md`, so a grouped folder like `skills/vendor/mattpocock/` can't be pointed at directly — each skill must sit one level under the skills dir. The `link-skills` zsh function (source [`scripts/link-skills`](scripts/link-skills), symlinked into `~/.zsh_functions/`) symlinks a skill into the current project by name; the source group is resolved automatically (preferring `mine/` on a name clash), and the link name stays bare so it's discoverable:

```bash
link-skills econ-paper-writing           # -> .claude/skills + .agents/skills (defaults)
link-skills writing-shape claude         # single agent
link-skills waza-ui claude codex pi  # multiple agents at once
```

Add `-g`/`--global` to link into your user-level dirs (`~/.claude/skills`, `~/.agents/skills`) instead of the current project:

```bash
link-skills -g writing-shape claude codex   # user-level, both agents
```

Or symlink manually — point at the skill's real `skills/mine/<name>` or `skills/vendor/<source>/<name>` path but keep the link name bare:

```bash
mkdir -p ~/.claude/skills
ln -s ~/skills/skills/vendor/mattpocock/writing-shape ~/.claude/skills/writing-shape
```

In a fresh clone, install the function itself by symlinking it onto your `fpath`:

```bash
ln -s "$PWD/scripts/link-skills" ~/.zsh_functions/link-skills   # then: autoload -Uz link-skills
```

**Tab completion (zsh).** [`scripts/_link-skills`](scripts/_link-skills) completes `link-skills` with an arrow-navigable menu of skill names (plus the `-g` flag and agent names), gathered live from `skills/mine/` and `skills/vendor/`. Symlink it onto your `fpath` and make sure the completion system is initialized:

```bash
ln -s "$PWD/scripts/_link-skills" ~/.zsh_functions/_link-skills
# in ~/.zshrc, AFTER `fpath=(~/.zsh_functions $fpath)`:
autoload -Uz compinit && compinit
```

Then `link-skills <Tab>` pops up the menu. (The arrow-key menu is enabled per-command by the completion file, so no global `menu select` zstyle is needed.)

### Profiles

To toggle a whole *set* of skills at once — e.g. an econ-research set vs a programming set — use **profiles**. A profile is a file under [`profiles/`](profiles/) listing skill names (one per line); [`scripts/use-skill-profile`](scripts/use-skill-profile) links the lot via `link-skills`. Profiles are independent — nothing is auto-unioned. The `global` profile holds cross-cutting skills; apply it once at user level for skills you want everywhere.

```bash
use-skill-profile -g global            # user-level (~/.claude + ~/.agents): everywhere-skills
use-skill-profile econ                 # this project: econ only (REPLACE — clears old links first)
use-skill-profile programming econ     # union both profiles
use-skill-profile --add lit-review-assistant  # STACK a profile onto current links (no clear)
clear-skills                     # toggle every linked skill off
```

Default is *replace* (switching profiles leaves the project clean); `--add` stacks instead. Edit membership in the `profiles/<name>` files, not the script. Install the functions the same way: `ln -s "$PWD/scripts/use-skill-profile" ~/.zsh_functions/use-skill-profile` (and likewise `clear-skills`).

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
- **zotero-cli** — Python 3.10+, `zotero-mcp-server` installed in the same interpreter, Zotero desktop running with the local API enabled. See [`skills/mine/zotero-cli/README.md`](skills/mine/zotero-cli/README.md) for setup.
- **matlab-econ-model-estimator** — MATLAB.
- **stata-cil** — Stata installed (`stataMP` / `STATA_BIN`); bash 3.2+.

## Credits

- Mario Zechner ([@badlogic](https://github.com/badlogic)) for the pi-skills format and the CLI-over-MCP philosophy.
- [jellllly420/netnewswire-mcp](https://github.com/jellllly420/netnewswire-mcp) for the original NetNewsWire-via-AppleScript idea.
- [54yyyu/zotero-mcp](https://github.com/54yyyu/zotero-mcp) for the Zotero ChromaDB indexer that `zot` reuses.
- [PiaoyangGuohai1/cli-anything-zotero](https://github.com/PiaoyangGuohai1/cli-anything-zotero) — related Zotero CLI project.
- Brendan Halpin's batch-Stata exit-code idea — [blog post](http://teaching.sociology.ul.ie/bhalpin/wordpress/?p=122) — used by `stata-cil`/`statab`.

## License

MIT (see upstream pi-skills for original components).
