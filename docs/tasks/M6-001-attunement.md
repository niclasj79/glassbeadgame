# M6-001 — Attunement as the heightened state: material, sky, drift and cadence

## Status

Blocked

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
