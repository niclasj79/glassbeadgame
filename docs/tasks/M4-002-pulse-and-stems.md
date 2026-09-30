# M4-002 — The pulse and the stems: a bed with harmony, movement and a pulse

## Status

Blocked

## Milestone

M4 — Semantic audiovisual grammar

## Dependencies

- M4-001 must be Done: the pulse keeps the conductor's grid, the fills land
  on it, and the stems read the slot the conductor keeps.
- ADR-017 must be accepted through reviewed merge, together with the §18
  amendment of `docs/VERTICAL-SLICE-SPEC.md`.

M2-011 is not a dependency in the steering sense: its Review status records
the director's pending device, accessibility and audiovisual gate, not missing
code, and this task does not rely on that gate.

## Objective

Extend the generative bed with the three things the director named as
lacking after choosing it over a recorded track: an underlying, hypnotic
percussive pulse with rhythmic highlights tied to the events of play; a
harmony that moves; and stems that answer the web. The target is a headphone
session in which the world keeps a pulse under everything, the harmony turns
slowly beneath the concepts' notes, and what the player has woven is audible
as a growing ensemble — with no time pressure, no reward in the sound, and
nothing that imitates Tension's grammar.

## Why this is next

The conductor (M4-001) gives the bed a grid every layer can keep, and the
first thing the director wants on that grid is a pulse. A licensed track was
weighed and set aside (ADR-017): it would bring a key, a tempo and a form of
its own into a world that keeps one time. The bed can grow harmony, movement
and a pulse on the grid it already has, and stay generative, offline,
deterministic and free of licence. Everything later in the polish track — the
surface pass, Attunement as the heightened state — is heard against this bed,
so it comes before them.

## Implementation plan

1. **The pulse's cells and fills as pure functions.** A module of pattern
   generators with no Web Audio: the loping cell over the slot's eighths, the
   fill that rolls into the next slot boundary, the second voice a completed
   motif adds for a phrase, the thinning under attention, and the profile
   under reduced intensity. Unit-tested on the grid.
2. **Three bodies.** A skin, a brush and a bell made from the voices the
   world has (a low wood strike, a bandpassed noise tap, a glass tick in the
   air register), each with a gain ceiling under the bed, all through the
   ambient bus so reach and space scale them, and the reverb the master
   already carries.
3. **The bed schedules the pulse.** Per slot, on the conductor's grid, gated
   by awakening and scaled by reach; thinned by `setSpace`; left to the
   heartbeat under Attunement; taken out with the bed at the coda.
4. **The harmony that moves.** The root cycle over the stable degrees per
   phrase, the voice-led pad chord crossfaded at the phrase boundary, the
   drone refresh locked to the phrase, the lean's ratio comment corrected.
   A test proves every concept's identity note consonant over every root.
5. **The stems.** A stem per faculty, entering with its first thread and
   thickening with its threads, pitched from the current chord, inside the
   voice budget and the tension ceiling.
6. **Events.** The director's cues that already reach the bed (`thread.woven`,
   `motif.completed`, `study.solved`, `attention.*`, `attunement.changed`,
   `conclusion.perform`) drive the fills and the second voice through the
   sink; the fill is one fill for every outcome kind.
7. **Load and evidence.** The pulse and the stems load with the semantic
   layer, after the title. The performance reference and the first load are
   recorded beside M4-001's; the comfort audit runs over a long timeline with
   the pulse in it.

## Required reading

