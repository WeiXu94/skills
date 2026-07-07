# Surface: graphics — SVG app icons & canvas art

Two related crafts. Both output vector or high-res static art; both obey the system's
color and one-signature-move discipline.

---

## A. SVG app icon

An icon is a **single idea, rendered legibly at 16px**. Concept before craft.

- **One metaphor.** Name the single thing the icon represents. If you need two, the
  concept isn't done. No text or letterforms (unless a wordmark is the deliberate move).
- **Grid + optical alignment.** Lay out on a grid (e.g. 24 or a 1024 icon grid); align
  *optically*, not just mathematically — circles and pointed shapes need to overshoot
  the grid to look centered.
- **Frame:** a squircle / rounded-rect tile matching platform convention (macOS ≈ 22.5%
  corner radius superellipse). Keep primary content in the safe area so masking never
  clips it.
- **Consistent stroke/corner language:** one stroke weight, one corner radius across all
  shapes in the mark. Mixed weights read as unfinished.
- **Palette:** pull from the system — usually the accent plus one or two neutrals. A
  restrained icon reads at small size; a busy one turns to mud in the Dock.
- **Legibility test:** render at 16, 32, 64, 512px. If it's unreadable at 16, simplify
  until it is.

**Handoff:** for macOS raster export — normalize to 1024², strip padding, validate
occupancy/transparency, generate `.icns` — use the **`macos-icon`** skill. This guide
owns the *visual design*; that skill owns the *production pipeline*.

---

## B. Canvas / poster / SVG art

For expressive static pieces (posters, cover art, hero graphics) the goal is
**museum-quality craft**, not UI.

- **Name the aesthetic first.** Write one line naming the visual movement/philosophy
  (e.g. "Swiss editorial", "risograph brutalism"); let it govern every choice.
- **~90% visual, ~10% text.** Ideas communicate through form, space, color, and
  composition — not paragraphs.
- **Craft is the product:** deliberate margins, no accidental overlaps, precise optical
  spacing, considered typography. It should look labor-intensive and intentional.
- **Original work only** — no reproducing copyrighted logos, characters, or layouts.
- Palette and type still descend from the system unless the piece deliberately declares
  its own world (a legitimate signature move for standalone art).

**Deliverable:** SVG for crisp scalable art; high-res PNG/PDF when a raster/print is
needed.
