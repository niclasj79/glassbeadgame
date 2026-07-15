# M2-010 — Derive deterministic interpretation thread identities

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M1-001, M1-002, M1-003, M2-004, M2-008, and M2-009 must be Done.
- The schema-version-1 `ThreadId`, committed-thread uniqueness rule, and atomic
  interpretation-commit event order must remain accepted.

## Objective

Create one pure deterministic function that derives the next stable `ThreadId`
for an interpretation from the exact canonical reduced session. The identity
must be namespaced unambiguously by `SessionId`, use the first available
positive thread ordinal, avoid every thread identity already committed in that
session, and remain reproducible after event-log replay.

This task supplies the stable identity required by the future production input
adapter before it invokes the accepted M2-008 Commit coordinator. It does not
compose production stores, allocate from mutable state, capture input, generate
events, commit a thread, persist a counter, or activate a caller. The shipped
game remains unchanged.

## Why this is next

M2-008 deliberately requires its future input adapter to supply an already
stable `ThreadId`; it does not own generation or collision policy. M2-009 now
completes the other missing headless prerequisite by supplying one accepted
candidate-evidence policy. The future production cutover can therefore be
specified honestly only after thread identity no longer depends on an ad hoc
timestamp, random value, legacy pair key, or presentation component.

Production composition cannot be isolated as an inert intermediate task:
M2-007 and M2-008 reserve it for the same separately reviewed cutover that
owns an active interaction path, input arbitration, evidence, and placeholder
presentation ownership. A small pure identity boundary is the remaining safe
pre-cutover packet. It removes one durable policy decision from the later
browser work without crossing that accepted boundary.

## Implementation plan

1. Reconfirm branded ID construction, event-log replay guarantees, canonical
   committed-thread uniqueness, M2-004 batch semantics, and M2-008 caller input.
2. Add one dependency-free thread-identity function beside the accepted
   interpretation runtime boundaries and export only its callable surface.
3. Encode the exact session namespace with its string length and choose the
   first unused positive ordinal from canonical `session.threads` only.
4. Prove deterministic replay parity, collision/gap behavior, namespace
   disambiguation, immutability, non-retention, and absence of time/random/store
   dependencies through focused tests and scans.
5. Leave production composition, browser input, thread commit, persistence,
   outcomes, and presentation to separately reviewed tasks.

## Required reading

- `AGENTS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M1-001-stable-domain-identifiers-and-events.md`
- `docs/tasks/M1-002-pure-session-reducer.md`
- `docs/tasks/M1-003-replay-and-serialization.md`
- `docs/tasks/M2-004-atomic-interpretation-commit.md`
- `docs/tasks/M2-008-interpretation-commit-coordinator.md`
- `docs/tasks/M2-009-provisional-resonance-evidence.md`
- `docs/MASTER-PLAN.md`, especially Ownership and Intellectual honesty
- `docs/ARCHITECTURE.md`, especially events, reducer, commands, and persistence
- `docs/CURRENT-STATE-AUDIT.md`, especially dual-source and legacy-pair risks
- `docs/ROADMAP.md`, especially the M2 goal and deterministic replay gate
- `docs/VERTICAL-SLICE-SPEC.md`, especially expressive weaving, persistence,
  and deterministic reload
- `docs/INTERACTION-DECISIONS.md`, especially I-008 and I-009

## Existing code and callers to inspect

- `src/domain/ids.ts`
- `src/domain/events/**`
- `src/domain/model/**`
- `src/domain/reducer/**`
- `src/domain/replay/**`
- `src/runtime/commands/interpretationCommit/**`
- `src/runtime/interpretation/**`
- `src/runtime/gestureProfile/**`
- `src/state/domainSession/**`
- `src/state/interactionDraft/**`
- `src/game/rules.ts`
- `src/scene/threading.ts`
- every current `ThreadId`, `toThreadId`, `threadId`, legacy thread-key, and
  interpretation-commit caller

The domain, command, store, legacy game, and scene files are inspection-only.
They establish accepted validation and current identity shapes; this task must
not change their behavior or grandfather legacy unordered pair keys as new
canonical thread identities.

## Owned scope

The task may modify only:

- one new production file and focused test file under
  `src/runtime/interpretation/**`;
- the local `src/runtime/interpretation/index.ts` export surface;
- this task file for status and implementation notes.

