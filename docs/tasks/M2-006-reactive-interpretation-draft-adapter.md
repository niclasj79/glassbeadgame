# M2-006 — Add the reactive interpretation-draft adapter

## Status

Done

## Milestone

M2 — New interaction loop

## Dependencies

- M2-003 must be Done.
- M2-005 must be Done.
- Director decisions I-004 through I-006 and I-010 must be accepted through
  reviewed merge.

## Objective

Expose the accepted immutable `InterpretationDraft` state machine through one
isolated vanilla Zustand adapter. The adapter gives future world controls and
accessible DOM controls one reactive source for provisional Attend, intention,
candidate, cancellation, and reset state while delegating every transition rule
to M2-003.

This task adds only the unintegrated reactive boundary. It does not record
canonical Attend, evaluate resonance, capture a gesture, commit a thread, listen
to input, or change presentation.

## Why this is next

M2-001 through M2-005 now establish the pure/durable command, resonance, draft,
atomic commit, and gesture-profile seams required by the redesigned loop. The
ephemeral draft is still usable only as direct pure function calls. Production
scene and accessibility surfaces must not each invent a competing provisional
state or duplicate its transition rules. A narrow reactive adapter is therefore
the smallest safe prerequisite for a later application coordinator and
end-to-end input migration.

## Implementation plan

1. Reconfirm the M2-003 draft stages, transition errors, cancellation hierarchy,
   immutability, and the established vanilla Zustand adapter conventions.
2. Add one factory under the owned state boundary whose stable actions delegate
   to the accepted pure draft functions.
3. Publish successful draft transitions once, preserve exact prior state on
   failure, and make inactive cancel/reset observable no-ops.
4. Add focused tests for isolation, the complete transition sequence,
   re-attention/re-arming, cancellation, reset, failure atomicity, action
   stability, immutability, non-mutation, and determinism.
5. Run all required checks and prove the adapter remains uninstantiated and
   unimported by production code.

## Required reading

- `AGENTS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M2-003-ephemeral-interpretation-draft.md`
- `docs/tasks/M1-004-zustand-domain-session-adapter.md`
- `docs/ARCHITECTURE.md`, especially layer ownership, commands, and Zustand
- `docs/VERTICAL-SLICE-SPEC.md`, especially attention, relation declaration,
  expressive weaving, interface, and accessibility
- `docs/INTERACTION-DECISIONS.md`, especially I-001 through I-012
- `docs/PLAYTEST-PLAN.md`, especially the M2 and device gates

## Existing code and callers to inspect

- `src/runtime/interactionDraft/**`
- `src/runtime/commands/attention/**`
- `src/runtime/commands/interpretationCommit/**`
- `src/runtime/gestureProfile/**`
- `src/state/domainSession/**`
- `src/state/store.ts`
- `src/state/types.ts`
- `src/scene/threading.ts`
- every current import or caller of the M2-003 draft functions

The M2-003 runtime module owns all draft stages and transition rules. The
canonical domain-session adapter owns durable event-log reactivity. The legacy
store and `threading.ts` own the currently shipped interaction only until later
migration tasks replace it. M2-006 must not combine or synchronize those
boundaries.

## Owned scope

The task may modify only:

- new files under `src/state/interactionDraft/**`;
- focused tests under that directory;
- this task file for status and implementation notes.

The pure draft, domain events/model/reducer/replay, commands, gesture builder,
canonical domain-session adapter, legacy store/types, persistence, production
input, React, scene, camera, audio, UI, content, dependencies, CI, and deployment
are inspection-only. No active task may introduce a competing reactive draft
owner while M2-006 is active.

## Required adapter contract

Provide a factory equivalent to:

```ts
interface InterpretationDraftAdapterState {
  readonly draft: InterpretationDraft;
  readonly attend: (
    conceptId: ConceptId,
    sessionConceptIds: readonly ConceptId[]
  ) => void;
  readonly armIntention: (intention: RelationIntention) => void;
  readonly selectCandidate: (
    conceptId: ConceptId,
    sessionConceptIds: readonly ConceptId[]
  ) => void;
  readonly cancel: () => void;
  readonly reset: () => void;
}

type InterpretationDraftStore = Pick<
  StoreApi<InterpretationDraftAdapterState>,
  "getState" | "getInitialState" | "subscribe"
>;

createInterpretationDraftStore(): InterpretationDraftStore;
```

Names may vary only when the public boundary remains equally narrow. Use
Zustand's already-installed vanilla API so tests and future non-React
application coordination can use the adapter, but expose only its read,
initial-state, and subscribe surface: the public store type must not expose
`setState` or `destroy`. Export the factory and public types through a local
index. Do not export a production singleton or React hook.

The adapter contains one meaningful value: the immutable ephemeral `draft`.
It does not cache session concepts, canonical attention, resonance, gesture
samples/profiles, event state, presentation state, or a second representation of
any durable thread.

## Required operation semantics

