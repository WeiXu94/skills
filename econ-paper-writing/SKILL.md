---
name: econ-paper-writing
description: You should use this skill when the user asks to write, edit or polish part of an economics research paper or make a draft paper from scratch.
---

# Overview

An economics paper usually consists of several sections as follows:

1. Abstract
2. Introduction
3. Literature Review (sometimes can be incorporated into introduction part)
4. Background (sometimes can be incorporated into introduction part)
5. Data
6. Regression Design
7. Empirical Result
8. Model and Estimation result (when the paper has/needs a model, for example, paper with structural analysis)
9. Conclusion

Next, I show you how to write each part and some requirements of each part.

## Abstract

Example Abstract:

```
Nearly everyone experiences the death of a parent in adulthood, but little is known about
its effects on adult children’s labor market outcomes and the underlying mechanisms. In this
paper, we use Danish administrative data to examine the impact of parental loss on individual
labor market outcomes. We leverage the timing of sudden, first parental deaths and adopt a
matched-control difference-in-differences strategy. Our findings show that parental death
negatively affects adult children’s earnings: sons’ earnings decline by 2% five years after
parental loss, while daughters’ earnings decrease by 3% during the same period. Exploring
the underlying mechanisms, we find that both men’s and women’s mental health deteriorates
following parental loss: women seek psychological assistance more frequently, while both
men and women increase their use of mental health and opioid prescriptions. Furthermore,
women with young children experience a comparatively larger earnings decline (around 4%)
due to the loss of informal childcare. These findings collectively highlight a substantial labor
market penalty for individuals who experience parental death.
```

## Introduction

1. Motiviation and what question I ask and address in the paper
2. A detailed summary of what I have done in this paper
3. The contribution of this paper to existing literature. Three points would be better.
4. Roadmap of the rest of the paper

Please refer to [the-introduction-formula.md](./the-introduction-formula.md) for more detailed instruction.

## Literature review

Write this part only if too much papers need to cover. Normally you can include this inside introduction part.

## Background

You can borrow the description text of background information from papers in the /literature/ folder.

## Data description

Generate a overview of dataset I used in the paper.

## Regression Tables and Graphs

Add all the tables and graphs and a detailed description of them to main text. 
- For the regression table, illustrate what each coefficient means, about how X variables affect Y variables.
- For the graphs, thoroughly describe what the graphs do and what information they intend to convey.

### tables
- use booktabs package when producing a table.
- ensure that the width of tables doesn't exceed the page width (no overflow).
- use booktabs package. 
- warp the tabular inside a threeparttable env in the main paper tex.
- don't add table notes into the exported latex file, instead add note in the threeparttable env.

A benchmark example:

```latex
\begin{table}
    \centering
    \caption{Title}\label{tab:tab_label}
    \input{/path/to/file.tex}
    \parbox{\textwidth}{\small
        \vspace{1eX}
        \textbf{Notes:} some note.
        \starnote
    }
\end{table}
```

## Conclusion

## Reference

Use the following two papers of my supervisor, Zhang Ning, as benchmark for the structure and writing. Consult it if not sure. Convert the pdf files into txt if needed.

- [Violence Against Women at Work](./papers/Violence%20Against%20Women%20at%20Work.pdf) QJE paper
- [Effects of Parental Death on Labor Market Outcomes](./papers/Parental_death_and_employment_Submission.pdf) AER paper 

