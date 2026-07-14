# M2-007 — Coordinate interpretive attention

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M2-001, M2-002, M2-003, and M2-006 must be Done.
- Director decisions I-001, I-002, I-004, I-010, I-011, and I-012 must be
  accepted through reviewed merge.

## Objective

Create one injectable application-runtime coordinator for explicit interpretive
Attend. One successful call must use the active canonical session as its sole
concept-membership source, prepare the accepted ephemeral attending draft,
evaluate complete non-spoiling candidate resonance, record exactly one accepted
`bead.attended` event, publish the new reactive draft, and return one immutable
result containing the exact published values.

This task composes accepted boundaries; it does not invent another interaction
state machine or migrate a production input. The current shipped pointer,
touch, keyboard, scene, audio, camera, UI, and legacy weaving behavior remain
unchanged.

## Why this is next

M2-001 through M2-006 now provide isolated canonical Attend, resonance, draft,
commit, gesture, and reactive-state seams. A future world control and its
accessible DOM equivalent must not separately decide which session concepts
are valid, when provisional state is replaced, or how candidate bands are
calculated. The smallest safe next step is therefore one headless coordinator
that proves these three accepted owners can act as one explicit Attend without
yet choosing browser event mapping or audiovisual presentation.

## Implementation plan

1. Characterize M2-001 preparation/publication, M2-002 complete-candidate
   evaluation, M2-003 re-Attend semantics, M2-006 notifications, and canonical
   session membership/reference behavior.
2. Add one injectable coordinator factory and an injected candidate-evidence
   resolver under a new runtime interpretation boundary.
3. Preflight every fallible operation before the first publication, then
   complete the accepted draft and canonical Attend publications synchronously
   without a compensating event or copied rule.
4. Return exact immutable event-log, reduced-session, attending-draft, and
   candidate-resonance references; preserve all prior references and subscriber
   counts on accepted failures.
5. Add focused tests for success ordering, re-Attend replacement, complete
   candidate coverage, failure atomicity, immutability, non-mutation,
   determinism, dependency call counts, and absence of production callers.

## Required reading

- `AGENTS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M2-001-attention-command-boundary.md`
- `docs/tasks/M2-002-candidate-resonance-model.md`
- `docs/tasks/M2-003-ephemeral-interpretation-draft.md`
- `docs/tasks/M2-006-reactive-interpretation-draft-adapter.md`
- `docs/ARCHITECTURE.md`, especially commands, state ownership, and clocks
- `docs/VERTICAL-SLICE-SPEC.md`, especially attention, resonance, cancellation,
  interface, and accessibility
- `docs/INTERACTION-DECISIONS.md`, especially I-001, I-002, I-004, I-010,
  I-011, and I-012
- `docs/PLAYTEST-PLAN.md`, especially the partial M2 and device gates

## Existing code and callers to inspect

- `src/runtime/commands/attention/**`
- `src/domain/relations/resonance/**`
- `src/runtime/interactionDraft/**`
- `src/state/interactionDraft/**`
- `src/state/domainSession/**`
- `src/runtime/session/**`
- `src/runtime/testMode.ts`
- `src/state/store.ts`
- `src/state/types.ts`
- `src/scene/threading.ts`
- `src/scene/ThreadingDriver.tsx`
- every current import or caller of the M2-001, M2-002, M2-003, and M2-006
  public surfaces

M2-001 owns canonical event construction/publication, M2-002 owns resonance
validation and band calculation, M2-003 owns draft transitions, M2-006 owns
draft reactivity, and the domain adapter owns canonical replay. The coordinator
owns only sequencing and exact dependency/result mapping.

## Owned scope

The task may modify only:

- new production and test files under `src/runtime/interpretation/**`;
- the minimum M2-001 attention-command files and focused tests required to
  expose a preparation step while preserving the existing command API;
- this task file for status and implementation notes.

All domain event payloads, IDs, reduced state, replay rules, resonance rules,
draft rules, adapter implementations, gesture and commit boundaries, session
start, legacy store/types, content, persistence, React, scene, camera, audio,
UI, input listeners, browser test adapter, dependencies, CI, and deployment are
inspection-only. If coordination requires changing one of those boundaries,
stop and record a specification proposal rather than expanding scope.

## Required coordinator contract

Provide an API equivalent to:

```ts
interface CandidateEvidenceResolutionRequest {
  readonly attendedConceptId: ConceptId;
  readonly session: SessionStateV1;
}

type ResolveCandidateEvidence = (
  request: CandidateEvidenceResolutionRequest
) => readonly CandidateResonanceEvidence[];

interface InterpretationAttentionCoordinatorDependencies {
  readonly domainStore: DomainSessionStore;
  readonly draftStore: InterpretationDraftStore;
  readonly now: () => number;
  readonly resolveCandidateEvidence: ResolveCandidateEvidence;
}

interface InterpretiveAttendResult {
  readonly event: BeadAttendedEventV1;
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
  readonly draft: AttendingInterpretationDraft;
  readonly candidateResonance: readonly CandidateResonance[];
}

type AttendInterpretively = (
  conceptId: ConceptId
) => InterpretiveAttendResult;

createInterpretationAttentionCoordinator(
  dependencies: InterpretationAttentionCoordinatorDependencies
): AttendInterpretively;
```

Names may vary only when the boundary remains equally explicit. The factory may
compose a prepared form of M2-001 internally, but the existing exported
`createAttendConceptCommand` callable contract and behavior must remain
compatible. Export the new factory and public types through a local index. Do
not add a production singleton or caller.

The evidence resolver is an injected read-only boundary. It receives the exact
active immutable canonical session and attended concept, returns evidence only,
and cannot publish, retain, or fabricate a result. This task does not implement
a content, topology, or placeholder evidence policy.

## Required operation semantics

### Preparation

- Read the canonical adapter at the start of the call and require one matching
  event log and reduced active session through the accepted Attend boundary.
- Derive session concept membership and order only from
  `SessionStateV1.conceptIds`; no caller-supplied or legacy bead list may enter
  coordination.
- Capture the injected clock exactly once and create exactly one accepted
  `bead.attended` event with the current session ID and next sequence.
- Validate the complete candidate event/replay result without publishing it.
  The existing M2-001 one-shot command must use the same preparation and retain
  its current event, error, clock, and notification semantics.
- Prepare the new attending draft through `attendDraft`, then resolve evidence
  once and call `evaluateCandidateResonance` once with complete canonical
  session coverage.
- Finish all expected validation, event construction, replay, draft, evidence,
  and resonance work before either store publishes.

### Successful publication

- A successful call replaces any inactive, attending, armed, or
  candidate-selected draft with the accepted new attending draft and records
  exactly one matching canonical `bead.attended` event. It never records pair,
  hypothesis, reset, cancel, or commit events.
- Preserve I-004 semantically: the prior provisional intention/candidate is
  discarded as part of preparing the new Attend and never appears in the new
  canonical event. No committed thread or earlier event is removed or rewritten.
- Publish only through the accepted draft and domain adapter actions. Do not
  expose or use raw Zustand `setState`.
- After preparation succeeds, publish the new attending draft first and the
  prepared canonical Attend second, with one notification from each store in
  that order. The second step publishes only the already validated immutable
  event: it performs no new clock, evidence, resonance, or event-construction
  work. The domain adapter may defensively replay-validate that prepared event
  through its existing append action. This makes I-004's provisional
  replacement order explicit without introducing a durable cancel/reset event.
- Complete both synchronous publications before returning. No React, scene,
  audio, UI, or input subscriber is introduced by this task.
- Return the exact event, event log, reduced session, attending draft, and
  resonance array produced or exposed by the accepted owners. Freeze the result
  wrapper and do not clone, sort, or relabel candidate results.
- Candidate result order remains the canonical session order excluding the
  attended concept, and every other session concept appears exactly once.

### Failures and atomicity

- No active canonical session propagates the accepted M2-001
  `no-active-session` error before the clock, evidence resolver, resonance
  evaluator, or draft publication.
- Unknown concepts, invalid/concluded session transitions, invalid time,
  incomplete/invalid evidence, and draft/resonance errors propagate their
  original typed error and code unchanged.
- Every expected failure occurs before publication and preserves the exact
  prior domain state, event log, reduced session, draft state, action
  references, and subscriber counts.
- Do not catch and translate accepted typed errors, compensate with a durable
  event, silently clear state, repair evidence, or fall back to a generic band.
- If the accepted boundaries cannot make all expected failure paths
  publication-free while honoring re-Attend semantics, stop and record the
  discovered conflict; do not add rollback or generic mutation APIs.

### Determinism and isolation

