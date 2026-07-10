#!/usr/bin/env bash
# Wait for a fable-consult subagent to finish, then print just its final reply
# (banner/prompt-box/status-bar chrome stripped, hard-wrap artifacts fixed).
# usage: answer.sh <name> [timeout_ms] [lines]
set -euo pipefail

NAME="${1:?usage: answer.sh <name> [timeout_ms] [lines]}"
TIMEOUT="${2:-600000}"
LINES="${3:-300}"

PANE=$(herdr agent get "$NAME" | jq -r '.result.agent.pane_id')

# `agent wait --status idle` is unreliable here: Claude Code's TUI briefly
# renders an idle-looking frame mid-generation (false positive), and an
# unattended pane that really has finished settles on "done", not "idle"
# ("done" = finished but not yet looked at) and stays there. So wait on the
# pane's "done" status instead, via the pane-targeted wait command.
herdr wait agent-status "$PANE" --status done --timeout "$TIMEOUT" >/dev/null

# Zoom only around the read itself (not the whole wait) so the pane doesn't
# eclipse the rest of the session while the subagent is working. Always
# unzoom, even on failure.
cleanup() { herdr pane zoom "$PANE" --off >/dev/null 2>&1 || true; }
trap cleanup EXIT

herdr pane zoom "$PANE" --on >/dev/null
sleep 0.3

herdr agent read "$NAME" --source recent-unwrapped --lines "$LINES" --format text \
  | jq -r '.result.read.text' \
  | awk '
      /^⏺/ { collecting=1; buf="" }
      collecting && /^[✻✢✳]/ { if (buf != "") last=buf; collecting=0; next }
      collecting { buf = buf $0 "\n" }
      END { printf "%s", last }
    ' \
  | sed -E 's/^⏺ ?//; s/^  //' \
  | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'
