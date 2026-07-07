# Surface: app UI (web & desktop)

Build screens and components that obey the design system and survive real use.

## Deliverable

A **self-contained HTML file** (inline CSS/JS, no external fetches) so it previews
instantly and iterates in a tight loop. Prefer semantic HTML + a small token layer
(CSS custom properties mirroring the `DESIGN.md`) over a heavy framework for mockups.
For production, translate the same tokens into the project's stack.

## Layout

- Apply the system's spacing scale and 12-col grid; hold the three-step rhythm
  (inside-group / between-group / between-section). No off-scale numbers.
- Establish hierarchy with **type and space first**, color second.
- Comfortable density: whitespace is structure, not waste.

## States — the part that separates real from mockup

Every interactive element defines: **default, hover, active, focus, disabled**, and for
anything data-backed also **empty, loading, error**.

- **Focus must be visible** (keyboard users) — the system's accent ring.
- **No jitter on state change:** use fixed-height action slots and uniform type so a
  label swap (e.g. "Save" → "Saving…") doesn't shift the layout.
- Design the **empty state** deliberately — it's the first thing a new user sees.

## Responsive

- Web: verify at 375px (mobile), ~768px (tablet), and desktop. Nothing overflows or
  collides; tap targets ≥ 44px.
- Reflow, don't shrink: stack columns, don't crush them.

## Desktop-app specifics (Electron / Tauri / native)

- Respect platform conventions: macOS traffic-light inset, window chrome, menu bar;
  Windows/Linux differ — don't ship one platform's furniture everywhere.
- Support the OS light/dark setting via the system's dual tokens.
- Native feel: instant feedback, no web-page scroll bounce where a native surface is
  expected, keyboard shortcuts for primary actions.

## Data-heavy UI

Tables and charts: pick the chart to the question (trend → line, comparison → bar,
part-to-whole → stacked/pie sparingly). Align numbers right, use `mono` for figures,
keep gridlines faint. Never rely on color alone to encode a series.

## Safety

Destructive actions (delete, bulk cleanup) get confirmation and a review-first pattern —
never a one-tap removal of anything with an opaque identifier.
