#!/usr/bin/env bash
# Start (or restart) a Claude subagent in Herdr for fable-consult.
# usage: start.sh <name> <prompt> [model] [effort]
set -euo pipefail

NAME="${1:?usage: start.sh <name> <prompt> [model] [effort]}"
PROMPT="${2:?usage: start.sh <name> <prompt> [model] [effort]}"
MODEL="${3:-fable}"
EFFORT="${4:-high}"

OLD_PANE=$(herdr agent get "$NAME" 2>/dev/null | jq -r '.result.agent.pane_id // empty') || true
if [ -n "${OLD_PANE:-}" ]; then
  herdr pane close "$OLD_PANE" >/dev/null 2>&1 || true
fi

herdr agent start "$NAME" --cwd "$PWD" --split right -- \
  claude --model "$MODEL" --effort "$EFFORT" --dangerously-skip-permissions "$PROMPT" >/dev/null

echo "started $NAME"
