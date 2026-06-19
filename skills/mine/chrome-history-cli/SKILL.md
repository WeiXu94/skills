---
name: chrome-history-cli
description: Search local Chrome browsing history exported by the History Trends Unlimited (HTU) extension. Use when the user asks "what was that page I visited about X?", "search my browsing history", "when did I last open Y?", or anything pointing at their own past Chrome activity. Works on TSV backups in ~/Downloads (htu_autobackup_*_incremental.tsv) — merges incrementals into a rolling combined master file, then searches with ripgrep. Do not use for live Chrome history (read the SQLite db directly) or for non-HTU exports.
---

# Chrome History CLI

Two scripts in `scripts/`:

| Script | Purpose |
| --- | --- |
| `chr-merge`  | Merge HTU incremental TSV exports into a deduplicated master `~/Downloads/htu_combined.tsv` |
| `chr-search` | Ripgrep over the master file, decode timestamps, filter by date/field, format output |

## Why merge?

HTU's autobackup file (`htu_autobackup_<date>_incremental.tsv`) is a rolling **1-year** window — older history falls off as new visits arrive. The combined master accumulates everything ever seen, so the archive grows past 1 year. Dedup is by visit ID (column 2 — globally unique).

## File format

Tab-separated, no header:

| Col | Field | Example |
| --- | --- | --- |
| 1 | URL | `https://github.com/anthropics/claude-code` |
| 2 | Visit ID | `U1772422487445.272` (`U` + epoch-ms with µs fraction) |
| 3 | Transition type | `0` link, `6` reload, etc. |
| 4 | Page title | `claude-code` |

## Workflow

`chr-search` auto-merges. Just run it:

```bash
"$SKILL_DIR"/scripts/chr-search 'kagi'
"$SKILL_DIR"/scripts/chr-search --since 2026-01-01 'github.com/anthropics'
"$SKILL_DIR"/scripts/chr-search --since 2026-04-01 --until 2026-04-30 --field title 'claude'
"$SKILL_DIR"/scripts/chr-search --limit 200 --field url 'arxiv'
```

On each run, `chr-search` checks `~/Downloads` for `htu_autobackup_*_incremental.tsv` files. If any exist, it invokes `chr-merge` (stderr notice), then searches. After a successful merge, processed files are moved to `~/Downloads/htu_merged/` so the next call sees an empty input and skips the merge entirely. No-op runs add ~0 ms overhead. Auto-merge is disabled when the user passes a non-default `--file` (so search-against-custom-file never mutates the default master).

`chr-merge` can still be called directly for explicit merges or troubleshooting:

```bash
"$SKILL_DIR"/scripts/chr-merge                 # one-shot merge + archive
"$SKILL_DIR"/scripts/chr-merge --no-archive    # leave inputs in place (debug)
```

Output: tab-separated rows, newest first:

```
2026-05-03 15:08	https://github.com/anthropics/claude-code/...	claude-code at main · anthropics/claude-code
```

## Flags

`chr-merge`:

| Flag | Default |
| --- | --- |
| `--input-dir DIR` | `~/Downloads` |
| `--out FILE` | `~/Downloads/htu_combined.tsv` |
| `--archive-dir DIR` | `<input-dir>/htu_merged` |
| `--no-archive` | off (archive on by default) |

`chr-search`:

| Flag | Default | Notes |
| --- | --- | --- |
| `--file PATH` | `~/Downloads/htu_combined.tsv` | |
| `--since YYYY-MM-DD` | — | inclusive, UTC |
| `--until YYYY-MM-DD` | — | inclusive, end-of-day UTC |
| `--limit N` | `50` | `0` = unlimited |
| `--field {all,url,title}` | `all` | `url` / `title` re-check the match against that column |
| `--fixed`, `-F` | off | literal pattern, no regex |
| `--case-sensitive` | off | default is case-insensitive |
| `--no-auto-merge` | off | skip the pre-search merge check |

## Tips

- Broad terms (`google`, `youtube`) easily return tens of thousands of rows. Always set `--limit` and add `--since` for recency-weighted searches.
- `--field title` is the right call when looking for a *concept* you remember reading about (the URL probably doesn't contain it). `--field url` when you remember the domain or path.
- Re-running `chr-merge` is idempotent; the auto-merge in `chr-search` skips entirely when nothing is pending.
- Archived backups live in `~/Downloads/htu_merged/`. Periodically clear them out once you trust the master is intact.
- Master file size: ~10 MB per year. Search latency stays under 100 ms for several years of data.
- For ad-hoc shell work, the master file is plain TSV — `awk -F'\t'`, `cut -f4`, etc. all work directly.
