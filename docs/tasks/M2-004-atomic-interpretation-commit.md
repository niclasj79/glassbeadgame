# M2-004 — Add the atomic interpretation commit boundary

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M2-003 must be Done.
- Director decisions I-008 and I-009 must be accepted through reviewed merge.

## Objective

Add one validated atomic publication path that converts an accepted
`candidate-selected` interpretation draft, a supplied stable thread identity,
and an already captured gesture profile into the existing ordered event batch:

`pair.selected → relation.hypothesized → thread.committed`

The task extends the canonical domain-session adapter with a non-empty batch
append and adds one application command over that boundary. All three events
must be constructed and replay-validated before one reactive publication. No
observer may see the canonical session stranded at pair-only or hypothesis-only
state.

This task does not integrate input, capture gestures, change the draft machine,
produce outcomes, or alter production presentation. It preserves the accepted
schema-version-1 event payloads and reducer semantics.

## Why this is next

M2-003 deliberately kept pair and intention provisional so cancellation could
remain free of durable side effects. I-008 now confirms that the selected pair,
hypothesis, and committed thread become durable only together after expressive
confirmation. The current adapter appends one event at a time, which would expose
two intermediate reactive states if a command published the accepted sequence
through repeated calls. A validated batch append is therefore the smallest safe
prerequisite for later gesture and production integration.

## Implementation plan

1. Reconfirm the accepted event order, reducer preconditions, gesture validation,
   adapter publication semantics, and M2-003 draft boundary.
2. Add one immutable non-empty batch append action to the canonical
   domain-session adapter, preserving the single-event action as a compatible
   path over the same validation logic.
3. Add a typed interpretation-commit command that constructs the exact three
   existing events from one accepted candidate draft and gesture, then publishes
   them through one batch call.
4. Test successful ordering, deterministic identity/time, one notification,
   replay equivalence, deep immutability, and every failure path without partial
   publication.
5. Run the complete repository suite and inspect the diff for schema drift,
   duplicate rules, partial state, production integration, or later-M2 work.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially the core loop and product laws;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 6–9, 22, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–8, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially state ownership and migration risks;
- `docs/DECISIONS.md`, especially ADR-003, ADR-008, and ADR-011;
- `docs/ROADMAP.md`, especially the M2 gate and unsafe parallelism;
- `docs/INTERACTION-DECISIONS.md`, especially I-004 through I-010;
- `docs/PLAYTEST-PLAN.md`, especially the accepted personal M2 gate;
- `docs/tasks/M2-001-attention-command-boundary.md`;
- `docs/tasks/M2-003-ephemeral-interpretation-draft.md`.

## Existing code and callers to inspect

- `src/domain/events/**`, especially `createSessionEvent`, `ConceptPair`,
  `RelationIntention`, `GestureProfile`, and `thread.committed` validation;
- `src/domain/model/**`, `src/domain/reducer/**`, and `src/domain/replay/**`,
  especially pair/hypothesis preconditions and post-commit clearing;
- `src/domain/ids.ts`, especially stable `ThreadId` and event identity;
- `src/runtime/interactionDraft/**` as the accepted input boundary;
- `src/runtime/commands/attention/**` as the preceding command pattern only;
- `src/state/domainSession/**`, including every action and subscriber test;
- production composition, legacy interaction, persistence, scene, audio, UI, and
  deterministic browser tests as inspection-only callers.

## Owned scope

- `src/state/domainSession/**` only as required for atomic non-empty event-batch
  publication and its focused tests;
- new pure/application command files and tests under
  `src/runtime/commands/interpretationCommit/**`;
- this task's status and implementation notes.

All event schemas, event constructors, IDs, model, reducer, replay decoder,
interaction draft, attention command, resonance, session-start coordination,
legacy state, production composition, persistence, input, React, scene, camera,
audio, UI, content, browser behavior, dependencies, and deployment are
inspection-only. No other active task may modify the domain-session publication
boundary or introduce a competing interpretation-commit command while M2-004 is
active.

## Required adapter contract

Extend `DomainSessionAdapterState` with an action equivalent to:

```ts
appendEvents(events: readonly SessionEventV1[]): void;
```

Required semantics:

1. Reject an empty or malformed batch without publishing.
2. Append events in supplied order without sorting, coercion, repair, or cloning
   into a second rule representation.
