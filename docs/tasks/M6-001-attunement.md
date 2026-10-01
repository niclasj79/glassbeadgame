# M6-001 — Attunement as the heightened state: material, sky, drift and cadence

## Status

In progress

## Milestone

M6 — Attunement and conclusion performance

## Dependencies

- M4-002 must be Done: the sustain and the cadence are the bed's, and the
  pulse must already know to leave Attunement to the heartbeat.
- ADR-018 must be accepted through reviewed merge, together with the §13
  amendment of `docs/VERTICAL-SLICE-SPEC.md`.

M2-011 is not a dependency in the steering sense: its Review status records
the director's pending device, accessibility and audiovisual gate, not missing
code, and this task does not rely on that gate.

## Objective

Make Attunement the peak of the audiovisual experience rather than a quieter
listening mode, within what §13 already allows and ADR-018 decides: while it
is held, the bead glass deepens, the void deepens, the sky's figures brighten
as the threads' voices enter, the bed's chord sustains without its phrase
movement, the camera drifts on the breath, and release plays a cadence that
resolves the chord and lifts the world back over one slot. All of it is
ephemeral (ADR-013, condition 3) and read from the state the cue bus already
publishes.

## Why this is next

The polish assessment found that Attunement reads, in play, as the world
turning down: the ribbons recede and the space thins, and nothing rises to
meet the player's attention. It is the one held heightened state the Game
has, so it is where a mesmerising world shows itself most. It comes after the
bed has grown (M4-002), because the sustain and the cadence are made of that
bed.

## Implementation plan

1. **One scalar, four answers.** The scene already eases an `attuned` scalar
   (the sky and the ribbons read it). The glass material takes it: index of
   refraction and dispersion rise toward the high tier's values within the
   tier's budget; the void's depth colour deepens in the vault's gradient;
   the sky's figures brighten as the audio director's channels enter (the
   thread pulses already carry when each thread sounds). No new state.
2. **The bed sustains.** On `attunement.changed` on, the bed holds the
   current chord (no phrase movement, no drone refresh) and the pulse leaves
   it to the heartbeat (M4-002 already does the latter); on off, the cadence:
   the held chord resolves to the phrase's root over one slot and the
   phrase clock resumes.
3. **The camera drifts.** A slow orbit around the attended web, at most 4°
   per breath, on the conductor's breath phase, cancelled by any input (the
   rig's user-authority rules), off under reduced motion.
4. **Release lifts the world.** The material, the depth and the drift ease
   back over one slot on the same cadence; nothing snaps.
5. **Evidence.** Deterministic browser tests through the adapter (Attunement
   is entered by its invitation; `musicalTime` and `presentationProfile`
   exist): the scalar's targets per tier and under reduced motion; a unit
   test for the cadence's plan; the rest-frame spec unchanged; the
   performance reference beside M4-003's.

## Required reading

