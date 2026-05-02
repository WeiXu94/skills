-- read_article.applescript
-- Args: <articleId> [<articleId> ...]
-- Output: NDJSON (one JSON object per ID, in input order). Single-ID call
-- returns one object on stdout (with trailing newline). Not-found IDs emit
-- {"error":"article not found","id":"..."} so callers can detect gaps.
--
-- Batching note: by amortizing osascript startup (~150ms) across N IDs, a
-- multi-ID invocation is meaningfully faster than N separate calls. The
-- per-article Apple Event marshaling (NNW → osascript IPC for the html
-- payload) is unchanged and remains the dominant cost on big articles.

on run argv
	set output to ""

	tell application "NetNewsWire"
		repeat with rawId in argv
			set targetId to rawId as string
			set found to false
			repeat with acct in every account
				if found then exit repeat
				repeat with f in allFeeds of acct
					if found then exit repeat
					try
						set matched to (get every article of f whose id is targetId)
					on error
						set matched to {}
					end try
					if (count of matched) > 0 then
						set output to output & my articleFullJson(item 1 of matched) & linefeed
						set found to true
					end if
				end repeat
			end repeat
			if not found then
				set output to output & "{\"error\":\"article not found\",\"id\":" & my jsonStr(targetId) & "}" & linefeed
			end if
		end repeat
	end tell

	return output
end run

on articleFullJson(a)
	tell application "NetNewsWire"
		set aId to id of a
		set aTitle to ""
		try
			set aTitle to title of a
		end try
		set aUrl to ""
		try
			set aUrl to url of a
		end try
		set aExtUrl to ""
		try
			set aExtUrl to external url of a
		end try
		set aHtml to ""
		try
			set aHtml to html of a
		end try
		set aText to ""
		try
			set aText to contents of a
		end try
		set aSummary to ""
		try
			set aSummary to summary of a
		end try
		set aDate to ""
		try
			set aDate to (published date of a) as string
		end try
		set aFeed to name of feed of a
		set aAuthors to ""
		try
			repeat with auth in every author of a
				if aAuthors is not "" then set aAuthors to aAuthors & ", "
				set aAuthors to aAuthors & (name of auth)
			end repeat
		end try
		set isRead to read of a
		set isStarred to starred of a
	end tell

	return "{\"id\":" & my jsonStr(aId) & ¬
		",\"title\":" & my jsonStr(aTitle) & ¬
		",\"url\":" & my jsonStr(aUrl) & ¬
		",\"external_url\":" & my jsonStr(aExtUrl) & ¬
		",\"feed\":" & my jsonStr(aFeed) & ¬
		",\"date\":" & my jsonStr(aDate) & ¬
		",\"authors\":" & my jsonStr(aAuthors) & ¬
		",\"read\":" & isRead & ¬
		",\"starred\":" & isStarred & ¬
		",\"summary\":" & my jsonStr(aSummary) & ¬
		",\"text\":" & my jsonStr(aText) & ¬
		",\"html\":" & my jsonStr(aHtml) & "}"
end articleFullJson

-- O(N) JSON-string encoding via AppleScript's text item delimiters.
-- The previous per-character implementation was O(N^2) on string length and
-- hung indefinitely on large HTML payloads (e.g. 100KB+ Substack roundups).
-- Backslash MUST be replaced first, otherwise the inserted backslashes from
-- subsequent passes get themselves doubled. Order of the rest does not matter.
-- Exotic control chars (other than \b \t \n \f \r) are passed through unescaped;
-- jq and most JSON parsers accept this in practice. If you ever feed output to
-- a strict parser, add more bulkReplace calls.
on jsonStr(s)
	if s is missing value then return "\"\""
	set s to s as string
	if s is "" then return "\"\""
	set s to my bulkReplace(s, "\\", "\\\\")
	set s to my bulkReplace(s, "\"", "\\\"")
	set s to my bulkReplace(s, (character id 8), "\\b")
	set s to my bulkReplace(s, (character id 9), "\\t")
	set s to my bulkReplace(s, (character id 10), "\\n")
	set s to my bulkReplace(s, (character id 12), "\\f")
	set s to my bulkReplace(s, (character id 13), "\\r")
	return "\"" & s & "\""
end jsonStr

on bulkReplace(s, find, repl)
	set savedTID to AppleScript's text item delimiters
	set AppleScript's text item delimiters to find
	set parts to text items of s
	set AppleScript's text item delimiters to repl
	set s to parts as string
	set AppleScript's text item delimiters to savedTID
	return s
end bulkReplace
