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
- [ ] Confirm the first ninety seconds teach the interaction without text.

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
- [ ] Play in a private window and confirm the game runs, and that the interface
      says the Game will not be saved rather than silently losing it.

---

## Standing constraints

- No item above may be ticked by an assistant.
- An unavailable device or setup is recorded as unavailable, never as covered.
- Automated checks establish correctness and repeatability. They do not
  establish comfort, meaning, pacing, or artistic quality.