3. Decode and replay the complete candidate log before calling the Zustand
   setter.
4. Publish the rebuilt frozen event log and matching reduced session together in
   exactly one adapter update/notification.
5. If any event fails decoding or replay, preserve the exact prior adapter state
   and action references with zero notifications.
6. Do not mutate the event array, events, existing log, or prior reduced state.
7. Preserve `appendEvent`; it may delegate to the batch action but must retain
   its public behavior and atomic single-event publication.

## Required command contract

Provide an application boundary equivalent to:

```ts
interface CommitInterpretationInput {
  readonly draft: CandidateSelectedInterpretationDraft;
  readonly threadId: ThreadId;
  readonly gesture: GestureProfile;
}

commitInterpretation(input: CommitInterpretationInput): CommitInterpretationResult;
```

The created command receives an injected `DomainSessionStore` and monotonic
`now()` dependency, following the existing Attend command pattern. Add a typed
error with stable closed codes for at least no active canonical session and a
draft that is not candidate-selected. Event construction/replay failures may
propagate through their accepted typed/native boundaries without translation.

Required semantics:

1. Require an active canonical event log and reduced session before reading the
   clock or publishing.
2. Require a runtime-valid `candidate-selected` draft; do not accept inactive,
   attending, armed, weaving, legacy interaction, or presentation state.
3. Read `now()` exactly once and construct all three events at that same
   game-relative time with consecutive sequences from
   `session.lastSequence + 1` through `+ 3`.
4. Preserve the draft's ordered pair and intention exactly in all applicable
   payloads; use only the supplied `threadId` and gesture for the committed event.
5. Construct all events before publication and call `appendEvents` exactly once.
   Never loop over `appendEvent`.
6. Return one frozen result containing the exact frozen three-event tuple and the
   published event-log/session references.
7. A successful result has one new committed thread and canonical
   `selectedPair === null` / `hypothesis === null` after the reducer processes the
   batch.
8. Any invalid time, identity, pair, intention, gesture, sequence, duplicate
   thread, or replay transition leaves the adapter at its exact prior reference
   with zero notification and does not mutate input.
9. The command does not clear or mutate the ephemeral draft; a later production
   coordinator owns post-success draft reset.

## Out of scope

- event-schema, identifier, model, reducer, replay-format, or decoder changes;
- adding reset/cancel/compensation events or publishing provisional events;
- changing M2-003 transitions, re-arming, weave-stage state, or gesture capture;
- generating thread IDs, reading wall-clock time, or normalizing input gestures;
- candidate resonance, correctness, content evidence, documented/Open outcomes,
  motifs, Attunement, or conclusion;
- production integration with legacy store, pointer/touch/keyboard/controller,
  React, scene, camera, audio, UI, accessibility surface, or persistence;
- dependencies, browser behavior, performance budgets, or deployment.

## Constraints

- TypeScript strict mode; explicit public types; no `any`.
- Synchronous, deterministic, deeply immutable outputs and fail-closed behavior.
- Reuse existing event constructors, reducer/replay validation, adapter, branded
  IDs, draft type, and gesture contract; do not duplicate their rules.
- One clock read, one validated batch append, and one reactive publication on
  success; zero publication on failure.
- Do not catch and replace accepted event/replay failures unless required to add
  command context without losing the original cause/code.
- If implementation requires changing event payloads, reducer transitions,
  persistence, gesture meaning, or production behavior, stop and record a
  specification proposal instead.

## Acceptance criteria

- The canonical adapter supports validated non-empty ordered batch append with
  one notification and no partial publication.
- The interpretation-commit command emits exactly pair → hypothesis → thread at
  one time and consecutive deterministic identities/sequences.
- Successful publication returns the exact rebuilt canonical references, adds
  one thread, and leaves no provisional canonical pair/hypothesis.
- Missing session, wrong draft stage, malformed input, construction failure, and
  replay failure preserve exact prior state and publish nothing.
- Tests prove input non-mutation, deep freezing, byte determinism, ordering,
  single clock read, single batch call, and absence of production side effects.
- No event/model/reducer/replay/draft/legacy game/persistence/input/presentation/
  content/browser/dependency/deployment contract changes or production caller.

## Required checks