### Fresh store

- Every factory call returns an isolated store whose draft is the exact accepted
  inactive draft value.
- Action function identities remain stable across all updates.
- Importing or creating the store performs no event, storage, browser, timer,
  random, network, legacy-store, or presentation side effect.

### Attend

- `attend` calls `attendDraft` with the current draft and caller-supplied session
  concepts, then publishes the exact returned frozen value in one Zustand update
  and one subscriber notification.
- A valid Attend from any draft stage starts the accepted new attending draft,
  discarding only the prior provisional intention/candidate state.
- Session concepts are validated by M2-003, are not cloned into adapter state,
  and are not retained after the call.

### Arm intention

- `armIntention` delegates to `armDraftIntention` and publishes exactly once on
  success.
- Re-arming while already armed is explicit and replaces the provisional
  intention through the accepted pure transition; it never silently reuses a
  previous intention.

### Select candidate

- `selectCandidate` delegates to `selectDraftCandidate` with the current draft
  and caller-supplied session concepts, preserving ordered pair identity.
- Success publishes the exact frozen candidate-selected draft once. Session
  concepts are never retained.

### Cancel and reset

- `cancel` delegates to `cancelDraft`, preserving the accepted hierarchy:
  candidate-selected → armed → attending → inactive.
- Cancelling inactive is an observable no-op: exact state reference, action
  references, and subscriber count remain unchanged.
- `reset` obtains the accepted inactive value from `createInterpretationDraft`
  for later session/commit lifecycle coordination. From any active stage it
  publishes inactive once; when already inactive it is an observable no-op.
- Neither operation creates, removes, or compensates a durable event.

### Failures and publication

- Compute the complete next draft through the pure transition before calling the
  Zustand setter.
- Propagate the original `InterpretationDraftError` and code unchanged.
- Any invalid stage, session concept collection, concept, pair, intention, or
  transition publishes nothing and preserves the exact prior state, draft, and
  action references with zero subscriber notification.
- Do not catch, translate, coerce, sort, repair, or partially publish inputs.
- Successful operations do not mutate caller-owned concept arrays or prior
  draft values.

## State and ownership rules

1. Zustand owns reactivity only; M2-003 remains the sole owner of draft rules.
2. The adapter state exposes no generic setter, partial draft update, hydration
   API, mutable draft, or stage-specific rule implementation; its public store
   type also hides Zustand's raw `setState`.
3. The draft is ephemeral and unpersisted. It is not reconstructed from or
   written into the canonical event log by this task.
4. The adapter does not import the canonical domain store, Attend/commit
   commands, resonance evaluator, gesture builder, legacy store/types, content,
   scene, UI, audio, browser APIs, React, or persistence middleware.
5. The factory remains uninstantiated by production code until an assigned
   coordination/migration task replaces one interaction path end to end.

## Out of scope

- changing M2-003 stages, transitions, errors, cancellation, or pair ordering;
- a weaving-in-progress stage, gesture samples/profile, or commit-success reset
  orchestration;
- canonical Attend, event creation, domain-session state, clocks, thread IDs,
  atomic commit, outcome, or replay behavior;
- candidate resonance computation or presentation;
- a module-level store, React hook/context/provider, selector API, or component;
- browser pointer/touch/pen/keyboard/controller collection or normalization;
- legacy `pressed`/`threading` migration, current input behavior, or test-mode
  adapter changes;
- camera, scene, audio, haptics, UI, accessibility presentation, cues, copy,
  content, persistence, dependencies, service worker, deployment, or GitHub
  settings.

## Constraints

- TypeScript strict mode; explicit public types; no `any`.
- Use only the installed Zustand vanilla API; add no dependency.
- Synchronous deterministic updates with no clock, randomness, browser global,
  React, persistence, or mutable module state.
- Reuse and return the exact accepted pure draft values; do not copy their
  transition logic or add adapter-specific validation/error codes.
- Do not mutate caller inputs, prior drafts, or frozen nested pair values.
- If implementation requires durable synchronization, production behavior,
  presentation policy, or a new draft stage, stop and record a specification
  proposal instead.

## Acceptance criteria

1. One exported vanilla-store factory creates isolated inactive adapters with
   stable action identities and the declared narrow surface.
2. Attend → arm → select publishes the exact accepted immutable drafts in order,
   once per successful transition.
3. Re-Attend from every active stage starts a new attending draft without
   durable mutation; re-arming is explicit.
4. Cancel follows candidate-selected → armed → attending → inactive exactly;
   inactive cancel is a reference-preserving no-op.
5. Reset returns every active stage to the accepted inactive value once and is a
   no-op when inactive.
6. Every M2-003 rejection propagates unchanged with no publication or reference
   change.
7. Inputs and prior draft values remain unchanged and every published draft is
   deeply frozen and deterministic.
8. The adapter caches no session concepts and exposes no generic mutation path.
9. No production caller imports or instantiates the factory, and no existing
   domain, command, gesture, legacy state, input, persistence, or presentation
   behavior changes.
