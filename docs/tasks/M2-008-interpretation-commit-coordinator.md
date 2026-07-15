# M2-008 — Coordinate expressive interpretation commit

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M2-004, M2-005, M2-006, and M2-007 must be Done.
- Director decisions I-004, I-008, I-009, and I-010 must be accepted through
  reviewed merge.

## Objective

Create one injectable application-runtime coordinator that commits the current
accepted `candidate-selected` interpretation draft. One successful call must
build exactly one accepted gesture profile from normalized samples, publish the
existing atomic `pair.selected → relation.hypothesized → thread.committed`
batch through the canonical command, reset the reactive ephemeral draft only
after that canonical publication succeeds, and return one immutable result
containing the exact committed and published values.

This task composes accepted owners. It does not capture browser input, generate
thread identities, invent a weave-stage state machine, resolve intellectual
outcomes, or migrate a production caller. The shipped pointer, touch, keyboard,
scene, camera, audio, UI, persistence, and legacy weaving behavior remain
unchanged.

## Why this is next

M2-004 deliberately leaves post-success draft reset to a later production
coordinator. M2-005 now owns deterministic pointer and hold-only gesture
profiles, M2-006 owns the sole reactive interpretation draft, and M2-007 proves
that canonical and ephemeral publication can be sequenced without moving rules
into controls. Future spatial and accessible controls must not independently
build gestures, choose which draft to commit, or clear provisional state before
canonical success. The smallest safe next step is therefore one headless
commit/reset coordinator before any browser-input cutover.

## Implementation plan

1. Reconfirm the M2-004 command contract, M2-005 gesture inputs, M2-006 reset
   semantics, canonical adapter notification behavior, and every current caller.
2. Add one injectable commit coordinator beside the accepted interpretation
   attention coordinator, exporting its public types through the local index.
3. Capture the current draft, build one gesture, invoke the existing atomic
   commit once, and reset the reactive draft only after canonical success.
4. Return exact immutable references and prove domain-then-draft publication,
   complete failure atomicity, non-mutation, and deterministic fresh-store runs.
5. Run the full repository suite and focused scans proving no copied rule,
   production caller, input/presentation change, or second state owner.

## Required reading

- `AGENTS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M2-004-atomic-interpretation-commit.md`
- `docs/tasks/M2-005-deterministic-gesture-profile.md`
- `docs/tasks/M2-006-reactive-interpretation-draft-adapter.md`
- `docs/tasks/M2-007-interpretive-attention-coordinator.md`
- `docs/MASTER-PLAN.md`, especially the core loop and product laws
- `docs/ARCHITECTURE.md`, especially commands, state ownership, clocks, and
  input adapters
- `docs/CURRENT-STATE-AUDIT.md`, especially state ownership, legacy input, and
  incremental-migration invariants
- `docs/ROADMAP.md`, especially the M2 gate and unsafe parallelism
- `docs/VERTICAL-SLICE-SPEC.md`, especially relation declaration, expressive
  weaving, interface, and accessibility
- `docs/INTERACTION-DECISIONS.md`, especially I-004 and I-008 through I-010
- `docs/PLAYTEST-PLAN.md`, especially the M2 and personal-device gates
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, to preserve the boundary between
  gesture/commit sequencing and later evidence or presentation meaning

## Existing code and callers to inspect

- `src/runtime/commands/interpretationCommit/**`
- `src/runtime/gestureProfile/**`
- `src/runtime/interactionDraft/**`
- `src/runtime/interpretation/**`
- `src/state/interactionDraft/**`
- `src/state/domainSession/**`
- `src/domain/events/**`, `src/domain/model/**`, `src/domain/reducer/**`, and
  `src/domain/replay/**` as accepted validation owners
- `src/runtime/testMode.ts`
- `src/state/store.ts` and `src/state/types.ts`
- `src/scene/threading.ts` and `src/scene/ThreadingDriver.tsx`
- every current import or caller of the M2-004, M2-005, M2-006, and M2-007
  public surfaces

M2-004 owns construction and atomic publication of the durable batch, M2-005
owns gesture-profile validation and calculation, M2-006 owns reactive draft
reset, and the domain adapter owns canonical replay. The coordinator owns only
dependency sequencing and exact input/result mapping.

## Owned scope

The task may modify only:

- new production and test files under `src/runtime/interpretation/**`;
- the local `src/runtime/interpretation/index.ts` export surface;
- this task file for status and implementation notes.

All domain events, IDs, gesture and draft rules, command and adapter
implementations, session start, attention/resonance coordination, legacy
store/types, production composition, persistence, input, React, scene, camera,
audio, UI, content, browser test adapter, dependencies, CI, and deployment are
inspection-only. If coordination requires changing one of those boundaries,
stop and record a specification proposal rather than expanding scope.

## Required coordinator contract

Provide an API equivalent to:

```ts
interface CommitInterpretivelyInput {
  readonly threadId: ThreadId;
  readonly gesture: BuildGestureProfileInput;
}

interface InterpretiveCommitResult {
  readonly committedDraft: CandidateSelectedInterpretationDraft;
  readonly gesture: GestureProfile;
  readonly events: InterpretationCommitEventsV1;
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
  readonly draft: InactiveInterpretationDraft;
}

interface InterpretationCommitCoordinatorDependencies {
  readonly domainStore: DomainSessionStore;
  readonly draftStore: InterpretationDraftStore;
  readonly now: () => number;
}

type CommitInterpretively = (
  input: CommitInterpretivelyInput
) => InterpretiveCommitResult;

createInterpretationCommitCoordinator(
  dependencies: InterpretationCommitCoordinatorDependencies
): CommitInterpretively;
```

Names may vary only when the boundary remains equally explicit. The coordinator
must compose `buildGestureProfile`, `createInterpretationCommitCommand`, and the
accepted draft-store `reset` action. It must not reproduce their validation or
state transitions. Export the factory and public types through the existing
runtime interpretation index. Do not add a production singleton or caller.

The future input adapter supplies an already stable `ThreadId` and normalized
gesture input. Thread-ID generation, browser coordinates, pointer capture,
keyboard timing, and device-event normalization do not belong here.

## Required operation semantics

### Preparation

- Creating the coordinator may create the accepted M2-004 command closure but
  performs no clock, store, browser, timer, random, network, persistence, or
  presentation work.
- At call start, capture the exact current reactive draft once. Do not accept a
  caller-supplied draft or consult the legacy interaction state.
- Build the gesture profile exactly once from the exact supplied normalized
  input. Do not add defaults, fabricate pointer geometry, infer modality, or
  retain the input or samples.
- Invoke the accepted commit command exactly once with the captured draft,
  supplied `threadId`, and exact built gesture. The command remains the only
  owner of active-session checks, candidate-draft validation, clock capture,
  event construction, replay validation, and canonical batch publication.

### Successful publication

- The accepted command publishes exactly the existing ordered pair,
  hypothesis, and thread events in one canonical adapter update. No Attend,
  cancel, reset, outcome, motif, reveal, or presentation event is added.
- Only after that command returns successfully, invoke the accepted draft-store
  `reset` action exactly once. Publish no intermediate draft stage.
- One domain notification precedes one draft notification. The canonical
  subscriber sees the complete committed batch while the candidate draft is
  still available; the next draft subscriber sees the accepted inactive draft.
- Complete both synchronous publications before returning. Do not introduce a
  React, scene, audio, UI, or input subscriber.
- Return the exact pre-commit candidate draft, exact built gesture, exact event
  tuple, exact published event-log/session references, and exact published
  inactive draft. Freeze the result wrapper and do not clone, reorder, relabel,
  or retain any value.
- The committed canonical thread preserves the draft's ordered pair and
  intention, the supplied stable thread ID, and the gesture builder's exact
  profile. Earlier events and threads remain unchanged.

### Failures and atomicity

- Gesture input failures propagate the accepted `GestureProfileBuildError` and
  code unchanged before any canonical or draft publication or clock read.
- Missing canonical session, non-candidate draft, invalid time or thread ID,
  malformed pair/intention/gesture, duplicate thread, and replay failures
  propagate their accepted typed/native error unchanged.
- Every expected failure preserves the exact prior domain state, event log,
  reduced session, draft state, action references, and subscriber counts. The
  draft reset action is never called when gesture building or canonical commit
  fails.
- Do not catch and translate accepted errors, compensate with a durable event,
  clear provisional state on failure, retry with a generic gesture, or repair
  identities or event data.
- The accepted reset action is a total post-success ephemeral transition. If
  implementation discovers a reachable accepted reset failure after canonical
  publication, stop and record the conflict; do not add rollback, raw mutation,
  or a compensating event.

