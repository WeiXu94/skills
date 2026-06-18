#!/usr/bin/env bash
#
# sync-upstream-skills.sh — vendor selected skills from upstream repos (LOGIC).
#
# Reads the data file `upstream-manifest` at the repo root, keeps a slim
# mirror of each upstream repo (partial + sparse checkout, so ONLY the listed
# folders are downloaded — not the whole repo), and copies each into a per-
# upstream folder `<repo-key>/<dest>/` in this repo. After each copy it rewrites
# the skill's SKILL.md `name:` to match <dest> (its immediate parent dir), so
# renamed skills stay valid AND re-syncable.
#
# Usage:
#   scripts/sync-upstream-skills.sh            # sync; then review with git status
#   scripts/sync-upstream-skills.sh --stage    # sync AND git-add the dest folders
#
# Edit the manifest (not this script) to add/remove skills or sources.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="${UPSTREAM_SKILLS_CACHE:-$HOME/.cache/upstream-skills}"
MANIFEST="${UPSTREAM_SKILLS_MANIFEST:-$REPO_ROOT/upstream-manifest}"

STAGE=0
[ "${1:-}" = "--stage" ] && STAGE=1

# --- load the manifest (data) ----------------------------------------------
REPOS=()    # "<key> <url>"
SKILLS=()   # "<key> <upstream/path> <dest>"
while read -r kind a b c || [ -n "$kind" ]; do
  case "$kind" in
    repo)   REPOS+=("$a $b") ;;
    skill)  SKILLS+=("$a $b $c") ;;
    ''|\#*) ;;  # blank line or comment
    *)      echo "manifest: ignoring unknown line type '$kind'" >&2 ;;
  esac
done < "$MANIFEST"

# --- 1. per repo: create/refresh a slim mirror of the wanted paths ----------
for repo in "${REPOS[@]}"; do
  read -r key url <<<"$repo"
  mirror="$CACHE_ROOT/$key"

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

# --- 2. copy each skill, flat, and normalize its name: field ---------------
echo "==> Copying into $REPO_ROOT"
for entry in "${SKILLS[@]}"; do
  read -r key src dst <<<"$entry"
  mirror="$CACHE_ROOT/$key"
  if [ ! -d "$mirror/$src" ]; then
    echo "!!  [$key] upstream path not found, skipping: $src"
    continue
  fi
  echo "    [$key] $src -> $key/$dst/"
  mkdir -p "$REPO_ROOT/$key"
  rsync -a --delete --exclude '.git' "$mirror/$src/" "$REPO_ROOT/$key/$dst/"

  # Make the skill valid even if renamed: name: must equal its dest folder
  # (the immediate parent dir, which is $dst — the upstream <key> level does
  # not affect the skill name).
  skillmd="$REPO_ROOT/$key/$dst/SKILL.md"
  if [ -f "$skillmd" ]; then
    tmp="$(mktemp)"
    sed '1,/^name:/ s/^name:.*/name: '"$dst"'/' "$skillmd" > "$tmp" && mv "$tmp" "$skillmd"
  fi

  [ "$STAGE" = 1 ] && git -C "$REPO_ROOT" add "$key/$dst"
done

echo "==> Done.${STAGE:+}"
[ "$STAGE" = 1 ] && echo "    (dest folders staged)" || echo "    Review with: git -C \"$REPO_ROOT\" status"
