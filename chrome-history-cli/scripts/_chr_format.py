#!/usr/bin/env python3
"""Post-process ripgrep output for chr-search.

Reads matched HTU TSV lines on stdin. Each row: URL\tU<ms>.<frac>\ttype\ttitle.
Decodes timestamp, applies date range / field / limit filters, prints
newest-first as: YYYY-MM-DD HH:MM\tURL\tTITLE
"""
import os
import re
import sys
from datetime import datetime, timezone


def parse_date(s: str, end_of_day: bool = False) -> float | None:
    if not s:
        return None
    dt = datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    if end_of_day:
        dt = dt.replace(hour=23, minute=59, second=59)
    return dt.timestamp() * 1000.0  # ms


def main() -> int:
    since_ms = parse_date(os.environ.get("SINCE", ""), end_of_day=False)
    until_ms = parse_date(os.environ.get("UNTIL", ""), end_of_day=True)
    limit = int(os.environ.get("LIMIT", "50") or "0")
    field = os.environ.get("FIELD", "all")
    pattern = os.environ.get("PATTERN", "")
    fixed = os.environ.get("FIXED", "0") == "1"
    ignore_case = os.environ.get("IGNORE_CASE", "1") == "1"

    if field in ("url", "title"):
        flags = re.IGNORECASE if ignore_case else 0
        if fixed:
            field_re = re.compile(re.escape(pattern), flags)
        else:
            try:
                field_re = re.compile(pattern, flags)
            except re.error as e:
                # Fall back to literal if user's regex isn't valid Python regex
                # (ripgrep's regex flavor is a superset). Still let ripgrep
                # match decide; just skip the column-level recheck.
                print(f"warning: --field filter disabled (regex error: {e})",
                      file=sys.stderr)
                field_re = None
    else:
        field_re = None

    rows: list[tuple[float, str, str, str]] = []
    for line in sys.stdin:
        line = line.rstrip("\n")
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        url, vid, _ttype, title = parts[0], parts[1], parts[2], "\t".join(parts[3:])

        if not vid.startswith("U"):
            continue
        ms_str = vid[1:].split(".", 1)[0]
        try:
            ms = float(ms_str)
        except ValueError:
            continue

        if since_ms is not None and ms < since_ms:
            continue
        if until_ms is not None and ms > until_ms:
            continue

        if field_re is not None:
            target = url if field == "url" else title
            if not field_re.search(target):
                continue

        rows.append((ms, url, title, vid))

    rows.sort(key=lambda r: r[0], reverse=True)

    out = sys.stdout
    n = 0
    for ms, url, title, _vid in rows:
        dt = datetime.fromtimestamp(ms / 1000.0).strftime("%Y-%m-%d %H:%M")
        out.write(f"{dt}\t{url}\t{title}\n")
        n += 1
        if limit > 0 and n >= limit:
            break
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        # Common when piping to `head`; exit cleanly.
        try:
            sys.stdout.close()
        except Exception:
            pass
        sys.exit(0)
