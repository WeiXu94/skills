# NetNewsWire AppleScript Cookbook

Reference snippets for extending the skill with new operations. Read this when you need to add functionality the four bundled scripts don't cover.

## NetNewsWire's scripting dictionary, in a nutshell

The properties Claude is most likely to need:

| Object | Properties |
| --- | --- |
| `application` | `current article`, `selected articles`, `accounts`, `feeds` |
| `account` | `name`, `id`, `active`, `allFeeds`, `folders`, `opml representation` |
| `feed` | `url`, `name`, `homepage url`, `icon url`, `favicon url`, `articles`, `authors` |
| `folder` | `name`, `id`, `feeds`, `articles` |
| `article` | `id`, `title`, `url`, `external url`, `contents`, `html`, `summary`, `published date`, `arrived date`, `read` (r/w), `starred` (r/w), `feed` |
| `author` | `name`, `url`, `avatar url`, `email address` |

Quirks worth flagging:

- `allFeeds of acct` returns top-level feeds (those not inside a folder). For feeds inside folders, you have to iterate `folders of acct` then `feeds of fld` separately.
- `articles` on a feed returns *all* articles NNW has cached, which can be hundreds per feed. Always use a `where` filter or a counter.
- `where` works for `read is false` and `starred is true` reliably. Date comparisons in `where` are flaky — filter dates in a Repeat block instead.
- `read` and `starred` are read/write — assign to them to mark.

## Recipe: list all feeds and folders

```applescript
tell application "NetNewsWire"
  set output to ""
  repeat with acct in every account
    set output to output & "ACCOUNT: " & (name of acct) & linefeed
    repeat with f in allFeeds of acct
      set output to output & "  " & (name of f) & " <" & (url of f) & ">" & linefeed
    end repeat
    repeat with fld in every folder of acct
      set output to output & "  FOLDER: " & (name of fld) & linefeed
      repeat with f in every feed of fld
        set output to output & "    " & (name of f) & " <" & (url of f) & ">" & linefeed
      end repeat
    end repeat
  end repeat
  return output
end tell
```

## Recipe: subscribe to a new feed

```applescript
tell application "NetNewsWire"
  -- Top-level in first account:
  make new feed at first account with properties {url:"https://example.com/feed.xml"}

  -- Inside a specific folder:
  repeat with acct in every account
    repeat with fld in every folder of acct
      if name of fld is "Tech" then
        make new feed at fld with properties {url:"https://example.com/feed.xml"}
        return "OK"
      end if
    end repeat
  end repeat
end tell
```

## Recipe: search articles by keyword

```applescript
tell application "NetNewsWire"
  set output to ""
  set matchCount to 0
  set maxResults to 20
  set q to "your search term"
  repeat with acct in every account
    if matchCount ≥ maxResults then exit repeat
    repeat with f in allFeeds of acct
      if matchCount ≥ maxResults then exit repeat
      repeat with a in every article of f
        if matchCount ≥ maxResults then exit repeat
        set t to ""
        try
          set t to title of a
        end try
        set c to ""
        try
          set c to contents of a
        end try
        if t contains q or c contains q then
          set output to output & (id of a) & "|" & t & linefeed
          set matchCount to matchCount + 1
        end if
      end repeat
    end repeat
  end repeat
  return output
end tell
```

This is slow on large libraries. NNW already has its own search index — for production use, consider exposing `selected articles` (the result of an in-app search) instead of searching from AppleScript.

## Recipe: get the currently selected article

Useful for "summarize the article I'm reading right now":

```applescript
tell application "NetNewsWire"
  set a to current article
  if a is missing value then return "ERROR:No article selected"
  return (title of a) & linefeed & (contents of a)
end tell
```

## Recipe: get OPML for backup

```applescript
tell application "NetNewsWire"
  set out to ""
  repeat with acct in every account
    set out to out & "ACCOUNT: " & (name of acct) & linefeed
    set out to out & (opml representation of acct) & linefeed
  end repeat
  return out
end tell
```

The `opml representation` returns a full OPML XML string, ready to write to a file.

## Pattern: building a new wrapper script

When adding a new operation, follow the existing convention:

1. Write the AppleScript as a standalone file in `scripts/<name>.applescript` that takes args via `on run argv`.
2. Output JSON or NDJSON, not pipe-delimited — the bundled `jsonStr` handler from `list_articles.applescript` can be copy-pasted for safe escaping.
3. Write a bash wrapper in the same directory that resolves `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` and calls `osascript "$SCRIPT_DIR/<name>.applescript" "$@"`.
4. Make the wrapper executable: `chmod +x scripts/<name>`.

## Debugging AppleScript

`osascript` errors are sparse. Useful tricks:

- Run the script standalone: `osascript /path/to/foo.applescript arg1 arg2`. Errors print to stderr with a line number.
- Open the `.applescript` file in macOS's Script Editor (built in) — it has syntax highlighting and a real debugger.
- If a `tell application "NetNewsWire"` block hangs, NNW is probably showing a modal dialog (e.g., "subscribe to this feed?"). Switch to NNW and dismiss it.
- Empty output with no error usually means the Automation permission is missing. Check System Settings → Privacy & Security → Automation.