- `AGENTS.md`
- `docs/MASTER-PLAN.md`
- `docs/VERTICAL-SLICE-SPEC.md` — §11, §13, §14, §18, §22
- `docs/ARCHITECTURE.md` — §8 and §10
- `docs/DECISIONS.md` — ADR-009, ADR-013, ADR-016 and ADR-017
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md` — the Tension grammar, CAV-006 and
  CAV-007
- `docs/tasks/M4-001-conductor.md` — the grid and its module (which lands
  with that packet), the sink's members, the lazy semantic layer
- `src/audio/ambient.ts` — every layer the bed schedules and how
- `src/audio/score.ts` — the phrase, the root rule, the units
- `src/audio/voices.ts` — the bodies, the envelopes, the voice budget
- `src/audio/mode.ts` — the mode, its stable and tense degrees
- `src/audio/theory.ts` — identity notes
- `src/audio/comfort.ts` — the comfort table and the tension ceiling
- `src/audio/intensity.ts` — the profiles
- `src/audio/engine.ts` — the buses, the reverb, the binaural layer
- `src/audio/director.ts` — the cues that reach the sink
- `src/audio/useAudio.ts` — the room lifecycle and the lazy layer
- `src/themes/worlds.ts` — each world's slot and bed
- `src/content/castalia/concepts.ts` — the motifs' degrees and timbres

## Existing code and callers to inspect

- The bed today: drone (root, every 8 slots), the one-note pad, the
  heartbeat (one sub onset per slot once awakening reaches 0.5), the shimmer,
  the four seats, the choir (identity notes, off the grid), the air bed; how
  reach scales the bus, how `setSpace` scales density and bed, and the
  `bed²` the pad and heartbeat receive under space.
- The root rule (`floor(slot / 12) % 3 === 2 ? 9 : 0`) and the 8-slot drone
  refresh that does not lock to the 12-slot phrase.
- The bodies and `playNote`'s options; the wood strike and the reed breath
  as the only noise in a voice; the noise taps in `src/audio/sfx.ts`; the
  global voice budget of 48; the 30 s lifetime cap.
- The mode: tonic C3, just temperament, stable `[0,3,4,5,7,8,9]`, tense
  `[1,2,6,10,11]`; twenty-three of twenty-four identity notes on pitch class
  C, one on 7.
- The intensity profiles and the fact that only director plans read them
  today; the bed, the heartbeat and the hand's sounds do not.
- The comfort audit (`auditComfort`) and how Attunement's stacking was caught
  by it.
- The conductor's `next`, `slotPhase` and `claim`; the sink's `quantize`,
  `quantizeHand`, `conduct`, `setSpace`, `concludeAt`.
- The Tension grammar in the reference: "co-prime pulse cycles interlock and
  only rarely coincide", which the pulse must not imitate.

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M4-002",
  "branch": "codex/M4-002-pulse-and-stems",
  "dependencies": ["M4-001"],
  "requiredReading": [
    "AGENTS.md",
    "docs/MASTER-PLAN.md",
    "docs/VERTICAL-SLICE-SPEC.md",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "docs/CONTENT-AUDIOVISUAL-REFERENCE.md",
    "docs/tasks/M4-001-conductor.md",
    "src/audio/ambient.ts",
    "src/audio/score.ts",
    "src/audio/voices.ts",
    "src/audio/mode.ts",
    "src/audio/theory.ts",
    "src/audio/comfort.ts",
    "src/audio/intensity.ts",
    "src/audio/engine.ts",
    "src/audio/director.ts",
    "src/audio/useAudio.ts",
    "src/themes/worlds.ts",
    "src/content/castalia/concepts.ts"
  ],
  "ownership": {
    "paths": [
      "docs/tasks/M4-002-pulse-and-stems.md",
      "src/audio/**"
    ],
    "boundaries": [
      "ambient-bed",
      "audio-scheduling",
      "musical-time"
    ]
  },
  "unresolvedDecisions": [],
  "requiredChecks": [
    "npm ci",
    "npm run steering:test",
    "npm run steering:check",
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run validate:content",
    "npm run build",
    "npm run bundle:check",
    "npm run test:browser",
    "npm run measure:performance",
    "git diff --check"
  ],
  "humanReview": [
    "product-specification",
    "audiovisual-quality",
    "accessibility-interaction"
  ],
  "stopBoundary": "reviewable-pr"
}
```

## Owned scope

### Declared paths

- `docs/tasks/M4-002-pulse-and-stems.md`
- `src/audio/**`

### Declared boundaries

- `ambient-bed`
- `audio-scheduling`
- `musical-time`

The scene is not owned: the pulse carries no concept and lights nothing, and
the bed's existing breath and pulses are the scene's only audio reads. The
domain, the cue planner, the event schema, the content and the UI must not
change.

## Functional contract

Names may vary if the contract stays equally closed and explicit.

### The pulse

- **Grid.** The world's slot is the bar. The cell is eight eighths; onsets
  are on the conductor's eighth or sixteenth and never off it. No pattern
  runs faster than the eighth except a fill, and a fill is at most half a
  slot of sixteenths.
