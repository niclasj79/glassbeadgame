# Director Sign-Off Checklist

## What this document is

The completion campaign built and verified a great deal automatically. It could
not verify beauty, comfort, pacing, intellectual honesty, or musical quality,
and it must not pretend otherwise. `AGENTS.md` names those categories as human
review boundaries; `PLAYTEST-PLAN.md` makes the director the acceptance
authority for all of them.

So this file separates three things that are easy to blur:

1. **Verified** — an automated check proves it, and the check is named here.
2. **Evidenced** — there is real evidence (a captured frame, a test, a
   citation) but the judgement is still yours.
3. **Unverified** — nothing automated can establish it. It needs you, a real
   session, and in several cases a real pair of headphones.

Nothing in this document may be ticked by an assistant. If an item is marked
complete without a human having done it, the document has become a liability
rather than a record.

---

## 1. Factual integrity — the highest-stakes gate

The content model makes fabrication structurally hard: `relationType` forces an
author to declare whether a relation asserts transmission or notices a
correspondence, and only `historical-transmission` may claim influence, only
with a non-interpretive source. The validator refuses to build a pack that
breaks either rule.

That is a mechanism, not a verdict. **Authoring is never acceptance (CAV-009).**

### Verified automatically

- [x] Every `established`, `attested`, and `contested` relation names at least
      one source in the register — `npx vitest run src/content/castalia`
- [x] Exactly one relation is typed `historical-transmission`, and it carries an
      explicit direction and a source
- [x] Every `contested` relation carries a `counterpoint` stating the disagreement
- [x] Every `sharedFacets` entry is genuinely carried by both concepts
- [x] No relation id is unresolvable in the pinned pack (ADR-013 condition 1)

### Requires you

- [ ] **Read `src/content/castalia/sources.ts` end to end.** 38 citations. Each
      was checked during authoring against author, venue, year, and whether the
      work says what the relation claims. Spot-check at least the ten below,
      which carry the most weight.
- [ ] **Read all 44 entries in `src/content/castalia/relations.ts`.** For each,
      ask only: *is the evidence class right?* An overstated class is the single
      most damaging defect this project can ship.
- [ ] Confirm the Bartók / Fibonacci relation reads as disputed rather than as
      evidence. It is the campaign's most citation-sensitive claim and is
      authored `contested`, citing Lendvai 1971, Howat's 1983 critique in *Music
      Analysis* 2/1, and Somfai 1996.
- [ ] Confirm the Hockney–Falco camera obscura relation states the dispute.
- [ ] Confirm the girih / quasicrystal relation (Lu & Steinhardt, *Science*
      2007) states its contested reception.
- [ ] Confirm the twelve `interpretive` relations assert nothing beyond the
      structures they compare — no smuggled influence.
- [ ] Decide whether any relation should be **cut**. Silence is always available
      and is preferable to a claim you would not defend.

**Priority citations to spot-check:** Lendvai 1971 · Howat, *Music Analysis*
2/1 (1983) 69–95 · Somfai 1996 · Messiaen, *Quatuor pour la fin du Temps*
(Durand 1942) and the Stalag VIII-A premiere date · Noether, *Nachrichten
Göttingen* (1918) 235–257 · Cantor, *JDMV* 1 (1891) 75–78 · Shechtman et al.,
*PRL* 53 (1984) 1951–1953 · Bennett et al. on Huygens' clocks, *Proc. R. Soc. A*
458 (2002) 563–579 · Barbour 1951 on temperament · Niceron 1638 on anamorphosis.

---

## 2. Audiovisual quality

Automated checks establish that frames render and that no path throws. They
establish nothing about whether the result is beautiful.

### Evidenced

- Reference frames: `node scripts/capture-frames.mjs` writes labelled PNGs to
  `artifacts/capture/` for desktop, desktop-reduced, and mobile, across title,
  arena, attending, armed, weaving, latched, and committed states.

### Requires you

- [ ] Play a full session at desktop dimensions, with headphones.
- [ ] Play a full session on a real phone, on ordinary speakers.
- [ ] Judge whether Castalia reads as **its own world** rather than as generic
      space. This was the campaign's opening diagnosis and it is the one thing a
      test cannot settle.
- [ ] Judge bloom and luminance comfort over a full fifteen minutes, not a
      screenshot.
- [ ] Judge camera phrasing: does attending feel situated, and does the arena
      stay legible? Does any sweep induce discomfort?
- [ ] Judge typographic hierarchy in the arena and in the marginalia.
- [ ] Confirm the threshold sets the stage without reading as a manual, and
      that the arena is legible immediately after it.
- [ ] **Judge the sky assembling.** Each of the six drawn figures belongs to
      one pair of faculties and its lines come in as the web joins those two
      (`scene/constellationReveal.ts`). Weave a Measure–Sound thread and watch
      the monochord; weave within one faculty and confirm nothing in the sky
      answers. The claim under test is that this reads as a picture assembling
      and not as a gauge filling — there is no denominator on screen, but only
      a person can say whether the eye supplies one.
- [ ] **Judge the unlit strand.** A thread the Game has nothing to add to now
      keeps its ink and loses its mark and its light (`scene/threadStanding.ts`,
      `uLit`). Weave two beads that share no facet and decide whether the
      strand reads as "your reading, standing alone" or as a broken thread.
- [ ] **Judge the glass clink.** Beads that would overlap on screen push each
      other apart as the camera turns, and that contact now sounds. Its rate
      limits and silence threshold are bounded in code (`COMFORT.contact`) and
      proven by tests; nothing automated establishes that it is *pleasant*, that
      the pitch range is right, or that it survives fifteen minutes without
      becoming tiresome. Orbit the camera deliberately, then play normally and
      see whether you stop noticing it in a good way or a bad one. No assistant
      has heard it.

