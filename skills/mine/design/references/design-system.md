# DESIGN.md — my design system

> **This is a seed, not scripture.** It ships with tasteful, opinionated defaults so
> you have something coherent to build against today. Edit it toward *your* taste —
> the values that survive your editing are the system. Keep it to **one voice**: if a
> change wouldn't come from the same studio as the rest, don't add it.
> The 9 sections below are the format agents read best (Stitch / DESIGN.md standard).

---

## 1. Visual theme & atmosphere

Calm, precise, modern. High whitespace, quiet surfaces, one deliberate accent.
Density is comfortable, not cramped. The feeling is *editorial software* — a tool
that respects the reader. Restraint is the default; boldness is spent in exactly one
place per screen (the **signature move**).

*Taste knob:* dial this toward warm/human, brutalist/raw, or luxe/editorial. The rest
of the system should follow whichever you pick.

## 2. Color palette & roles

Semantic, not literal — name by *job*, not by hue, so a re-theme is a one-place edit.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `ink` | `#111114` | `#F4F4F5` | primary text |
| `ink-muted` | `#5B5B63` | `#A1A1AA` | secondary text, captions |
| `ink-faint` | `#8E8E96` | `#71717A` | placeholders, disabled |
| `surface` | `#FFFFFF` | `#0B0B0F` | base background |
| `surface-raised` | `#F7F7F8` | `#16161B` | cards, panels |
| `line` | `#E6E6E9` | `#26262C` | borders, dividers |
| `accent` | `#4F46E5` | `#7C74F0` | primary action, links, focus |
| `accent-quiet` | `#EEEDFB` | `#211E3A` | accent tint / hover bg |
| `success` | `#0E9F6E` | `#2FD08A` | positive state |
| `warning` | `#C77700` | `#F5A524` | caution |
| `danger` | `#D02F44` | `#F2617A` | error, destructive |

Rules: one accent, used sparingly — if everything is accented, nothing is. Never
communicate state by color alone (pair with icon/label). Text on any surface must
clear WCAG AA (4.5:1 body, 3:1 large).

*Taste knob:* the accent is the fastest personality lever. Swap indigo for your color.

## 3. Typography

| Token | Family | Size / line-height | Weight | Use |
| --- | --- | --- | --- | --- |
| `display` | Sans | 48–72 / 1.05 | 600 | hero headline |
| `h1` | Sans | 32 / 1.15 | 600 | page title |
| `h2` | Sans | 24 / 1.2 | 600 | section |
| `h3` | Sans | 18 / 1.3 | 600 | subsection |
| `body` | Sans | 16 / 1.6 | 400 | prose |
| `small` | Sans | 14 / 1.5 | 400 | captions, meta |
| `mono` | Mono | 14 / 1.5 | 400 | code, data, numbers |

Sans = a strong grotesque (Inter, Geist, or your pick). Mono = one with character
(Berkeley Mono, JetBrains Mono). Tighten letter-spacing on large display type
(`-0.02em`); leave body alone. **One** type pairing across the whole system.

*Taste knob:* the type pairing is the second-fastest personality lever after accent.
A distinctive display face makes work unmistakably yours.

## 4. Component stylings

- **Button (primary):** `accent` bg, white text, radius `md`, `padding 10px 16px`,
  weight 500; hover darkens ~8%, active ~12%; visible `focus` ring (`accent`, 2px).
- **Button (secondary):** transparent bg, `line` border, `ink` text; hover
  `surface-raised`.
- **Input:** `surface` bg, `line` border, radius `sm`; focus swaps border to `accent`
  + 2px ring; error swaps to `danger`.
- **Card:** `surface-raised`, `line` border *or* `elev-1` (not both), radius `lg`.
- **State coverage is mandatory:** every interactive component defines default,
  hover, active, focus, disabled — plus empty/loading/error where it holds data.

## 5. Layout principles

- **Spacing scale (4px base):** `4 8 12 16 24 32 48 64 96`. Only these values.
- **Three-step rhythm:** ~8px inside a group, ~16px between groups, ~32–48px between
  sections. Consistent rhythm reads as intentional; random spacing reads as slop.
- **Grid:** 12-col, max content width ~1120–1280px, gutters 24–32px.
- Generous whitespace is a feature, not wasted space.

## 6. Depth & elevation

Shadows are soft and low, never harsh. Prefer a single `line` border for flat
surfaces; reserve shadow for things that truly float (menus, modals, popovers).

| Token | Shadow |
| --- | --- |
| `elev-0` | none (use `line` border) |
| `elev-1` | `0 1px 2px rgba(0,0,0,.06)` |
| `elev-2` | `0 4px 12px rgba(0,0,0,.08)` |
| `elev-3` | `0 12px 32px rgba(0,0,0,.12)` |

Radius: `sm 6px`, `md 8px`, `lg 12px`, `xl 16px`, `full 9999px`. Pick one radius
language and keep corners consistent.

## 7. Motion

Quick, purposeful, physical. Default `160ms ease-out` for hovers/state,
`240ms` for entrances. Motion clarifies cause and effect — it is never decoration.
Respect `prefers-reduced-motion`. No scattered, unrelated effects (a tell of slop).

## 8. Do's and don'ts

**Do:** spend boldness in one place; let headlines carry structure; use real content
and imagery; keep one accent, one type pairing, one radius language; make focus states
visible.

**Don't:** purple/violet gradient heroes, generic 3-column rounded-card grids, centered
hero with two CTAs, emoji as UI icons, decorative gradients standing in for content,
glassmorphism everywhere, more than one accent, ad-hoc spacing values.

## 9. Agent prompt guide

When applying this system, tell the agent:

> Build against this DESIGN.md. Use only its tokens — no ad-hoc colors, sizes, or
> spacing. Semantic color roles (`ink`, `surface`, `accent`, …), the 4px spacing
> scale, one type pairing, one radius language. Spend boldness in exactly one place;
> keep everything else quiet. Support light and dark. Ship a self-contained artifact,
> then verify it in the browser at the target viewport before calling it done.
