#!/usr/bin/env bash
# claude-print — invoke Claude Code CLI in print mode as a subagent
# Usage: claude-print "<prompt>" [model] [effort]
#   model defaults to "fable[1m]", effort defaults to "high"
# If no prompt argument, reads from stdin.

set -euo pipefail

PROMPT="${1:-$(cat)}"
MODEL="${2:-fable}"
EFFORT="${3:-high}"

exec env \
  ANTHROPIC_BASE_URL="https://www.packyapi.com" \
  ANTHROPIC_AUTH_TOKEN="${PACKY_CLAUDE_SALE_API_KEY}" \
  CLAUDE_CODE_ATTRIBUTION_HEADER=0 \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1 \
  claude --model "$MODEL" --effort "$EFFORT" --dangerously-skip-permissions --print "$PROMPT"
