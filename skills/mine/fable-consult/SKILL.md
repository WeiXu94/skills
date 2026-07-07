---
name: fable-consult
description: Only use when the user explicitly mentions "fable". Spawns Claude Code with the fable[1m] model (high effort) in print mode as a sub-agent for planning, code review, academic writing, or any advanced reasoning task.
---

# Fable Consult

The fable model excels at deep reasoning. For best results, spend effort crafting a clear, well-structured prompt — include relevant file paths, context, and specific questions.

## Usage

```bash
"$SKILL_DIR"/scripts/fable-print "PROMPT"
```

## Prompt crafting

- Mention file paths so fable can read them directly
- Be specific about what you want: plan, critique, rewrite, review, etc.
- Include constraints and expectations
- Instruct fable to end with a concise summary of its findings and the file(s) changed/created — this will be shown to the user
