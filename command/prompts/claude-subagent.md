---
description: Run Claude CLI as a subagent.
argument-hint: "<task> [model]"
---

Spawn Claude Code CLI in print mode as a subagent to do the task: $1

Define the prompt well. Execute this shell command (use a long timeout), quoting the prompt safely:

```bash
claude --model "${2:-fable}" --effort high --dangerously-skip-permissions --print "$PROMPT"
```

Report the CLI output/finding.