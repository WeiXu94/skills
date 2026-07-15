---
name: claude-subagent
description: Spawns Claude Code (claude-cli) with the default fable model (high effort) in print mode as a sub-agent for planning, code review, academic writing, or any advanced reasoning task. Use when the user wants a deep-reasoning subagent via the Claude CLI.
disable-model-invocation: true
metadata:
  opencode/slash: true
  opencode/autoinvoke: false
---

# Claude Subagent

The fable model excels at deep reasoning. For best results, spend effort crafting a clear, well-structured prompt — include relevant file paths, context, and specific questions.

## Usage

```bash
"$SKILL_DIR"/scripts/claude-print.sh "PROMPT" [model] [effort]
```

Defaults: model `fable`, effort `high` unless the user specifies otherwise.

## Prompt crafting

- Mention file paths so fable can read them directly
- Be specific about what you want: plan, critique, rewrite, review, etc.
- Include constraints and expectations
- Instruct fable to end with a concise summary of its findings and the file(s) changed/created — this will be shown to the user
