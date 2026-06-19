---
name: china-micro-surveys
description: Catalog and workflow for Chinese micro survey datasets (household, individual, firm) including key metadata, waves, hosts, topics, access, and suitability. Use when a user asks about Chinese microdata sources, wants to pick a dataset for an economics research idea, or needs guidance on which survey fits a question.
---

# China Micro Surveys

## Quick start

- Load the catalog in `references/survey_catalog.csv`.
- Use `scripts/query_surveys.py` to shortlist surveys by topic/unit/frequency.
- For each candidate, verify the latest waves and access rules on the official survey site before final recommendations.

## Workflow for a research idea

1) Clarify the question
- Identify outcome, treatment/exposure, unit of analysis (individual/household/firm), time period, and geography.
- Identify whether panel structure is required (causal designs, fixed effects, event studies).

2) Shortlist datasets
- Use `scripts/query_surveys.py` with topic keywords and unit/frequency filters.
- If the idea is about aging or health, prioritize CHARLS/CLHLS/CHNS/NHSS.
- If about finance/wealth, prioritize CHFS/CHIP/UHS/RHS.
- If about attitudes or social values, prioritize CGSS/CSS.
- If about labor/migration, prioritize CLDS/CMDS/RUMiC.
- If about education, prioritize CEPS/CFPS.
- If about private firms/enterprise outcomes, prioritize CPES/WBES/ASIF.

3) Match design to data
- Check if the survey has panel waves that align with the proposed timing.
- Check sample representativeness (national vs selected provinces).
- Check required variables exist (income, health metrics, labor history, etc.).

4) Verify and propose a data plan
- Confirm latest waves and access on official sites (web lookup required).
- Provide a data plan: variables list, sample restrictions, and potential identification strategy.

## Catalog maintenance

- The catalog is a starter list and is not exhaustive.
- Add new surveys by editing `references/survey_catalog.csv` with consistent fields.
- When details are uncertain, note them and flag for verification.

## Script usage

Example queries:

```bash
# find finance/wealth household surveys
python3 scripts/query_surveys.py --q "finance wealth" --field unit=household

# find labor and migration panel data
python3 scripts/query_surveys.py --q "labor migration" --field frequency=panel
```

The script prints a compact table; follow up by reading full rows in the catalog for details.
