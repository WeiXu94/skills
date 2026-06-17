# Some general rules to follow for economics research projects

## Regression Results

- When running regressions, TeX export is fine, but also report the result table in Markdown.
- The Markdown table should be readable immediately in the GUI/CLI, not require opening raw TeX.

## Tables

Export every regression-result or summary-statistics table in both TeX and Markdown-table
format, then echo the Markdown table inline so I can view it in the TUI/GUI without opening
the raw TeX.

- Use the `modelsummary` package to export the LaTeX table in R.
- Use the `esttab` package to export the LaTeX table in Stata.
- Fall back to a direct file write (e.g. `writeLines`) only if neither can produce the table.

### LaTeX integration with other writing/doc TeX files

Wrap the table TeX file inside a `threeparttable` env when including it in other files like
`paper/slide.tex`:

```latex
\begin{table}[htpb]
    \centering
    \begin{threeparttable}
        \caption{<title>}\label{tab:<label>}
        \centering
        \input{<table-file.tex>}
        \begin{tablenotes}[para,flushleft]
            \textbf{Notes:} <note-content>
        \end{tablenotes}
    \end{threeparttable}
\end{table}
```

## Figures

Generate every image/figure in PDF format, falling back to PNG only when PDF is not applicable.

### LaTeX integration with TeX files

```latex
\begin{figure}[htbp]
    \centering
    \caption{<title>}
    \label{fig:<label>}
    \includegraphics[width=\linewidth]{<figure-file>.pdf}
\end{figure}
```

## Memo / file naming

Agent-generated memos use the timestamp-prefixed convention from the russia project:
`YYYYMMDDHHMM description.md`.

## Literature PDFs

- Reference literature usually lives under `<project>/literature/` as PDF files.

When you want to read the PDF of a paper:

- DO NOT use the Read tool to open PDF files directly.
- Use the `pdftotext` command via bash to transcribe them into a `.txt` file under
  `<project>/literature/transcribed/<same-name>.txt`. Name each transcription exactly after
  its source PDF filename (replace `.pdf` with `.txt`).
- Use `rg` to retrieve the information you need from the paper.
- Read the abstract and/or introduction first, then decide whether to read the full content.

## Reproducibility (REQUIRED)

All analysis must be fully reproducible. No exceptions. I prefer Make/a Makefile to handle this.

### Write all code to files
- **Never** run analysis via inline one-liners (e.g. `Rscript -e "..."`, `python -c "..."`,
  `stata -e -q "..."`, `matlab -batch "disp(...)"`) without first saving the code to a file in
  the appropriate directory — `<project>/code/`, `<project>/scripts/`, or `<project>/tmp/`.
- Even quick/throwaway scripts that produce a table, figure, number, or transformed dataset must
  be committed as a `.do`, `.m`, `.R`, `.py`, or `.sh` file. Set a seed for anything stochastic.
- The Make target should invoke the file, not embed the code.
- This applies to data-cleaning snippets, ad-hoc plots, sanity checks that get cited, and anything
  whose output ends up in the paper, slides, or memos.

### Put all environment setup in the Makefile
- File downloads (`curl`, `wget`), data fetches, symlink creation (`ln -s`), directory creation
  (`mkdir -p`), config copying, and dependency installs must be Make targets — not steps run by
  hand in the shell.
- Each external resource gets a target with the URL and destination path visible in the Makefile so
  a fresh clone can rebuild from scratch with `make`.
- If a step truly cannot be automated (e.g. manual data-portal login), document the exact manual
  steps in a `README` next to the target and have the target check for the expected file.

### Build documents through the project's build system
- Compile papers and slides via the project's Make targets, not ad-hoc `pdflatex`. Fix LaTeX errors
  and warnings before declaring success.

### Temporary/scratch scripts
- One-off helpers that are NOT project analysis (format converters, forensics helpers, quick
  extractors) go in `<project>/tmp/` (gitignored), never the system `/tmp`. If a scratch script's
  output ends up in the paper, slides, or a memo, it is analysis — move it into `code/`/`scripts/`
  and follow the rules above.

### Why
A future reader (including the user, a coauthor, or a referee) must be able to clone the repo and
reproduce every number and figure by running `make`. Inline code in shell history disappears;
Makefile-driven file-based code does not.
