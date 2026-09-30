# M4-001 — The conductor: beads, hand and breath on the score

## Status

In progress

## Milestone

M4 — Semantic audiovisual grammar

## Dependencies

- M2-012 must be Done: the focus view owns the camera close-in, the fog, the
  lens and the focus lane that this task puts on the grid.
- M9-001 must be Done: the Studies share the arena and its audio room
  lifecycle, on which the conductor is rebuilt.
- ADR-016 must be accepted through reviewed merge.

M2-011 is not a dependency in the steering sense: its Review status records
the director's pending device, accessibility and audiovisual gate, not missing
code, and this task does not rely on that gate.

## Objective

Build the conductor — one read model of musical time, written by the
schedulers and read by the scene each frame — and the four things ADR-016
hangs on it, as one playable spike: a session in which the beads light on
their own notes, the hand's sounds land on the grid, the camera counts the
world's slot, and the breath is on the bar. The target is a director's play
session with headphones in which the world audibly and visibly keeps one
time, with nothing added for decoration and nothing that costs a full-screen
pass.

## Why this is next

The director asked for the audiovisual feel to move toward an absolutely
beautiful, mesmerising experience as a side track that converges with the
core interactions. The assessment behind ADR-016 found that the build already
has the two things such an experience is built on — one clock and one
coordinated moment — but that only the director's cues use them. The conductor
is the smallest systemic change that lets everything else keep the same time,
and every later polish bundle (stems by faculty, Attunement as the heightened
state, payoff by form, the surface pass) reads it. Built first, it makes the
rest cheap; built later, each of those would bring its own timing.

## Implementation plan

1. **The conductor.** A pure module in the audio layer: the grid (the world's
   slot, its eighths and sixteenths, the twelve-slot phrase, the four-slot
   breath), a *now* injected at creation (the Web Audio clock in production,
   the controlled clock in test mode), the next grid point on either division
   with the lead the bed's quantize already uses, the slot and breath phases,
   and a bounded ring of scheduled onsets keyed by concept with a light
   envelope read per frame. Unit-tested against fake clocks.
2. **One slot.** The bed arms the conductor with the world's slot and its grid
   origin when it starts, and disarms it when it stops. The production
   director receives the world's slot so its rhythm unit is the slot's
   sixteenth in every world. The camera's beat becomes 0.35 of the slot.
3. **Writers.** The production sink publishes every note of every plan it
   schedules (concept, onset, duration, weight by role), muted or not; the
   ambient choir publishes the identity notes it schedules; the hand's sounds
   publish theirs at their grid time.
4. **Beads on notes.** The bead pass reads each concept's light from the
   conductor inside its frame loop and folds it into the kindling lane by
   `max`, so the glass answers with the light it already has.
5. **The hand on the grid.** The interaction sounds take a start time; their
   callers ask the conductor for the next sixteenth; the focus lane in the
   director asks the sink for the same grid instead of `now + 0.06`. One sound
   of a kind per grid point.
6. **The breath on the bar.** While the conductor is armed, the frame breath
   phase is the conductor's four-slot phase; the bloom, the bed and the sky
   follow because they already read it. A camera breath of at most 0.6 % of
   the field of view joins it, off under reduced motion and on the potato
   tier.
7. **Test mode and evidence.** The test adapter arms the conductor on the
   controlled clock, can conduct a synthetic note and read a bead's light and
   the musical time; a browser describe proves the grid, the light and the
   breath deterministically. The performance reference is recorded beside the
   previous one.

## Required reading

