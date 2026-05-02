---
name: netnewswire-cli
description: Read, summarize, and search articles in NetNewsWire (the macOS RSS reader) from the command line via AppleScript. Use this skill whenever the user mentions NetNewsWire, NNW, RSS feeds on a Mac, daily news digests from their reader, summarizing today's articles, or anything that involves pulling content out of NetNewsWire. Also use when the user asks to "summarize my feeds", "what's new in my RSS", "give me a digest", or wants to schedule a recurring news summary on macOS — even if they don't say "NetNewsWire" explicitly, this is the right tool when the source is a local Mac RSS reader. Do not use for fetching arbitrary RSS feeds from the open web (use a feed parser for that), and do not use on non-macOS systems.
---

# NetNewsWire CLI

A small toolkit of AppleScript + bash scripts that talk to NetNewsWire on macOS. Use it to list articles, read full text, and build digests — without running an MCP server or other long-lived process.

## When to reach for this

- "Summarize today's unread articles from NetNewsWire."
- "Pull all starred articles from the last week and write a Markdown report."
- "Set up a daily 8am summary of my feeds." (cron / launchd)
- "Search my RSS for recent posts about <topic>."

## When NOT to use this

- The user wants to fetch a specific public RSS URL — use `curl` + a feed parser instead. This skill only sees what NetNewsWire has already fetched.
- Non-macOS environments — `osascript` is macOS-only.
- The user wants real-time push / streaming — NNW doesn't expose that via AppleScript; this skill only does pull.

## Prerequisites the user must have

Before any script runs:

1. **macOS** with NetNewsWire installed and **running** (the app must be open — AppleScript can launch it but article fetching only works when the app is running and has done at least one refresh).
2. **`jq`** in `$PATH` (`brew install jq`).
3. **Automation permission** — the first invocation triggers a macOS prompt: System Settings → Privacy & Security → Automation → grant the running terminal app (Terminal/iTerm/etc.) access to NetNewsWire. If permission is denied, every script returns an empty result with a permission error in stderr. Tell the user to check this if they see empty output.

## The three scripts

All live in this skill's `scripts/` directory and are executable:

| Script | Purpose | Output |
| --- | --- | --- |
| `nnw-articles` | List articles with filters | NDJSON (one JSON object per line) on stdout |
| `nnw-read <id> [<id> …]` | Get article(s) full content. Single ID → one JSON object; multiple IDs (positional or via `--batch` from stdin) → NDJSON, in input order | JSON or NDJSON on stdout |
| `nnw-daily` | Orchestrator: list → batch-read → LLM summarize | Markdown digest |

Run `<script> --help` to see the full flags. The `.applescript` files in the same directory are called by these wrappers — do not invoke them directly unless you need to debug.

## The composition pattern

These tools are designed to pipe together with `jq`. The standard pattern is:

```text
nnw-articles [filters]      →  NDJSON stream of article metadata
   ↓ jq -r .id
nnw-read --batch            →  NDJSON of full articles (text, html, summary)
   ↓ jq -r .text
<your processing>           →  summarize, search, format, etc.
```

`nnw-articles` returns metadata + summary only. For full article bodies, pipe IDs into `nnw-read --batch` — this fetches N articles in a single `osascript` invocation, amortizing the ~150 ms startup cost. Empirical: 5 articles via `--batch` runs in ~1.8 s vs ~2.8 s for 5 separate `nnw-read` calls (~35% faster). Always prefer `--batch` over a per-ID loop.

## Common recipes

### Recipe 1: Today's unread articles, JSON

```bash
"$SKILL_DIR"/scripts/nnw-articles --unread --since-hours 24
```

Output is one JSON object per line. Use `jq -s .` to collect into an array if you need to count or sort.

### Recipe 2: Get one article as Markdown

```bash
"$SKILL_DIR"/scripts/nnw-read <id> --markdown
```

Requires `pandoc`. Without `pandoc`, use `--text` for plain text or default JSON.

### Recipe 3: Batch-fetch many articles in one shot

Pipe IDs from `nnw-articles` straight into `nnw-read --batch`. This makes one `osascript` invocation handle the whole list, instead of N separate calls. NDJSON out, one object per ID, in input order:

```bash
"$SKILL_DIR"/scripts/nnw-articles --unread --since-hours 24 \
  | jq -r .id \
  | "$SKILL_DIR"/scripts/nnw-read --batch
```

You can also pass IDs as positional args (`nnw-read id1 id2 id3 ...`) which behaves identically. Prefer stdin for >5 IDs to avoid the shell's `ARG_MAX` limit.

For not-found IDs the batch emits `{"error":"article not found","id":"..."}` and continues — caller can detect gaps with `jq 'select(.error)'`.

### Recipe 4: Daily digest with an LLM

`nnw-daily` does the full pipeline. It chooses the LLM backend in this order:

