#!/usr/bin/env bash
#
# sync-upstream-skills.sh — vendor selected skills from upstream repos.
#
# Keeps a slim mirror of each upstream repo (partial + sparse checkout, so ONLY
# the folders listed below are ever downloaded — not the whole repo) and copies
# them, flat, into this repo. Re-run any time to pull upstream updates.
#
# Usage:
#   scripts/sync-upstream-skills.sh           # sync everything in SKILLS
#   git status                                # review what changed, then commit
#
# To track another skill: add a line to SKILLS as
#   "<repo-key> <path/inside/upstream/repo> <dest-folder-name-in-this-repo>"
# (the repo-key must exist in REPOS). To add a new source, add a REPOS line.

set -euo pipefail

CACHE_ROOT="${UPSTREAM_SKILLS_CACHE:-$HOME/.cache/upstream-skills}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- config -----------------------------------------------------------------

# Upstream sources:  "<repo-key> <git-url>"
REPOS=(
  "mattpocock https://github.com/mattpocock/skills.git"
  "waza       https://github.com/tw93/Waza.git"
)

# Skills to vendor:  "<repo-key> <upstream/path> <dest-folder-in-this-repo>"
SKILLS=(
  "mattpocock skills/in-progress/writing-beats                 writing-beats"
  "mattpocock skills/engineering/improve-codebase-architecture improve-codebase-architecture"
  "mattpocock skills/engineering/diagnosing-bugs               diagnosing-bugs"
  "mattpocock skills/engineering/codebase-design               codebase-design"
  "mattpocock skills/productivity/writing-great-skills         writing-great-skills"
  "mattpocock skills/in-progress/decision-mapping              decision-mapping"
  "mattpocock skills/in-progress/writing-fragments             writing-fragments"
  "mattpocock skills/in-progress/writing-shape                 writing-shape"
  "waza       skills/learn                                     learn"
  "waza       skills/design                                    design"
  "waza       skills/read                                      read"
)
# ---------------------------------------------------------------------------

# 1. Per repo: create/refresh a slim mirror restricted to the wanted paths.
for repo in "${REPOS[@]}"; do
  read -r key url <<<"$repo"
  mirror="$CACHE_ROOT/$key"

  # Gather this repo's sparse paths from the SKILLS list.
  paths=()
  for entry in "${SKILLS[@]}"; do
    read -r ekey src _dst <<<"$entry"
    [ "$ekey" = "$key" ] && paths+=("$src")
  done
  [ ${#paths[@]} -eq 0 ] && continue

  if [ ! -d "$mirror/.git" ]; then
    echo "==> [$key] creating slim mirror at $mirror"
    mkdir -p "$CACHE_ROOT"
    git clone --filter=blob:none --no-checkout --depth 1 "$url" "$mirror"
    git -C "$mirror" sparse-checkout init --cone
  fi

  echo "==> [$key] sparse paths: ${paths[*]}"
  git -C "$mirror" sparse-checkout set "${paths[@]}"

  branch="$(git -C "$mirror" remote show origin | sed -n 's/.*HEAD branch: //p')"
  echo "==> [$key] fetching $branch"
  git -C "$mirror" fetch --depth 1 origin "$branch"
  git -C "$mirror" checkout -B "$branch" "origin/$branch" >/dev/null 2>&1
done

# 2. Copy each selected skill, flat, into this repo (mirror = source of truth).
echo "==> Copying into $REPO_ROOT"
for entry in "${SKILLS[@]}"; do
  read -r key src dst <<<"$entry"
  mirror="$CACHE_ROOT/$key"
  if [ ! -d "$mirror/$src" ]; then
    echo "!!  [$key] upstream path not found, skipping: $src"
    continue
  fi
  echo "    [$key] $src -> $dst/"
  rsync -a --delete --exclude '.git' "$mirror/$src/" "$REPO_ROOT/$dst/"
done

echo "==> Done. Review with:  git -C \"$REPO_ROOT\" status"