- `AGENTS.md`
- `docs/MASTER-PLAN.md`
- `docs/VERTICAL-SLICE-SPEC.md` — §6 (nothing flickers), §13, §18, §21, §22
- `docs/ARCHITECTURE.md` — §8 and §10
- `docs/DECISIONS.md` — ADR-008, ADR-009, ADR-013 and ADR-016
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md` — CAV-006 and CAV-007
- `docs/INTERACTION-DECISIONS.md` — camera traversal as performance phrasing,
  I-015 through I-020
- `docs/PLAYTEST-PLAN.md` — P-005
- `docs/audits/M0-PERFORMANCE-BASELINE.md`
- `docs/tasks/M2-012-focus-view.md` — the focus lane, the fog pass and the
  lazy chunks
- `docs/tasks/M9-001-studies-spike.md` — the room lifecycle and the last
  performance reference
- `src/audio/ambient.ts` — the bed's slot, grid and quantize
- `src/audio/director.ts` — the sink boundary, the rhythm unit and the focus
  lane
- `src/audio/scheduler.ts` — the look-ahead scheduler
- `src/audio/sfx.ts` — the hand's sounds
- `src/audio/useAudio.ts` — the bridge, the room lifecycle and test-mode gaps
- `src/scene/frameState.ts` — the per-frame owner and the thread pulses
- `src/scene/Beads.tsx` — the instance buffers and the kindling lane
- `src/scene/Cosmos.tsx` — the frame clock and the breath
- `src/scene/Effects.tsx` — the bloom breath
- `src/scene/CameraRig.tsx` — phrases, the kick and the field of view
- `src/scene/framing.ts` — the camera beat
- `src/scene/Threads.tsx` — the one place the scene reads the audio clock
- `src/scene/threadGrammar.ts` — the shared comfort table
- `src/runtime/testMode.ts` — the controlled clocks and the adapter type

## Existing code and callers to inspect

- The bed (`src/audio/ambient.ts`): `start()` sets the slot from the world
  and `nextSlotTime = ctx.currentTime + 0.15`; `quantize()` is the only
  next-grid function and returns `now + 0.02` when the loop is not running;
  the choir pushes thread pulses up to 1.2 s ahead; `stop()` clears them.
- The director (`src/audio/director.ts`): `AudioSink` (`now`, `quantize`,
  `play`, `setSpace`, `activeVoiceCount`, `concludeAt`, `retire`); the rhythm
  unit `unitSecondsFor(2)` when no slot is given; the focus lane at
  `sink.now() + 0.06`; `onThreadVoice` and where it is and is not emitted.
- The production wiring (`src/audio/productionAudio.ts`): the director is
  created without a slot; `play` goes to the semantic scheduler and
  `quantize` to the bed.
- The engine (`src/audio/engine.ts`): `now()`, muting (plans lose their notes;
  the master gain goes to zero), `setAmbientReach`.
- The hand's sounds (`src/audio/sfx.ts`) and their callers in
  `src/scene/threading.ts` (hover, select, latch, cancel, long press) and
  `src/scene/Beads.tsx` (the clink): each plays at `ctx.currentTime`.
- The plan shapes (`src/audio/plan.ts`): `PlannedNote` carries `conceptId`,
  `role`, `atSeconds` (plan-relative), `envelope`, `gain`; `VoicePlan.meta`
  carries `outcome` — the weight table must never read it.
- The bridge (`src/audio/useAudio.ts`): the listener that turns `onThreadVoice`
  into pulses, the room lifecycle (`roomIsEmpty`, `choirMustReset`), and every
  test-mode skip.
- The scene: `frameState.ts` (`clock`, `breathPhase`, `breathDepth`, `pulses`,
  `bursts`, `flare`, `kick`), `Cosmos.tsx` (the clock and the breath phase at
  0.1 Hz of dilated time), `Beads.tsx` (`aState`, `aTier`, the kindling lane
  `aTier.y = max(idle, gather)`, the two index spaces, `needsUpdate`),
  `Effects.tsx` (`BreathDriver`, depth 0.12, tier bloom table),
  `CameraRig.tsx` (`perform()`, `phraseSmoothTime`, the FOV kick at 4 %),
  `framing.ts` (`CAMERA_BEAT_SECONDS = 0.7`, phrases in half beats),
  `Threads.tsx` (the ribbon reads pulses on `audio.now()`), `Firmament.tsx`
  (line breath), `ThreadingDriver.tsx` (the cue bus tick, `applyBreath` at
  about 15 Hz, the test adapter).
- The tests that pin shapes: `src/scene/glass.test.ts` (`attribute vec2
  aTier;`, the `uTime` count, uniform parity under reduced motion),
  `src/scene/framing.test.ts` (phrases as half-beat multiples, at most 2),
  `src/scene/stations.test.ts` (every `frameState.` read inside `useFrame`),
  `src/audio/director.test.ts` and `src/audio/threadVoice.test.ts` (the
  recording sink; `now + LEAD` and the quantized time),
  `src/audio/regressions.test.ts`, `src/audio/ending.test.ts` (fake
  contexts).
- Test mode (`src/runtime/testMode.ts`, `src/scene/ThreadingDriver.tsx`):
  `presentationNow()` and `advanceTestClock`; no AudioContext is created; the
  adapter's `snapshot`, `advanceClock`, `beadScreen`, `presentationProfile`.
- Bundle: `scripts/bundle-budgets.json` and the last measurement (523,317
  bytes gzip against 524,000). The audio engine and the scene are in the first
  load.

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M4-001",
  "branch": "codex/M4-001-conductor",
  "dependencies": ["M2-012", "M9-001"],
  "requiredReading": [
    "AGENTS.md",
    "docs/MASTER-PLAN.md",
    "docs/VERTICAL-SLICE-SPEC.md",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "docs/CONTENT-AUDIOVISUAL-REFERENCE.md",
    "docs/INTERACTION-DECISIONS.md",
    "docs/PLAYTEST-PLAN.md",
    "docs/audits/M0-PERFORMANCE-BASELINE.md",
    "docs/tasks/M2-012-focus-view.md",
    "docs/tasks/M9-001-studies-spike.md",
    "src/audio/ambient.ts",
    "src/audio/director.ts",
    "src/audio/scheduler.ts",
    "src/audio/sfx.ts",
    "src/audio/useAudio.ts",
    "src/scene/frameState.ts",
    "src/scene/Beads.tsx",
    "src/scene/Cosmos.tsx",
    "src/scene/Effects.tsx",
    "src/scene/CameraRig.tsx",
    "src/scene/framing.ts",
    "src/scene/Threads.tsx",
    "src/scene/threadGrammar.ts",
    "src/runtime/testMode.ts"
  ],
  "ownership": {
    "paths": [
      "docs/tasks/M4-001-conductor.md",
      "src/audio/**",
      "src/scene/**",
      "src/runtime/testMode.ts",
      "tests/browser/**"
    ],
    "boundaries": [
      "musical-time",
      "audio-scheduling",
      "scene-frame-state",
      "camera-phrasing",
      "bead-glass",
      "deterministic-test-mode"
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
  "humanReview": ["audiovisual-quality", "accessibility-interaction"],
  "stopBoundary": "reviewable-pr"
}
```

