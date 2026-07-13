# M1-001 — Establish stable domain identifiers and events

## Status

Review

## Milestone

M1 — Domain foundation

## Dependencies

- M0-001 through M0-007 must be Done.

## Objective

Introduce the first presentation-independent domain contract: stable branded identifiers, the four player-facing relation intentions, a versioned event envelope, and the initial typed session-event vocabulary required by the target architecture.

This task establishes types and invariants only. It does not make the new event log authoritative, change current gameplay, or migrate any caller.

## Why this exists

The current implementation uses structurally interchangeable strings for concepts, sessions, threads, discoveries, and presentation state. Durable changes are direct Zustand mutations rather than a typed event contract. The reducer, replay, serialization, persistence, and adapter tasks need one explicit vocabulary and identity boundary before they can proceed without duplicating rules.

## Implementation plan

1. Inventory current identifier shapes and durable session mutations.
2. Add dependency-free branded identifier types and narrow boundary constructors.
3. Define schema version 1 of the event envelope and initial discriminated event union.
4. Add focused compile-time and runtime unit tests for identity separation, event narrowing, and envelope invariants.
5. Run the full repository validation suite and review the diff for accidental integration or duplicate state.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially the core loop and protected product laws;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 5–10, 12–15, 20, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 11–12, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially `src/content/`, `src/game/`, and `src/state/` migration risks;
- `docs/ROADMAP.md`, especially the M1 gate and safe-parallelism rules;
- all accepted M0 task implementation notes.

## Existing code and callers to inspect

- `src/content/types.ts`, content validators, content records, and `pairKey`;
- `src/state/types.ts`, `src/state/store.ts`, persistence setup, and every store action that changes a session;
- `src/game/session.ts`, `src/game/rules.ts`, and their tests;
- `src/scene/threading.ts` and the callers that commit a weave;
- conclusion, replay, Codex, audio, and test-mode consumers of session data;
- local-storage keys, sanitizers, and session-memory shapes;
- `src/test/fixtures.ts` and current Vitest conventions.

## Owned scope

- `src/domain/ids.ts`;
- `src/domain/events/**`;
- focused unit tests beside those files;
- this task's status and implementation notes.

No other active task may modify the domain identifier or event vocabulary while M1-001 is in progress.

## Required identifier contract

Define distinct branded string types for at least:

- `SessionId`;
- `EventId`;
- `ConceptId`;
- `ThreadId`;
- `DocumentedRelationId`;
- `OpenThreadId`;
- `MotifCompletionId`;
- `MotifKindId`;
- `WorldId`;
- `ContentPackVersion`.

Boundary constructors must reject empty or whitespace-only values and return the corresponding branded type. They must preserve existing authored concept and documented-relation strings rather than renaming content. Identifier creation must be deterministic from explicit inputs; this task must not introduce wall-clock, random, browser, or storage dependencies.

Identifiers with different meanings must not be assignable to one another without an explicit boundary conversion. Do not globally brand existing content types or migrate legacy callers in this task.

## Required event envelope

Every event in schema version 1 must be a discriminated, immutable value containing:

- `schemaVersion: 1`;
- a stable `EventId`;
- the owning `SessionId`;
- a zero-based non-negative integer `sequence`;
- a non-negative finite `at` value measured in game-relative milliseconds;
- a literal event `type`;
- a payload specific to that event type.

Event IDs must be collision-safe and deterministically derivable from the exact session ID and sequence pair. Ordering and game-relative time are data; wall-clock timestamps do not belong in the domain event envelope. Factories or constructors must reject invalid individual envelope values. Cross-event log validation, contiguous-sequence enforcement, parsing of unknown persisted data, migrations, and replay belong to M1-003.

## Required schema-version-1 vocabulary

Define a discriminated union covering the initial architecture vocabulary:

- `session.started` — a canonical non-empty string seed, content-pack version, world, and ordered session concept IDs;
- `bead.attended` — attended concept ID;
- `pair.selected` — two distinct ordered concept IDs;
- `relation.hypothesized` — the selected pair and one of `echo`, `passage`, `tension`, or `ground`;
- `thread.committed` — stable thread ID, pair, declared relation, and normalized gesture profile;
- `documented-relation.revealed` — thread ID and authored documented-relation ID;
- `open-thread.created` — thread ID and stable Open Thread ID;
- `motif.completed` — stable completion ID, motif kind identifier, and participating concept/thread IDs;
- `attunement.entered` and `attunement.exited`;
- `session.concluded`.

`attunement.entered`, `attunement.exited`, and `session.concluded` have empty version-1 payloads; later tasks derive their meaning from event order and reduced state rather than duplicating snapshots in those events. The new canonical seed is a string so the documented `castalia-golden-001` scenario can be represented directly; existing numeric seeds remain untouched legacy data until an assigned migration.

The normalized gesture profile must represent duration in milliseconds, path length relative to the viewport diagonal, dimensionless curvature, average speed in viewport diagonals per second, dimensionless speed variance, a `[0, 1]` pressure proxy when available, and input modality without retaining raw pointer samples. All supplied numeric summaries must be finite and non-negative. Input modality is exactly `mouse`, `touch`, `pen`, `keyboard`, `controller`, or `unknown`; unavailable optional measurements are omitted rather than fabricated. Gesture data must not encode intellectual validity.