10. No production dependency is added.

## Required tests and checks

- Clean dependency installation from the lockfile.
- Typecheck.
- Lint.
- Full unit suite plus focused tests for:
  - factory isolation, initial exact inactive value, and stable actions;
  - complete Attend → arm → select sequence and ordered pair;
  - re-Attend from attending, armed, and candidate-selected;
  - explicit re-arming;
  - complete cancellation hierarchy and inactive no-op;
  - reset from every stage and inactive no-op;
  - invalid session concepts, unknown/identical concepts, unsupported intention,
    and invalid transition order with unchanged references and zero
    notification;
  - input non-mutation, deep freezing, repeat determinism, and byte identity.
- Content validation.
- Production build.
- Bundle report and accepted ceiling check.
- Deterministic browser smoke tests.
- Targeted performance reference only if implementation affects an active
  per-frame, input, rendering, or audio path; otherwise report why it was not
  required.
- `git diff --check`.
- Focused dependency scan proving only Zustand vanilla, M2-003 draft types/rules,
  and domain ID/intention types are imported.
- Focused caller scan proving no production module imports or instantiates the
  new adapter.
- Focused ownership scan proving Zustand contains no copied stage transition or
  validation rules and cannot update a draft generically.
- Focused diff scan proving every changed production/test file stays within the
  declared state adapter boundary.

## Expected completion report

- exact adapter API and files;
- operation, no-op, failure, and notification behavior;
- tests added with final counts;
- every required check and focused scan result;
- performance-reference disposition;
- confirmation that no production interaction or durable state changed;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this adapter establishes the
ephemeral state-ownership seam later shared by world and accessibility controls.
Automated tests can prove delegation and reactive atomicity but cannot authorize
the later production cutover, input ergonomics, audiovisual response, or device
comfort.

## Implementation notes

- Accepted and merged in PR #42 on 2026-07-14. The exact `main` merge commit
  `c7000d3` passed Quality Gates run `29364475654` and Pages deployment run
  `29364591720`.
- Selected on 2026-07-14 after PR #41 was reviewed and merged, its exact
  `main` merge commit `cd518bf` passed Quality Gates run `29359290671`, no PR
  remained open, and no active task owned `src/state/interactionDraft/**`.
- Implementation plan: add one narrow vanilla-store factory whose stable
  actions delegate to the accepted draft transitions; hide raw `setState` from
  the public store type; prove exact sequencing, re-Attend/re-arm, cancellation,
  reset/no-op behavior, failure atomicity, immutability, determinism, isolation,
  and input non-mutation; then run the complete suite and focused ownership and
  caller scans.
- Implemented `createInterpretationDraftStore` and its local public index under
  `src/state/interactionDraft/`. The factory exposes only `getState`,
  `getInitialState`, and `subscribe`; its stable actions publish the exact
  frozen M2-003 values and delegate every transition, validation, error, no-op,
  cancellation, and reset rule to the accepted pure draft module.
- Added 19 focused tests covering isolated factories and the narrow type,
  Attend -> arm -> select publication and ordered pairs, every active re-Attend
  and reset stage, explicit re-arm, the complete cancellation hierarchy,
  inactive no-ops, every accepted M2-003 error code with failure atomicity,
  input/prior-value immutability, deep freezing, determinism, and byte identity.
- Required checks passed: clean `npm ci` (330 packages, zero vulnerabilities;
  the existing `three-mesh-bvh@0.7.8` deprecation notice remains), typecheck,
  lint, 19 test files / 247 unit tests, content validation (3 tests), production
  build (1,136 transformed modules), bundle report and ceiling check, 3
  deterministic Playwright browser tests, and `git diff --check`.
- Bundle report remained at 2,422,605 total raw / 1,270,785 total gzip bytes,
  1,581,963 JavaScript raw / 465,848 JavaScript gzip bytes, with a 683,665-byte
  largest asset. A targeted performance reference was not required because the
  factory is intentionally uninstantiated and changes no active per-frame,
  input, rendering, or audio path.
- Focused import, caller, ownership, and diff scans confirmed that production
  code imports only Zustand vanilla, M2-003 draft rules/types, and domain
  ID/intention types; no production module imports the adapter; no draft rule or
  generic mutation path is copied into Zustand; and every changed source/test
  file remains inside `src/state/interactionDraft/**`.
- Self-review found no specification conflict or compatibility proposal. No
  production interaction, canonical/durable state, persistence, presentation,
  dependency, or deployment behavior changed. Human review remains required
  for this new ephemeral ownership seam before merge.
- Ready packet proposed on 2026-07-14 after PR #40 was reviewed and merged. Its
  exact `main` merge commit `bc6da55` passed Quality Gates run `29358570399` and
  Pages deployment run `29358691405`; no PR remained open and no active task
  owned `src/state/interactionDraft/**`.