## Owned scope

### Declared paths

- `docs/tasks/M4-001-conductor.md`
- `src/audio/**`
- `src/scene/**`
- `src/runtime/testMode.ts`
- `tests/browser/**`

### Declared boundaries

- `musical-time`
- `audio-scheduling`
- `scene-frame-state`
- `camera-phrasing`
- `bead-glass`
- `deterministic-test-mode`

The scene and audio globs are declared because the spike threads one time
through both layers; no other packet is active in them. The domain, the cue
planner, the event schema, persistence, the UI screens and the steering
harness are not owned and must not change.

## Functional contract

Names may vary if the contract stays equally closed and explicit.

### The conductor

- A pure module in the audio layer with no React, three or DOM import. Its
  clock is injected: `audio.now()` in production, the controlled presentation
  clock in test mode.
- **Grid.** `arm({ slotSeconds, origin })` when the bed starts (the world's
  slot and the bed's first slot time), `disarm()` when it stops and whenever
  the room is empty (title, threshold, Studies list). While unarmed, the next
  grid point is `now + 0.02`, as the bed's quantize answers today.
- **Divisions.** The eighth of the slot (the answer grid the director already
  quantizes to), the sixteenth (the hand grid), the slot, the twelve-slot
  phrase, the four-slot breath.
- **Reads.** `next(division, lead = 0.03)`: the first grid point at least the
  lead ahead. `slotPhase()` in [0, 1). `breathPhase()`: one cycle per four
  slots, cresting on the slot boundary that begins each group. `light(
  conceptId)` in [0, 1]. Every read takes primitives and returns a number;
  none allocates.
- **Onsets.** `sound({ conceptId, at, duration, weight })` records a scheduled
  onset in audio time. The ring holds at most 64; the oldest onset goes
  first. Two onsets on one concept closer than a third of a second merge into
  the stronger (CAV-007's 3 Hz luminance bound, enforced here and nowhere
  else). Onsets older than their duration plus a second are dropped on the
  next write.
- **Envelope.** The light rises over 60 ms at the onset and decays over the
  onset's duration, bounded to [0.35 s, 1.6 s]; it is the weight at the crest.
- **Weights by role**, in one table with no outcome axis: identity and lead
  notes 1.0, accompanying and choir notes 0.6, the hand's sounds 0.35. The
  table is tested against `VoicePlan.meta.outcome` never being read.
- **Reset.** `reset()` clears the onsets; the room lifecycle calls it with
  `disarm()`.

### One slot

- The production director receives the world's slot, so its rhythm unit is
  the slot's sixteenth in every world (Castalia 0.125 s, unchanged; Tide 0.15
  s; Ember 0.1125 s; Aurora 0.1375 s). The director's tests take the slot
  through the recording sink.
