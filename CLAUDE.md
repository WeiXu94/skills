# CLAUDE.md

Collection of Claude Code skills, grouped by source:

- `mine/` — my own skills.
- `mattpocock/`, `waza/`, `baoyu/`, `karpathy/`, `juliusbrussee/` — skills
  vendored from upstream repos (one folder per source).

Each skill is a `<group>/<name>/` dir with `SKILL.md` (plus optional `scripts/`,
`references/`). A skill's `name:` must equal its immediate dir name (`<name>`);
the `<group>` level does not affect it. Claude discovers skills only one level
deep, so consume them via per-skill symlinks (`add-skill <name>` for the current
project, `add-skill -g <name>` for user-level `~/.claude` + `~/.agents`; source
`scripts/add-skill`, symlinked into `~/.zsh_functions/`), not by pointing
`.claude/skills` at a group folder.

## Vendored skills

Some skills are pulled from upstream repos, listed in `upstream-manifest` (data).
`scripts/sync-upstream-skills.sh` (logic) reads it, partial+sparse-fetches only
the listed folders into `~/.cache/upstream-skills`, and copies each into
`<group>/<name>/` here.

- Add/remove a skill or source: edit `upstream-manifest`, not the script.
- Quick add by URL: `scripts/add-skill-from-url <github-url-to-SKILL.md>` parses
  the URL, appends the manifest line(s) (reusing the repo-key if that source is
  already listed, else adding one), and syncs. Pass `--no-sync` to batch several
  adds then sync once, and an optional trailing `dest-folder` to rename on import.
- Sync rewrites each copied `SKILL.md` `name:` to match its dest dir, so you may
  rename freely (e.g. `learn` -> `waza-learn`).
- Don't hand-edit a vendored skill dir; the next sync overwrites it. To
  customize one, copy it into `mine/`; `add-skill` prefers `mine/` on a name
  clash, so the vendored copy keeps tracking upstream while your fork is linked.

## Hook

`.githooks/pre-commit` syncs + stages vendored skills on every commit (needs
network; skips if offline; bypass with `--no-verify`). Enable in a fresh clone:

    git config core.hooksPath .githooks