All ID constructors, event schemas, model types, reducer/replay rules, command
and coordinator implementations, adapters and stores, gesture rules,
provisional evidence, production composition, session start, persistence,
legacy state, input, React, scene, camera, audio, UI, content, dependencies,
browser tests, CI, and deployment are inspection-only. If collision-safe
identity requires changing one of those boundaries, stop and record a
specification proposal rather than expanding scope.

## Required identity contract

Provide an exported callable equivalent to:

```ts
type CreateInterpretationThreadId = (
  session: SessionStateV1
) => ThreadId;

const createInterpretationThreadId: CreateInterpretationThreadId;
```

Names may vary only when the boundary remains equally explicit. Reuse the
accepted `SessionStateV1`, `SessionId`, `ThreadId`, and `toThreadId` surfaces;
do not introduce parallel ID or session types. Export the callable and its
public alias through the local interpretation index.

Do not add a factory, counter, singleton, store, cache, clock, random source,
UUID dependency, hash dependency, browser global, persistence adapter, fallback
callback, or error class. The function is a total pure mapping for every valid
canonical `SessionStateV1`.

## Canonical identity format

For a canonical session ID `S` and positive ordinal `N`, the only generated
format is:

```text
thread:<S.length>:<S>:<N>
```

Examples:

```text
S = session.castalia, N = 1
thread:16:session.castalia:1

S = a:b, N = 2
thread:3:a:b:2
```

The decimal length prefix is the exact JavaScript/TypeScript `S.length` value
(UTF-16 code units). It makes the session namespace unambiguous even when a
session ID contains colons, periods, digits, or text resembling an ordinal.
The function must preserve the exact accepted session-ID string; do not trim,
lowercase, normalize, hash, parse, or remove a `session` prefix.

## Ordinal allocation policy

1. Read the exact immutable `session.threads` once as the sole collision set.
2. Treat every existing `thread.id` as occupied, regardless of whether it uses
   this task's generated format or came from an accepted imported/replayed log.
3. Examine generated candidates for ordinals `1` through
   `session.threads.length + 1` in ascending order.
4. Return the first candidate whose exact string is not already occupied.

With `K` committed threads, at most `K` generated candidates can be occupied,
so one of the first `K + 1` ordinals is always available. The implementation
must be bounded by that rule and must not use an unbounded retry loop.

Examples:

- no threads → ordinal `1`;
- occupied generated ordinals `1` and `2` → ordinal `3`;
- occupied generated ordinals `1` and `3` → fill gap `2`;
- arbitrary legacy IDs plus occupied generated ordinal `1` → ordinal `2`;
- identical thread ordinals in different session namespaces do not collide.

The ordinal is an identity allocator only. It is not player-facing progress,
score, thread count, event sequence, creation time, or persistence version.

## Required operation semantics

### Canonical input

- Consume the exact passed `SessionStateV1`; do not read the production domain
  store, event log, draft, legacy session, pair, current clock, or input state.
- Use only `session.sessionId` and the identities in `session.threads`.
- Do not validate or repair the canonical session, concluded status, selected
  pair, hypothesis, sequence, thread contents, outcomes, motifs, or concepts.
  Their accepted owners have already validated a real reduced session.
- Do not require a candidate-selected draft. The future input adapter controls
  when it requests an ID and the accepted Commit coordinator remains the
  authority for commit readiness.

### Determinism and isolation

- Equal canonical session values produce the same primitive `ThreadId` in
  every process and after serialize/decode/replay.
- The result depends on no wall clock, game clock, random source, process state,
  module import order, object identity, thread pair, intention, gesture, content,
  device, locale, or presentation state.
- Importing or calling the function performs no publication, notification,
  timer, network, logging, persistence, browser, or presentation work.
- The function neither mutates nor retains the session, its thread array,
  thread records, IDs, or any caller-owned value.

### Relationship to Commit

- The function only derives an ID. It does not reserve it, append an event, or
  guarantee that a later asynchronous caller still holds the latest session.
- The future active input adapter must derive the ID from the exact canonical
  session immediately before its synchronous M2-008 Commit call.
- The accepted reducer remains the final collision authority and must continue
  to reject any duplicate `ThreadId` in a committed event log.
- Repeated calls before a successful commit intentionally return the same ID;
  after the committed thread appears in replayed state, the next call advances
  to the first remaining free ordinal.

