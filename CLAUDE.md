# CLAUDE.md

Collection of Claude Code skills, all under `skills/`:

- `skills/mine/` — my own skills.
- `skills/vendor/<source>/` — skills vendored from upstream repos, one folder
  per source (`skills/vendor/mattpocock/`, `skills/vendor/waza/`,
  `skills/vendor/baoyu/`, `skills/vendor/karpathy/`, `skills/vendor/juliusbrussee/`,
  `skills/vendor/badlogic/`, ...).

Each skill is a `<name>/` dir with `SKILL.md` (plus optional `scripts/`,
`references/`), sitting in `skills/mine/<name>` or `skills/vendor/<source>/<name>`.
A skill's `name:` must equal its immediate dir name (`<name>`); the enclosing
`mine`/`vendor/<source>` levels do not affect it. Claude discovers skills only one
level deep, so consume them via per-skill symlinks (`link-skills <name>` for the
current project, `link-skills -g <name>` for user-level `~/.claude` + `~/.agents`;
source `scripts/link-skills`, symlinked into `~/.zsh_functions/`), not by pointing
`.claude/skills` at a group folder. Zsh tab-completion for `link-skills` lives in
`scripts/_link-skills` (symlink onto `fpath`; needs `compinit`).

By default skills link into both agents (`claude` -> `.claude/skills`,
`codex`/`pi`/`opencode` -> `.agents/skills`). Target specific ones with `--agent`,
which all three scripts (`link-skills`, `clear-skills`, `use-skill-profile`) accept.
It takes multiple values — comma/slash-separated, repeatable, or both:
`--agent claude`, `--agent claude,codex`, `--agent claude --agent codex`.

## Profiles

A *profile* is a named set of skills you toggle into a project (or user-level)
with one command — e.g. an `econ` set vs a `programming` set. Profiles are data:
one file per profile under `profiles/<name>`, listing skill names one per line
(`#` comments + blank lines ignored). Profiles are independent — nothing is
auto-unioned. The `global` profile holds cross-cutting skills; apply it once at
user level (`use-skill-profile -g global`) for skills you want everywhere.

`scripts/use-skill-profile` (logic, a sourced zsh function symlinked into
`~/.zsh_functions/`) reads the file(s) and links each skill via `link-skills`:

    use-skill-profile -g global            # user-level (~/.claude + ~/.agents): everywhere-skills
    use-skill-profile econ                 # project: econ only (REPLACE: clears old links first)
    use-skill-profile programming econ     # project: union both profiles
    use-skill-profile --add <profile>      # STACK onto current links (no clear)
    use-skill-profile econ --agent claude  # project: econ, only the claude agent dir
    clear-skills                     # toggle everything off (removes ~/skills symlinks only)
    clear-skills --agent codex       # clear only the codex/.agents links

- Edit profile membership: change the `profiles/<name>` files, not the script.
- Default is REPLACE so switching profiles leaves a project clean; this also
  drops one-off skills you linked manually with `link-skills` (re-add, or list them
  in a profile). `--add` preserves existing links.
- `clear-skills` only removes symlinks pointing into `~/skills`; real dirs and
  foreign symlinks are left alone.

## Vendored skills

Some skills are pulled from upstream repos, listed in `upstream-manifest` (data).
`scripts/sync-upstream-skills.sh` (logic) reads it, partial+sparse-fetches only
the listed folders into `~/.cache/upstream-skills`, and copies each into
`skills/vendor/<source>/<name>/` here.

- Add/remove a skill or source: edit `upstream-manifest`, not the script.
- Quick add by URL: `scripts/add-skill-from-url <github-url-to-SKILL.md>` parses
  the URL, appends the manifest line(s) (reusing the repo-key if that source is
  already listed, else adding one), and syncs ONLY that skill (other vendored
  skills are left untouched). Pass `--no-sync` to batch several adds then sync
  once, and an optional trailing `dest-folder` to rename on import.
- A bare `sync-upstream-skills.sh` re-vendors every manifest skill; pass
  `<dest>...` to limit it to named skills. A source repo is fetched only when its
  upstream tip has moved since the last sync (a cheap `git ls-remote` probe), so
  an unchanged upstream costs almost nothing.
- Sync rewrites each copied `SKILL.md` `name:` to match its dest dir, so you may
  rename freely (e.g. `learn` -> `waza-learn`).
- Don't hand-edit a vendored skill dir; the next sync overwrites it. To
  customize one, copy it into `skills/mine/`; `link-skills` prefers `mine/` on a
  name clash, so the vendored copy keeps tracking upstream while your fork is linked.

Vendored skills are NOT auto-synced; run `scripts/sync-upstream-skills.sh` (all)
or `scripts/add-skill-from-url <url>` (one) when you want to pull upstream.