1. `$LLM_CMD` — any shell command that reads a prompt on stdin and writes the summary on stdout. Examples: `export LLM_CMD='llm -m claude-opus-4-7'`, `export LLM_CMD='ollama run llama3.2'`.
2. `$ANTHROPIC_API_KEY` — calls `https://api.anthropic.com/v1/messages` directly via `curl`.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
"$SKILL_DIR"/scripts/nnw-daily --since-hours 24 --limit 30 --out ~/Desktop/digest.md
```

Articles always stay unread after the digest — the user might want to open the full posts after seeing the summary, and there's no automatic mark-read step.

### Recipe 5: Build a custom digest yourself

When the user wants something `nnw-daily` doesn't do (e.g., group by topic, filter to specific feeds, translate, etc.), build the pipeline yourself with `--batch`:

```bash
nnw-articles --unread --since-hours 24 \
  | jq -r .id \
  | nnw-read --batch \
  | jq -c '{title, feed, text, summary, html}' \
  | <your-LLM-or-processing-step>
```

Don't fall back to a per-ID loop — `--batch` is one `osascript` call regardless of how many IDs you feed it, and parallel `osascript` calls just queue on NNW's single-threaded AppleScript dispatcher anyway.

### Recipe 6: Token-efficient last-day digest (preferred when *you* are the LLM)

This is the routine to use when the user asks "summarize the last day's articles" and *you* (Claude / the calling model) are the summarizer — i.e., article bodies are about to land in your context window. Reading every body is wasteful: a normal day has 10–50 unread articles, most of which are link roundups, brief commentary, or feed-noise that the metadata + summary already captures. Token-thrift here is the difference between a tight digest and burning 50k+ tokens on filler.

**The routine:**

1. **List metadata for the window.** One `nnw-articles` call — gives you title, feed, date, summary for everything.
   ```bash
   "$SKILL_DIR"/scripts/nnw-articles --since-hours 24 --limit 200 > /tmp/list.ndjson
   ```

2. **Triage in your head.** Read the metadata list and pick a *small* subset (target ≤6, hard cap ≈10) of articles to fetch in full. Good signals for "fetch fully":
   - High-signal feeds the user clearly cares about (named publications, individual writers — not aggregator/newsletter feeds).
   - Title suggests a substantive argument or analysis (not "Friday assorted links", "Newsletter #N", a YouTube video, or a one-line linkpost).
   - The summary is meaty enough to hint at depth but short enough that you can't summarize from it alone.

   Skip-fully-read signals: link roundups, "assorted links", weekly newsletters, video posts (no transcript), AEA chart highlights, and anything where the summary already conveys the whole point.

3. **Batch-fetch the chosen subset.** Pipe IDs into `nnw-read --batch` so all N fetches happen in one `osascript` invocation — measured 35% faster than a per-ID loop on 5 articles, and the gap widens with more IDs. Don't parallelize separate calls: NNW's AppleScript dispatcher is single-threaded and parallel `osascript` calls just queue.
   ```bash
   printf '%s\n' "$CHOSEN_IDS" \
     | "$SKILL_DIR"/scripts/nnw-read --batch \
     > /tmp/full.ndjson
   ```

4. **Extract text with the right fallback.** On most feeds the `text` field comes back empty even when the article has full content — `html` is what's actually populated. The fallback chain is `text || summary || strip_html(html)`, but expect the third branch to fire most of the time. Per-article, on the NDJSON stream:
   ```bash
   jq -c '{id, title, feed, body: (
     if (.text // "") != "" then .text
     elif (.summary // "") != "" then .summary
     else .html end
   )}' /tmp/full.ndjson \
   | while IFS= read -r row; do
       printf '%s' "$row" | jq -r .body | python3 -c "
   import sys, re, html
   t = sys.stdin.read()
   t = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', t, flags=re.S|re.I)
   t = re.sub(r'</?(p|div|br|h[1-6]|li|tr|blockquote)[^>]*>', '\n', t, flags=re.I)
   t = re.sub(r'<[^>]+>', '', t)
   print(re.sub(r'\n\s*\n+', '\n\n', html.unescape(t)).strip())
   "
   done
   ```
   If `pandoc` is installed (`brew install pandoc`), prefer `pandoc -f html -t plain --wrap=none` for cleaner output (preserves list structure, smarter blockquote handling). The Python fallback is for the no-deps case. See Pitfall 5.

5. **Build a hybrid digest.** For the few full-fetched articles, write 2–4 sentences of real synthesis. For the rest, write a one-line bullet from metadata only (`feed | title — summary`). Group by topic, not by feed — the user wants "what happened in the world" not "what happened in feed X".

**Token budget rule of thumb:** a typical fully-read post contributes 3k–8k tokens of body; a metadata-only entry is ~50 tokens. Reading 5 of 30 articles fully ≈ 25–40k tokens; reading all 30 ≈ 150k+. Always do the triage.

**Output shape the user usually wants:**
```markdown
# Daily digest — <date range>
N unread articles fetched.

## <Topic A>
- **<Title>** — *<Feed>*. <2–4 sentence synthesis from full body.> [link]
- **<Title>** — *<Feed>*. <one-line from summary only.> [link]

