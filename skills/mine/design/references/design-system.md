# DESIGN.md — my design system

> **This is a seed, not scripture.** It ships with a minimal, monochrome baseline so
> you have something coherent to build against today. Edit it toward *your* taste —
> the values that survive your editing are the system. Keep it to **one voice**: if a
> change wouldn't come from the same studio as the rest, don't add it.
> The 9 sections below are the format agents read best (Stitch / DESIGN.md standard).

---

## 1. Visual theme & atmosphere

Minimal, clean, precise. **Monochrome only** — white, black, and the greys between.
No color. No accent hues. Personality comes from proportion, negative space, type,
and the weight of black against white. The feeling is *architectural* — structure laid
bare, nothing to hide behind. Restraint is the default; boldness is spent in exactly
one place per screen (the **signature move**), expressed through scale, weight, or
contrast rather than hue.

*Taste knob:* dial this toward warm-minimal (creamy whites, soft blacks), brutalist
(raw, high-contrast, visible structure), or editorial (generous whitespace, oversized
type). The rest of the system follows whichever you pick.

## 2. Color palette & roles

**No hues. No accent color.** Everything is black, white, or a grey on the spectrum
between them. Roles are named by *job*, not by value, so a light/dark flip is a
one-place edit.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `ink` | `#0A0A0A` | `#FAFAFA` | primary text |
| `ink-muted` | `#5C5C5C` | `#A3A3A3` | secondary text, captions |
| `ink-faint` | `#999999` | `#737373` | placeholders, disabled |
| `surface` | `#FFFFFF` | `#0A0A0A` | base background |
| `surface-raised` | `#F5F5F5` | `#171717` | cards, panels |
| `surface-subtle` | `#FAFAFA` | `#0F0F0F` | subtle background shift |
| `line` | `#E5E5E5` | `#262626` | borders, dividers |
| `line-strong` | `#D4D4D4` | `#404040` | prominent borders, active rings |
| `ink-inverse` | `#FAFAFA` | `#0A0A0A` | text on dark/black backgrounds |

State is conveyed through **weight and contrast**, not color:
- **Primary / active / selected** → `ink` fill (solid black/white), `ink-inverse` text.
- **Positive / success** → heavier border weight, check icon.
- **Caution / warning** → `line-strong` border, alert icon.
- **Error / destructive** → `ink` fill on delete actions, error icon + label.

Never communicate state by a visual channel alone. Pair any contrast/border change
with an icon or text label. Text on any surface must clear WCAG AA (4.5:1 body, 3:1 large).

*Taste knob:* shift the black toward warm (`#1A1A1A`) or cool (`#08080A`); keep the
greys evenly spaced on the same temperature.

## 3. Typography

Type is the **primary personality carrier** in a monochrome system. Choose
deliberately — the face itself does all the work color used to do.

| Token | Family | Size / line-height | Weight | Use |
| --- | --- | --- | --- | --- |
| `display` | Sans | 48–72 / 1.05 | 600 | hero headline |
| `h1` | Sans | 32 / 1.15 | 600 | page title |
| `h2` | Sans | 24 / 1.2 | 600 | section |
| `h3` | Sans | 18 / 1.3 | 600 | subsection |
| `body` | Sans | 16 / 1.6 | 400 | prose |
| `small` | Sans | 14 / 1.5 | 400 | captions, meta |
| `mono` | Mono | 14 / 1.5 | 400 | code, data, numbers |

Sans = a strong grotesque or neo-grotesque (Inter, Geist, Helvetica Neue, or your pick).
Mono = one with character (Berkeley Mono, JetBrains Mono). Tighten letter-spacing on
large display type (`-0.02em`); leave body alone. **One** type pairing across the whole
system — in monochrome, mixing faces reads as noise, not sophistication.

*Taste knob:* the type pairing IS the personality now. A distinctive display face or an
unexpected sans (mono for headlines, anyone?) makes work unmistakably yours. Experiment
with weight contrast — 700 headlines against 300 body — rather than color contrast.

## 4. Component stylings

