---
name: claude-subagent-herdr
description: Use when the user wants to consult "fable" or "Claude" for deep reasoning, planning, code review, or writing. Spawns Claude (fable/opus, high effort) as a Herdr agent target so the session is live-visible (attach, read, state) instead of hidden print output.
disable-model-invocation: true
---

# Claude Subagent (Herdr)

Spawns Claude as a Herdr agent target for full live visibility. Assumes you are already inside a Herdr session. Uses helper scripts in `scripts/` (relative to this file) so the read/cleanup mechanics don't need to be reasoned about each time.

1. Craft a self-contained prompt (file paths, exact deliverable, constraints)

2. Start (or restart) the subagent by name:
```bash
scripts/start.sh <name> "$PROMPT" [model] [effort]
```
Defaults: model `fable`, effort `high`. Closes any prior instance with the same `<name>` first.

3. Fetch the reply once ready (blocks until idle, then returns just the model's answer text):
```bash
scripts/answer.sh <name> [timeout_ms] [lines]
```
Defaults: timeout `600000`, lines `300` (raise `lines` for very long essay-style answers). Report the returned text to the user.

The agent pane keeps running afterward for live inspection (`herdr agent attach <name>`).

## Notes
- Swap `opus` in for `model` if the user asks for opus.
- Cleanup when fully done: `herdr pane close "$(herdr agent get <name> | jq -r .result.agent.pane_id)"`.
- read https://raw.githubusercontent.com/ogulcancelik/herdr/refs/heads/master/SKILL.md for more details on Herdr usage.
