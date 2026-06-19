#!/usr/bin/env bash
#
# sync-upstream-skills.sh — vendor selected skills from upstream repos (LOGIC).
#
# Reads the data file `upstream-manifest` at the repo root, keeps a slim
# mirror of each upstream repo (partial + sparse checkout, so ONLY the listed
# folders are downloaded — not the whole repo), and copies each into a per-
# upstream folder `skills/vendor/<repo-key>/<dest>/` in this repo. After each
# copy it rewrites the skill's SKILL.md `name:` to match <dest> (its immediate
# parent dir), so renamed skills stay valid AND re-syncable.
#
# Usage:
#   scripts/sync-upstream-skills.sh                # sync every manifest skill
#   scripts/sync-upstream-skills.sh --stage        # sync AND git-add the dest folders
#   scripts/sync-upstream-skills.sh <dest>...      # sync ONLY the named skill(s)
#
# A source repo is fetched only when its upstream tip has moved since the last
# sync — checked with a cheap `git ls-remote` probe (no objects downloaded) — so
# an unchanged upstream costs just the probe, not a full re-fetch.
#
# Edit the manifest (not this script) to add/remove skills or sources.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="${UPSTREAM_SKILLS_CACHE:-$HOME/.cache/upstream-skills}"
MANIFEST="${UPSTREAM_SKILLS_MANIFEST:-$REPO_ROOT/upstream-manifest}"
VENDOR_DIR="$REPO_ROOT/skills/vendor"   # vendored skills land in <VENDOR_DIR>/<key>/<dest>/

# Flags plus an optional positional filter: dest-folder names to restrict the
# sync to (anything not starting with `-` that isn't a known flag).
STAGE=0
FILTER=()
for arg in "$@"; do
  case "$arg" in
    --stage) STAGE=1 ;;
    -*)      echo "Unknown flag: $arg" >&2; exit 1 ;;
    *)       FILTER+=("$arg") ;;
  esac
done

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

# --- restrict to the requested skills, if a filter was given ---------------
if [ ${#FILTER[@]} -gt 0 ]; then
  kept=()
  for entry in "${SKILLS[@]}"; do
    read -r _k _s d <<<"$entry"
    for want in "${FILTER[@]}"; do
      if [ "$d" = "$want" ]; then kept+=("$entry"); break; fi
    done
  done
  if [ ${#kept[@]} -eq 0 ]; then
    echo "No manifest skills match: ${FILTER[*]}" >&2
    exit 1
  fi
  SKILLS=("${kept[@]}")
  echo "==> Restricting sync to: ${FILTER[*]}"
fi

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

  # Probe upstream once: default branch + tip SHA in a single network round-trip,
  # no objects downloaded.
  symref="$(git ls-remote --symref "$url" HEAD)"
  branch="$(printf '%s\n' "$symref" | awk '/^ref:/{sub("refs/heads/","",$2); print $2; exit}')"
  remote_sha="$(printf '%s\n' "$symref" | awk '$2=="HEAD"{print $1; exit}')"
  : "${branch:?[$key] could not resolve upstream default branch (offline?)}"

  if [ ! -d "$mirror/.git" ]; then
    echo "==> [$key] creating slim mirror at $mirror"
    mkdir -p "$CACHE_ROOT"
    git clone --filter=blob:none --no-checkout --depth 1 "$url" "$mirror"
    git -C "$mirror" sparse-checkout init --cone
    local_sha=""
  else
    local_sha="$(git -C "$mirror" rev-parse HEAD 2>/dev/null || echo "")"
  fi

  # Narrow the working tree to the wanted paths. In a partial clone this lazily
  # fetches blobs for any newly-listed path, so it works even when we skip the
  # full fetch below.
  echo "==> [$key] sparse paths: ${paths[*]}"
  git -C "$mirror" sparse-checkout set "${paths[@]}"

  if [ "$remote_sha" = "$local_sha" ]; then
    echo "==> [$key] up to date at ${remote_sha:0:12}; skipping fetch"
  else
    echo "==> [$key] upstream at ${remote_sha:0:12}; fetching $branch"
    git -C "$mirror" fetch --depth 1 origin "$branch"
    git -C "$mirror" checkout -B "$branch" "origin/$branch" >/dev/null 2>&1
  fi
done

# --- 2. copy each skill, flat, and normalize its name: field ---------------
echo "==> Copying into $VENDOR_DIR"
for entry in "${SKILLS[@]}"; do
  read -r key src dst <<<"$entry"
  mirror="$CACHE_ROOT/$key"
  if [ ! -d "$mirror/$src" ]; then
    echo "!!  [$key] upstream path not found, skipping: $src"
    continue
  fi
  echo "    [$key] $src -> skills/vendor/$key/$dst/"
  mkdir -p "$VENDOR_DIR/$key"
  rsync -a --delete --exclude '.git' "$mirror/$src/" "$VENDOR_DIR/$key/$dst/"

  # Make the skill valid even if renamed: name: must equal its dest folder
  # (the immediate parent dir, which is $dst — the upstream <key> level does
  # not affect the skill name).
  skillmd="$VENDOR_DIR/$key/$dst/SKILL.md"
  if [ -f "$skillmd" ]; then
    tmp="$(mktemp)"
    sed '1,/^name:/ s/^name:.*/name: '"$dst"'/' "$skillmd" > "$tmp" && mv "$tmp" "$skillmd"
  fi

  [ "$STAGE" = 1 ] && git -C "$REPO_ROOT" add "skills/vendor/$key/$dst"
done

echo "==> Done.${STAGE:+}"
[ "$STAGE" = 1 ] && echo "    (dest folders staged)" || echo "    Review with: git -C \"$REPO_ROOT\" status"