- `AGENTS.md`
- `docs/MASTER-PLAN.md`
- `docs/VERTICAL-SLICE-SPEC.md` — §6, §13, §18, §22
- `docs/ARCHITECTURE.md` — §8 and §10
- `docs/DECISIONS.md` — ADR-009, ADR-013, ADR-016, ADR-017 and ADR-018
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md` — CAV-006 and CAV-007
- `docs/INTERACTION-DECISIONS.md` — camera traversal as performance phrasing
- `docs/tasks/M4-001-conductor.md`
- `docs/tasks/M4-002-pulse-and-stems.md`
- `src/audio/attunement.ts` — the channels
- `src/audio/director.ts` — the Attunement cue's handling
- `src/audio/ambient.ts` — the bed and its chord
- `src/scene/Attunement.ts` — the ribbons' recession and the voice travel
- `src/scene/Firmament.tsx` — the sky's attuned state
- `src/scene/glass.ts` — the glass material
- `src/scene/CameraRig.tsx` — user authority and phrases
- `src/scene/frameState.ts` — `timeScaleTarget` and the attuned scalar
- `src/runtime/scene/createSceneDirector.ts` — the flare on entering and leaving

## Existing code and callers to inspect

- Audio: each enter cue plays one cycle of up to six thread channels with
  0.9 s gaps, `setSpace(0.15, 0.55)`, and nothing repeats it; off restores
  `setSpace(1, 1)`.
- Scene: `frameState.timeScaleTarget = 0.55` while attuned; ribbons recede to
  a 0.3 floor over 0.55 s and hold for 6 s; the sky eases its attuned state
  over 0.9 s; flare 0.7 on entering and 0.25 on leaving.
- The glass material's uniforms (`uIor`, dispersion define) and the tier
  budget; the vault gradient's `uDepth`.
- The rig: `perform()`, user authority, `TRANSIT_TIMEOUT_S`, the breath
  phase it already reads for its own breath.
- The cue: `attunement.entered`/`attunement.exited` keep empty payloads
  (ADR-013).

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M6-001",
  "branch": "codex/M6-001-attunement",
  "dependencies": ["M4-002"],
  "requiredReading": [
    "AGENTS.md",
    "docs/MASTER-PLAN.md",
    "docs/VERTICAL-SLICE-SPEC.md",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "docs/CONTENT-AUDIOVISUAL-REFERENCE.md",
    "docs/INTERACTION-DECISIONS.md",
    "docs/tasks/M4-001-conductor.md",
    "docs/tasks/M4-002-pulse-and-stems.md",
    "src/audio/attunement.ts",
    "src/audio/director.ts",
    "src/audio/ambient.ts",
    "src/scene/Attunement.ts",
    "src/scene/Firmament.tsx",
    "src/scene/glass.ts",
    "src/scene/CameraRig.tsx",
    "src/scene/frameState.ts",
    "src/runtime/scene/createSceneDirector.ts"
  ],
  "ownership": {
    "paths": [
      "docs/tasks/M6-001-attunement.md",
      "src/audio/**",
      "src/scene/**",
      "src/runtime/scene/**",
      "tests/browser/**"
    ],
    "boundaries": [
      "attunement",
      "ambient-bed",
      "bead-glass",
      "camera-phrasing"
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

- `docs/tasks/M6-001-attunement.md`
- `src/audio/**`
- `src/scene/**`
- `src/runtime/scene/**`
- `tests/browser/**`

### Declared boundaries

- `attunement`
- `ambient-bed`
- `bead-glass`
- `camera-phrasing`

The domain, the cue planner, the event schema, the UI and the content must
not change; the cues keep their empty payloads.

## Functional contract

Names may vary if the contract stays equally closed and explicit.

- **The scalar.** `attuned` eases in over 0.9 s and out over one slot (the
  cadence), as the sky's does today; every answer below reads it and no
  answer keeps its own.
- **Material.** Index of refraction rises by at most 0.06 and dispersion, on
  tiers that have it, by at most a third; the void's depth colour deepens by
  at most 20 % toward black; the sky's figure brightness rises with the
  channels that have sounded (the thread pulses), to at most 1.5× rest. All
  through uniforms; no shader recompiles.
- **The bed.** On enter, the chord holds and the phrase clock pauses; the
  choir and the seats stay as they are; the pulse leaves it to the heartbeat
  (M4-002). On exit, the cadence: the held chord resolves to the root of the
  phrase it paused in, over one slot, on the conductor's grid, and the clock
  resumes at the next slot boundary.
- **The camera.** A drift of at most 4° of orbit per breath on the breath
  phase, around the attended web's centre, cancelled by any pointer, touch or
  key, and never during a reveal; off under reduced motion.
- **Release.** Everything above returns over one slot on the same cadence.
- **Bounds.** No luminance change above 3 Hz; nothing durable; no counter;
  reduced bloom keeps the depth and drops the brightening.

## Out of scope

- Conducting pulses, foregrounding a motif or listening spatially beyond what
  exists (§13's other verbs are their own decisions).
- Any change to the invitation, the entry threshold or the exit gesture.
- The conclusion performance.
- New effects or passes (M4-003's rule holds).

## Constraints

- ADR-013: ephemeral; no payload; the conclusion is compiled from the log.
- ADR-016: everything timed on the conductor's grid.
- CAV-007 and §6; user camera authority per the interaction decisions.
- No React state per frame; every `frameState.` read inside `useFrame`.

## Acceptance criteria

1. One scalar drives the material, the depth, the sky and the drift; a source
   scan proves no second attuned state exists in the scene.
2. The bounds above are constants in one table with tests.
3. The bed's hold and cadence are unit-tested on a fake sink and context:
   the chord holds, the clock pauses, the cadence resolves to the root over
   one slot on the grid, the clock resumes on a boundary.
4. The drift is cancelled by input and absent under reduced motion; tests on
   the rig's pure helpers.
5. Browser: entering Attunement in test mode raises the scalar's targets and
   leaving lowers them over one slot; the rest-frame spec passes unchanged.
6. Every existing browser test passes; the performance reference is recorded
   beside M4-003's; the first load is within the ceilings.

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

## Expected completion report

- The branch and the pull request; the constants as shipped; every check
  with its result; the performance reference; the director's questions for
  the headphone session (is Attunement now the peak; does the cadence read
  as a release or as a loss; is the drift felt or seen).

## Human review boundary

### Declared categories

- `product-specification`
- `audiovisual-quality`
- `accessibility-interaction`

Human review is required because §13 changes and because the point is feel:
the director must hold Attunement with headphones and judge that the world
rises to meet the attention rather than turning down, that release is a
cadence and not a snap, and that reduced motion keeps the state legible.

## Implementation notes

- Proposed on 2026-09-30 with ADR-018 under the director's polish mandate;
  blocked behind M4-002.
- Unblocked on 2026-10-01: M4-002 merged (`1c5a78f`) and ADR-018 with the
  §13 amendment merged in PR #69 (`49a214a`). Directly assigned by the game
  design director the same day ("Move M6-001 to Ready and build it"), so it
  goes from Blocked to In progress in this pull request, on
  `codex/M6-001-attunement` restarted from `main` (`02673fa`).
- **Plan, written before the code** (AGENTS.md, task protocol 3):
  1. *One scalar.* Today the vault, the drawn sky and the dust each keep their
     own ease of the session's `attunementActive`; there is no shared scalar.
     A pure module (`src/scene/attuned.ts`) owns the bounds table, the scalar's
     step and the answers; Cosmos steps it once a frame after the breath, on
     musical seconds (the conductor's clock while the grid is armed, the frame
     clock when it is not, as the breath does), into `frameState.attuned`. The
     vault, the sky, the dust, the glass and the rig read the answers it wrote;
     `useAttuned` and the per-component eases are removed, and a source scan
     proves no second attuned state remains. The ribbons' per-thread presence
     (`Attunement.ts`) is a different quantity (which thread is speaking) and
     stays.
  2. *In and out.* In: the sky's exponential ease, 0.9 s. Out: the stage
     records the cadence instant when the cue arrives (the first slot
     boundary at least `SCORE.harmony.cadenceLeadSeconds` ahead on the
     conductor's grid, the same instant the bed computes); the scalar holds
     until then and falls along a smoothstep to zero over exactly one slot.
     Without a grid the fall begins at once, over the world's slot.
  3. *The answers.* Glass: `uIor` + 0.06 × scalar; dispersion through a new
     `uDispersion` uniform (the split was a compiled constant), × (1 + 1/3 ×
     scalar), read only where the tier compiles dispersion. Depth: `uDepth`
     in the vault and in the glass (the same `gbgEnvironment`, so the room and
     what the beads carry agree) × (1 − 0.2 × scalar). Sky: the drawn
     figures' stars and lines × (1 + 0.5 × scalar × voices), where voices is
     the eased fraction of this hold's channels whose thread voices have
     begun since entering (`frameState.pulses`, on the conductor's clock),
     out of min(threads, `SCORE.attunement.maxChannelsPerCycle`); the static
     figure boost it replaces (up to 1.9× on the lines) exceeded the 1.5×
     bound. The field's recession and the vault's legibility shift stay,
     driven by the scalar. Reduced bloom drops the brightening and keeps the
     depth; today reduced motion implies reduced bloom (`quality.ts`).
  4. *The drift.* The rig turns the camera about the orbit target (the web's
     centre at rest) at (4° per breath) × scalar × (1 − cos breath), whose
     mean over a breath is 4°: it eases with the breath rather than gliding.
     Off under reduced motion; never during a reveal, a scripted move, a
     gesture, the focus view or the conclusion's performance; a press or
     wheel on the canvas or any key cancels it for the rest of the hold,
     eased out over a quarter second; the idle orbit stays off while
     attuned, so one authority turns the camera.
  5. *The bed (audio).* An optional sink call, `holdHarmony(held)`, from the
     director on `attunement.changed` (before the channels) and on the
     conclusion. The bed's phrase clock becomes its own counter of harmonic
     slots: held, it does not advance, and the ground is re-struck on the
     same root and voicing at its usual strike interval so the chord sustains
     inside the 30 s voice bound. Released: the cadence at the first slot
     boundary at least the lead ahead — the fifth and the colour release
     over one slot while one voice arrives on the root an octave above the
     pad's root; the drone and the pad's root hand over at the next boundary,
     where the clock resumes at the start of the next phrase (the cadence
     closes the phrase it paused in). The cadence slot writes no pulse cell
     and no stems; the heartbeat stays.
  6. *Evidence.* Unit tests for the step, the answers, the bounds, the
     drift's helpers and the source scan; the bed's hold and cadence on a fake
     context; the director's calls; an adapter read of the scalar and its
     answers; a browser spec that weaves six threads by keyboard, accepts the
     invitation, and measures the targets and the one-slot release at two
     profiles; the rest-frame spec unchanged; the performance reference.
- Built on 2026-10-01 in two halves from `01d7546`, the scene here and the
  bed in a parallel worktree, merged without conflict. As shipped:
- **The scene** (`src/scene/attuned.ts`, `Cosmos.tsx`, `frameState.ts`). The
  bounds are one frozen table, `ATTUNED`: enter 0.9 s, voices eased 0.9 s,
  index of refraction +0.06, dispersion +1/3, depth −20 %, figure gain at
  most 1.5×, drift 4° a breath, the drift let go within 0.25 s, no
  oscillation (3 Hz bound). `advanceAttuned` steps the scalar in place:
  `entering` (exponential), `awaiting` (held until the cadence's boundary),
  `releasing` (smoothstep over exactly one slot, overshoot carried), `rest`.
  `attunedAnswers` writes the answers once a frame; the stage records the
  hold's start and the cadence's boundary at the cue
  (`conductor.next(1, cadenceLeadSeconds)`). The vault, the drawn sky and the
  dust lost their own eases and `skyAttunement.ts` is gone; the source scan in
  `attuned.test.ts` proves the three `uAttuned` writes read the one scalar,
  that only `Cosmos` steps it, and that the session's flag is read only by
  `Cosmos`, the ribbons' per-thread presence and the interface.
- **The answers.** The glass's dispersion split became a uniform
  (`uDispersion`, rest `DISPERSION_SPLIT`), so nothing recompiles; only the
  high tier compiles dispersion. The depth scales `uDepth` in the vault and in
  the glass together. The drawn figures keep their size and their stars and
  lines take the gain; the static attuned boost they replace (up to 1.9× on
  the lines and a larger, brighter star) exceeded the packet's bound, so a
  hold with no voice heard — no unlocked audio — leaves the figures at rest
  while the field still recedes and the vault's drawing still comes forward.
  The drift turns about the orbit target at `(4°/breath) × scalar × (1 +
  depth × sin breath)`, on musical seconds; a press or wheel on the canvas or
  any key takes the camera for the rest of the hold (the Release control is
  interface, not world, and leaves the drift to fall with the scalar); the
  idle orbit is off while attuned.
- **The bed** (`ambient.ts`, `harmony.ts`, `conductor.ts`, `director.ts`).
  The phrase clock is the bed's own `harmonicSlot`; without a hold every slot,
  strike and root is as before (the 521 existing audio tests pass unchanged).
  Held, the clock waits and the same chord is struck again at its usual
  interval — the packet's "no drone refresh" read as no movement, because a
  voice may not outlive 30 s. Released, the cadence on the first boundary
  at least the lead ahead (`gridPointAtOrAfter`, now the one formula behind
  `conductor.next` too, so the scene and the bed agree to the bit): the fifth
  and the colour release over the slot, the drone and the pad's root hold to
  the next boundary, one voice arrives on the root an octave above the pad's;
  the next boundary strikes the next phrase's chord. The cadence slot writes
  no stems, no pulse cell and no fill. Calls the bed half made beyond the
  plan, all tested: the phrase it resumes on is the one after the phrase whose
  chord it resolves (`nextPhraseStart`, which fixes the plan's formula
  skipping a phrase when the hold began on a phrase boundary); a hold taken
  back during the cadence strikes the held chord at once on the first
  boundary the lead allows, the cadence's own where possible, and nothing
  doubles; a re-strike due on the cadence's own slot strikes the drone and the
  pad's root alone, so the root still carries the cadence; a fading ground
  voice is never retired twice (a click); and the release reaches the bed
  before the space returns, so the arrival is struck at the held level and the
  room rises over it. Known limit: where the cadence's boundary falls inside
  the lookahead already written (about half of releases), that slot's stems
  were written before the release and stay; at Attunement's density they are
  sparse and on the held chord.
- Load: the first load is 517,773 bytes gzip and 1,721,885 raw against
  524,000 and 1,760,000, from 515,287 and 1,714,586 on `main` (+818 bytes
  gzip for the bed, the rest for the scene's module).
- Checks in the cloud container on the integrated head: `npm run
  steering:test` 82 of 82; `steering:check` 32 packets; typecheck (app and
  Playwright); lint; `npm test` 2,321 passed in 142 files (62 new: 32 for the
  scene, 30 for the bed); `validate:content`; build; `bundle:check`; `git diff
  --check`. Browser, on the software renderer at 800×600 through the local
  runner: the CI set (`test:browser`) passed 18 of 18 in 2.5 minutes. The
  first full run, right after the dev server was restarted, passed 24 of 25:
  the focus view's column test missed its first attend by mouse, and missed it
  again when rerun alone at once; it then passed five times on this branch and
  six times on `main` alternately, so it is recorded as a timing sensitivity of
  the software renderer to watch on CI, not as a defect of this change (the
  held state is at rest there, and nothing in it touches a click). The new
  `attunement.spec.ts` passed 3 of 3 on three runs (about 2.3 minutes; not in
  the CI set, like `surface.spec.ts`); the rest-frame spec 4 of 4, unchanged.
  `npm run measure:performance` (SwiftShader, quiet, effective frames per
  second, evidence only per M0-005): desktop-base idle 2.96, mobile-potato idle
  9.76 and focus 6.25, against M4-003's 2.65, 8.61 and 5.41; the desktop focus
  profile misses the container's frame floor, as on `main`. The held state
  draws nothing new: uniforms and one camera rotation. `npm ci` was not run
  again in this container: no dependency or lockfile changed.
- For the headphone and screen session: is Attunement now the peak; does the
  cadence read as a release or as a loss; is the drift felt or seen; does the
  void read as deeper or only darker; do the figures brightening as the
  voices enter read as the sky listening; is closing the phrase on release
  (rather than resuming it) right; and under reduced motion, is the held state
  still legible without the drift.