Payloads reference stable IDs and replay-relevant facts, not display text, React state, Three.js objects, audio nodes, storage records, computed presentation cues, or wall-clock timestamps.

## Scope

1. Create the `src/domain/` identifier and event modules without importing React, Zustand, Three.js, Web Audio, DOM, Node, storage, or current presentation modules.
2. Export the player-facing relation intention vocabulary from the domain event contract.
3. Provide narrow constructors/factories for identifiers and events so invalid envelope primitives cannot silently enter through new callers.
4. Add type-focused tests proving identifier brands are distinct and event-type checks narrow payloads correctly.
5. Add runtime tests for deterministic event IDs, accepted values, rejected empty IDs, invalid sequence/time values, distinct pair endpoints, optional gesture measurements, and exhaustive coverage of every event type.
6. Document any discovered conflict as a proposal in this task's implementation notes; do not silently change canonical behavior.

## Out of scope

- a session reducer, initial `SessionState`, selectors, commands, or rule evaluation;
- event-log serialization, unknown-input parsing, replay, compatibility migrations, or persistence;
- replacing current `src/content/`, `src/game/`, `src/state/`, localStorage, Codex, or session-memory types;
- emitting events from current UI, input, scene, audio, or Zustand paths;
- changing content IDs, connection IDs, seed generation, gameplay, relation outcomes, motifs, scoring, or presentation;
- adding a dependency;
- defining authored evidence classes, source records, Open Thread prose, or documented-relation content;
- raw gesture-point storage or audiovisual cue planning.

## Constraints

- TypeScript strict mode applies; public event and identifier types are explicit and contain no `any`.
- Domain modules are deterministic and side-effect free.
- Prefer exhaustive discriminated unions over open string/type registries.
- Schema version is a literal on every event, not a package or application version.
- Do not create a second durable source of truth or claim the new events are persisted.
- Existing behavior and legacy types remain unchanged until their assigned migration tasks.
- Any decision that changes product behavior or the canonical event vocabulary requires human review.

## Acceptance criteria

- All required branded identifiers and their rejecting boundary constructors exist under `src/domain/`.
- Existing authored concept and documented-relation ID strings can be represented without data migration.
- `SessionEventV1` is an exhaustive discriminated union for every required schema-version-1 event type.
- Every event carries the required stable identity, sequence, schema, session, and game-relative-time fields.
- Event construction is deterministic for identical inputs and rejects empty IDs, negative/fractional sequences, non-finite/negative time, and identical pair endpoints.
- Relation intentions are limited to Echo, Passage, Tension, and Ground in their canonical lowercase domain representation.
- Gesture profiles contain only normalized replay-relevant summary fields and support unavailable pressure/input measurements without fabricated values.
- Unit tests demonstrate identifier non-interchangeability, event narrowing, deterministic construction, invariant rejection, and all event variants.
- No production dependency, caller migration, persistence behavior, Zustand state, scene, audio, content record, or gameplay behavior changes.
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
10. focused inspection confirming `src/domain/` has no forbidden framework, platform, presentation, or storage imports.

The performance reference is not required because this task adds no runtime integration. If any required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- identifier and event modules added;
- event vocabulary and invariant summary;
- tests added and all check results;
- confirmation that no existing caller or durable state path was migrated;
- compatibility or specification proposals, if any;
- human-review items.

## Human review boundary

Human review is required before merge because this establishes the compatibility surface for later event logs, reducers, replay, and persistence. Automated tests are necessary but not sufficient to accept the event vocabulary.

## Implementation notes

- Added dependency-free branded identifiers and rejecting constructors in `src/domain/ids.ts`. Existing authored strings remain unchanged, while event IDs use a deterministic length-prefixed session/sequence encoding.
- Added an immutable schema-version-1 event union, closed relation/input vocabularies, normalized gesture summaries, invariant validation, and deterministic factories under `src/domain/events/`.
- Added focused compile-time and runtime coverage for all eleven event variants, identifier separation, exhaustive narrowing, deterministic frozen values, invalid envelope fields, distinct pair endpoints, and optional gesture measurements.
- No current caller, Zustand state, persistence record, content model, gameplay rule, scene, UI, or audio path imports or emits the new events.
- This task was the recorded low-risk steering-loop dry run: it was selected as the first Ready task with all dependencies Done and no overlapping active owner; one isolated branch and one reviewable PR were produced, with no automatic merge or next-task selection.
- Branch protection was verified before selection: strict `Quality Gates` is required on `main`, pull requests and conversation resolution are enforced, administrators are included, and force pushes/deletions are disabled.
- Required checks passed: clean lockfile install with zero vulnerabilities; typecheck; lint; 8 unit-test files with 53 tests; 3 content-validation tests; production build; bundle ceilings; 3 deterministic browser tests; `git diff --check`; and focused inspection finding no forbidden framework, presentation, platform, or storage references under `src/domain/`. The existing deprecated `three-mesh-bvh@0.7.8` transitive warning remains unchanged.
