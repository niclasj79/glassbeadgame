# M1-002 — Implement the pure session reducer

## Status

Ready

## Milestone

M1 — Domain foundation

## Dependencies

- M1-001 must be Done.

## Objective

Define the immutable `SessionStateV1` model and a pure reducer that applies the accepted schema-version-1 session events without React, Zustand, Three.js, Web Audio, browser APIs, storage, or legacy game-state mutation.

This task establishes deterministic domain state transitions only. It does not emit events, parse persisted input, replay a stored log through an adapter, or migrate current gameplay.

## Why this exists

M1-001 established stable identifiers and a typed event vocabulary, but no domain state is derived from those events. The existing Zustand store still owns gameplay-era mutations and derived snapshots. Replay, serialization, commands, and incremental adapter work need one authoritative pure transition function before any current path can migrate safely.

## Implementation plan

1. Reinspect every M1-001 event and the legacy state/mutation map for facts that must be represented without copying legacy scoring or presentation state.
2. Define a minimal immutable session model and stable typed transition-error vocabulary.
3. Implement `reduceSession(previous, event)` with lifecycle, ordering, reference, and uniqueness invariants.
4. Add a complete valid event-sequence fixture plus focused rejection and immutability tests.
5. Run the full repository validation suite and inspect the diff for duplicate rules, integration, nondeterminism, and forbidden imports.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially the core loop and protected qualities;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 5–15, 20, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 11, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`;
- `docs/audits/M0-STATE-MUTATION-MAP.md` and `docs/audits/M0-PERSISTENCE-MAP.md`;
- `docs/tasks/M1-001-stable-domain-identifiers-and-events.md` and every file under `src/domain/`.

## Existing code and callers to inspect

- `src/domain/ids.ts` and `src/domain/events/**`;
- `src/state/types.ts`, `src/state/store.ts`, and store characterization tests;
- `src/game/session.ts`, `src/game/rules.ts`, and their tests;
- `src/scene/threading.ts` commit path;
- conclusion, replay, Codex, audio, and deterministic test-mode consumers of legacy session state;
- current local-storage/session-memory shapes and progress cleaners.

## Owned scope

- `src/domain/model/**`;
- `src/domain/reducer/**`;
- focused tests and fixtures under those directories;
- exports under `src/domain/` only when needed for the new model/reducer;
- this task's status and implementation notes.

M1-001 event payloads and identifier formats are accepted inputs, not editable scope. No other active task may modify the session model or reducer boundary while M1-002 is in progress.

## Required session model

Define an immutable `SessionStateV1` containing only event-derived domain facts:

- session ID, canonical string seed, content-pack version, world ID, and ordered session concept IDs;
- last accepted sequence and game-relative time;
- current attended concept or `null`;
- current selected pair or `null`;
- current relation hypothesis or `null`;
- committed threads in event order, including stable ID, pair, declared intention, normalized gesture profile, event ID, sequence, and commit time;
- thread outcomes in event order as a closed union of documented-relation reveal or Open Thread creation, with their stable IDs and source thread;
- completed motifs in event order, including completion/kind IDs and referenced concepts/threads;
- whether Attunement is active;
- whether the session is concluded.

Do not include score, points, rank, modal/UI state, camera/audio/render state, wall-clock time, authored display prose, persisted envelopes, derived graph metrics, or legacy snapshot fields. Selectors and richer graph projections belong to later tasks.

## Required reducer contract

Provide a dependency-free function equivalent to:

```ts
reduceSession(previous: SessionStateV1 | null, event: SessionEventV1): SessionStateV1
```

The reducer must return a new deeply immutable state for every accepted event and must not mutate the previous state, event, payload, or nested arrays. Identical inputs must produce deeply equal outputs.

Invalid transitions throw a domain-specific error with a closed stable code and the rejected event ID. Error text may aid debugging but must not be the compatibility contract. At minimum, codes distinguish lifecycle, session identity, sequence, relative time, unknown concept/thread reference, duplicate identity/outcome, pair/hypothesis mismatch, and Attunement-state errors.

## Required transition semantics

1. `session.started` is the only event accepted with `previous === null`; it must have sequence `0`, establish the session model, and contain at least one unique concept ID.
2. No second `session.started` event is accepted for an existing state.
3. Every later event must match the state's session ID, use exactly `lastSequence + 1`, and have game-relative time greater than or equal to the prior event time.
4. No event is accepted after `session.concluded`.
5. Every referenced concept must belong to the session; every referenced thread must already be committed.
6. `bead.attended` replaces the current attended concept.
7. `pair.selected` replaces the current pair and clears any previous hypothesis.
8. `relation.hypothesized` requires the same currently selected ordered pair and records its intention.
9. `thread.committed` requires the same current pair and hypothesis intention, requires a unique thread ID, appends the committed thread, and clears the selected pair and hypothesis.
10. A thread may receive exactly one outcome: either `documented-relation.revealed` or `open-thread.created`. Open Thread IDs must be unique within the session; an authored documented-relation ID may be referenced by more than one thread and is not treated as a newly created outcome ID.
11. `motif.completed` requires a unique completion ID and only known participating concepts/threads, then appends the motif without calculating eligibility or effects.
12. `attunement.entered` is valid only while inactive; `attunement.exited` is valid only while active.
13. `session.concluded` marks the session concluded and Attunement inactive. It does not invent a score, portrait, Annotation, archive record, or wall-clock end time.

The reducer enforces event-log consistency, not player command eligibility. Relation validity, motif eligibility, outcome selection, cancellation batching, and command failure reasons remain outside this task.

## Scope

1. Add the minimal session-state model and transition error types.
2. Add one exhaustive reducer over `SessionEventV1`.
3. Preserve event order explicitly; do not use unordered iteration as a source of durable order.
4. Add reusable domain-only fixtures for a complete valid sequence covering all eleven event types.
5. Add tests for every transition and every required rejection family.
6. Prove previous inputs remain unchanged and repeated reduction is deterministic.
7. Record conflicts as proposals in implementation notes instead of changing M1-001 or canonical product behavior.

## Out of scope

- event creation, command handling, event batching, cancellation, or UI/input validation;
- log parsing, schema migration, serialization, replay helpers, snapshots, or persistence;
- Zustand adapters, current store actions, localStorage, IndexedDB, Codex, or session archives;
- selectors, graph algorithms, relation matching, motif eligibility, scoring, progression, portrait, or Annotation;
- React, scene, audio, cues, accessibility presentation, or browser integration;
- changing event payloads, identifier formats, content IDs, authored content, gameplay, or dependencies.

## Constraints

- TypeScript strict mode applies; public types are explicit and contain no `any`.
- Domain code is deterministic, side-effect free, and independent of frameworks/platforms.
- Use exhaustive event discrimination and stable typed error codes.
- Preserve ordered arrays and branded IDs; do not downcast durable identities to interchangeable strings in public types.
- Do not catch and reinterpret reducer errors in presentation language.
- Do not create a second durable source of truth or connect the model to persistence.
- Human review is required for any proposed change to accepted event semantics.

## Acceptance criteria

- `SessionStateV1`, committed-thread, thread-outcome, completed-motif, hypothesis, and transition-error types are explicit and immutable.
- `reduceSession` exhaustively handles all eleven accepted event variants and implements every required transition semantic.
- A valid full sequence reduces deterministically from `null` to a concluded state containing only event-derived facts.
- Invalid lifecycle, identity, sequence, time, reference, duplicate, mismatch, and Attunement transitions fail with the expected stable code and rejected event ID.
- Failed and successful reductions do not mutate prior state or event inputs.
- Tests cover every event variant, every rejection family, deep immutability, and deterministic equality.
- No existing caller, event schema, Zustand state, persistence path, gameplay rule, presentation path, content record, or dependency changes.
- Typecheck, lint, unit tests, content validation, production build, bundle check, and deterministic browser smoke all pass.

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
10. focused import inspection confirming the new model/reducer has no framework, presentation, platform, storage, or legacy-state dependencies.

The performance reference is not required because no runtime path is integrated. If any required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- state, reducer, and error modules added;
- transition and invariant summary;
- valid-sequence and rejection tests added;
- all check results;
- confirmation that no current caller or durable path was migrated;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because reducer semantics become the foundation for replay, commands, persistence, and later migration. Automated checks are necessary but not sufficient to accept the transition model.

## Implementation notes

- None yet.
