---
name: design
description: Design distinctive UI and visual work against your own design system. Use when building or restyling a web or desktop app, making a slide deck or presentation, drawing an SVG app icon or canvas/poster art, when something looks generic or "AI slop" and needs polish, or when creating or editing your own design system (DESIGN.md).
---

# Design

Produce distinctive UI and visual artifacts — app screens, slide decks, app icons,
canvas art — that all read as **one hand**, because they are built against **your
design system**: a single plain-text `DESIGN.md` that encodes your taste once, and
every surface obeys.

## Your design system is the source of truth

Everything here applies **your** `DESIGN.md`, never generic defaults.

- **Load order:** a project-root `DESIGN.md` if the project ships one, else your
  personal system at `references/design-system.md`.
- **No system yet, or it's thin?** Build or extend it first with
  `references/build-your-design-system.md`. The move is *steal like an artist*:
  collect surfaces you love, extract their tokens, merge, then edit to your taste
  until it's one coherent voice. You seed from others; the taste that survives the
  editing is yours. Source material and libraries to steal from: `references/resource.md`.

## Process

Every surface — app, slide, icon, canvas — runs the same four steps. Only **step 3**
branches by surface.

### 1. Lock the direction

Before any pixels, pin four things (ask only what you can't infer from the request):

- **Surface** — app UI / slide / icon / canvas.
- **Job** — the one thing it must accomplish, or make the viewer feel.
- **Mood** — 2–3 adjectives.
- **The signature move** — the *one* place you spend boldness (a hero, a type
  choice, a motion, a color). Everything else stays quiet.

**Done when:** a one-line direction statement is written down, naming the signature move.

### 2. Load the design system

Read the governing `DESIGN.md` (load order above) and pull the tokens this surface
needs: color roles, type scale, spacing, radius, elevation, motion, plus the
do/don't guardrails. If the direction needs something the system lacks, **add it to
the system** — don't invent a one-off value.

**Done when:** color, type, spacing, and motion tokens are in hand, and every gap is
either filled in the system or explicitly flagged.

### 3. Build on the surface

Open the guide for this surface and build a self-contained artifact:

- **App UI** (web or desktop) → `references/surface-app-ui.md`
- **Slides / deck / presentation** → `references/surface-slides.md`
- **SVG app icon or canvas/poster art** → `references/surface-graphics.md`
  (for macOS icon *export & validation*, hand off to the `macos-icon` skill)

**Done when:** the artifact renders, and every visual value traces to a system token
— no ad-hoc colors, sizes, or spacings.

### 4. Critique and verify against the oracle

The **rendered output is the oracle**, not your memory of the code. View the real
artifact at its real size(s) and run `references/ai-slop.md`. For each miss, make the
*smallest* change that clears it.

**Done when:** it passes every item in `ai-slop.md`, the rendered surface has been
viewed at its target viewport(s)/size(s), and it delivers the step-1 direction — the
signature move lands and nothing competes with it.
