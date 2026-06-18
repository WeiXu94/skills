# CLAUDE.md

Collection of Claude Code skills, grouped by source:

- `mine/` — my own skills.
- `mattpocock/`, `waza/`, `baoyu/` — skills vendored from upstream repos (one
  folder per source).

Each skill is a `<group>/<name>/` dir with `SKILL.md` (plus optional `scripts/`,
`references/`). A skill's `name:` must equal its immediate dir name (`<name>`);
the `<group>` level does not affect it. Claude discovers skills only one level
deep, so consume them via per-skill symlinks (`add-skill <name>`, in
`~/.zsh_functions/`), not by pointing `.claude/skills` at a group folder.

## Vendored skills

Some skills are pulled from upstream repos, listed in `upstream-manifest` (data).
`scripts/sync-upstream-skills.sh` (logic) reads it, partial+sparse-fetches only
the listed folders into `~/.cache/upstream-skills`, and copies each into
`<group>/<name>/` here.

- Add/remove a skill or source: edit `upstream-manifest`, not the script.
- Sync rewrites each copied `SKILL.md` `name:` to match its dest dir, so you may
  rename freely (e.g. `learn` -> `waza-learn`).
- Don't hand-edit a vendored skill dir; the next sync overwrites it.

## Hook

`.githooks/pre-commit` syncs + stages vendored skills on every commit (needs
network; skips if offline; bypass with `--no-verify`). Enable in a fresh clone:

    git config core.hooksPath .githooks