- The camera's beat is 0.35 of the world's slot (Castalia 0.7 s, unchanged).
  Phrases stay whole or half beats of at most two beats. The rig reads the beat
  through the theme, not from a constant.

### Beads on notes

- The production sink publishes every note of every plan it schedules to the
  conductor before handing it to the scheduler, at `at + note.atSeconds`,
  with the note's envelope length as duration and its role's weight — muted
  or not, since muting strips the sound and never the schedule.
- The ambient choir publishes each identity note it schedules for a concept.
- The bead pass reads `light(conceptId)` per instance inside its frame loop
  and folds it into the kindling lane: `aTier.y = max(idle, gather, light)`.
  No attribute is widened; the glass shader is unchanged.
- Reduced motion keeps the light (it is a luminance change under 3 Hz, not
  motion). The potato tier keeps it (one read per bead per frame).
- CAV-006: a documented, an Open and an unresolved outcome light their beads
  with the same weight; a test proves it over the three outcome plans.

### The hand on the grid

- Every interaction sound takes a start time in audio seconds; callers pass
  `next(sixteenth)`. One sound of a kind per grid point: a second request for
  the same kind on the same grid point is dropped. The hover ping keeps its
  90 ms throttle as well.
- The focus lane (sighting, lock, preview, reopen) asks the sink for the hand
  grid instead of `now + 0.06`; the minimum spacing of sightings stays.
- The attention foreground, outcomes, the weave landing, ensembles,
  Attunement and the conclusion keep the eighth.
- The visual answers are unchanged: every existing browser test passes without
  a changed expectation of draft stages, cards, fog or camera.
- The hand grid is one constant (`HAND_DIVISION`, 16). The director may set it
  to 8 or back to none after playing; the packet records the choice.

### The breath on the bar

- While the conductor is armed, `frameState.breathPhase` is the conductor's
  breath phase each frame; while unarmed it advances at 0.1 Hz of dilated
  time as today. `breathDepth` and its reduced-motion zero are unchanged; the
  bloom's depth of 0.12 is unchanged.
- The camera breathes with the same phase: the field of view scales by
  `1 − CAMERA_BREATH · breathDepth · sin(breathPhase)` with `CAMERA_BREATH`
  0.006, a constant in the shared comfort table beside the 3 Hz bound. It is
  off under reduced motion (depth is zero) and off on the potato tier (a
  budget flag). It composes with the existing kick, which is unchanged.
- The bed's own breath follows automatically (it reads the frame phase), and
  so do the sky's line breath, the armillary, the margin rule and the motif
  marks.

### Deterministic test mode

- In test mode the conductor is armed on the controlled clock at session
  start with the world's slot and an origin 0.15 s ahead, and disarmed with
  the room, so the grid exists without an AudioContext.
