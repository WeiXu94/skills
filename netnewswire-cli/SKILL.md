---
name: netnewswire-cli
description: Read, summarize, and search articles in NetNewsWire (the macOS RSS reader) from the command line via AppleScript. Use this skill whenever the user mentions NetNewsWire, NNW, RSS feeds on a Mac, daily news digests from their reader, or summarizing today's articles. Also use when the user asks to "summarize my feeds", "what's new in my RSS", or "give me a digest" — even if they don't say "NetNewsWire" explicitly, this is the right tool when the source is a local Mac RSS reader. Do not use for fetching arbitrary RSS feeds from the open web (use a feed parser for that), and do not use on non-macOS systems.
---

# NetNewsWire CLI

Bash + AppleScript wrappers around NetNewsWire on macOS. Three scripts: list articles, read article bodies, build an LLM digest.

For pitfalls, troubleshooting, and how to extend the skill, see [DEBUG.md](DEBUG.md).

## Prerequisites

1. **macOS**, with NetNewsWire **running** and at least one refresh completed.
2. **`jq`** in `$PATH` (`brew install jq`).
3. **`pandoc`** for HTML → plain-text conversion (`brew install pandoc`).
4. **Automation permission** — first run prompts macOS; grant the calling terminal app access to NetNewsWire under System Settings → Privacy & Security → Automation. Empty output usually = permission denied.

## The three scripts

All under `scripts/`, executable.

| Script | Purpose | Output |
| --- | --- | --- |
| `nnw-articles` | List articles with filters | NDJSON (one JSON per line) |
| `nnw-read <id> [<id> …]` | Fetch full article(s). Single ID → one JSON; multiple IDs (positional or `--batch` from stdin) → NDJSON | JSON / NDJSON |
| `nnw-daily` | Orchestrator: list → batch-read → LLM summarize | Markdown digest |

Run `<script> --help` for flags. Always prefer `nnw-read --batch` over a per-ID loop — single `osascript` call instead of N.

## Composition pattern

```text
nnw-articles [filters]   →  NDJSON metadata stream
   ↓ jq -r .id
nnw-read --batch         →  NDJSON of full articles (text, html, summary)
   ↓ jq / pandoc
<your processing>        →  summarize, search, format
```

`nnw-articles` returns metadata + summary only — for full bodies, pipe IDs into `nnw-read --batch`.

## Recipes

### 1. Today's unread articles

```bash
"$SKILL_DIR"/scripts/nnw-articles --unread --since-hours 24
```

NDJSON out. Use `jq -s .` to collect into an array.

### 2. One article as Markdown

```bash
"$SKILL_DIR"/scripts/nnw-read <id> --markdown   # needs pandoc
"$SKILL_DIR"/scripts/nnw-read <id> --text       # plain text
"$SKILL_DIR"/scripts/nnw-read <id>              # full JSON
```

### 3. Batch-fetch many articles

```bash
"$SKILL_DIR"/scripts/nnw-articles --unread --since-hours 24 \
  | jq -r .id \
  | "$SKILL_DIR"/scripts/nnw-read --batch
```

NDJSON out, one object per ID, in input order. Not-found IDs emit `{"error":"article not found","id":"..."}`. Positional form (`nnw-read id1 id2 …`) works the same; prefer stdin for >5 IDs (avoids `ARG_MAX`).

### 4. Daily digest with an LLM

`nnw-daily` runs the full pipeline. LLM backend is picked in this order:

1. `$LLM_CMD` — any shell command that reads prompt on stdin and writes summary on stdout. Example: `export LLM_CMD='llm -m claude-opus-4-7'`.
2. `$ANTHROPIC_API_KEY` — calls `https://api.anthropic.com/v1/messages` via `curl`.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
"$SKILL_DIR"/scripts/nnw-daily --since-hours 24 --limit 30 --out ~/Desktop/digest.md
```

### 5. Custom digest

```bash
nnw-articles --unread --since-hours 24 \
  | jq -r .id \
  | nnw-read --batch \
  | jq -c '{title, feed, text, summary, html}' \
  | <your-LLM-or-processing-step>
```

### 6. Token-efficient last-day digest (preferred when *you* are the LLM)

Use this when *you* are the model summarizing. Reading every body burns tokens for little gain — most days have 10–50 articles, mostly link roundups and short commentary that the metadata already captures.

1. **List metadata.**
   ```bash
   "$SKILL_DIR"/scripts/nnw-articles --since-hours 24 --limit 200 > /tmp/list.ndjson
   ```

2. **Triage.** Pick a small subset to read fully (target ≤6, hard cap ≈10). Read fully when: high-signal feed (named writer/publication, not aggregator), title suggests a real argument, summary hints at depth but isn't the whole point. Skip: link roundups, "assorted links", weekly newsletters, video posts, anything whose summary already says it all.

3. **Batch-fetch the chosen subset.**
   ```bash
   printf '%s\n' "$CHOSEN_IDS" \
     | "$SKILL_DIR"/scripts/nnw-read --batch \
     > /tmp/full.ndjson
   ```

4. **Extract bodies as plain text via pandoc.** `text` is usually empty (most feeds populate only `html`); fall back through `text → summary → html`, then run pandoc on the result. **Note:** jq's `//` operator only falls back on `null`/`false`, *not* empty strings — so use an explicit `if/elif` chain, otherwise an empty `text` field swallows the fallback.
   ```bash
   jq -c '. + {body: (
            if (.text // "") != "" then .text
            elif (.summary // "") != "" then .summary
            else (.html // "") end
          )}' /tmp/full.ndjson \
     | while IFS= read -r row; do
         printf '=== %s ===\n' "$(printf '%s' "$row" | jq -r .title)"
         printf '%s' "$row" | jq -r .body | pandoc -f html -t plain --wrap=none
         printf '\n'
       done
   ```
   pandoc handles plain-text input transparently, so the summary fallback also works.

5. **Build a hybrid digest.** 2–4 sentences of synthesis for each fully-read article; one-line bullets from metadata for the rest. Group by topic, not by feed.

**Token budget:** a fully-read post ≈ 3k–8k tokens; a metadata-only entry ≈ 50 tokens. Reading 5 of 30 articles fully ≈ 25–40k vs all 30 ≈ 150k+. Always triage.

**Output shape:**
```markdown
# Daily digest — <date range>
N unread articles fetched.

## <Topic A>
- **<Title>** — *<Feed>*. <2–4 sentence synthesis from full body.> [link]
- **<Title>** — *<Feed>*. <one-line from summary only.> [link]
```

## Output schemas

`nnw-articles`:

```json
{"id": "...", "title": "...", "url": "...", "feed": "...", "date": "2026-05-01T08:30:00", "read": false, "starred": false, "summary": "..."}
```

`nnw-read` (single object, or NDJSON of these in batch mode):

```json
{"id": "...", "title": "...", "url": "...", "external_url": "...", "feed": "...", "date": "...", "authors": "...", "read": false, "starred": false, "summary": "...", "text": "...", "html": "..."}
```

Not-found IDs in batch mode:

```json
{"error": "article not found", "id": "..."}
```
