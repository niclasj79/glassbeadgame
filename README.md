# The Glass Bead Game

A contemplative audiovisual instrument, after Hermann Hesse's *Das Glasperlenspiel*.

You enter Castalia and attend to an idea. Other ideas answer — not because an
author hid a correct pairing behind one of them, but because they genuinely
share structure with what you are looking at. You choose how you understand the
relationship — **Echo**, **Passage**, **Tension**, or **Ground** — and weave it.
Your reading immediately becomes glass, light, motion, music, and a durable
record.

The Game answers honestly. Some threads meet a documented relation, with its
sources and its evidence class stated plainly. Some become an **Open Thread** —
a specific question your reading raises, which the Game says out loud it cannot
settle. And some meet near-silence, because nothing credible connects those two
ideas yet, and saying so is better than inventing something.

Over about fifteen minutes your web develops motifs, changes the world, and
becomes eligible for **Attunement**. When you conclude, the session performs
itself back to you — compiled from what you actually did, in the order you did
it — and resolves into a **portrait** of six readings with no total, and a short
**annotation** that names things you can go and check.

No accounts, no backend, no timers, no score. Fully static and offline-capable.

## The promise this makes

Every documented claim declares what *kind* of claim it is. A relation that
notices a structural correspondence is typed differently from one that asserts
historical influence, and only the second may claim influence — and only with a
verifiable source. Exactly one relation in the pack does. Where no citation
could be verified, the relation either asserts nothing beyond the two structures
compared, or it was not written.

The most citation-sensitive claim in the game — that Bartók composed with
Fibonacci proportions — reaches you as *contested*, cites Lendvai's argument and
Howat's 1983 criticism of it, and says: treat the attribution as disputed, not
as evidence.

Silence is always available, and it is preferred to fabricated significance.

## Play

- **Attend** — click, tap, or focus a bead and press Enter.
- **Choose an intention** — four sigils bloom around the attended bead.
- **Weave** — draw from the armed bead toward another and release. Keyboard and
  assistive routes hold-and-confirm instead; they express the same decision and
  receive the same outcome.
- **Step back** — Escape, or the world's cancel mark. Nothing provisional is
  ever written.
- **Conclude** when you are ready.

Every action has a mouse, touch, and keyboard path, and every cue has a textual
equivalent. Relation meaning is never carried by colour alone.

## Develop

```sh
npm ci                    # install exactly from package-lock.json
npm run typecheck         # tsc strict
npm run lint
npm test                  # vitest
npm run validate:content  # the Castalia pack's own gate
npm run build             # production build; also runs the content gate
npx playwright install chromium
npm run test:browser      # deterministic Chromium smoke
npm run bundle:check      # bundle regression gate
npm run measure:performance

npm run dev               # http://localhost:8080
node scripts/capture-frames.mjs   # labelled reference frames for art review
```

`measure:performance` and `capture-frames` write ignored reports under
`artifacts/`. Their output is evidence for human judgement, not a gate.

## Where things live

```
src/
  content/castalia/  the game IS this data — 24 concepts, 22 structural facets,
                     44 sourced relations with evidence classes, Open Thread
                     prompts, and a validator that gates the build
  domain/            pure rules: events, reducer, replay, topology, outcomes,
                     semantic motifs, portrait, annotation, conclusion compiler.
                     No browser, React, Three.js, or Web Audio anywhere in here
  runtime/           commands, the presentation cue boundary, progression,
                     captions, session generation
  scene/             R3F Castalia: optical glass, procedural concept figures,
                     the armillary, semantic thread materials, camera phrasing
  audio/             Web Audio: concept motifs, the four relation grammars,
                     the comfort envelope, Attunement, the conclusion
  state/             zustand adapters over event-derived state
  ui/                thin DOM surfaces and the accessibility mirror
  platform/          IndexedDB and the service worker
legacy/              the archived v1 app — reference only
```

The rule that holds it together: **domain code owns every durable rule, and
imports nothing from the browser.** The whole golden path is proven in unit
tests with no renderer and no audio context, which is what makes the audiovisual
layer replaceable without risking the composition.

### For composers

Concept motifs are authored data in `src/content/castalia/concepts.ts` — a
contour, a rhythm, a register, an articulation, and a timbre body per concept.
The four relation grammars live in `src/audio/grammar.ts`, and every comfort
bound is in `src/audio/comfort.ts` and nowhere else. `playVoice()` remains the
single place a note is born, so recordings can replace synthesis without any
content change.

### Adding a documented relation

1. Pick two concept ids from `src/content/castalia/concepts.ts`.
2. Add a `DocumentedRelation` in `src/content/castalia/relations.ts`. You must
   declare its `relationType`, its `evidence` class, an honest `fit` for all
   four intentions, and the facets both concepts genuinely carry.
3. If it is `historical-transmission`, the validator will demand a direction and
   a non-interpretive source. If it is `contested`, it will demand that you
   state the disagreement.
4. `npm run build` must pass.

If you cannot source it, make it `interpretive` — which asserts nothing beyond
the structures compared — or do not write it.

## Human review

`docs/DIRECTOR-SIGNOFF.md` separates what an automated check proves, what has
evidence but still needs a person, and what nothing automated can establish.
Beauty, comfort, pacing, intellectual honesty, and musical quality are in the
third category. No assistant may tick those items.
