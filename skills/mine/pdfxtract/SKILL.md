---
name: pdfxtract
description: PDF extraction via the pdfxtract CLI, which pairs pdftotext (faithful math/accents) with liteparse (Markdown structure, OCR). Use when extracting or parsing text from a PDF, summarizing a paper/document, listing a PDF's sections, or pulling one section out by name.
disable-model-invocation: true
---

# pdfxtract

CLI that extracts a PDF by combining **pdftotext** (faithful glyphs — math, accents) with **liteparse** (Markdown structure + OCR). Auto-detects digital vs scanned and writes a small bundle of artifacts. Requires `pdftotext` (poppler) and `liteparse` on PATH.

## Invoke

```bash
<basedir>/pdfxtract <input.pdf> [flags]
```

## Flags

| Flag | Effect |
|------|--------|
| `<input.pdf>` | input PDF (required, positional) |
| `-o, --outdir DIR` | output dir (default `<pdf-stem>_pdfxtract/`) |
| `--mode {auto,digital,scanned}` | force a mode; `auto` detects (default) |
| `--toc` | print the table of contents and exit |
| `--section TEXT` | print the section whose title contains `TEXT`, then exit |
| `--no-reflow` | build `merged.md` from raw pdftotext (skip paragraph rejoin) |
| `--max-pages N` | process only the first N pages (quick test) |
| `--force` | re-extract even if the output dir already has results |
| `--verbose` | progress to stderr |

`--toc` and `--section` write to stdout and exit early.

## Outputs (in outdir)

| File | Contents | Read it for |
|------|----------|-------------|
| `merged.md` | faithful text under Markdown headings | the main deliverable — prose + navigation |
| `content.reflowed.txt` | pdftotext rejoined into paragraphs | clean reading |
| `content.raw.txt` | verbatim `pdftotext -layout` | exact glyphs; verbatim quotes |
| `structure.md` | raw liteparse Markdown | OCR output / original structure |
| `toc.md` | table of contents | the section list |
| `report.json` | QA report | mode, trust recommendation, matched headers |

## Trust rule

Read `report.json` → `recommendation`:

- **`pdftotext-primary`** (digital PDF): trust `merged.md` / `content.raw.txt`. Take all equations and math from `content.raw.txt`; `report.json` counts and samples the lines liteparse corrupted (`liteparse_math_artifact_lines`).
- **`liteparse-ocr-primary`** (scanned PDF): pdftotext has no text layer, so `merged.md` equals `structure.md`.

## Exit

0 on success; 1 if the PDF is missing or `--section` matches nothing. Missing `pdftotext`/`liteparse` aborts with install hints.