1. `npm ci`;
2. `npm run typecheck`;
3. `npm run lint`;
4. `npm test`;
5. `npm run validate:content`;
6. `npm run build`;
7. `npm run bundle:check`;
8. `npm run test:browser`;
9. `git diff --check`;
10. focused adapter scan proving one setter/notification after complete batch
    decode/replay and no partial loop publication;
11. focused command scan proving exactly one clock read, three ordered event
    constructions, and one `appendEvents` call with no `appendEvent` loop;
12. focused schema/ownership scan proving no domain event, model, reducer, replay,
    draft, gesture, content, or presentation rule was duplicated or changed;
13. focused caller scan proving no production module imports or instantiates the
    new command;
14. focused diff scan proving every changed production/test file stays within
    the declared adapter and command boundaries.

The targeted performance reference is not required because the command remains
unintegrated and changes no active render/input/audio path. If a required check
cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- adapter batch-publication contract and compatibility behavior;
- command input/result/error contracts and exact ordered event mapping;
- successful atomic publication and complete failure-matrix tests;
- full check and focused-scan results;
- confirmation that no production, persistence, input, camera, audiovisual,
  content, browser, dependency, or deployment path changed;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this task establishes the durable
atomic interpretation boundary and changes the canonical reactive adapter API.
Automated tests can prove ordering and publication atomicity but cannot authorize
later gesture feel, input equivalence, presentation, or artistic acceptance.

## Implementation notes

- Selected on 2026-07-14 after PR #37 was reviewed and merged, its exact
  `main` merge commit `2d4d6ea` passed CI run `29335050180`, no PR remained
  open, and no active task owned the domain-session publication boundary.
- Implementation plan: add one shared validated adapter batch-publication path
  while preserving `appendEvent`; add the typed commit command over an accepted
  candidate draft, stable thread identity, and gesture; prove exact event order,
  one clock read/update/notification, immutability, determinism, and atomic
  failures; then run the complete required suite and focused ownership scans.
- Added `appendEvents` to the canonical domain-session adapter. It rejects empty
  or non-array input, rebuilds and replays the complete candidate log before one
  Zustand setter call, publishes the matching frozen log/session together, and
  leaves exact prior references untouched on any decode or replay failure.
  Existing `appendEvent` now uses the same internal validation/publication path.
- Added the typed `createInterpretationCommitCommand` boundary and closed
  `no-active-session` / `draft-not-ready` errors. A successful command reads its
  injected clock once, constructs the existing pair, hypothesis, and thread
  events at one time with three consecutive sequences, freezes the tuple,
  invokes `appendEvents` once, and returns the exact published log/session
  references without mutating or clearing the draft.
- Expanded adapter coverage from 6 to 9 tests and added 15 focused command tests.
  They cover ordered payloads/identities, one notification and batch call, zero
  `appendEvent` calls, stable action references, replay equivalence, input
  non-mutation, deep freezing, byte determinism, missing session, every wrong
  draft stage, malformed batch content, invalid time/gesture/intention/thread
  identity, unknown concepts, and a duplicate-thread rejection at the third
  transition with no intermediate publication.
- Required validation passed: clean lockfile installation with zero
  vulnerabilities; typecheck; lint; 17 unit-test files with 194 tests; 3 content
  validation tests; production build; bundle ceilings at 2,422,605 raw bytes /
  1,270,785 gzip bytes total and 1,581,963 raw / 465,848 gzip JavaScript bytes;
  3 deterministic browser tests; and `git diff --check`. The adapter addition is
  +187 raw / +74 gzip bytes total versus the prior baseline. The existing
  `three-mesh-bvh@0.7.8` deprecation and established large-chunk notices remain
  unchanged.
- Focused scans found one `now()` call, exactly three event constructions, one
  `appendEvents` call, no `appendEvent` loop, and one adapter setter only after
  complete batch decode/replay. No production module imports or instantiates the
  command, and no event schema, ID, model, reducer, replay, draft, gesture,
  content, legacy game, persistence, input, scene, camera, audio, UI, browser,
  dependency, or deployment file changed.
- The targeted performance reference was not required because the command is
  unintegrated and no active render/input/audio behavior changed. Human review
  remains required for the durable batch boundary and adapter API; no
  compatibility proposal or specification conflict was discovered.