---

## 3. The four relation intentions

The specification requires Echo, Passage, Tension, and Ground to be
distinguishable from audiovisual behaviour without relying on label or colour.

### Verified automatically

- [x] Every intention reaches the player in words on every commit —
      `npx vitest run src/runtime/captions`
- [x] Relation meaning is never colour-only, because the caption layer is
      always computed

### Requires you

- [ ] **A blind pass.** Have someone show you unlabelled examples, or capture
      them and review later. Identify at least three of four from behaviour
      alone. This is the M4 gate and it cannot be self-administered while you
      can see which button you pressed.
- [ ] Repeat the blind pass with colour removed (greyscale screenshot).
- [ ] Repeat with reduced motion enabled.
- [ ] Repeat muted, reading captions only.
- [ ] Judge whether Tension is *beautiful instability* rather than a wrong note.
      The comfort envelope is bounded in code (CAV-007: beating 0.8–6.5 Hz, no
      luminance flicker above 3 Hz, torsion ±14°, amplitude decaying to a floor
      within ~12 s), but "within bounds" and "pleasant" are different claims.

---

## 4. Pacing and the whole arc

### Requires you

- [ ] Does a session sustain 12–18 minutes without time pressure?
- [ ] Does Attunement feel *invited* rather than unlocked? It is offered on a
      completed motif or on a connected web of six threads, with no visible
      counter — confirm nothing in play reads as progress toward it.
- [ ] Does the conclusion feel like **this** session? Recognise at least two
      session-specific moments.
- [ ] Does the seventh reading, *Reading*, characterise how you read without
      making you feel marked? It says which verbs you reached for and how often
      Castalia read with you, narrowed you, or ran across you. If it reads as a
      score in words, it has failed CAV-006 and should be rewritten or cut.
- [ ] When a motif forms, it now arrives after the outcome of the commit that
      completed it and waits under that reading until you set it aside. Does
      the middle game have a beat it did not have, or does the wait read as
      the Game withholding something?
- [ ] Can you explain at least half your threads afterwards?
- [ ] Do you want another Game to say something different — not to accumulate?

---

## 5. Accessibility

### Verified automatically

- [x] Text scales with the reader (all sizes in `rem`)
- [x] Every cue has a textual equivalent, with copy rules enforced by tests
- [x] Keyboard path completes the full loop — `npm run test:browser`
- [x] Reduced motion shortens transitions rather than removing them

### Requires you

- [ ] Complete a session using **only** the keyboard.
- [ ] Complete a session with a screen reader, and judge whether the running
      commentary is the same experience or a summary of one.
- [ ] Complete a session muted, reading captions only.
- [ ] Complete a session at 200% browser zoom.
- [ ] Judge touch ergonomics on a real phone — target sizes, and whether the
      weave gesture is comfortable one-handed.

---

## 6. Performance

### Verified automatically

- [x] Bundle budgets — `npm run bundle:check`
- [x] Frame reference report — `npm run measure:performance` (reference
      evidence, explicitly not a hardware-independent gate)

### Requires you

- [ ] Sustained 60 fps on your desktop target over a full session, not a burst.
- [ ] Mobile thermal behaviour after ten minutes — does the device get hot, and
      does the frame rate hold?
- [ ] Confirm the low quality tier looks *intentional* rather than broken.

---

## 7. Offline and persistence

### Verified automatically

- [x] The repository degrades to a working in-memory store when IndexedDB is
      unavailable, and reports that honestly — `npx vitest run src/platform`
- [x] Deterministic reload reconstructs portrait, annotation, and compiled
      performance from the log alone — `npx vitest run src/runtime/progression`

### Requires you

- [ ] Install as a PWA and play offline.
- [ ] Confirm an update never interrupts a session in progress.
- [ ] Conclude a Game, close the tab, reopen the game: it is on the shelf at
      the title, and opening it gives the reading it left — whole, with no
      performance to sit through, and the web drawn behind it.
- [ ] Judge whether the shelf reads as a shelf and not as a collection. It
      names Games by when they ended and the first thing their annotation
      said; it counts nothing. If it ever makes you want to fill it, it has
      become a progress bar.
- [ ] Copy the reading and paste it somewhere: the register is in order, every
      standing is in words, and the citations are intact.
- [ ] Play in a private window and confirm the game runs, and that the plate
      says the Game is kept for this visit only rather than silently losing it.

---

## Automated evidence at campaign close

Reproduce with the commands named in each section above.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx vitest run` | 56 files, 815 tests passing |
| `npm run lint` | clean |
| `npm run validate:content` | 48 tests; pack validates with 0 errors, 0 warnings |
| `npm run build` | clean |
| `npm run bundle:check` | every budget passing (JS gzip 488 kB against a 500 kB ceiling) |
| `npm run test:browser` | 7 of 7 passing |

Set `GBG_BASE_URL` to point the browser suite at a dev server that is already
running; starting a second one doubles the content gate and can push first paint
past the per-test timeout.

**What that table does and does not mean.** It means the game is correct,
deterministic, replayable, and within budget. It means no committed thread can
produce a fabricated claim, because the content model makes fabrication a build
failure rather than a matter of care. It does not mean the game is beautiful,
comfortable, well-paced, or well-scored — and the sections above exist because
those are the questions that remain.

One item deserves naming rather than burying: **the conclusion performance has
never been heard.** It compiles deterministically from the event log and its
structure is asserted in tests, but no human has listened to a session play
itself back. That is the single largest untested claim in the slice.

## Standing constraints

- No item above may be ticked by an assistant.
- An unavailable device or setup is recorded as unavailable, never as covered.
- Automated checks establish correctness and repeatability. They do not
  establish comfort, meaning, pacing, or artistic quality.
