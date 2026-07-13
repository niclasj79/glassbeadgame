# M1-003 — Add validated event-log serialization and deterministic replay

## Status

Ready

## Milestone

M1 — Domain foundation

## Dependencies

- M1-001 must be Done.
- M1-002 must be Done.

## Objective

Define a versioned canonical JSON representation for schema-version-1 session event logs, validate unknown input into the accepted event contract, and replay a validated ordered log through the pure reducer to produce `SessionStateV1`.

This task establishes a domain-only interchange and replay boundary. It does not persist logs, migrate legacy data, emit events, or connect the new domain model to current gameplay.

## Why this exists

M1-001 established individually constructed events and M1-002 established their pure transition semantics. The M1 gate also requires an abstract golden-path session to survive serialization, unknown-input parsing, and deterministic replay. Treating the event log as canonical requires one rejecting boundary before any repository or Zustand adapter may trust stored data.

## Implementation plan

1. Reinspect the accepted event factories, branded-ID constructors, reducer invariants, and full-session fixture alongside the current persistence audit.
2. Define the version-1 log envelope, closed validation/replay error contract, and explicit compatibility policy.
3. Implement unknown-input decoding, canonical serialization, and ordered replay without framework, browser, or storage dependencies.
4. Add round-trip, malformed-input, compatibility, reducer-failure, immutability, and deterministic replay tests using the full-session fixture.
5. Run the full repository validation suite and inspect the diff for schema drift, coercion, reordering, duplicate durable state, integration, nondeterminism, and forbidden imports.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially the technical success criteria;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 9, 15, 20, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 11, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`;
- `docs/DECISIONS.md`, especially the event-sourced domain decision;
- `docs/ROADMAP.md`, especially the M1 goal, work, and gate;
- `docs/audits/M0-PERSISTENCE-MAP.md`;
- `docs/tasks/M1-001-stable-domain-identifiers-and-events.md`;
- `docs/tasks/M1-002-pure-session-reducer.md` and every production file under `src/domain/`.

## Existing code and callers to inspect

- `src/domain/ids.ts` and `src/domain/events/**`, including all constructors and invariants;
- `src/domain/model/**` and `src/domain/reducer/**`, including the full-session fixture and every reducer error;
- current `src/state/` persisted slice, merge/cleaning behavior, and characterization tests;
- current session-memory, archive, replay, Codex, and conclusion consumers;
- any current JSON import/export or shared-progress validation utilities, as comparison only.

## Owned scope

- `src/domain/replay/**`;
- focused tests and fixtures under that directory;
- exports under `src/domain/` only when needed for the replay boundary;
- this task's status and implementation notes.

M1-001 event/identifier contracts and M1-002 model/reducer semantics are accepted inputs, not editable scope. No other active task may modify the domain event-log, parsing, serialization, or replay boundary while M1-003 is in progress.

## Required version-1 log contract

Define an immutable log envelope equivalent to:

```ts
interface SessionEventLogV1 {
  readonly format: "glass-bead-game.session-event-log";
  readonly schemaVersion: 1;
  readonly events: readonly SessionEventV1[];
}
```

The envelope version describes the stored log format; each event retains its accepted event schema version. Version 1 contains no snapshot, reduced state, wall-clock timestamp, player profile, preferences, content records, presentation cues, checksum, storage metadata, or legacy progress.

The canonical serialized form is compact JSON constructed in a documented fixed property order. Serializing the same accepted event sequence must produce byte-identical text regardless of input object insertion order. Event array order is durable and must never be sorted, deduplicated, resequenced, or inferred from timestamps.

## Required validation boundary

Provide domain-only functions equivalent to:

```ts
decodeSessionEventLogV1(input: unknown): SessionEventLogV1
parseSessionEventLogV1(json: string): SessionEventLogV1
serializeSessionEventLogV1(log: SessionEventLogV1): string
replaySessionEventLogV1(log: SessionEventLogV1): SessionStateV1
```

Names may vary if the public contract remains equally narrow and explicit.

Decoding and serialization must validate their inputs at runtime rather than trusting TypeScript assertions. They must reject:

- malformed JSON, primitives, arrays, `null`, and envelopes with missing, extra, or incorrectly typed fields;
- an incorrect format discriminator or any unsupported log schema version;
- an empty event list;
- event values with missing, extra, or incorrectly typed envelope/payload fields;
- unsupported event schema versions or event types;
- empty branded-ID strings, invalid sequence/time values, identical pair endpoints, invalid intention/input-modality values, invalid gesture summaries, and malformed arrays;
- an event ID that is not exactly the deterministic ID for its session ID and sequence;
- any ordered cross-event inconsistency rejected by `reduceSession`.

Validation must not trim, coerce, repair, sort, discard, default, or synthesize unknown data. Accepted values are rebuilt through the accepted ID/event constructors and deeply frozen; no parsed mutable object or array reference may escape.

## Compatibility policy

- Only the exact version-1 envelope and exact version-1 events are accepted by this task.
- Unknown format versions, event versions, event types, and extra fields fail closed with stable errors; they are not treated as version 1.
- A future compatible additive or breaking change requires a new explicit schema version and reviewed decoder/migration path.
- A future migrator must preserve the original canonical event log until successful validation and replay of its replacement; this task does not define or perform migrations.
- Snapshots may later accelerate loading but cannot replace the canonical event sequence and are outside this format.

## Error contract

Invalid input must throw a domain-specific error with a closed stable code, processing stage, and useful location such as event index/property path when available. Error prose is diagnostic, not the compatibility surface.

At minimum, stable codes distinguish malformed JSON, invalid envelope shape, unsupported log version, invalid event shape, unsupported event version/type, invalid event ID, invalid event payload, empty log, and replay/transition failure. Reducer failures must remain inspectable without rewriting their stable transition code into presentation language.

## Required replay semantics

1. Replay consumes the stored array exactly once in stored order, beginning with `null` state.
2. Every event is applied through the accepted `reduceSession`; replay does not duplicate transition rules.
3. Successful replay returns the reducer's deeply immutable final `SessionStateV1`.
4. Identical accepted logs produce deeply equal states and do not mutate the log or any event.
5. Parsing, serializing, parsing again, and replaying the full-session fixture produces the same final state as direct reduction.
6. Transition failures report the failing event index and preserve the underlying stable `SessionTransitionError` details.
7. Replay does not require the final event to conclude the session; a valid in-progress non-empty log is accepted.

## Scope

1. Add the immutable version-1 event-log type and compatibility constants.
2. Add strict unknown-input decoding for the envelope and every accepted event payload.
3. Add deterministic canonical JSON parsing and serialization.
4. Add ordered replay through the existing reducer.
5. Add a stable typed validation/replay error boundary.
6. Add exhaustive tests for all event variants, the valid full-session round trip, in-progress replay, and every required rejection family.
7. Record conflicts as proposals in implementation notes instead of changing accepted event or reducer behavior.

## Out of scope

- localStorage, IndexedDB, filesystem, network, repository interfaces, autosave, import UI, export UI, or PWA behavior;
- legacy progress/session migration, schema-version conversion, recovery, quarantine, backup, or snapshotting;
- emitting events, commands, batching, cancellation, clocks, or Zustand adapters;
- changing event payloads, identifier formats, reducer semantics, content IDs, authored content, gameplay rules, or dependencies;
- React, scene, audio, cues, accessibility presentation, browser integration, or current replay presentation;
- cryptographic signing, compression, encryption, telemetry, or sharing protocols.

## Constraints

- TypeScript strict mode applies; public types are explicit and contain no `any`.
- Domain code is deterministic, side-effect free, and independent of frameworks/platforms.
- Unknown input remains `unknown` until checked; unsafe broad casts do not substitute for boundary validation.
- Use exhaustive discriminated handling for all eleven accepted event types.
- Preserve branded identities, exact numeric values, optional-field absence, and array order.
- Do not duplicate reducer rules or create a second durable source of truth.
- Do not add a production or development dependency.
- Any proposal to accept/coerce unknown data or alter accepted event/reducer semantics requires human review.

## Acceptance criteria

- The version-1 envelope and compatibility constants are explicit, immutable, and contain only the canonical event sequence.
- Unknown JSON/value input is either rebuilt as a deeply immutable `SessionEventLogV1` or rejected with the expected stable error code and location.
- Decoder coverage is exhaustive across all eleven event payload variants and rejects missing, extra, mistyped, unsupported, invalid-ID, and invalid-value cases.
- Canonical serialization is byte-deterministic, preserves event order and optional-field absence, and round-trips every accepted event field.
- The reusable full-session fixture round-trips and replays to a state deeply equal to direct reduction.
- Valid in-progress logs replay; empty and cross-event-invalid logs fail at the correct boundary.
- Replay delegates transition semantics to `reduceSession`, preserves reducer failure details, and does not mutate inputs.
- No existing caller, event/reducer contract, Zustand state, persistence path, gameplay rule, presentation path, content record, or dependency changes.
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
10. focused inspection confirming `src/domain/replay/**` has no framework, presentation, platform, storage, current-state, or legacy-replay dependencies;
11. focused inspection confirming parsing/serialization does not duplicate reducer transition rules or silently normalize unknown values.

The performance reference is not required because this task adds no runtime integration. If any required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- log envelope, decoder, serializer, replay, and error modules added;
- canonical format and compatibility-policy summary;
- exhaustive round-trip and rejection tests added;
- all check results;
- confirmation that no persistence or current caller was integrated;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because the serialized event-log format and failure policy become a compatibility surface for later persistence, import/export, and migrations. Automated checks are necessary but not sufficient to accept this contract.

## Implementation notes

- None yet.
