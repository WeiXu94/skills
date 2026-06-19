---
name: record-as-implement
description: Implement a spec while maintaining a session-scoped notes file of off-spec decisions, deviations, and tradeoffs.
---

Implement the user's spec: $ARGUMENTS

**One notes file per Claude session, reused across turns.** Resolve the path before writing:

1. Read session id: `echo "$CLAUDE_CODE_SESSION_ID"` (fall back to `env | grep -i claude` if empty).
2. Marker: `/tmp/claude-implement-<session-id>` — its contents are the notes file's absolute path. If the marker exists and that file exists, reuse it.
3. Otherwise, create `./docs/<YYYYMMDDHHMM>-implementation-notes.<ext>` (current local time, set once) and write its absolute path into the marker. Create `./docs/` if missing. Pick whatever format and structure fit the notes best.

Log only things invisible from the diff:
- Decisions the spec didn't specify (and why)
- Deviations (spec said / you did / why)
- Tradeoffs between viable options
- Assumptions to confirm
- Surprises: quirks, constraints, unexpected behavior

Skip routine steps. Update as you go, not at the end. When done, point the user at the file.