- Equal canonical logs, drafts, evidence, concept IDs, and clocks produce
  byte-identical event/draft/resonance/result data in fresh stores.
- The coordinator does not mutate or retain concept IDs, evidence arrays,
  canonical state, prior drafts, or candidate results.
- Importing or creating the coordinator performs no clock, event, store,
  resolver, browser, timer, random, network, persistence, legacy, or
  presentation side effect.

## Ownership rules

1. The coordinator owns sequencing only; it contains no copied session,
   resonance-band, draft-stage, event-validation, reducer, or replay rule.
2. M2-001 remains the sole canonical Attend command. Any preparation extraction
   is shared by, not parallel to, the existing one-shot command.
3. M2-002 remains the sole resonance evaluator; the resolver supplies evidence
   but cannot calculate or label bands.
4. M2-003/M2-006 remain the sole draft rule/reactivity owners; the coordinator
   exposes no generic draft setter or second reactive draft value.
5. Candidate resonance and the draft remain ephemeral and unpersisted. Only
   `bead.attended` is durable in this task.
6. No production composition occurs until a separately reviewed input/cutover
   task supplies one evidence policy and routes one interaction path end to end.

## Out of scope

- production singleton composition or any active caller;
- candidate evidence derivation from content, facets, topology, documented
  connections, camera/frustum position, or legacy discoveries;
- focus, inspection, hover, dwell, background activation, pointer/touch/pen,
  keyboard, controller, or gesture sample capture;
- arming presentation, candidate activation, weaving, commit/reset
  coordination, outcome, motifs, or conclusion;
- camera posture/sweeps, bead emphasis, thread preview, audio, haptics, labels,
  microcopy, DOM controls, captions, reduced-motion behavior, or onboarding;
- changing event schemas, reducer/replay semantics, resonance thresholds, draft
  stages/cancellation, persistence, content, dependencies, CI, or deployment;
- modifying or removing the shipped legacy interaction path.

## Constraints

- TypeScript strict mode; explicit public types; no `any`.
- Add no production dependency and no mutable module singleton.
- Synchronous deterministic coordination; no browser global, timer,
  randomness, React, Three.js, Web Audio, persistence, or legacy store import.
- Capture the clock, active canonical references, and evidence exactly once per
  successful attempt; use no implicit fallback source.
- Do not weaken validation to make coordination pass and do not invent
  significance when evidence is missing.

## Acceptance criteria

1. One exported injectable factory composes the accepted Attend, resonance, and
   reactive draft owners without a production caller or duplicate state.
2. Success derives membership from the active canonical session, records one
   exact `bead.attended` event, publishes one exact attending draft, and returns
   complete ordered resonance once.
3. Re-Attend from every draft stage discards only provisional state and leaves
   committed/canonical history intact except for the one new Attend event.
4. The clock, resolver, evaluator, draft publication, and canonical Attend
   publication occur exactly once in the required order with expected
   subscriber counts.
5. Every accepted command, draft, evidence, resonance, reducer, replay, and time
   failure preserves both stores and all references with zero notification.
6. The existing M2-001 one-shot command remains compatible and uses the same
   preparation rather than a second event-construction path.
7. Results and prior values are immutable, inputs are not mutated or retained,
   and equal fresh-store runs are byte-identical.
8. No generic mutation, compensating event, fallback band, legacy projection,
   persistence, production input, or presentation behavior is introduced.
9. No current production module imports or instantiates the coordinator.
10. No production dependency is added.

## Required tests and checks

- Clean dependency installation from the lockfile.
- Typecheck.
- Lint.
- Full unit suite plus focused tests for:
  - factory isolation and import/creation side-effect absence;
  - inactive -> attending success with exact event, log, state, draft, and
    complete ordered candidate resonance;
  - re-Attend from attending, armed, and candidate-selected;
  - exact dependency calls and domain/draft notification order/counts;
  - no active session before clock/resolver/draft work;
  - unknown concept, concluded session, clock/time regression, resolver throw,
    incomplete/invalid evidence, and every relevant draft/resonance rejection;
  - unchanged references and zero notifications on every expected failure;
  - input/prior-value non-mutation, deep freezing, repeat determinism, and byte
    identity;
  - unchanged M2-001 one-shot command behavior and shared preparation.
- Content validation.
- Production build.
- Bundle report and accepted ceiling check.
- Deterministic browser smoke tests.
- Targeted performance reference only if implementation affects an active
  runtime path; otherwise report why it was not required.
