---
name: zotero-cli
description: Search and manage a local Zotero library from the command line via the `zot` CLI. Use this skill whenever the user asks about papers in their Zotero library, wants to find a reference they've saved, searches by author/year/title (keyword) or by topic/concept (semantic), or wants to rebuild the Zotero semantic search index. Trigger this for phrases like "find my paper on X", "what do I have saved about Y", "search Zotero", "Zotero library", "my references on Z", "summarize my paper on W", or when the user mentions a paper they know they've added but doesn't recall the exact title. Also trigger when the user wants to update the Zotero semantic search database.
---

# Zotero CLI (`zot`)

A two-command Python CLI over a local Zotero library:

- `zot search` — keyword OR semantic search, returns JSON
- `zot update-db` — rebuild the semantic index (delegates to `zotero-mcp update-db`)

Semantic search reuses the ChromaDB index that `zotero-mcp` already builds at `~/.config/zotero-mcp/chroma_db/`, so results stay consistent with whatever the user has indexed.

**Autosync.** Before any semantic query, `zot` checks Zotero for the `dateAdded` of the most recent top-level item and compares it to a marker at `~/.config/zotero-mcp/.zot_last_sync`. If the marker is missing or older, `zot` runs `zotero-mcp update-db` (incremental) and then refreshes the marker on success. If nothing new has been added, the check is a single API call (~1s overhead). Pass `--no-autosync` or set `ZOT_AUTOSYNC=0` to disable.

## When to use this skill

Trigger whenever the user references their Zotero library or asks about papers they've saved. Don't ask "would you like me to search Zotero?" — just run the search and show results. Common cues:

- "do I have anything on …", "what did I save about …"
- "find that paper by …", "the X paper from 20YY"
- "summarize my paper on …" (search first, then read fulltext for the matching key)
- "papers similar to this abstract: …"
- "rebuild the Zotero index", "update my Zotero search db", "the semantic search seems stale"

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

**"Export BibTeX for these papers"** — search to get keys, then for each key:
`curl "http://localhost:23119/api/users/0/items/<KEY>?format=bibtex"`

## Limitations to flag to the user

- **Local API must be enabled.** Zotero desktop must be running with "Allow other applications on this computer to communicate with Zotero" enabled (Settings → Advanced → General). If keyword search returns connection errors, this is almost always why.
- **Semantic depends on `zotero-mcp` being installed and `update-db` having been run.** If `zot search -s` errors with "cannot import zotero_mcp", run `pip install zotero-mcp-server` (or `pipx inject zotero-mcp-server zotero-mcp-server` if zotero-mcp was installed via pipx). If it errors with "no such collection" or returns 0 results, run `zot update-db --fulltext` first.
- **Tag filters** (`#foo`) aren't reliably matched by `qmode=titleCreatorYear`. For tag-heavy queries, mention this caveat or suggest the user try semantic mode instead.
- **Local API is read-only.** This skill cannot create/modify items. For writes, the user needs `ZOTERO_API_KEY` and a different tool.

## Installation (for reference, in case the user asks)

```bash
chmod +x scripts/zot
ln -s "$PWD/scripts/zot" ~/.local/bin/zot   # or copy

zot --help
zot search "test" -n 1                       # tests Zotero local API
zot search -s "test" -n 1                    # tests ChromaDB access
```

`zot` is a single Python file with **no third-party imports** beyond what `zotero_mcp` already pulls in. The shebang line uses `python3` — whichever Python is on PATH must have `zotero-mcp-server` importable (for semantic mode only; keyword mode uses only stdlib).

## Environment variables (rarely needed)

| Var | Default | Use |
|---|---|---|
| `ZOTERO_LOCAL_BASE` | `http://localhost:23119/api` | Override if Zotero runs on a non-default port |
| `ZOTERO_USER_ID` | `0` | Local API uses 0 for all users; only change for unusual setups |
| `ZOT_AUTOSYNC` | `1` | Set to `0` to disable the auto `update-db` check before semantic queries |
| `ZOT_SYNC_MARKER` | `~/.config/zotero-mcp/.zot_last_sync` | File where the last-synced `dateAdded` is stored |

Embedding model and ChromaDB path are read from `~/.config/zotero-mcp/config.json` automatically — no need to configure them here.
