# zotero-cli skill

A two-command Python CLI (`zot`) that wraps Zotero's local API and `zotero-mcp`'s ChromaDB index, packaged as a Claude Code skill.

## What's in here

```text
zotero-cli/
├── SKILL.md                       # the skill description Claude reads
├── README.md                      # this file
└── scripts/
    └── zot                        # single-file Python CLI (~220 lines)
```

## Prerequisites

1. **Python 3.10+** (uses `str | None` syntax)
2. **`zotero-mcp-server`** installed in the same Python (you already have this, since you've been running `update-db`)
3. **Zotero desktop** running with **Settings → Advanced → "Allow other applications on this computer to communicate with Zotero"** enabled
4. **At least one `zotero-mcp update-db` run** so the ChromaDB index exists

## Install

```bash
chmod +x scripts/zot
ln -s "$(pwd)/scripts/zot" ~/.local/bin/zot

zot --help
zot search "test" -n 1                  # tests Zotero local API
zot search -s "neural networks" -n 3    # tests ChromaDB
```

If `zot search -s` fails with `cannot import zotero_mcp`, your `python3` on PATH doesn't have `zotero-mcp-server` available. Fix:

```bash
pip install zotero-mcp-server
# or, if you installed zotero-mcp via pipx:
pipx inject zotero-mcp-server zotero-mcp-server
```

If your `zotero-mcp` lives in a venv that isn't your default `python3`, change the shebang line in `scripts/zot` to point at that interpreter (e.g. `#!/Users/you/.venvs/zotero/bin/python`).

## Install as a Claude Code skill

Drop the entire `zotero-cli/` directory into your Claude Code skills folder (typically `~/.claude/skills/zotero-cli/`). Claude reads `SKILL.md` and invokes `zot` directly.

## Usage

```bash
zot search "Brewer 2011"                       # keyword (default)
zot search -s "papers on transformer attention" # semantic
zot search -a "RLHF for code"                  # auto: keyword → semantic fallback
zot search "ML" -n 5 -t "-attachment"          # limit + item type
zot search "ML" -c COLLECTION_KEY              # restrict to collection (keyword only)

zot update-db                                  # rebuild index, metadata-only
zot update-db --fulltext                       # include PDF fulltext
zot update-db --fulltext --force-rebuild       # nuke and rebuild
```

Output is JSON on stdout. Errors and progress on stderr.

## Architecture in 30 seconds

```text
zot                                                       # one Python file
├── search
│   ├── --keyword (default)
│   │   └── urllib → http://localhost:23119/api/users/0/...   # Zotero local API
│   ├── --semantic
│   │   └── from zotero_mcp.chroma_client import ...          # in-process import
│   │       └── client.query(...)                             # ChromaDB ANN search
│   └── --auto: keyword first, semantic fallback if 0 hits
│
└── update-db
    └── subprocess.call(["zotero-mcp", "update-db", ...])     # delegates entirely
```

Single language, single process. Semantic search loads the embedding model once on first call (~1-2s), then subsequent operations within the same invocation are fast. There is no IPC, no helper subprocess, no servers.

`update-db` shells out to `zotero-mcp` because reimplementing the indexer (incremental diff, batching, token truncation, PDF fulltext extraction, retry logic — ~1100 lines in `zotero_mcp.semantic_search`) would be a waste of effort.

## Limitations

- Read-only. Local API doesn't support writes.
- Tag-only filters work poorly with keyword mode (Zotero `qmode=titleCreatorYear` doesn't index tags reliably). Use semantic for tag-heavy queries, or extend the script.
- Single-user assumption (`ZOTERO_USER_ID=0`). Set the env var if you have a non-default setup.
- Python 3.10+ required for type union syntax. Lower it by replacing `str | None` with `Optional[str]` if you need 3.9.

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
| `ZOTERO_BBT_BASE` | `http://localhost:23119` | Better BibTeX base URL (legacy, no longer used; kept for back-compat) |
| `ZOTERO_USER_ID` | `0` | Local API uses 0 for all users; only change for unusual setups |
| `ZOT_AUTOSYNC` | `1` | Set to `0` to disable the auto `update-db` check before semantic queries |
| `ZOT_SYNC_MARKER` | `~/.config/zotero-mcp/.zot_last_sync` | File where the last-synced `dateAdded` is stored |

Embedding model and ChromaDB path are read from `~/.config/zotero-mcp/config.json` automatically — no need to configure them here.