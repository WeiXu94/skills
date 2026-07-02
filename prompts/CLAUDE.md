## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Documents

- Unless I explicitly ask otherwise, write docs, such as plan/handoff/summary, under `./docs/logs/`; create it if missing.
- Use `YYYYMMDDHHmm-<plan/handoff/summary/empty>-<topic>.md` for doc filenames. The middle slot indicates what kind of the doc is, leave as empty if no category.
- For HTML reports/docs, use the same rule: `YYYYMMDDHHmm-<topic>.html`.
- This applies to technical decisions, code logic/pipelines, chat summaries, result records, handoffs, and similar docs.

## Auto commit

- Auto-commit without being asked once you reach significant progress or finish a feature/fix that deserves a record in the commit history.
- Commit at logical, self-contained milestones, not mid-change. Each commit should build/pass and capture one coherent unit of work.
- Write a clear, concise commit message: what changed and why.
- Never commit unrelated changes together, secrets, scratch files, or anything under `tmp/`.
