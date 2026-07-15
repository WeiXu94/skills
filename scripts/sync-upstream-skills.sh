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
# File-path sources (e.g. a root-level `SKILL.md` in an app repo) are supported:
# the src field is the blob path (e.g. `SKILL.md`), and the skill is extracted
# with `git show <sha>:<path>` so the rest of a large repo is never checked out.
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
# If a skill's upstream src path no longer exists (upstream moved/renamed it),
# the sync keeps the last vendored copy untouched, warns, lists it in an
# end-of-run summary, and exits 3 — fix that skill's src (3rd field) in the
# manifest and re-sync. (dest unchanged => same folder + skill name downstream.)
#
# Edit the manifest (not this script) to add/remove skills or sources.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="${UPSTREAM_SKILLS_CACHE:-$HOME/.cache/upstream-skills}"
MANIFEST="${UPSTREAM_SKILLS_MANIFEST:-$REPO_ROOT/upstream-manifest}"
VENDOR_DIR="$REPO_ROOT/skills/vendor"   # vendored skills land in <VENDOR_DIR>/<key>/<dest>/

# True when the manifest src is a file blob path (currently: *.md), not a folder.
is_file_src() {
  case "$1" in
    *.md|*.MD|*.Md) return 0 ;;
    *) return 1 ;;
  esac
}

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

# Per-repo tip SHA after probe/fetch — written as "$CACHE_ROOT/$key.sha" for
# file-path skill extraction (no associative arrays; macOS /bin/bash is 3.2).

# --- 1. per repo: create/refresh a slim mirror of the wanted paths ----------
for repo in "${REPOS[@]}"; do
  read -r key url <<<"$repo"
  mirror="$CACHE_ROOT/$key"

  dir_paths=()
  file_paths=()
  for entry in "${SKILLS[@]}"; do
    read -r ekey src _dst <<<"$entry"
    [ "$ekey" = "$key" ] || continue
    if is_file_src "$src"; then
      file_paths+=("$src")
    else
      dir_paths+=("$src")
    fi
  done
  # Skip repos with no skills in the (possibly filtered) set.
  [ ${#dir_paths[@]} -eq 0 ] && [ ${#file_paths[@]} -eq 0 ] && continue

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
    # Cone sparse only matters when we have directory paths to materialize.
    if [ ${#dir_paths[@]} -gt 0 ]; then
      git -C "$mirror" sparse-checkout init --cone
    fi
    local_sha=""
  else
    local_sha="$(git -C "$mirror" rev-parse HEAD 2>/dev/null || echo "")"
  fi

  # Narrow the working tree to the wanted *directory* paths. File-path skills
  # are extracted via `git show` and never need a sparse materialization — so a
  # root-level SKILL.md in a huge app repo does not pull the whole tree.
  if [ ${#dir_paths[@]} -gt 0 ]; then
    echo "==> [$key] sparse paths: ${dir_paths[*]}"
    # Mirrors created for file-only skills may not have sparse-checkout yet.
    git -C "$mirror" sparse-checkout init --cone 2>/dev/null || true
    git -C "$mirror" sparse-checkout set "${dir_paths[@]}"
  else
    echo "==> [$key] file-only skills: ${file_paths[*]} (no sparse checkout)"
  fi

  if [ "$remote_sha" = "$local_sha" ]; then
    echo "==> [$key] up to date at ${remote_sha:0:12}; skipping fetch"
  else
    echo "==> [$key] upstream at ${remote_sha:0:12}; fetching $branch"
    git -C "$mirror" fetch --depth 1 origin "$branch"
    # For directory skills we need a checked-out worktree. For file-only skills
    # pointing FETCH_HEAD is enough for `git show` — skip worktree materialize.
    if [ ${#dir_paths[@]} -gt 0 ]; then
      git -C "$mirror" checkout -B "$branch" "origin/$branch" >/dev/null 2>&1
    else
      git -C "$mirror" update-ref "refs/heads/$branch" "origin/$branch"
      git -C "$mirror" symbolic-ref HEAD "refs/heads/$branch" 2>/dev/null || true
    fi
  fi

  printf '%s\n' "$remote_sha" > "$CACHE_ROOT/$key.sha"
done

# --- 2. copy each skill, flat, and normalize its name: field ---------------
echo "==> Copying into $VENDOR_DIR"
MISSING=()   # skills whose upstream src path no longer exists (likely moved/renamed)
for entry in "${SKILLS[@]}"; do
  read -r key src dst <<<"$entry"
  mirror="$CACHE_ROOT/$key"
  sha=""
  [ -f "$CACHE_ROOT/$key.sha" ] && sha="$(cat "$CACHE_ROOT/$key.sha")"
  [ -n "$sha" ] || sha="$(git -C "$mirror" rev-parse HEAD 2>/dev/null || echo "")"

  if is_file_src "$src"; then
    # Single-file skill (e.g. root SKILL.md): extract the blob only.
    if [ -z "$sha" ] || ! git -C "$mirror" cat-file -e "$sha:$src" 2>/dev/null; then
      echo "!!  [$key] upstream file not found: $src"
      echo "!!      did upstream move/rename it? update this skill's src (3rd field) in $MANIFEST"
      echo "!!      kept existing skills/vendor/$key/$dst/ as-is (last good copy, not refreshed)"
      MISSING+=("$key  $src  -> skills/vendor/$key/$dst")
      continue
    fi
    echo "    [$key] $src (file) -> skills/vendor/$key/$dst/"
    mkdir -p "$VENDOR_DIR/$key"
    rm -rf "$VENDOR_DIR/$key/$dst"
    mkdir -p "$VENDOR_DIR/$key/$dst"
    git -C "$mirror" show "$sha:$src" > "$VENDOR_DIR/$key/$dst/SKILL.md"
  else
    if [ ! -d "$mirror/$src" ]; then
      echo "!!  [$key] upstream path not found: $src"
      echo "!!      did upstream move/rename it? update this skill's src (3rd field) in $MANIFEST"
      echo "!!      kept existing skills/vendor/$key/$dst/ as-is (last good copy, not refreshed)"
      MISSING+=("$key  $src  -> skills/vendor/$key/$dst")
      continue
    fi
    echo "    [$key] $src -> skills/vendor/$key/$dst/"
    mkdir -p "$VENDOR_DIR/$key"
    rsync -a --delete --exclude '.git' "$mirror/$src/" "$VENDOR_DIR/$key/$dst/"
  fi

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

echo "==> Done."
[ "$STAGE" = 1 ] && echo "    (dest folders staged)" || echo "    Review with: git -C \"$REPO_ROOT\" status"

# Surface any skipped skills loudly at the end (easy to miss mid-log) and exit
# non-zero so callers/automation notice the manifest needs fixing.
if [ ${#MISSING[@]} -gt 0 ]; then
  echo
  echo "!!  WARNING: ${#MISSING[@]} skill(s) had NO matching upstream path and were NOT updated:"
  for m in "${MISSING[@]}"; do echo "!!    $m"; done
  echo "!!  Likely an upstream move/rename — fix each src path (3rd field) in:"
  echo "!!    $MANIFEST"
  echo "!!  then re-run the sync. (dest unchanged => same folder + skill name, nothing downstream breaks)"
  exit 3
fi
