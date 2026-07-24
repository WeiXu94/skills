---
name: zotero-cli
description: Zotero library search, citation export, and index management via the `zot` CLI. Use when the user wants to find or search their saved papers/references — by author/year/title (keyword) or by topic/concept (semantic), including when they don't recall the exact title; summarize or read a saved paper; export a paper's BibTeX/citation; or update/rebuild the Zotero semantic search index.
---

# Zotero CLI (`zot`)

A three-command Python CLI over a local Zotero library:

- `zot search` — keyword OR semantic search, returns JSON
- `zot bibtex` — export an item as BibTeX (by Zotero key or search query), via Better BibTeX by default
- `zot update-db` — rebuild the semantic index (delegates to `zotero-mcp update-db`)

Semantic search reuses the ChromaDB index that `zotero-mcp` already builds at `~/.config/zotero-mcp/chroma_db/`, so results stay consistent with whatever the user has indexed.

**Autosync.** Before any semantic query, `zot` checks Zotero for the `dateAdded` of the most recent top-level item and compares it to a marker at `~/.config/zotero-mcp/.zot_last_sync`. If the marker is missing or older, `zot` runs `zotero-mcp update-db` (incremental) and then refreshes the marker on success. If nothing new has been added, the check is a single API call (~1s overhead). Pass `--no-autosync` or set `ZOT_AUTOSYNC=0` to disable.

## Choosing keyword vs semantic — the most important decision

| User wrote | Mode | Why |
|---|---|---|
| "Brewer 2011", surname, exact title fragment | `--keyword` (default) | Substring match. Short queries best. |
| "papers on machine learning", "X about Y" | `--auto` | Try keyword first, fall back to semantic. |
| "papers similar to / related to / conceptually close to …" | `--semantic` | User explicitly asked for similarity. |
| Pasted abstract or paragraph | `--semantic` | Keyword can't handle long text. |
| "papers at the intersection of A and B" | `--semantic` | Cross-concept queries. |

**Keyword query construction is counterintuitive**: extra words make the search STRICTER, not broader (it's substring matching, not search-engine ranking). For "papers by Brewer on attention 2011", just send `Brewer 2011`. Strip topic words.

When in doubt → `--auto`.

## Commands

All search output is JSON on stdout. Errors and progress on stderr.

```bash
# Keyword (default)
zot search "Brewer 2011"
zot search --keyword "Cladder-Micus" -n 5
zot search "ML" -t "-attachment" -c COLLECTION_KEY

# Semantic (explicit)
zot search --semantic "papers on transformer attention mechanisms"
zot search -s "RLHF for code generation" -n 20

# Auto: keyword first, semantic fallback if 0 hits
zot search --auto "deep learning for protein folding"

# Pasted abstract → semantic. Use $(cat -) or shell expansion to pass long text safely.
zot search -s "$(cat abstract.txt)"

# BibTeX export (Better BibTeX by default; --native for Zotero's built-in)
zot bibtex ABC123XY                        # direct Zotero key
zot bibtex "Autor 2013"                    # search query → first hit
zot bibtex "Autor 2013 China" --native     # multiple-word query, native exporter

# Rebuild index
zot update-db                              # incremental, metadata only
zot update-db --fulltext                   # include PDF fulltext (slower, better quality)
zot update-db --fulltext --force-rebuild   # nuke and rebuild from scratch
```

## Output format

```json
{
  "mode": "keyword",
  "query": "Brewer 2011",
  "results": [
    {
      "key": "ABC123XY",
      "title": "...",
      "creators": ["Brewer, J.A."],
      "date": "2011",
      "itemType": "journalArticle",
      "abstract": "...",
      "tags": ["mindfulness"],
      "DOI": "...",
      "url": "..."
    }
  ]
}
```

Semantic results add `"similarity"` (0–1, higher is closer) and `"snippet"` (first 300 chars of indexed text). Auto-mode results that fall back to semantic include `"fallback": true`.

The `key` field is the Zotero item key — keep it; it's needed for any follow-up like fetching fulltext, attachments, or citations.

## Workflow patterns

**"Summarize my paper on X"**
1. `zot search --auto "X"` to get a key
2. If multiple hits, ask the user which (or pick by best title match)
3. Read fulltext: `curl "http://localhost:23119/api/users/0/items/<KEY>/fulltext"` (returns JSON with a `content` field)

**"What papers do I have on X?"** — `zot search --auto "X"`. If results look thin or off-topic, suggest `zot update-db` to refresh the index, especially if the user has added papers recently.

**"Find papers similar to this one"** — pull the abstract (search by key, read `abstract`), pipe to `zot search -s`.

**"Export BibTeX for these papers"** — `zot bibtex <KEY|"query">`. The argument is a Zotero key (8 uppercase alphanumerics) or a search query; on multiple matches the command prints a disambiguation list to stderr and exits non-zero.

## When a command fails

`zot` prints errors to stderr. Before reporting failure to the user, see README.md § Troubleshooting — the usual causes (Zotero desktop stopped, `zotero-mcp-server` not installed, stale index) each have a one-line fix there.


