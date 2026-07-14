# M2-005 — Build deterministic expressive gesture profiles

## Status

Done

## Milestone

M2 — New interaction loop

## Dependencies

- M2-004 must be Done.
- Director decision I-009 must be accepted through reviewed merge.

## Objective

Add one pure TypeScript builder that converts normalized, game-relative gesture
samples into the existing schema-version-1 `GestureProfile`. The builder must
support pointer paths and keyboard/controller hold-and-confirm without
fabricating unavailable geometry, and must return deterministic, deeply
immutable output or fail closed on malformed input.

This task establishes only the calculation and validation seam. It does not
listen to browser events, normalize pixels, alter the interaction draft, commit
events, or render audiovisual feedback.

## Why this is next

M2-004 deliberately accepts an already captured `GestureProfile`; no production
module yet has a canonical way to derive one. I-009 requires duration and
modality for hold-and-confirm while leaving unavailable geometric fields absent,
with no penalty or fake pointer path. A small pure builder makes those semantics
testable before pointer, touch, keyboard, or controller adapters are allowed to
feed the durable commit command.

## Implementation plan

1. Reconfirm the accepted gesture fields, event validation, I-009 equivalence,
   and the legacy pointer implementation's current non-canonical measurements.
2. Add explicit normalized-sample input types and one pure profile builder under
   the owned runtime boundary.
3. Implement the specified duration, path, speed, curvature, and pressure
   calculations without browser, state, event-construction, or presentation
   dependencies.
4. Add focused tests for pointer and hold-only profiles, exact calculations,
   determinism, immutability, absent data, and every validation failure.
5. Run all required checks and scan callers to prove the builder remains
   unintegrated in production.

## Required reading

- `AGENTS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M2-004-atomic-interpretation-commit.md`
- `docs/VERTICAL-SLICE-SPEC.md`, especially expressive gesture and accessibility
- `docs/ARCHITECTURE.md`, especially pure rules, input, and event ownership
- `docs/INTERACTION-DECISIONS.md`, especially I-008 through I-010
- `docs/PLAYTEST-PLAN.md`, especially the M2 and device gates

## Existing code and callers to inspect

- `src/domain/events/types.ts`
- `src/domain/events/createSessionEvent.ts`
- `src/domain/events/createSessionEvent.test.ts`
- `src/runtime/commitInterpretation.ts`
- `src/runtime/commitInterpretation.test.ts`
- `src/scene/threading.ts`
- `src/state/types.ts`
- `src/state/store.ts`

The existing event type owns the durable field names and modality vocabulary.
Its event constructor owns final payload validation. The M2-004 command consumes
but does not derive a gesture. Legacy `threading.ts` measures pixels per pointer
event for presentation and uses thresholds for the old loop; those values are
not normalized profiles and must not become a second canonical rule source.

## Owned scope

The task may modify only:

- `src/runtime/gestureProfile/**`;
- focused tests colocated with that boundary;
- this task file for implementation notes and status.

All domain event types and constructors, the interpretation draft and commit
command, adapters and stores, legacy state, browser input, React, scene, camera,
audio, UI, persistence, content, dependencies, and deployment are
inspection-only. No active task may introduce a competing gesture-profile
builder while M2-005 is active.

## Required input contract

Expose explicit readonly public types equivalent to:

```ts
interface NormalizedGestureSample {
  readonly atMs: number;
  readonly xViewport?: number;
  readonly yViewport?: number;
  readonly pressure?: number;
}

interface BuildGestureProfileInput {
  readonly inputModality: InputModality;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly samples?: readonly NormalizedGestureSample[];
}

buildGestureProfile(input: BuildGestureProfileInput): GestureProfile;
```

Names may vary only when the resulting API is equally explicit. Coordinates are
already normalized viewport units supplied by a future adapter; they may lie
outside `0..1` during pointer capture and therefore must be finite but not
clamped. Times are game-relative milliseconds, never wall-clock timestamps.

The builder must apply these boundary rules:

1. `inputModality` must use the existing `INPUT_MODALITIES` vocabulary.
2. Start and end must be finite and non-negative, and end must not precede
   start.
3. Sample times must be finite, fall inside the declared interval, and be
   strictly increasing.
4. A sample either supplies both finite coordinates or neither. A sample list
   may not mix coordinate-bearing and coordinate-free samples.
5. Pressure, when present, must be finite and within `0..1`.
6. Invalid input throws a stable typed error; it is never sorted, clamped,
   coerced, partially accepted, or silently repaired.
