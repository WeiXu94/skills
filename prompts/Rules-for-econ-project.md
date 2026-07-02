# Rules for economics research projects

## Principles

- Be a peer reviewer, not a cheerleader. Challenge weak identification, omitted
  variables, fragile assumptions, and overclaiming. State uncertainty honestly.
- Separate what the author claims, what the data support, and your own inference.
- Investigate before asserting. Read the paper, script, or data first; cite
  `file:line` for code references.
- Before nontrivial work, surface assumptions and define a verifiable success
  criterion (e.g. "coefficient within X of the published table", "model moments
  match targets to tolerance Y").

## Literature

- Summarize by: research question, identification strategy, data and sample, key
  specification, headline estimates (magnitudes and units), robustness, and the
  most credible threats to validity. Separate the causal claim from the
  estimand — what variation identifies the effect, under what assumptions.
- Across papers, build a comparison table (estimate, sign, magnitude, sample,
  method, identification) and note where findings conflict.
- Literature lives under `<project>/literature/` as PDFs. Do NOT open PDFs with
  the Read tool. Transcribe with `pdftotext` to
  `<project>/literature/transcribed/<same-name>.txt` (keep the source filename,
  swap `.pdf` for `.txt`), then `rg` for what you need. Read the abstract and
  intro first, then decide whether to read the rest.

## Modeling

- Derive before you code: environment, agents' problems, FOCs, equilibrium
  definition, parameters-to-observables map. Flag where functional-form or
  distributional assumptions do the heavy lifting.
- For structural/quantitative work: state the calibration vs. estimation split,
  targeted moments, per-parameter identification argument, and solution method
  (VFI, projection, MIT shock, GMM/SMM). Check units, steady-state consistency,
  and market clearing.
- Validate numerically: convergence diagnostics, grid/tolerance sensitivity,
  model-vs-data moment fit.

## Empirics

- Pin down the research design first (DiD, event study, IV, RD, panel FE,
  structural), match the estimator to it, and state the identifying assumption.
- Inspect data before modeling: sample construction, missingness, outliers,
  variable definitions, panel balance, treatment timing.
- Use the right clustering/heteroskedasticity treatment; default to
  robust/clustered SEs and say which. Run pre-trend / placebo / specification
  checks where the design allows. A single point estimate is not a result.

## Language conventions

- **R**: `haven`, `dplyr`/`tidyr`, `fixest` (`feols`) for FE, `modelsummary` for
  tables, `sandwich` for robust SEs; export with `booktabs = TRUE`.
- **Stata**: `reghdfe`/`ivreghdfe` for high-dimensional FE, `esttab`/`estout`
  for tables; `frames`/`tempfile` over clobbering data in memory; run `.do`
  files in batch.
- **MATLAB**: batch via `matlab -batch "<script>"` (no `.m`). Keep solution,
  estimation, and counterfactual as separate scripts.
- **Python**: `pandas`/`numpy`, `statsmodels`/`linearmodels`, `pyfixest` for FE,
  `scipy.optimize` for structural estimation; use a project virtual environment.

## Tables and figures

- Come from scripts, never hand-typed numbers. Export every regression and
  summary-stats table in BOTH LaTeX (for the paper) and a Markdown table (`.md`)
  so results are readable without opening raw TeX, and echo that Markdown table
  inline on the terminal so it renders in the TUI/GUI.
- LaTeX export: `modelsummary` (R) or `esttab` (Stata); fall back to direct file
  writing (e.g. `writeLines`) only if neither can produce the table. The inline
  table should be compact, pipe-delimited Markdown, e.g.:

  ```
  |          |    (1)  |    (2)   |
  |:---------|--------:|---------:|
  | weight   | 1.747** | 3.465*** |
  |          | (2.72)  | (5.49)   |
  | mpg      | -49.51  | 21.85    |
  |          | (-0.57) | (0.29)   |
  | Num.Obs. | 74      | 74       |
  ```

- Save figures as PDF, falling back to PNG only when PDF is not applicable.
- Wrap an exported table inside `threeparttable` when including it elsewhere:

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

  ```latex
  \begin{figure}[htbp]
      \centering
      \caption{<title>}\label{fig:<label>}
      \includegraphics[width=\linewidth]{<figure-file>.pdf}
  \end{figure}
  ```

## Writing papers and slides (LaTeX / Beamer)

- Read the target `.tex` first and match its document class, structure,
  notation, and citation style. Write like an economist: lead with the
  contribution, state question and result up front, tie claims to evidence,
  define notation before use, and prefer precise prose over hedged filler.
- `\input{}` exported tables and `\includegraphics` exported figures. Pull
  citation keys from the project's `.bib` files; never invent a key or reference.
- Beamer: one idea per frame, minimal text, lean on exported figures/tables, and
  use frame titles that state the takeaway.

## Reproducibility (REQUIRED)

A coauthor or referee must be able to clone the repo and reproduce every number
and figure with `make`. Prefer a Makefile to orchestrate everything.

- **Code lives in files, not shell history.** Never run analysis as inline
  one-liners (`Rscript -e`, `python -c`, `stata -e -q`, `matlab -batch "disp"`).
  Even throwaway scripts that produce a number, table, figure, or dataset go in
  `<project>/code|scripts|tmp/` as a `.do`/`.m`/`.R`/`.py`/`.sh` file that a
  Make target invokes; the target never embeds the code. Set seeds.
- **Environment setup lives in the Makefile.** Downloads, data fetches, symlinks,
  directory creation, and dependency installs are Make targets with URLs and
  destinations visible, so a fresh clone rebuilds from scratch. If a step cannot
  be automated (e.g. manual data-portal login), document it in a `README` beside
  the target and have the target check for the expected file.
- **Build documents through the project's build system**, not ad-hoc `pdflatex`;
  fix LaTeX errors and warnings before declaring success.
- **Scratch scripts** that are NOT project analysis (format converters, quick
  extractors) go in `<project>/tmp/` (gitignored), never the system `/tmp`. If a
  scratch script's output ends up in the paper, slides, or a memo, it is
  analysis — move it into `code/`/`scripts/` and follow the rules above.

## Workflow

- Keep theory, estimation, and counterfactual stages modular and separately
  runnable; export to the designated output directories.
- Name agent-generated memos `YYYYMMDDHHMM description.md`.
- If stuck after a few attempts, stop and ask rather than flailing on errors.
- Respect each project's own conventions and any `AGENTS.md`/`CLAUDE.md` rules.