## <Topic B>
...
```

## Pitfalls to know about

These will save the user (and you) debugging time:

**1. Empty output usually means permission denied.** macOS silently fails AppleScript automation if permission isn't granted. If `nnw-articles` returns nothing, do not assume the user has no unread articles — first ask them to check System Settings → Privacy & Security → Automation. Specifically tell them to grant access to the *terminal program they ran the command from*, not just NetNewsWire.

**2. Date filtering happens after fetch, not in the `where` clause.** AppleScript's `where` clause on NNW articles doesn't reliably support date comparisons. The `--since-hours` flag fetches all articles matching other filters, then drops old ones in AppleScript. This means `--since-hours 1 --limit 1000` is roughly the same cost as `--limit 1000` — the limit, not the time window, controls the upper bound of work done.

**3. `--limit` interacts with `--since-hours` weirdly.** Articles are streamed feed-by-feed in NNW's internal order, and the limit cuts off after N matching articles regardless of date. With `--since-hours 24`, if the first feed enumerated has 100 old articles, those get filtered out but still count toward iteration cost. For "all of today's unread", set `--limit` to 200+ to be safe.

**4. Article IDs are stable but feed-scoped.** Don't try to construct article IDs by hand — always get them from `nnw-articles` output. They look like opaque strings (account-specific format) and should be passed verbatim.

**5. `nnw-read` returns both `html` and `text`, and `text` is usually empty.** In practice, most feeds populate only `html` — observed in a recent run where 12/12 articles had `text=""` while `html` was full. Don't trust `nnw-daily`'s `text // .summary` fallback to give you bodies; for an actual digest, strip the HTML yourself. Correct chain: `text || summary || strip_html(html)`, but expect the third branch to fire most of the time.

**5a. Exotic control characters pass through unescaped in JSON output.** The AppleScript JSON encoder (`jsonStr` in `read_article.applescript` / `list_articles.applescript`) escapes the seven common cases (`\` `"` `\b` `\t` `\n` `\f` `\r`). Other control chars in U+0000–U+001F (very rare in HTML) are passed through verbatim. `jq` and most parsers accept this leniently; if you ever feed output to a strict JSON consumer, add more `bulkReplace` calls. Don't be tempted to revert to a per-character escape loop — see Pitfall 8.

**6. NetNewsWire must be running.** If the app is closed, AppleScript will launch it (because of `tell application "NetNewsWire"`), but it won't have synced yet, so you'll get stale articles or none at all. For cron/launchd jobs, either rely on the user keeping NNW open, or add a sync step (see "Scheduling" below).

**7. Mac sleep blocks scheduled jobs.** A cron job at 8am won't run if the Mac is asleep. Use `launchd` with `RunAtLoad=true` or a wakeup schedule, or use `caffeinate` if you only need to stay awake briefly.

**8. Don't revert the AppleScript JSON encoder to a per-character loop.** The current `jsonStr` uses `text item delimiters` for O(N) bulk replacement of the seven JSON-escaped chars. An earlier version iterated character-by-character and was O(N²) on string length — large bodies (Zvi's 100KB+ housing roundups, weekly newsletters with hundreds of links) hung the AppleScript bridge indefinitely. Fix verified: a previously-hanging 105KB Zvi post now decodes in ~2s. If you add new escape cases, do them as additional `bulkReplace` calls — never as a per-char loop, no matter how "clean" it looks.

## Scheduling a recurring digest

For a daily 8am digest, prefer `launchd` over cron on macOS:

```text
~/Library/LaunchAgents/com.user.nnw-daily.plist
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.user.nnw-daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>/path/to/scripts/nnw-daily --out ~/Desktop/nnw-$(date +\%F).md</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ANTHROPIC_API_KEY</key><string>sk-ant-...</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StandardErrorPath</key><string>/tmp/nnw-daily.err</string>
</dict></plist>
```

Load with `launchctl load ~/Library/LaunchAgents/com.user.nnw-daily.plist`.

`PATH` matters — `launchd` jobs start with a minimal `PATH` that doesn't include `/opt/homebrew/bin`, so `jq`/`pandoc`/`curl` won't be found unless added explicitly.

## How to extend

If the user asks for something the four scripts don't cover (e.g., "list all my folders", "subscribe to a new feed", "search for keyword X"), check `references/applescript-cookbook.md` — it has the relevant NNW AppleScript snippets you can adapt into a new wrapper. Don't try to invent the AppleScript syntax from scratch; NNW's scripting dictionary uses some unusual property names (`allFeeds` not `all feeds`, `homepage url` not `homepageUrl`).

## Quick reference for output schemas

`nnw-articles` (one per line):

```json
{"id": "...", "title": "...", "url": "...", "feed": "...", "date": "2026-05-01T08:30:00", "read": false, "starred": false, "summary": "..."}
```

`nnw-read <id>` (single ID — one JSON object) or `nnw-read --batch` / `nnw-read id1 id2 …` (multiple — NDJSON, one of these per line, in input order):

```json
{"id": "...", "title": "...", "url": "...", "external_url": "...", "feed": "...", "date": "...", "authors": "...", "read": false, "starred": false, "summary": "...", "text": "...", "html": "..."}
```

Not-found IDs in batch mode emit:

```json
{"error": "article not found", "id": "..."}
```
