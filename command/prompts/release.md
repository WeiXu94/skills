---
description: Commit, bump version, tag, and push to trigger a GitHub release
argument-hint: "<major|minor|patch>"
---
Release this project with bump level `${1:-patch}`. Stop and report on any failure.

1. **Commit pending changes** — `git add -A && git commit` with a concise message. Do this before bumping so the bump runs on a clean tree.
2. **Bump version** — `npm version ${1:-patch} --no-git-tag-version` (or the project's equivalent). Read the new version as `NEW_VERSION`.
3. **Commit + tag** — `git add -A && git commit -m "chore(release): v$NEW_VERSION"` and `git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"`.
4. **Push** — `git push origin HEAD "v$NEW_VERSION"`. The `v*` tag triggers the GitHub Action release.
5. **Watch the run**:
   ```bash
   RUN_ID=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
   gh run watch "$RUN_ID" --exit-status
   ```
   If it fails, surface the failed job's log (`gh run view "$RUN_ID" --log-failed`) and stop.

Report: old -> new version, commit hash, tag, run URL, and final pass/fail. Do not run `gh release create` — the Action handles publishing.