Weight and line carry all state. No colored accents anywhere.

- **Button (primary):** `ink` bg (solid black/white), `ink-inverse` text, radius `sm`,
  `padding 10px 16px`, weight 500; hover lightens bg to `#2A2A2A` (light) / `#E5E5E5`
  (dark); active lightens further; visible `focus` ring (`ink`, 2px, outset).
- **Button (secondary/ghost):** transparent bg, `line` border, `ink` text; hover
  bg shifts to `surface-raised`; focus same ring as primary.
- **Button (text-only):** no border, `ink` text, transparent bg; hover bg `surface-raised`.
- **Input:** `surface` bg, `line` border, radius `sm`; focus swaps border to `ink` +
  2px ring (same `ink`); error gets `line-strong` border + icon.
- **Card:** `surface-raised`, `line` border *or* `elev-1` (not both), radius `sm`
  or `none` (match the radius language).
- **Toggle / Switch:** off = `line` bg, on = `ink` bg; thumb always white.
- **Selected / Active state:** heavier type weight (500 or 600) + `ink` underline or
  left-bar, never a color highlight.
- **State coverage is mandatory:** every interactive component defines default,
  hover, active, focus, disabled — plus empty/loading/error where it holds data.

## 5. Layout principles

- **Spacing scale (4px base):** `4 8 12 16 24 32 48 64 96`. Only these values.
- **Three-step rhythm:** ~8px inside a group, ~16px between groups, ~32–48px between
  sections. Consistent rhythm reads as intentional; random spacing reads as slop.
- **Grid:** 12-col, max content width ~1120–1280px, gutters 24–32px.
- Generous whitespace is the main character — in monochrome, the space IS the design.
  Empty areas are as deliberate as filled ones.

## 6. Depth & elevation

Shadows are soft, low, and greyscale. Prefer a `line` border for flat surfaces;
reserve shadow for things that truly float (menus, modals, popovers). In monochrome,
a single `line` border often reads cleaner than a shadow.

| Token | Shadow |
| --- | --- |
| `elev-0` | none (use `line` border) |
| `elev-1` | `0 1px 2px rgba(0,0,0,.04)` |
| `elev-2` | `0 4px 12px rgba(0,0,0,.06)` |
| `elev-3` | `0 12px 32px rgba(0,0,0,.10)` |

Radius: `none 0`, `sm 4px`, `md 8px`, `lg 12px`, `full 9999px`. Pick one radius
language and keep corners consistent. Minimal systems often work best with `none` or
`sm` everywhere — sharp corners reinforce the clean, architectural feel.

## 7. Motion

Quick, purposeful, physical. Default `120ms ease-out` for hovers/state,
`200ms` for entrances. In monochrome, motion is even more noticeable — keep it
shorter and simpler than you would in a colored system. Motion clarifies cause and
effect; it is never decoration. Respect `prefers-reduced-motion`. No scattered,
unrelated effects (a tell of slop).

## 8. Do's and don'ts

**Do:** spend boldness in one place (extreme scale, a black fill, oversized type);
let headlines carry structure; use real content and high-contrast black-and-white
photography; keep one type pairing, one radius language, one weight language; make
focus states visible via black rings; let whitespace do the heavy lifting; use
weight and scale for hierarchy, not color.

**Don't:** any color accent — no purple, no blue, no green, none; gradient heroes of
any kind; generic 3-column rounded-card grids; centered hero with two CTAs; emoji as
UI icons; decorative gradients or blurred blobs standing in for content; glassmorphism;
more than one type pairing; ad-hoc spacing values; scattered unrelated motion.

## 9. Agent prompt guide

When applying this system, tell the agent:

> Build against this DESIGN.md. Monochrome only — white, black, and greys. No color
> accents, no hue anywhere. Semantic roles use greyscale values (`ink`, `surface`, `line`,
> …). Use only the 4px spacing scale, one type pairing, one radius language. Spend
> boldness in exactly one place via scale, weight, or contrast — not color. Support
> light and dark. Ship a self-contained artifact, then verify it in the browser at
> the target viewport before calling it done.
