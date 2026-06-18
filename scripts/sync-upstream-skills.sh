#!/usr/bin/env bash
#
# sync-upstream-skills.sh — vendor selected skills from an upstream repo.
#
# Keeps a slim mirror of an upstream skills repo (partial + sparse checkout, so
# ONLY the folders listed below are ever downloaded — not the whole repo) and
# copies them, flat, into this repo. Re-run any time to pull upstream updates.
#
# Usage:
#   scripts/sync-upstream-skills.sh           # sync everything in SKILLS
#   git status                                # review what changed, then commit
#
# To track another skill: add a line to SKILLS as
#   "<path/inside/upstream/repo>:<dest-folder-name-in-this-repo>"
# and re-run.

set -euo pipefail

# --- config -----------------------------------------------------------------
UPSTREAM_REPO="https://github.com/mattpocock/skills.git"
MIRROR="${UPSTREAM_SKILLS_MIRROR:-$HOME/.cache/upstream-skills/mattpocock-skills}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Skills to vendor:  "<upstream/path>:<dest-folder-in-this-repo>"
SKILLS=(
  "skills/in-progress/writing-beats:writing-beats"
)
# ---------------------------------------------------------------------------

# Upstream sparse paths derived from the SKILLS list.
sparse_paths=()
for entry in "${SKILLS[@]}"; do
  sparse_paths+=("${entry%%:*}")
done

# 1. Create the slim mirror on first run (partial clone, no blobs yet, shallow).
if [ ! -d "$MIRROR/.git" ]; then
  echo "==> Creating slim mirror at $MIRROR"
  mkdir -p "$(dirname "$MIRROR")"
  git clone --filter=blob:none --no-checkout --depth 1 "$UPSTREAM_REPO" "$MIRROR"
  git -C "$MIRROR" sparse-checkout init --cone
fi

# 2. Restrict the mirror to just the folders we want (only these get fetched).
echo "==> Sparse paths: ${sparse_paths[*]}"
git -C "$MIRROR" sparse-checkout set "${sparse_paths[@]}"

# 3. Pull the latest upstream tip for the default branch.
default_branch="$(git -C "$MIRROR" remote show origin | sed -n 's/.*HEAD branch: //p')"
echo "==> Fetching ${default_branch}"
git -C "$MIRROR" fetch --depth 1 origin "$default_branch"
git -C "$MIRROR" checkout -B "$default_branch" "origin/$default_branch" >/dev/null 2>&1

# 4. Copy each selected skill, flat, into this repo (mirror = source of truth).
echo "==> Copying into $REPO_ROOT"
for entry in "${SKILLS[@]}"; do
  src="${entry%%:*}"
  dst="${entry##*:}"
  if [ ! -d "$MIRROR/$src" ]; then
    echo "!!  upstream path not found, skipping: $src"
    continue
  fi
  echo "    $src -> $dst/"
  rsync -a --delete --exclude '.git' "$MIRROR/$src/" "$REPO_ROOT/$dst/"
done

echo "==> Done. Review with:  git -C \"$REPO_ROOT\" status"