- **Cell.** A loping three-three-two across the slot's eighths (onsets on the
  first, fourth and seventh eighth) on the skin; the brush on the eighth
  between the second and third skin onsets; the bell only in fills and
  highlights. The cell repeats each slot; no pattern accelerates, changes
  tempo or counts.
- **Bodies.** Skin: a wood strike in the sub register, low-passed, gain at
  most 0.06 × bed. Brush: a bandpassed noise tap (1.6–3.8 kHz), gain at most
  0.02 × bed. Bell: a glass tick in the air register, gain at most 0.015 ×
  bed. All through the ambient bus (reach and space scale them, the master's
  reverb carries them), none through the tension bus. Gains are constants in
  one table beside the bed's.
- **Entry and growth.** The skin enters when awakening reaches 0.25 at gain
  proportional to awakening; the brush from 0.5; nothing sounds in an
  unwoven arena. Reach scales the bus as it does today.
- **Space.** Under attention (`setSpace` density below 1) the cell keeps only
  its downbeat; under Attunement the pulse is silent and the heartbeat keeps
  the slot; the conclusion takes the pulse out with the bed's fade to the
  coda; the room's lifecycle stops it with the bed.
- **Highlights.** A woven thread: a fill of brush sixteenths over the last
  half slot before the next slot boundary, landing on one bell on the
  boundary — the same fill for documented, open and unresolved outcomes
  (CAV-006), quantized as the weave landing is. A completed motif, or a
  solved Study: the cell gains its second voice (the brush on every other
  eighth) for the following phrase. Attention's sighting, lock and preview
  add nothing to the pulse; the hand's own sounds are already its percussion.
- **Profiles.** Reduced intensity keeps the skin on the downbeats only and no
  fills; silent keeps nothing. Both apply to the pulse through the same
  profile the director's plans read.
- **What it must not be.** No co-prime cycle against the slot (Tension's
  signature); no swell tied to time; no pattern that anticipates an act; no
  bead light (no concept); no pitch that could beat against the binaural
  layer or the drone (the skin's pitch is the mode's tonic in the sub
  register, or unpitched).

### The harmony that moves

- **The root cycle.** Per twelve-slot phrase the root walks 0, 5, 9, 7 and
  returns, replacing the lean to 9 every third phrase. The drone refreshes
  on the phrase boundary, not every eight slots.
- **The chord.** The pad becomes root, fifth and one colour (the third or the
  sixth, from the stable set), voice-led: each voice moves to the nearest
  stable degree of the next chord, crossfaded over two seconds across the
  phrase boundary.
- **Consonance with the concepts.** Every identity note (pitch class C, and
  the one on 7) forms a stable interval class with every root of the cycle;
  a test proves it over the mode's ratios, and the cycle may not change
  without it.
- **The lean's comment** ("both exact ratios, so the floor locks rather than
  beats") is corrected: the just ratios of 9 and 14 are 27/20.

### The stems

- One stem per faculty, entering when the faculty's first thread is woven,
  thickening with its thread count up to three voices, pitched from the
  current chord: Measure an arpeggio of metal and glass on the eighths, Sound
  a formant sustain, Matter a low pedal in gut, Image air in reed. Each
  stem's gain ceiling sits under the choir's.
- Stems are harmony's movement, never melody: no stem states a concept's
  motif or its identity note in the concept's register.
- Stems keep the voice budget and the tension ceiling; the comfort audit
  over a ten-thread session with the pulse and the stems passes.
- Stems thin with `setSpace` as the choir does, and leave with the bed.

### Load

- The pulse's and the stems' modules load with the semantic audio layer
  (after the title), never in the first load. The first load stays under
  the ceiling; the remedy for crossing it is another dynamic import.

## Out of scope

- Any recorded or sampled audio; any asset file.
- Visual counterparts of the pulse; the scene, the conductor's readers.
- The Tension grammar, the relation grammars, the motifs and the content.
- Attunement as the heightened state and the payoff by form (later packets).
- The conclusion performance's score, beyond taking the pulse out with the
  bed.
- The hand's sounds, the focus lane, the choir's own timing.

## Constraints

- Product laws 3 and 8: contemplative, no time pressure; nothing sounds for
  decoration — the pulse follows the web's awakening and acts, never a clock.
