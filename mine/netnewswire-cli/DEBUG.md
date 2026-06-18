# NetNewsWire CLI — Debugging & Internals

Pitfalls, troubleshooting, and how to extend the skill. For day-to-day usage, see [SKILL.md](SKILL.md).

## Pitfalls

**1. Empty output usually means permission denied.** macOS silently fails AppleScript automation if permission isn't granted. If `nnw-articles` returns nothing, do not assume the user has no unread articles — first ask them to check System Settings → Privacy & Security → Automation. Specifically tell them to grant access to the *terminal program they ran the command from*, not just NetNewsWire.

**2. Date filtering happens after fetch, not in the `where` clause.** AppleScript's `where` clause on NNW articles doesn't reliably support date comparisons. The `--since-hours` flag fetches all articles matching other filters, then drops old ones in AppleScript. This means `--since-hours 1 --limit 1000` is roughly the same cost as `--limit 1000` — the limit, not the time window, controls the upper bound of work done.

**3. `--limit` interacts with `--since-hours` weirdly.** Articles are streamed feed-by-feed in NNW's internal order, and the limit cuts off after N matching articles regardless of date. With `--since-hours 24`, if the first feed enumerated has 100 old articles, those get filtered out but still count toward iteration cost. For "all of today's unread", set `--limit` to 200+ to be safe.

**4. Article IDs are stable but feed-scoped.** Don't try to construct article IDs by hand — always get them from `nnw-articles` output. They look like opaque strings (account-specific format) and should be passed verbatim.

**5. `nnw-read` returns both `html` and `text`, and `text` is usually empty.** In practice, most feeds populate only `html` — observed in a recent run where 12/12 articles had `text=""` while `html` was full. Don't trust `nnw-daily`'s `text // .summary` fallback to give you bodies; for an actual digest, strip the HTML yourself. Correct chain: `text || summary || strip_html(html)`, but expect the third branch to fire most of the time.

**5a. Exotic control characters pass through unescaped in JSON output.** The AppleScript JSON encoder (`jsonStr` in `read_article.applescript` / `list_articles.applescript`) escapes the seven common cases (`\` `"` `\b` `\t` `\n` `\f` `\r`). Other control chars in U+0000–U+001F (very rare in HTML) are passed through verbatim. `jq` and most parsers accept this leniently; if you ever feed output to a strict JSON consumer, add more `bulkReplace` calls. Don't be tempted to revert to a per-character escape loop — see Pitfall 8.

**6. NetNewsWire must be running.** If the app is closed, AppleScript will launch it (because of `tell application "NetNewsWire"`), but it won't have synced yet, so you'll get stale articles or none at all. Ask the user to keep NNW open before invoking the scripts.

**7. NetNewsWire does not expose a refresh/sync verb to AppleScript.** You cannot tell NNW to fetch new articles from Feedly/iCloud from the command line. NNW refreshes on its own internal schedule (Settings → General → Refresh every N min). The scripts only see what NNW has already pulled.

**8. Don't revert the AppleScript JSON encoder to a per-character loop.** The current `jsonStr` uses `text item delimiters` for O(N) bulk replacement of the seven JSON-escaped chars. An earlier version iterated character-by-character and was O(N²) on string length — large bodies (Zvi's 100KB+ housing roundups, weekly newsletters with hundreds of links) hung the AppleScript bridge indefinitely. Fix verified: a previously-hanging 105KB Zvi post now decodes in ~2s. If you add new escape cases, do them as additional `bulkReplace` calls — never as a per-char loop, no matter how "clean" it looks.

## Performance notes

- **Apple Event marshaling dominates.** A 105 KB article takes ~1.8 s end-to-end; the JSON-encode step inside AppleScript is ~200 ms of that. Moving the encode step to shell (sed/jq) or JS saves the 200 ms but adds wrapper-side parsing complexity. Not worth it.
- **Batch reads are ~35% faster than sequential.** 5 articles via `nnw-read --batch` in 1.83 s vs. 2.80 s for 5 separate `nnw-read` calls. The gap widens with N because per-call `osascript` startup (~150 ms) is amortized.
- **Don't parallelize.** NNW's AppleScript dispatcher is single-threaded; parallel `osascript` calls just queue.

## How to extend

If the user asks for something the three scripts don't cover (e.g., "list all my folders", "subscribe to a new feed", "search for keyword X"), check `references/applescript-cookbook.md` — it has the relevant NNW AppleScript snippets you can adapt into a new wrapper. Don't try to invent the AppleScript syntax from scratch; NNW's scripting dictionary uses some unusual property names (`allFeeds` not `all feeds`, `homepage url` not `homepageUrl`).