### Determinism and isolation

- Equal canonical logs, candidate drafts, thread IDs, gesture inputs, and clocks
  produce byte-identical gesture/event/session/result data in fresh stores.
- The coordinator does not mutate or retain normalized samples, gesture input,
  prior draft, canonical state, events, or published results.
- No production module imports or instantiates the coordinator in this task.
- Gesture and draft remain ephemeral until the accepted commit command makes
  only the existing event batch durable; no gesture buffer or draft is persisted
  independently.

## Ownership rules

1. The coordinator owns sequencing only; it contains no copied gesture,
   draft-stage, event, reducer, replay, or adapter rule.
2. M2-004 remains the sole canonical interpretation-commit command and batch
   publication path.
3. M2-005 remains the sole gesture-profile builder. The coordinator neither
   normalizes browser input nor supplies unavailable fields.
4. M2-006 remains the sole reactive draft owner. Reset occurs through its
   accepted action; no generic setter or second reactive draft value is exposed.
5. M2-007 remains the sole interpretive-Attend coordinator and is not expanded
   into commit, evidence, or presentation ownership.
6. Production composition waits for a separate reviewed cutover task that also
   defines placeholder evidence, input arbitration, and presentation ownership.

## Out of scope

- production singleton composition or any active caller;
- arm-intention, candidate-selection, Attend, resonance, or cancellation APIs;
- browser pointer/touch/pen, keyboard, controller, timing, coordinate, pressure,
  pointer-capture, focus, or gesture-sample capture;
- thread-ID generation, collision policy, persistence, resume, import, or
  migration;
- candidate evidence, documented/Open/weak outcome resolution, content claims,
  sources, motifs, scoring, progression, Attunement, or conclusion;
- weave preview/tracing, camera motion, bead/thread materials, audio, haptics,
  labels, microcopy, DOM controls, captions, reduced-motion behavior, or
  onboarding;
- changing event schemas, reducer/replay semantics, gesture calculations,
  draft transitions, command behavior, adapters, dependencies, CI, or
  deployment;
- modifying or removing the shipped legacy interaction path.

## Constraints

- TypeScript strict mode; explicit public types; no `any`.
- Add no production dependency and no mutable module singleton.
- Synchronous deterministic coordination; no browser global, timer, randomness,
  React, Three.js, Web Audio, persistence, or legacy-store import.
- Capture the draft and build the gesture once; invoke one accepted commit and
  one post-success reset with no implicit fallback source.
- Do not weaken validation or add rollback to make coordination pass.

## Acceptance criteria

1. One exported injectable factory composes the accepted gesture, commit, and
   reactive draft owners without a production caller or duplicate state.
2. Success uses the exact current candidate draft and supplied thread ID, builds
   one exact gesture, publishes the existing atomic three-event batch once, and
   resets the draft once only after canonical success.
3. Domain publication/notification precedes draft reset/notification, and the
   result returns exact immutable committed and published references.
4. Every gesture, draft, session, identity, time, event, reducer, and replay
   failure preserves both stores and all references with zero notification.
5. The draft is never reset on failure; no committed event or thread is removed,
   rewritten, or compensated.
6. Results and prior values are immutable, inputs are not mutated or retained,
   and equal fresh-store runs are byte-identical.
7. No browser capture, thread-ID policy, outcome/evidence rule, persistence,
   production input, legacy projection, or presentation behavior is introduced.
8. No current production module imports or instantiates the coordinator.
9. No production dependency is added.

## Required tests and checks

- Clean dependency installation from the lockfile.
- Typecheck.
- Lint.
- Full unit suite plus focused tests for:
  - import/factory isolation and creation side-effect absence;
  - candidate-selected success with exact captured draft, gesture, three events,
    canonical references, inactive draft, and domain-then-draft notifications;
  - pointer profiles with normalized samples and honest keyboard/controller
    hold-only profiles with absent geometry;
  - exact clock, commit, reset, publication, and notification call counts;
  - invalid modality/time/samples/coordinates/pressure and every relevant
    gesture-builder rejection before clock or publication;
  - no active session, every wrong draft stage, invalid thread/time/event data,
    unknown concepts, and duplicate-thread replay rejection;
  - unchanged references and zero notifications on every expected failure;
  - no reset on failure and no intermediate or compensating event;
  - input/prior-value non-mutation, deep freezing, repeat determinism, and byte
    identity.