7. The input and caller-owned sample array are never mutated.

Export a dedicated `GestureProfileBuildError` (or equivalently named subclass)
whose readonly `code` is exactly one of:

- `unsupported-input-modality`;
- `invalid-time-range`;
- `invalid-samples` for a non-array sample collection;
- `invalid-sample-time`;
- `non-monotonic-samples`;
- `invalid-sample-coordinates`;
- `mixed-coordinate-availability`;
- `invalid-pressure`.

The same invalid condition must always use the same code. Error messages may add
diagnostic detail but tests must not depend on incidental wording.

## Required profile calculations

The output always includes the supplied `inputModality` and
`durationMs = endedAtMs - startedAtMs`.

Pressure is independent of path geometry. When at least one sample supplies
pressure, output the arithmetic mean of all supplied pressure values; omit it
when none do.

For fewer than two coordinate samples, omit all four geometric fields. For two
or more coordinate samples, calculate:

- `pathLengthViewport`: the sum of Euclidean distances between consecutive
  coordinates;
- `averageSpeedViewportPerSecond`: total path length divided by total segment
  time in seconds;
- `speedVariance`: the population variance of per-segment speeds, in
  `(viewport-units per second)²`; a one-segment path has variance `0`;
- `curvature`: the arithmetic mean of the absolute turning angles between
  consecutive non-zero segments, divided by pi. Skip zero-length segments; use
  `0` when fewer than two non-zero segments remain. Clamp only the floating-point
  cosine ratio to `[-1, 1]` before `acos` to prevent numerical domain drift.

Do not round the calculated values. Strictly increasing sample time means every
segment duration is positive. A stationary path is valid and produces zero path
length, average speed, speed variance, and curvature.

Hold-and-confirm may supply no samples at all. A keyboard, controller, or other
profile without coordinate samples contains modality and duration plus pressure
only if genuinely supplied. It receives no fabricated path, curvature, speed,
or input penalty. Optional future directional modulation may use the same
normalized coordinate contract without changing durable event fields.

Return a new deeply frozen object. Repeated equal inputs must produce exactly
equal values and byte-identical `JSON.stringify` output.

## Out of scope

- changing `GestureProfile`, `InputModality`, event schemas, constructors,
  reducer transitions, replay, serialization, or persistence;
- collecting, buffering, resampling, throttling, or normalizing DOM events;
- deciding gesture start/end lifecycle, pointer capture, drag thresholds,
  hold duration, cancellation, or directional modulation controls;
- integrating with M2-003 drafts or M2-004 commits;
- thread-ID generation, clocks, Zustand, legacy store migration, or durable
  publication;
- visual, musical, spatial, haptic, camera, resonance, or outcome behavior;
- tuning artistic feel, accessibility comfort, performance, or device support;
- dependencies, content, service workers, CI, deployment, or GitHub settings.

## Constraints

- TypeScript strict mode; explicit public types; no `any`.
- Pure synchronous deterministic calculation with no browser globals, clocks,
  random values, mutable module state, React, Three.js, Zustand, or Web Audio.
- Import and return the existing event-domain types rather than copying the
  modality or durable profile contracts.
- Do not export a second event validator or weaken final validation in
  `createSessionEvent`.
- Do not reuse legacy pixel thresholds or presentation-only `pointerMotion`.
- If implementation requires changing gesture meaning, event compatibility,
  production input, or presentation behavior, stop and record a specification
  proposal instead.

## Acceptance criteria

1. One exported builder accepts the declared normalized contract and returns the
   existing `GestureProfile`.
2. Modality and duration are present for valid pointer and hold-only inputs.
3. Pointer geometry uses exactly the specified normalized formulas.
4. Missing geometry remains absent; keyboard/controller hold-only profiles
   contain no fabricated pointer fields.
5. Pressure is averaged only from genuinely supplied valid values.
6. Invalid modality, interval, sample order/range, partial/mixed coordinates,
   non-finite number, or pressure range fails closed with a stable typed error.
7. Inputs remain untouched and outputs are deeply frozen.
8. Repeated equal inputs yield byte-identical output.
9. No existing event, draft, commit, state, input, or presentation behavior
   changes, and no production caller imports the builder.
10. No production dependency is added.

## Required tests and checks