## Ownership rules

1. M2-010 owns only deterministic thread-ID derivation from accepted reduced
   state. It owns no event, commit, input, persistence, or presentation rule.
2. M1-001 remains the branded ID constructor and event-envelope owner.
3. M1-002 remains the committed-thread uniqueness and canonical-state owner.
4. M1-003 remains the serialization, decode, and replay owner.
5. M2-004/M2-008 remain the only atomic interpretation-commit command and
   coordinator; they accept but do not derive the ID.
6. A later reviewed input/cutover task owns timing of allocation, production
   composition, input arbitration, placeholder presentation ownership, and the
   active caller.
7. Legacy pair keys are not canonical identities and must not enter this
   function.

## Out of scope

- production singleton composition or any active caller;
- reserving identities, mutable counters, persistence, resume/import migration,
  cross-device allocation, backend coordination, or concurrent writers;
- changing ID constructors, event payloads, reducer uniqueness, serialization,
  replay, command/coordinator signatures, or thread records;
- pair ordering, relation intention, gesture capture/profile, evidence,
  resonance, outcome, documented reveal, Open Thread, motif, or conclusion;
- browser pointer/touch/pen, keyboard, controller, focus, inspection, camera,
  audio, haptics, labels, DOM, accessibility, or other presentation;
- adapting, translating, or deleting legacy thread keys and state;
- modifying persistence, content, dependencies, browser tests, CI, deployment,
  or the shipped game.

## Constraints

- TypeScript strict mode; explicit public type; no `any`.
- Add no production dependency and no mutable module state.
- Bounded synchronous pure allocation; no time, randomness, UUID, hashing,
  environment, store, browser, or persistence access.
- Compare occupied IDs by exact string equality only.
- Use the canonical format and first-free policy exactly; do not add alternate
  formats or silent fallback behavior.
- Do not copy reducer, replay, event-construction, or command validation.

## Acceptance criteria

1. One exported pure function returns a branded `ThreadId` in the exact
   length-prefixed session namespace and has no production caller.
2. An empty session receives ordinal `1`; contiguous occupied generated IDs
   advance; gaps are filled with the lowest free positive ordinal.
3. Arbitrary existing/legacy IDs remain occupied by exact identity but do not
   influence the ordinal unless they exactly collide with a generated candidate.
4. Session IDs with separators or ambiguous-looking suffixes produce distinct,
   unambiguous namespaces and preserve their exact source string.
5. Repeated equal calls and independently replayed equivalent sessions return
   byte-identical ID strings; a successful committed/replayed thread advances
   the next result without a persisted allocator counter.
6. Inputs and prior values are not mutated or retained, and imports/calls have
   no clock, random, store, browser, persistence, or presentation side effect.
7. Existing ID, event, reducer, replay, commit, coordinator, store, legacy, and
   presentation behavior remains unchanged.
8. No production dependency or second identity source is added.

## Required tests and checks

- Clean dependency installation from the lockfile.
- Typecheck.
- Lint.
- Full unit suite plus focused tests for:
  - empty session ordinal `1` and exact format;
  - contiguous generated identities advancing to the next ordinal;
  - generated gaps choosing the first free ordinal;
  - arbitrary legacy/imported IDs and exact generated collisions;
  - distinct session namespaces, including separator-heavy and
    ambiguous-looking session IDs;
  - repeated-call determinism and byte identity;
  - equality after canonical serialize/decode/replay;
  - advancement after an accepted interpretation commit is replayed;
  - concluded and otherwise valid canonical sessions receiving identity without
    duplicated commit-readiness validation;
  - input/thread-array/thread-record non-mutation and non-retention;
  - import/call side-effect absence and no environment dependency.
- Content validation.
- Production build.
- Bundle report and accepted ceiling check.
- Deterministic browser smoke tests.
- Targeted performance reference only if implementation affects an active
  runtime path; otherwise report why it was not required.
- `git diff --check`.
- Focused dependency scan proving imports are limited to accepted domain ID and
  reduced-session types/constructors.
- Focused caller scan proving no production module imports or invokes the new
  function.
- Focused ownership scan proving no time/random/UUID/hash/store/persistence,
  reducer/replay validation, event/commit logic, legacy pair-key logic, generic
  mutation, or alternate ID format was copied.
