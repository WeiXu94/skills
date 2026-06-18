---
name: econ-paper-writing-shape
description: Draft an econ paper section by section into sections/*.tex — fixed skeleton, grow each section from the materials pile, grill weak prose. Pairs with econ-paper-writing-fragments.
disable-model-invocation: true
---

<what-to-do>

Shape an economics paper from raw material into LaTeX, **one section per file**
under `sections/`, so each part stays small enough to edit and refine alone. The
macro-structure is a fixed **skeleton** (econ papers don't discover their shape) —
your job is to grow each section, pulling from the **quarry**: the `materials.md`
evidence pile built by econ-paper-writing-fragments (or any pile the user points at).

Read the pile end-to-end first. Treat it and any exported result files as
read-only inputs. Ask once where `main.tex` lives; default the project root.

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
     quarry and its takeaway. Render the exhibit by convention (see Rendering) and
     write the illustration it needs.
4. **Write each agreed unit immediately** to that section's `.tex` file, following
   the writing rhythm below.
5. **Grill as you go.** Refuse weak prose:
   - "What does this paragraph do that the previous didn't?"
   - "If I cut this, what breaks?"
   - "This sentence does two jobs — split it."
   - Econ edge: "Causal or descriptive?" · "Where's the identification?" ·
     "Every coefficient explained?" · "This is robustness, not main — move it."
6. **Loop — this is the engine.** The skeleton is fixed, but each section is *grown
   by a loop*: repeat steps 3–5, unit by unit, until the section is done — the user
   decides when. Then return to step 2 and take the next section, until the skeleton
   is filled. Finally, re-thread the Introduction against the final results.

</what-to-do>

<supporting-info>

## Conversational feel

This is a grilling session inverted. In the fragments stage the question was "what
does this result show?"; here it is "what is this paper arguing, and in what order
does the reader need the evidence?" Push back. Refuse to let weak transitions
slide. Hold every claim to what its exhibit and identification actually support —
if a paragraph doesn't earn its place, cut it.

## Rendering

Exhibits render by convention, not by argument — don't deliberate them, render and
illustrate: a regression table → `threeparttable`+`booktabs` (convention in the
reference); a figure → a `figure` float; a definition or derivation →
`equation`/`align`; an antecedent → `\cite`. The one genuine call:

- **Inline vs. footnote** — a caveat or aside that would derail the argument → a
  footnote; otherwise inline.

Sizing shifts by section: the Introduction is paragraph-by-paragraph prose; the
Results section is exhibit-anchored (a table or figure plus its illustration); the
Model section is equation-driven.

## Pulling from the quarry

Each exhibit in the pile carries a takeaway and a target section. Place the
exhibit, then write the illustration the section needs — for a regression table,
say what each coefficient means (how X moves Y); for a figure, say what it
conveys. If a section needs something the pile lacks, name the gap: "We need a
robustness check here and the pile doesn't have one — run it or we cut this."

## Writing rhythm

Append to the section's `.tex` file as each unit is agreed — don't batch. Re-read
the file from disk before every write; the user edits the `.tex` between turns, so
never overwrite blindly. If the user wants a unit rewritten, edit that unit in
place and leave the rest alone.

## Out of scope

- Editing the materials pile or exported result `.tex` files.
- Inventing results not in the pile.
- Bibliography management, journal-specific templating, or submission formatting.

</supporting-info>