- ADR-008 and ADR-009: the bed is texture and reads the stores; only a cue
  says what a moment meant; the pulse's highlights come through the sink from
  cues the director already handles.
- ADR-016: everything on the conductor's grid; the pulse conducts no light.
- CAV-006: one fill for every outcome kind. CAV-007: no beating from the
  pulse; the tension ceiling holds; no onset pattern above the sixteenth.
- The Tension grammar's co-prime cycles are not imitated by the bed.
- No React state, no per-frame work in audio, no new dependency, no change
  to `package.json`, CI or the steering scripts.
- Determinism: the cell and the fills are pure functions of the slot index
  and the events; the humanising detune stays the bed's.

## Acceptance criteria

1. A pure pattern module exists with unit tests for the cell, the fill, the
   second voice, the thinning under attention, the reduced profile and the
   silent profile, all on the conductor's grid.
2. The bed schedules the pulse per slot on the grid, gated by awakening and
   scaled by reach; a test with a fake context finds every pulse onset on an
   eighth or a sixteenth and every gain under its ceiling.
3. The three bodies exist with gain ceilings in one table under the bed's;
   none routes through the tension bus; none carries a concept or conducts a
   light.
4. A woven thread's fill lands on the next slot boundary and is identical
   for the three outcome kinds; a completed motif and a solved Study add the
   second voice for one phrase; attention thins to the downbeat; Attunement
   silences the pulse; the coda takes it out with the bed; the room's
   lifecycle stops it.
5. The root cycle is 0, 5, 9, 7 per phrase, the drone refreshes on the phrase
   boundary, the pad is a voice-led chord crossfaded over two seconds, and a
   test proves every identity note consonant over every root.
6. Four stems enter with their faculties' first threads, thicken to at most
   three voices, are pitched from the current chord, and state no motif or
   identity note; the comfort audit passes over a ten-thread timeline with
   the pulse and the stems.
7. Reduced intensity keeps the skin on the downbeats only; silent keeps
   nothing.
8. No pulse or stem pattern uses a cycle co-prime to the slot's eighths; a
   test over the pattern module proves every onset is on the eighth or the
   sixteenth grid.
9. The modules load with the semantic layer; the first-load walk never
   reaches them; the first load is within the ceilings.
10. The performance reference is recorded beside M4-001's, and every check
    below is reported.

## Required tests and checks

- `npm ci`
- `npm run steering:test`
- `npm run steering:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run validate:content`
- `npm run build`
- `npm run bundle:check`
- `npm run test:browser`
- `npm run measure:performance`
- `git diff --check`

Report every check, including any that could not run and the exact reason.
The browser set proves nothing about the sound; the director's headphone
session is the gate.

## Expected completion report

- The branch and the pull request.
- The cell, the fill and the second voice as shipped, with their gains, and
  the root cycle and chord voicings.
- The stems' bodies, ceilings and entry rule.
- The first-load bytes and the performance reference beside M4-001's.
- Every check with its result.
- The director's open questions for the headphone session: whether the pulse
  is hypnotic or an irritant over twelve minutes; whether the fills read as
  answers and never as rewards; whether the harmony's turn is felt beneath
  the concepts; whether the stems read as the web's growth.

## Human review boundary

### Declared categories

- `product-specification`
- `audiovisual-quality`
- `accessibility-interaction`

Human review is required before merge because §18 changes and because the
point is feel. The director must judge, with headphones over a whole session
and again under reduced motion and muted: that the pulse is underneath and
hypnotic rather than in front and insistent; that it never reads as a timer;
that the fills answer acts and reward nothing; that the harmony turns without
drawing attention to itself; that the stems sound like the web growing; and
that Tension still sounds like Tension against the new bed. Automated checks
prove the grid, the ceilings, the parity across outcomes and the consonance
of the cycle; they cannot establish that the bed is beautiful.

## Implementation notes

- Decided by the game design director on 2026-09-30, choosing the bed over a
  recorded track and naming what it lacks: harmony, movement, and an
  underlying hypnotic percussive pulse with rhythmic highlights tied to the
  events of play. Recorded as ADR-017 with the §18 amendment; blocked behind
  M4-001, whose grid it stands on.