- Focused diff scan proving no domain, command, coordinator, store, input,
  legacy, content, scene, audio, UI, persistence, dependency, browser-test, CI,
  or deployment file changed.

## Expected completion report

- exact function/type exports and changed files;
- exact identity format and first-free allocation examples;
- deterministic replay, collision, namespace, immutability, and isolation
  evidence;
- tests added with final counts and every required check result;
- performance-reference disposition and focused scan results;
- confirmation that no production composition, active input, commit behavior,
  persistence, content, presentation, legacy state, or durable schema changed;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this packet defines the stable
identity format later written into durable thread events. Automated tests can
prove determinism, collision avoidance, and replay parity, but cannot authorize
future migration, concurrent-writer, cross-device, or persistence guarantees
beyond the local single-session vertical slice.

## Implementation notes

- Implemented `createInterpretationThreadId` and its explicit public callable
  type under `src/runtime/interpretation/**`. The pure helper reads the passed
  canonical thread array once, compares exact occupied identities in a local
  `Set`, and returns the first available positive sequence in the required
  `thread:<S.length>:<S>:<N>` namespace. It has no production caller.
- Added 10 focused tests covering exact empty/contiguous/gapped allocation,
  arbitrary imported identities, separator-heavy and UTF-16 namespaces,
  repeated calls, canonical serialize/decode/replay parity, advancement after
  an accepted commit, concluded sessions, non-mutation/non-retention, and
  import/call isolation from clocks, randomness, and UUIDs.
- Verification passed: clean lockfile install (330 packages, 0
  vulnerabilities; existing `three-mesh-bvh` deprecation warning), typecheck,
  lint, 23 unit files / 307 tests, 3 content-validation tests, production build
  (1,136 modules), bundle report and ceiling check, and 3 deterministic
  Playwright checks. Final bundle metrics exactly match the merged baseline:
  2,422,605 raw / 1,270,785 gzip total, 1,581,963 raw / 465,848 gzip
  JavaScript, and 683,665 bytes for the largest asset. The existing Vite
  greater-than-500-kB chunk advisory remains unchanged.
- Focused scans confirmed only the accepted domain ID constructor/types and
  reduced-session type are imported; `session.threads` is read once; one
  canonical identity-format literal exists; no production caller exists beyond
  the local export; and no clock, random, UUID, hash, store, persistence,
  reducer/replay validation, event/commit, legacy-pair, or presentation owner
  entered production code. The owned four-file diff passes `git diff --check`.
  Self-review also removed an internal word that Tailwind interpreted as a CSS
  utility, restoring byte-for-byte bundle parity with `main`.
- A targeted performance reference was not run because the new function has no
  active production caller and changes no emitted production asset. No domain
  event/schema, reducer, replay, commit/coordinator, store, input, persistence,
  legacy state, content, audiovisual presentation, browser test, CI,
  deployment, or dependency behavior changed.
- Human review remains required because this packet defines the stable identity
  format that a later cutover will write into durable thread events. It does
  not claim concurrent-writer, cross-device, or migration guarantees.

- Selected on 2026-07-15 after PR #49 was reviewed and merged. Its exact
  `main` merge commit `9aa8eef` passed Quality Gates run `29439686409`; no PR
  remained open, every dependency was Done, and no active work owned
  `src/runtime/interpretation/**` or the thread-identity derivation boundary.
- Implementation plan: add one exported pure allocator that reads the exact
  canonical thread array once, builds a fixed exact-identity collision set,
  and returns the lowest free positive ordinal in the length-prefixed session
  namespace; add focused canonical replay/commit, collision, namespace,
  determinism, immutability, non-retention, and environment-isolation tests;
  then run every required repository check and focused ownership scan.
- Ready packet proposed on 2026-07-15 after PR #48 was reviewed and merged.
  Its exact `main` merge commit `3c590f5` passed Quality Gates run
  `29422757687` and Pages deployment run `29422904373`; no PR remained open and
  no active work owned `src/runtime/interpretation/**` or the thread-identity
  derivation boundary.
- Packet plan: derive the first free positive thread ordinal inside an exact
  length-prefixed session namespace from canonical reduced threads only; prove
  replay parity, gap/collision behavior, separator-safe namespaces,
  immutability, determinism, and absent production/time/random/store callers;
  leave production composition and the active browser cutover coupled as
  required by M2-007 and M2-008.
