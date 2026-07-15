---
name: research-adr
description: Write a research ADR for a settled, consequential identification, sample, data, model, or method choice among genuinely live alternatives. Use when the user asks to ADR, record, log, or document that decision; when discussing why one approach beat alternatives; or when a choice explicitly replaces a prior ADR.
disable-model-invocation: true
metadata:
  opencode/slash: true
  opencode/autoinvoke: false
---

# Research ADR

Capture **why** a research decision was made — not an implementation plan. Same role as coding ADRs: immutable decision history. The ADR is the internal source of truth; papers/notes may summarize for their audience and should link back where practical.

## Steps

### 1. Gate

Write only if **alternatives were genuinely live** at decision time and the choice binds later work. One ADR = one **independently reversible** choice (split if identification, sample, estimator, and inference could later change separately).

Good grain: "DiD not IV", "cluster at province", "drop pre-2010", "CFPS not CHFS", "CFPS 2018 not 2016", "log not levels".
Not an ADR: whole paper design, literature summary, estimation script, or a choice with no real alternative.

**Done when:** user has explicitly accepted the choice (or asked to record a settled one). If rationale is missing from materials, ask — never invent it.

### 2. Locate the log

Path: `<project>/docs/adr/` (create if missing). List existing files; **read titles (and bodies of candidates)** for the same decision — update/supersede rather than duplicate. Next id = max `NNNN` + 1 (start `0001`). Numbers permanent — never renumber.

**Done when:** no duplicate exists (or supersession target identified); next id assigned.

### 3. Draft

Filename: `NNNN.<domain>.<slug>.md`. Domains: `identification` | `sample` | `data` | `model` | `method` (or project-defined, stay consistent).

```markdown
---
title: <short decision title>
id: ADR-NNNN
date: <YYYY-MM-DDTHH:MM:SS±HH:MM>
status: accepted
supersedes: []          # e.g. [ADR-0003]
superseded_by: []
related: []             # other ADRs this depends on or informs
---

## Context

What forced the choice? Constraints, evidence, assumptions that distinguished the live options, prior ADRs. Do not invent missing rationale.

## Alternatives

- **A** — …
- **B** — …
Only options that were genuinely viable at decision time. Why each was live; why losers lost.

## Decision

The choice, in one or two sentences.

## Consequences

What this locks in / rules out. Upsides and downsides. Material validity threats and required robustness / follow-up checks when applicable.

## References

Durable, precise cites (paper + locator, dataset + version, code path/rev) with a short relevance note — no dumps.
```

Status: `proposed` | `accepted` | `Deprecated` | `rejected` (proposed then overturned) | `superseded`. Write `accepted` only when the user has settled it; use `proposed` if still under discussion.

### 4. Supersede, don't rewrite

Never edit an accepted ADR's substance. To reverse: set old `status: superseded` + `superseded_by`; new ADR has `supersedes`. Both sides of the link required.

## Done when

- User accepted the choice (or asked to record a settled one)
- Every listed alternative was genuinely live
- Context records evidence/assumptions (no invented rationale)
- Consequences include validity / downstream implications where applicable
- Supersession links are reciprocal if any
- User is pointed at the path

## Rules

- **Rationale, not implementation plan.** No estimation pipelines, table specs, or paper outlines.
- **Network.** Fill `related` / `supersedes` so decisions form a graph, not a pile.
