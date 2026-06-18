---
name: econ-paper-writing-shape
description: Draft an econ paper section by section into sections/*.tex — fixed skeleton, grow each section from the materials pile, argue the LaTeX format, grill weak prose. Pairs with econ-paper-materials.
disable-model-invocation: true
---

<what-to-do>

Shape an economics paper from raw material into LaTeX, **one section per file**
under `sections/`, so each part stays small enough to edit and refine alone. The
macro-structure is a fixed **skeleton** (econ papers don't discover their shape) —
your job is to grow each section, pulling from the **quarry**: the `materials.md`
evidence pile built by econ-paper-materials (or any pile the user points at).

Read the pile end-to-end first. Treat it and any exported result files as
read-only inputs. Ask once where `main.tex` lives; default the project root.
Re-read a section file from disk before every write — the user edits `.tex`
between turns; never overwrite blindly.

1. **Lay the skeleton.** If absent, create `main.tex` (preamble + an `\input` of
   each section in order) and an empty `sections/<name>.tex` per section. Confirm
   which sections this paper needs — see
   [references/section-skeleton.md](references/section-skeleton.md) for the list,
   each section's purpose, the introduction formula, and the table convention.
   Skip the model section unless the paper is structural.
2. **Pick a section.** Default to the Introduction first, then revisit it after
   every other section is drafted — by the end it has had the most attention.
3. **Shape the section, unit by unit.**
   - *Introduction*: draft 2–3 candidate **openings**, each framing the
     contribution differently; the user picks or hybridizes. Then grow paragraph
     by paragraph along the formula: hook → question → antecedents → value-added →
     roadmap.
   - *Other sections*: grow unit by unit, each unit pulled from an exhibit in the
     quarry and its takeaway. For every unit, argue the **LaTeX format** out loud
     (below) before writing it.
4. **Write each agreed unit immediately** to that section's `.tex` file. Append,
   don't batch. If the user rewrites a unit, edit that unit in place; leave the
   rest alone.
5. **Grill as you go.** Refuse weak prose:
   - "What does this paragraph do that the previous didn't?"
   - "If I cut this, what breaks?"
   - "This sentence does two jobs — split it."
   - Econ edge: "Causal or descriptive?" · "Where's the identification?" ·
     "Every coefficient explained?" · "This is robustness, not main — move it."

A section is done when the user says so; the paper is done when the skeleton is
filled and the intro has been re-threaded against the final results.

</what-to-do>

<supporting-info>

## The LaTeX format menu

Each unit is rendered deliberately — weigh the choice with the user, don't default
silently:

- **Prose vs. equation** — a definition, assumption, or derivation that must be
  precise → `equation`/`align`. Otherwise prose.
- **Prose vs. regression table** — 3+ parallel estimates sharing columns → a
  `threeparttable`+`booktabs` table (convention in the reference). A single number
  → state it inline.
- **Prose vs. figure** — when a trend, distribution, or event-study path *is* the
  point → a `figure` float, then illustrate it ("what does this convey?").
- **Inline vs. footnote** — a caveat or aside that would derail the argument → a
  footnote.
- **Quote vs. `\cite`** — cite the antecedent; paraphrase the idea unless the
  original wording is the point.

Sizing shifts by section: the Introduction is paragraph-by-paragraph prose; the
Results section is exhibit-anchored (a table or figure plus its illustration); the
Model section is equation-driven.

## Pulling from the quarry

Each exhibit in the pile carries a takeaway and a target section. Place the
exhibit, then write the illustration the section needs — for a regression table,
say what each coefficient means (how X moves Y); for a figure, say what it
conveys. If a section needs something the pile lacks, name the gap: "We need a
robustness check here and the pile doesn't have one — run it or we cut this."

## Out of scope

- Editing the materials pile or exported result `.tex` files.
- Inventing results not in the pile.
- Bibliography management, journal-specific templating, or submission formatting.

</supporting-info>
