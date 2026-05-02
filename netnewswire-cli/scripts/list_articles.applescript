-- list_articles.applescript
-- Args: <unreadOnly: true|false> <starredOnly: true|false> <sinceHours: number, 0 = no limit> <limit: number>
-- Output: NDJSON (one JSON object per line) so shell can stream-parse with jq.

on run argv
	set unreadOnly to (item 1 of argv is "true")
	set starredOnly to (item 2 of argv is "true")
	set sinceHours to (item 3 of argv) as number
	set maxArticles to (item 4 of argv) as integer

	set cutoffDate to missing value
	if sinceHours > 0 then
		set cutoffDate to (current date) - (sinceHours * hours)
	end if

	set output to ""
	set articleCount to 0

	tell application "NetNewsWire"
		repeat with acct in every account
			if articleCount ≥ maxArticles then exit repeat
			repeat with f in allFeeds of acct
				if articleCount ≥ maxArticles then exit repeat
				set matched to {}
				try
					if unreadOnly then
						set matched to (get every article of f where read is false)
					else if starredOnly then
						set matched to (get every article of f where starred is true)
					else
						set matched to (get every article of f)
					end if
				end try
				repeat with a in matched
					if articleCount ≥ maxArticles then exit repeat
					set keepIt to true
					if cutoffDate is not missing value then
						try
							if (published date of a) < cutoffDate then set keepIt to false
						on error
							set keepIt to false
						end try
					end if
					if keepIt then
						set output to output & my articleToJson(a) & linefeed
						set articleCount to articleCount + 1
					end if
				end repeat
			end repeat
		end repeat
	end tell

	return output
end run

-- Build a JSON object for one article. Only metadata + summary; no full body.
on articleToJson(a)
	tell application "NetNewsWire"
		set aId to ""
		try
			set aId to id of a
		end try
		set aTitle to ""
		try
			set aTitle to title of a
		end try
		set aUrl to ""
		try
			set aUrl to url of a
		end try
		set aSummary to ""
		try
			set aSummary to summary of a
		end try
		set aDate to ""
		try
			set aDate to (published date of a) as «class isot» as string
		on error
			try
				set aDate to (published date of a) as string
			end try
		end try
		set aFeed to ""
		try
			set aFeed to name of feed of a
		end try
		set isRead to read of a
		set isStarred to starred of a
	end tell

	return "{\"id\":" & my jsonStr(aId) & ¬
		",\"title\":" & my jsonStr(aTitle) & ¬
		",\"url\":" & my jsonStr(aUrl) & ¬
		",\"feed\":" & my jsonStr(aFeed) & ¬
		",\"date\":" & my jsonStr(aDate) & ¬
		",\"read\":" & isRead & ¬
		",\"starred\":" & isStarred & ¬
		",\"summary\":" & my jsonStr(aSummary) & "}"
end articleToJson

-- O(N) JSON-string encoding via AppleScript's text item delimiters.
-- See read_article.applescript for rationale; keep both copies in sync.
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