- The adapter gains `conduct({ conceptId, inMs, durationMs, weight })`,
  `beadLight(conceptId)` (the value actually written into the instance
  buffer's kindling lane on the last frame), and `musicalTime()` returning
  `{ armed, slotSeconds, slotPhase, breathPhase, nextHandAtMs, nextAnswerAtMs }`.
- A browser describe in the deterministic-mode spec proves: the grid is armed
  after session start and `slotPhase` advances by half when the clock advances
  by half a slot; a conducted note lights its bead and only its bead, and the
  light has fallen below a tenth once the clock has passed the duration; the
  breath phase crests on a four-slot boundary; leaving to the Studies list
  disarms the grid.

## Out of scope

- Bundle B (stems by faculty, Attunement as the heightened state, payoff by
  form) and Bundle C (dither, a dust field, one pass for all screen effects).
- Folding the thread pulses into the conductor (the next audio packet).
- Any change to the conclusion performance, the cue planner, the event
  schema, the bed's harmonic grammar, the motif renderer or the content.
- New effects, passes, particles, analysers or dependencies.
- Changes to the hand's sounds' timbre or gain, or to the focus lane's copy.
- The UI, the Studies, persistence, the steering harness and CI.

## Constraints

- Product laws 2, 3, 6 and 8: the visual answer never waits for the grid;
  nothing pulses for decoration; no persistent HUD; silence is preferred to
  fabricated significance.
- ADR-008 and ADR-009: no rule lives in audio or the scene; the cue bus stays
  the one coordination boundary; the conductor is a read model of timing, not
  a second bus.
- ADR-013: no event-schema change; conducting during Attunement stays
  ephemeral.
- CAV-006: the weight table has no outcome axis. CAV-007: no luminance above
  3 Hz on one bead; the breath amplitudes are constants in the shared table.
- The Web Audio clock is authoritative: onsets are stored in audio time; the
  controlled clock stands in only where no audio exists.
- No React state per frame; every `frameState.` and conductor read in the
  scene is inside `useFrame` (the existing source scan).
- Determinism: the conductor's reads are pure functions of its inputs; with a
  seed and the controlled clock, the browser describe is exact.
- Bundle: the first load stays under 524,000 bytes gzip. The remedy for
  crossing it is a dynamic import of audio the title does not need (the
  conclusion's and Attunement's audio are the first candidates), never a
  raised ceiling.
- No production dependency. No change to `package.json`, the CI workflow or
  the steering scripts (owned by M0-008).

## Acceptance criteria

1. The conductor module exists in the audio layer, imports no React, three or
   DOM API, and its unit tests cover: the next grid point on both divisions
   with the 0.03 s lead and the unarmed fallback; the slot and breath phases,
   with the crest on a four-slot boundary; the ring cap and the drop of old
   onsets; the 3 Hz merge on one concept; the envelope's rise and decay
   bounds; the weight table; `reset()`.
2. The director's rhythm unit is the world's slot in every world: a test
   renders a motif under Tide's slot and finds every onset on a multiple of
   0.15 s; Castalia's onsets are unchanged.
3. The camera's beat is 0.35 of the slot: Castalia's phrases are unchanged to
   the millisecond, and the framing tests still find every phrase a half-beat
   multiple of at most two beats.
4. Every note of every plan the production sink schedules reaches the
   conductor, muted or not: a unit test with a recording conductor and a
   muted engine counts the onsets.
5. The three outcome plans light their beads with equal weight (CAV-006).
6. The hand's sounds and the focus lane land on the sixteenth grid with at
   most one of a kind per grid point; the director tests assert the grid time
   through the recording sink; the interaction sounds accept a start time and
   fall back to now when unarmed.
7. The bead pass takes the light through the kindling lane with `max`; the
   glass shader and its attributes are unchanged (the existing glass tests
   pass unchanged).
8. `frameState.breathPhase` follows the conductor while armed; the camera
   breath is at most 0.6 % of the field of view, off under reduced motion and
   on the potato tier; the bloom depth is unchanged.
9. The browser describe of the deterministic-mode spec passes on CI: the grid,
   the light, the breath, the disarm on leaving.
10. The performance reference is recorded beside M9-001's, both profiles,
    idle and focus, on the same container, and the first load is within the
    ceilings.
11. Every existing browser test passes without a changed expectation.
12. This packet's implementation notes record the hand-grid choice offered to
    the director, the measurements, and any proposal the work raised.

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
The browser set on the software renderer is evidence of correctness, not of
feel; the director's headphone session is the feel gate.

## Expected completion report

- The branch and the pull request.
- The conductor's public surface as built, and every writer and reader by
  file.
- The hand-grid constant as shipped and the alternative offered.
- The performance reference beside M9-001's, and the first-load bytes.
- Every check with its result.
- The director's open questions for the headphone session: whether the hand's
  sounds feel late on the sixteenth; whether the beads' light on their notes
  reads as the world singing or as a flicker; whether the breath on the bar is
  felt.

## Human review boundary

### Declared categories

- `audiovisual-quality`
- `accessibility-interaction`

Human review is required before merge because the point of the task is feel.
The director must judge, with headphones on a real GPU and again muted: that
the beads' light on their notes reads as the world singing, never as a
flicker; that the hand's sounds on the grid feel like an instrument answering
and not like lag; that the breath on the bar is felt without being noticed;
that reduced motion loses the breath and keeps the light; and that muted play
still shows the world keeping time. Automated checks prove the timing, the
bounds and the parity across outcomes; they cannot establish that it is
mesmerising.

## Implementation notes

- Directly assigned by the game design director on 2026-09-30 ("Go on with
  the polish track"), with ADR-016, the roadmap entry and the index reviewed
  in one pull request. Not selected by the autonomous loop: M2-011 remains in
  Review without a steering ownership projection, so no packet can validate
  as Ready.
