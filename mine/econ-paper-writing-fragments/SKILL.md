---
name: econ-paper-writing-fragments
description: Inventory scattered econ-paper materials — tables, figures, data, model, literature, code — into one evidence pile, each exhibit with its takeaway, ready to draft from. Pairs with econ-paper-writing-shape.
disable-model-invocation: true
---

<what-to-do>

By the time an econ paper gets written, the results already exist — scattered as
table `.tex` files, figures, regression output, a model write-up, data docs,
reference PDFs, code. This skill gathers them into one **evidence pile**: a single
markdown file where every artifact becomes an **exhibit** with its **takeaway**.
Drafting (econ-paper-writing-shape) then treats the pile as a quarry.

Ask once where the project root is and where to write the pile (default
`materials.md` at the project root); remember the path. Re-read the pile from disk
before every write — the user edits it between turns; only append, or edit one
entry in place when asked.

1. **Sweep the project for artifacts.** Look for tables (`*.tex` under `tables/`,
   `results/`, `output/`), figures (`figures/`, `*.pdf`/`*.png`), regression logs,
   data dictionaries, model notes, references (`*.bib`, `/literature/`, PDFs), and
   the code that produced results. List what you found; have the user confirm,
   drop, or add. Completion: every found artifact is either logged below or
   explicitly set aside.
2. **Interrogate each artifact into an exhibit.** One short grilling per artifact —
   you are extracting the *illustration*, not just filing the file:
   - What does it show? (one line)
   - **Takeaway** — the single number or fact a reader must leave with.
   - **Claim** — which argument of the paper it supports.
   - Identification — why it is causal or descriptive; what variation drives it.
   - Caveats — what a referee attacks; where the robustness lives.
   - Section — where it belongs (Data, Results, Mechanisms, …).
3. **Append the exhibit** to the pile, then move to the next. Don't batch.
4. **Catch loose fragments too.** A mechanism half-thought, a sharp sentence, a
   number worth deploying — append it as a `Fragment` so it isn't lost.

Stop when every artifact is logged or set aside and each exhibit has a takeaway
and a target section. The pile is raw material — do not write paper prose here.

</what-to-do>

<supporting-info>

## The pile format

One H1 title, then exhibits and fragments separated by `---`. No order beyond the
order added — econ-paper-writing-shape decides order.

```markdown
# Materials: <working title>

## Exhibit: Table 2 — DiD earnings effect
- path: results/tab_did_earnings.tex
- type: regression table
- shows: 5-yr post-loss earnings, sons vs daughters
- takeaway: sons −2%, daughters −3% at year 5
- claim: parental death carries a labor-market penalty
- identification: matched-control DiD on sudden first parental deaths
- caveats: pre-trends in appendix; first deaths only
- section: Empirical Results

---

## Fragment
Women with young kids lose informal childcare → larger earnings hit (~4%).
Work into a mechanisms subsection.
```

## What counts as an exhibit

Any artifact the paper *shows and illustrates*: a regression table, a figure, a
summary-stats table, an event-study plot, a structural estimate, a model equation
block. The bar is "does the paper point at this and explain it?" If yes, it is an
exhibit and needs a takeaway.

## Writing rhythm

Append silently as exhibits emerge; mention what you logged in passing. Re-read
before every write; never overwrite — the user reorders and prunes the pile
between turns. "Cut that exhibit", "merge these two", "rewrite the takeaway
sharper" are first-class instructions.

</supporting-info>
