#!/usr/bin/env python3
import argparse
import csv
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Search the China micro-survey catalog by keywords and fields."
    )
    parser.add_argument(
        "--catalog",
        default=os.path.join(os.path.dirname(__file__), "..", "references", "survey_catalog.csv"),
        help="Path to survey_catalog.csv",
    )
    parser.add_argument(
        "--q",
        default="",
        help="Keyword query (space-separated). Matches name, topics, notes.",
    )
    parser.add_argument(
        "--field",
        action="append",
        default=[],
        help="Field-specific filter, e.g. --field unit=household",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of results (0 = no limit)",
    )
    return parser.parse_args()


def parse_field_filters(items):
    filters = []
    for item in items:
        if "=" not in item:
            continue
        key, val = item.split("=", 1)
        filters.append((key.strip(), val.strip()))
    return filters


def matches_query(row, tokens):
    if not tokens:
        return True
    hay = " ".join(
        [
            row.get("survey_id", ""),
            row.get("name_en", ""),
            row.get("topics", ""),
            row.get("notes", ""),
        ]
    ).lower()
    return all(tok in hay for tok in tokens)


def matches_fields(row, filters):
    for key, val in filters:
        if val.lower() not in row.get(key, "").lower():
            return False
    return True


def main():
    args = parse_args()
    if not os.path.isfile(args.catalog):
        print(f"Catalog not found: {args.catalog}", file=sys.stderr)
        return 2

    tokens = [t.lower() for t in args.q.split() if t.strip()]
    filters = parse_field_filters(args.field)

    with open(args.catalog, newline="") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            if not matches_query(row, tokens):
                continue
            if not matches_fields(row, filters):
                continue
            rows.append(row)

    if args.limit:
        rows = rows[: args.limit]

    if not rows:
        print("No matches.")
        return 0

    # Print a compact table
    headers = ["survey_id", "name_en", "unit", "frequency", "years_or_waves", "topics", "access"]
    print("\t".join(headers))
    for row in rows:
        print("\t".join(row.get(h, "") for h in headers))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
