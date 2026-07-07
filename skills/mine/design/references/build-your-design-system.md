# Build (or extend) your design system

Yes — **start from others' work and edit to your taste.** That's not a shortcut, it's
how taste is built. You can't design a coherent system from a blank page and adjectives;
you *can* recognize what you love in real artifacts, take it apart, and reassemble the
pieces into something that's yours. *Steal like an artist.*

The output of this loop is `references/design-system.md` in the 9-section format.

## The loop

### 1. Collect surfaces you love
Gather **3–7 real artifacts** — sites, apps, decks, icon sets — you'd be proud to have
made. Real things, not adjectives. Screenshot them or keep the URLs. Aim for a mix so
you can borrow different strengths from each.

### 2. Extract each one's tokens
For every reference, pull: color palette + roles, type pairing + scale, spacing rhythm,
radius, elevation, motion, and its **one signature move**. Two fast sources of
pre-decoded systems (270+ / 73+ real sites, Linear · Stripe · Vercel · …):

- design-bites — https://github.com/educlopez/design-bites
- awesome-design-md — https://github.com/voltagent/awesome-design-md
- Geist (Vercel) as a worked example — https://vercel.com/design.md

Or extract from a live site's computed CSS (colors, font stacks, spacing, shadows).

### 3. Merge — choose, don't average
Averaging references gives mush. **Choose**: take the color logic from one, the type
pairing from another, the spacing rhythm from a third. Assemble a single draft, noting
where each piece came from.

### 4. Edit to your taste
This is the actual design act. Go through the draft and cut anything that isn't *you*.
Resolve every conflict toward **one voice**. Add or sharpen your **signature move** —
the thing someone could recognize across your app, your deck, and your icon. What
survives this pass is your system.

### 5. Prune to coherence — the one-hand test
Read the whole thing and ask: *could all of this have come from the same studio, on the
same day?* Remove outliers. One accent. One type pairing. One radius language. One
motion feel. Coherence beats richness.

### 6. Write it down, keep it living
Put the result into `references/design-system.md` using all 9 sections. It's not frozen
— every project teaches you something; fold the lesson back in. When a specific project
genuinely needs a different voice, don't fork your personal system: drop a project-root
`DESIGN.md` for that project only (the skill loads it ahead of your personal one).

## Where taste actually lives

Fastest personality levers, in order: **accent color → type pairing → signature move →
motion feel**. If you only edit four things in the seed, edit those. Everything else can
stay close to the defaults and still read as yours.
