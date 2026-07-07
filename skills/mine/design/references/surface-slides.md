# Surface: slides & decks

A deck is a *sequence* — its coherence is the design. Same tokens as everything else,
plus the discipline of rhythm across many frames.

## Deliverable

A **self-contained HTML deck** (one section per slide, keyboard nav) for a fast preview
loop. Export to PPTX/PDF only when the audience needs it — note that PPTX round-trips
lose fidelity, so design in HTML and treat PPTX as an export, not the source.

## The rules that make decks read as one hand

- **One idea per slide.** If a slide has two messages, it's two slides.
- **Fixed frame:** identical margins, safe area, and grid on *every* slide. Drifting
  margins are the fastest way a deck looks amateur.
- **One headline scale, one body scale.** Resist per-slide font sizing. The headline
  alone should convey the slide's point.
- **90/10 where it counts:** hero/section slides carry a single strong visual with
  minimal text; content slides stay clean, never bullet soup (≤ ~3 lines per point).
- **Consistent motion:** one transition, one build behavior across the deck. Varied
  transitions read as slop.
- **Signature move at the deck level:** one recurring visual device (a color band, a
  numbering system, a recurring mark) ties the sequence together — spend it once,
  repeat it, don't add a second.

## Composition per slide

- Anchor with a real visual (chart, photo, diagram), not a decorative gradient.
- Left-align text blocks for scanability; center only for title/section slides.
- Charts follow the data-viz rules: faint gridlines, `mono` numerals, no color-only
  encoding, one message per chart.

## Verify

Present the rendered deck full-screen at 16:9, arrow through **every** slide: margins
hold, headlines carry the story on their own, no slide is overloaded, contrast survives
a projector (avoid pale-on-white).