- `git diff --check`.
- Focused dependency scan proving the coordinator imports only the accepted
  domain, command, draft, adapter, and resonance boundaries.
- Focused caller scan proving no production module imports or instantiates it.
- Focused ownership scan proving no event, reducer, replay, resonance-band, or
  draft-stage rule was copied and no generic store mutation was exposed.
- Focused diff scan proving no production input, legacy state, scene, audio, UI,
  persistence, content, dependency, browser-test, or deployment file changed.

## Expected completion report

- exact coordinator/preparation API and changed files;
- successful call, dependency, publication, and notification ordering;
- complete failure-atomicity evidence;
- tests added with final counts and every required check result;
- performance-reference disposition and focused scan results;
- confirmation that no production interaction, presentation, persistence, or
  durable schema changed;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this packet establishes the
sequencing seam later shared by spatial and accessible controls and clarifies
the relationship between ephemeral replacement and canonical Attend. Automated
tests can prove deterministic orchestration and expected failure atomicity but
cannot authorize the later input cutover, evidence policy, audiovisual response,
camera comfort, or device equivalence.

## Implementation notes

- Selected on 2026-07-14 after PR #43 was reviewed and merged, its exact
  `main` merge commit `d814d50` passed Quality Gates run `29365817388`, no PR
  remained open, and no active task owned `src/runtime/interpretation/**` or the
  M2-001 attention-command seam.
- Implementation plan: extract one shared, validated Attend preparation and
  publication pair while preserving the existing one-shot command; add one
  injectable interpretation-attention coordinator that preflights canonical
  Attend, draft replacement, evidence, and resonance before publishing draft
  then domain state; prove exact references, ordering, re-Attend behavior,
  failure atomicity, immutability, determinism, and absent production callers;
  then run the complete repository and focused boundary checks.
- Implemented one shared `createAttendConceptPreparation` seam under M2-001.
  It captures and validates the canonical event once without publishing, and
  the existing `createAttendConceptCommand` now composes that same preparation
  and publication path without changing its public callable contract.
- Added the exported injectable interpretation-attention coordinator. It reads
  canonical membership, prepares Attend, preflights draft replacement, resolves
  and evaluates complete evidence once, publishes the accepted draft first and
  the prepared canonical Attend second, then returns a frozen wrapper around
  the exact published event, log, session, draft, and resonance references.
- Added one shared-preparation compatibility test and 16 coordinator tests.
  The focused run passes 25 tests; the complete suite passes 20 files and 264
  tests. Covered success/reference identity, publication and notification
  order, every draft-stage re-Attend, no-session/unknown/concluded/time errors,
  evidence and resonance rejections, resolver failure, atomicity, input
  non-mutation/non-retention, deep freezing, and byte-identical fresh runs.
- Required checks passed: clean `npm ci` (330 packages, zero vulnerabilities;
  existing `three-mesh-bvh@0.7.8` deprecation only), typecheck, lint, unit tests,
  content validation, production build, bundle report and ceiling check, three
  deterministic Playwright smoke tests, and `git diff --check`. Final bundle
  figures remained 2,422,605 raw / 1,270,785 gzip bytes total, 1,581,963 raw /
  465,848 gzip JavaScript bytes, and 683,665 bytes for the largest asset.
- Focused scans found only accepted domain, command, draft, adapter, and
  resonance imports; no production caller; no copied event/reducer/replay,
  resonance-band, draft-stage, or generic store-mutation rule; and no changed
  production input, legacy, scene, audio, UI, persistence, content, dependency,
  browser-test, or deployment file. A targeted performance reference was not
  required because this task adds no active runtime path or production caller.
- No production interaction, presentation, persistence, durable schema, or
  dependency changed. No compatibility proposal was required. Human review is
  still required for this new sequencing seam before merge.
- Ready packet proposed on 2026-07-14 after PR #42 was reviewed and merged. Its
  exact `main` merge commit `c7000d3` passed Quality Gates run `29364475654` and
  Pages deployment run `29364591720`; no PR remained open and no active task
  owned `src/runtime/interpretation/**` or the M2-001 attention-command seam.
- Packet plan: compose only accepted Attend, resonance, draft, and adapter
  owners; extract shared Attend preparation only if required for prepublication
  validation; leave evidence policy, production composition/input,
  presentation, commit/reset, persistence, and all human comfort gates to
  separate reviewed tasks.
