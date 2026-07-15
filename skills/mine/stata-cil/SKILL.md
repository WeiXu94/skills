---
name: stata-cil
description: Run Stata do-files in batch mode via scripts/statab with trustworthy exit codes on r(#) errors. Use when the user wants to run Stata from the shell/agent, check whether a Stata script succeeded, surface Stata return codes, or mentions stata-cil / statab.
---

# Stata CLI (`statab`)

Stata's own `-e`/`-b` batch modes often exit **0** even when a do-file hits `r(#)`. This skill's wrapper **`scripts/statab`** gives a **trustworthy** exit code: it runs Stata, then fails when user code left an `r(#);` trailer in the log.

Canonical binary: `"$SKILL_DIR"/scripts/statab`  
(`$SKILL_DIR` is the skill folder, set by the agent framework when the skill loads. `~/bin/statab.sh` may symlink here — prefer the skill path.)

## Steps

1. **Confirm the target.** Require an explicit do-file path or bare Stata command from the user/context. If none is given, ask.
2. **Run via `statab`.** From the intended working directory (cwd is where Stata writes the log):

   ```bash
   "$SKILL_DIR"/scripts/statab do path/to/file.do
   # or imply do for a single .do path:
   "$SKILL_DIR"/scripts/statab path/to/file.do
   ```

3. **Interpret the exit code** (done when status + any printed `r(#)` context are reported; success only on exit 0):

   | Code | Meaning |
   | --- | --- |
   | `0` | User section of the log has no `r(#);` |
   | `1` | Stata reported `r(#)` after user code — log **kept** |
   | `2` | Usage / missing do-file |
   | `127` | Stata binary not found |
   | other | Propagated from the Stata process |

4. **On failure, read the kept log** (stem of the do-file, truncated at first space: `foo bar.do` → `foo.log`; bare commands → `stata.log`). Surface the error and surrounding lines. Fix the cause or stop — never re-run blindly in a loop.

## Invocation cheat sheet

```bash
"$SKILL_DIR"/scripts/statab --help
"$SKILL_DIR"/scripts/statab -v do analysis.do          # verbose: print Stata argv
"$SKILL_DIR"/scripts/statab -k do analysis.do          # keep log on success
"$SKILL_DIR"/scripts/statab do "my project/run.do"     # spaces OK
"$SKILL_DIR"/scripts/statab do file.do arg1 arg2       # do-file args
"$SKILL_DIR"/scripts/statab 'display "hello"'          # bare command → stata.log
STATA_BIN=stata-mp "$SKILL_DIR"/scripts/statab do f.do
"$SKILL_DIR"/scripts/statab --stata /path/to/stataMP do f.do
```

## Rules

- **Use `statab` for trustworthy exit codes** — not raw `stataMP -e` when you need to know if the run failed.
- **cwd matters.** Stata writes the log in the process cwd; `cd` to the project dir first if relative paths / log location matter.
- **Profile noise is already filtered.** `statab` ignores `r(#);` only inside the leading `Running …profile…` block (e.g. a broken `sysprofile.do`); trust the exit code.
- **On success the log is deleted** unless `-k` / `STATAB_KEEP_LOG=1`. On error the log stays.
- **Binary search** (unless `STATA_BIN` / `--stata`): `stataMP`, `stata-mp`, `StataMP`, `stata-se`, `stataSE`, `stata`, then common macOS app-bundle paths.

## Prerequisites

- Stata installed and findable (or set `STATA_BIN` / pass `--stata`).
- macOS/Linux bash (script targets bash 3.2+).