- Clean dependency installation from the lockfile.
- Typecheck.
- Lint.
- Full unit suite plus focused tests for:
  - mouse/touch/pen paths and keyboard/controller hold-only profiles;
  - exact straight, turning, stationary, speed-variance, and pressure examples;
  - absent samples, one sample, two samples, zero-duration hold, and
    out-of-viewport finite coordinates;
  - every validation rule and stable error classification;
  - input non-mutation, deep freezing, repeat determinism, and byte identity.
- Content validation.
- Production build.
- Bundle report and accepted ceiling check.
- Deterministic browser smoke tests.
- Targeted performance reference only if implementation affects an active
  per-frame, input, rendering, or audio path; otherwise report why it was not
  required.
- `git diff --check`.
- Focused dependency/caller scan proving the builder has no browser, React,
  Three.js, Zustand, Web Audio, event-construction, or production caller.
- Focused diff scan proving every changed production/test file stays within the
  declared gesture-profile boundary.

## Expected completion report

- exact files changed and API added;
- formulas and validation behavior implemented;
- tests added with final counts;
- every required check and result;
- caller, ownership, and dependency scan results;
- performance-reference disposition;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because the normalized calculation seam
will shape later audiovisual articulation and input equivalence. Automated tests
can prove formula fidelity and absence of fabricated geometry, but cannot accept
gesture feel, device comfort, directional modulation, or artistic pacing. Those
remain later director-led playtest gates.

## Implementation notes

- Accepted and merged in PR #40 on 2026-07-14. The exact `main` merge commit
  `bc6da55` passed Quality Gates run `29358570399` and Pages deployment run
  `29358691405`.
- Selected on 2026-07-14 after PR #39 was reviewed and merged, its exact
  `main` merge commit `fa77aed` passed CI run `29339063847` and Pages deployment
  run `29339191696`, no PR remained open, and no active task owned
  `src/runtime/gestureProfile/**`.
- Implementation plan: add the closed typed builder error, validate normalized
  sample intervals/coordinates/pressure without repair, calculate the specified
  duration/path/speed/variance/curvature/pressure profile, prove hold-only
  equivalence and deterministic immutability in focused tests, then run the
  complete required suite and ownership/caller scans.
- Added the pure `buildGestureProfile` boundary, explicit readonly input/sample
  contracts, and the closed `GestureProfileBuildError` vocabulary. Validation
  rejects unsupported modalities, invalid intervals/sample collections/times,
  non-monotonic order, partial or mixed coordinates, non-finite calculations,
  and invalid pressure without sorting, clamping, coercion, or mutation.
- The builder always records modality and duration; derives normalized path
  length, elapsed-time average speed, population variance of segment speeds,
  mean normalized turning angle, and supplied-pressure mean exactly as
  specified; omits unavailable geometry for hold-only input; and returns a new
  frozen byte-deterministic profile.
- Added 34 focused tests covering mouse, touch, pen, keyboard, controller, and
  unknown modalities; straight, turning, unequal-speed, stationary, one-point,
  coordinate-free, zero-duration, pressure, and out-of-viewport cases; every
  closed error code; input non-mutation; freezing; and byte identity.
- Required validation passed: clean lockfile installation with zero
  vulnerabilities; typecheck; lint; 18 unit-test files with 228 tests; 3 content
  validation tests; production build; bundle ceilings at 2,422,605 raw bytes /
  1,270,785 gzip bytes total and 1,581,963 raw / 465,848 gzip JavaScript bytes;
  3 deterministic browser tests; and `git diff --check`. The existing
  `three-mesh-bvh@0.7.8` deprecation and established large-chunk notices remain
  unchanged.
- Focused scans found only event-domain type/constant and local error imports,
  no browser/React/Three/Zustand/Web Audio/event-construction dependency, no
  production caller, and no changes outside the owned gesture-profile boundary
  and this task file. Event, reducer, replay, state, input, presentation,
  content, dependency, and deployment contracts remain unchanged.
- The targeted performance reference was not required because the pure builder
  is unintegrated and changes no active per-frame, input, rendering, or audio
  path. Human review remains required for later gesture feel, device comfort,
  directional modulation, and audiovisual phrasing; no compatibility proposal
  or specification conflict was discovered.
- Ready packet proposed on 2026-07-14 after PR #38 was reviewed and merged. Its
  exact `main` merge commit `d8c200e` passed Quality Gates run `29336060556` and
  Pages deployment run `29336185499`; no PR remained open and no active task
  owned `src/runtime/gestureProfile/**`.