- Content validation.
- Production build.
- Bundle report and accepted ceiling check.
- Deterministic browser smoke tests.
- Targeted performance reference only if implementation affects an active
  runtime path; otherwise report why it was not required.
- `git diff --check`.
- Focused dependency scan proving the coordinator imports only the accepted
  domain types, commit command, gesture builder, and draft/domain adapters.
- Focused caller scan proving no production module imports or instantiates it.
- Focused ownership scan proving no gesture, event, reducer, replay,
  draft-stage, or adapter rule was copied and no generic store mutation exists.
- Focused diff scan proving no production input, legacy state, scene, audio, UI,
  persistence, content, dependency, browser-test, or deployment file changed.

## Expected completion report

- exact coordinator API and changed files;
- gesture-build, canonical publication, draft-reset, and notification ordering;
- complete failure-atomicity and reset-safety evidence;
- tests added with final counts and every required check result;
- performance-reference disposition and focused scan results;
- confirmation that no production interaction, presentation, persistence,
  evidence/outcome policy, or durable schema changed;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this packet establishes the
post-gesture sequencing seam later shared by spatial and accessible controls.
Automated tests can prove deterministic orchestration, atomic canonical commit,
and post-success reset, but cannot authorize later browser-input cutover,
gesture feel, evidence policy, audiovisual response, device equivalence, or
artistic quality.

## Implementation notes

- Implemented one injectable `createInterpretationCommitCoordinator` that
  captures the accepted reactive draft, builds the accepted gesture profile,
  invokes the accepted atomic commit command, then performs exactly one
  post-success accepted reset. The frozen result returns the exact captured
  draft and exact published gesture, event tuple, event log, session, and
  inactive draft references; no production caller was added.
- Added 21 focused tests covering factory isolation, pointer and hold-only
  profiles, domain-then-draft notification order, exact publication/reset
  counts, every gesture-builder error code, missing session, every non-ready
  draft stage, invalid clock/thread identity, unknown concepts, duplicate
  threads, failure reference preservation, non-mutation, deep freezing, and
  byte-identical fresh-store runs. The full suite passes 21 files and 285 tests.
- Verification passed: clean `npm ci` (0 vulnerabilities), typecheck, lint,
  focused and full unit tests, content validation, production build, bundle
  report and accepted ceiling check, `git diff --check`, and all three
  deterministic browser smoke tests. The first browser attempt timed out while
  closing one context under concurrent gate load; the isolated rerun passed all
  scenarios in 1.4 minutes with no assertion failure.
- Focused dependency, caller, ownership, and changed-file scans confirm only
  accepted types, commands, builders, and adapters are imported; no production
  module instantiates the coordinator; no gesture, event, reducer, replay,
  stage-transition, or adapter rule was copied; and no input, legacy state,
  scene, audio, UI, persistence, content, dependency, CI, browser-test, or
  deployment file changed. A performance reference was not required because
  the headless coordinator has no active runtime path. No compatibility
  proposal or unresolved implementation conflict was discovered.
- Selected on 2026-07-15 after PR #45 was reviewed and merged. Its exact
  `main` merge commit `7273464` passed Quality Gates run `29405282284`; no PR
  remained open, every dependency was Done, and no active work owned
  `src/runtime/interpretation/**` or the commit/reset sequencing seam.
- Implementation plan: add one injectable headless coordinator that captures
  the current draft once, builds the accepted gesture profile once, invokes the
  accepted atomic commit command once, resets the accepted reactive draft only
  after success, and returns exact frozen references; prove ordering, failure
  atomicity, isolation, and determinism without adding a production caller.
- Ready packet proposed on 2026-07-15 after PR #44 was reviewed and merged. Its
  exact `main` merge commit `45c40cf` passed Quality Gates run `29370493332` and
  Pages deployment run `29370605521`; no PR remained open and no active task
  owned `src/runtime/interpretation/**` or the commit/reset sequencing seam.
- Packet plan: compose only the accepted gesture builder, atomic commit command,
  domain adapter, and reactive draft reset; leave browser capture, ID policy,
  evidence/outcomes, production composition, presentation, persistence, and all
  human device/comfort/artistic gates to separate reviewed tasks.
