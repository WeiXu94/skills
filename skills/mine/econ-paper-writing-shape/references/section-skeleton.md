# Econ paper section skeleton

The fixed macro-structure. `main.tex` `\input`s these in order from `sections/`.

| File | Section | Purpose |
|------|---------|---------|
| abstract.tex | Abstract | Question, data/strategy, headline results, one-line "so what". |
| intro.tex | Introduction | The whole paper in miniature — see the formula below. |
| literature.tex | Literature review | Only if too many papers to fold into the intro; otherwise drop. |
| background.tex | Background | Institutional/contextual setup the reader needs before the results. |
| data.tex | Data | Source, sample, key variables, summary stats. |
| design.tex | Regression design | The estimating equation and what identifies it. |
| results.tex | Empirical results | Each table/figure shown and illustrated, coefficient by coefficient. |
| model.tex | Model & estimation | Only when structural — equations, estimation, fit. |
| conclusion.tex | Conclusion | What was learned, limitations, what it implies. |

Drop sections a given paper doesn't need; merge literature/background into the
intro when short.

## The introduction formula

Write the intro first, then re-edit it every time another section changes — by the
end it has had the most attention. (Keith Head / Jim Brander.)

1. **Hook** — why the topic matters: Y matters (people are helped or hurt when it
   moves), or is puzzling, controversial, big, or common. Avoid bait-and-switch
   and "everyone's writing about it".
2. **Question** — what this paper actually does; land a clean "This paper addresses
   …" sentence by the 2nd–3rd paragraph. Understandable from the topic alone.
3. **Antecedents** — the prior work needed to see the contribution; establish,
   without insult, where it is incomplete. May intertwine with value-added.
4. **Value-added** — ~3 contributions relative to the antecedents. The paragraph
   that keeps a referee from rejecting; it makes sense only in light of prior work.
5. **Road-map** — customized to this paper, naming landmarks; keep it short.

## Table convention

- Export the bare `tabular` from your stats code and `\input` it — don't paste.
- Use `booktabs`. Keep width within the page (no overflow).
- Wrap the `tabular` in a `threeparttable` in the main `.tex`; put notes there,
  not in the exported file.

```latex
\begin{table}
    \centering
    \caption{Title}\label{tab:label}
    \input{/path/to/tabular.tex}
    \parbox{\textwidth}{\small
        \vspace{1ex}
        \textbf{Notes:} ...
        \starnote
    }
\end{table}
```
