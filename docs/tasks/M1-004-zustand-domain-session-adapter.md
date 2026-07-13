# M1-004 — Add an isolated Zustand domain-session adapter

## Status

Ready

## Milestone

M1 — Domain foundation

## Dependencies

- M1-001 must be Done.
- M1-002 must be Done.
- M1-003 must be Done.

## Objective

Provide a small, testable Zustand vanilla-store factory that exposes the canonical validated event log and its reduced `SessionStateV1` as one atomically updated reactive projection.

This task creates the adapter seam only. It does not instantiate a production singleton, connect a current UI/input path, replace the legacy global store, emit commands/events, or add persistence.

## Why this exists

The accepted domain modules can construct, validate, serialize, and replay sessions without application frameworks, but current presentation code can only react to the legacy rule-owning Zustand store. The next migration task needs a reactive boundary that delegates all durable meaning to the event log and reducer without copying those rules into Zustand or creating an immediately competing persisted source of truth.

## Implementation plan

1. Reinspect the accepted domain APIs, the legacy store shape/middleware, subscriptions, and mutation map.
2. Define the minimal adapter state, factory, and atomic load/append/clear operations with explicit invariants.
3. Implement the adapter with Zustand's existing vanilla API, delegating validation and reduction to M1-003/M1-002.
4. Add focused tests for isolation, loading, appending, subscriptions, atomic failure, immutability, and clearing.
5. Run the full repository suite and inspect the diff for duplicated rules, persistence, global integration, overlapping state ownership, nondeterminism, and accidental caller changes.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially the protected qualities and technical success criteria;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 5–15, 20, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 11, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially the `src/state/` migration risk;
- `docs/DECISIONS.md`, especially ADR-003 and ADR-008;
- `docs/ROADMAP.md`, especially the M1 gate and unsafe parallelism;
- `docs/audits/M0-STATE-MUTATION-MAP.md` and `docs/audits/M0-PERSISTENCE-MAP.md`;
- `docs/tasks/M1-001-stable-domain-identifiers-and-events.md` through `M1-003-replay-and-serialization.md`;
- every production file under `src/domain/`.

## Existing code and callers to inspect

- `src/state/store.ts`, `src/state/types.ts`, and `src/state/store.test.ts`;
- every direct `useStore.getState()`, selector, and subscription caller;
- `src/scene/threading.ts` and `src/scene/ThreadingDriver.tsx`, including the deterministic test adapter;
- current conclusion, replay, Codex, audio, and scene consumers of legacy session snapshots;
- Zustand's already-installed vanilla store API and current middleware usage;
- the accepted event-log decoder, serializer, replay function, reducer, errors, and full-session fixture.

## Owned scope

- new files under `src/state/domainSession/**`;
- focused tests under that directory;
- this task's status and implementation notes.

The legacy `src/state/store.ts` and `src/state/types.ts`, all current callers, `src/domain/**`, persistence configuration, input, scene, audio, UI, and content are inspection-only. No other active task may create or integrate a competing domain-session adapter while M1-004 is in progress.

## Required adapter contract

Provide a factory equivalent to:

```ts
interface DomainSessionAdapterState {
  readonly eventLog: SessionEventLogV1 | null;
  readonly session: SessionStateV1 | null;
  readonly loadEventLog: (input: unknown) => void;
  readonly appendEvent: (event: SessionEventV1) => void;
  readonly clearSession: () => void;
}

createDomainSessionStore(): StoreApi<DomainSessionAdapterState>
```

Names may vary if the public boundary remains equally narrow. Use Zustand's vanilla store API so tests and non-React application code can use the adapter without React. Do not export a module-level store instance or React hook in this task.

The adapter has exactly two meaningful session representations:

- `eventLog` is the canonical ordered domain fact record;
- `session` is the immutable projection derived from that exact log.

They must always be either both `null` or a matching validated log/state pair. The reduced state is not persisted, independently editable, or accepted from callers.

## Required operation semantics

### Fresh store

- Each factory call returns an isolated store with `eventLog === null` and `session === null`.
- Action function identities remain stable across state updates.
- Creating or importing the module performs no storage, browser, timer, random, network, legacy-store, or presentation side effect.

### Load

- `loadEventLog(input: unknown)` delegates unknown-input rebuilding and cross-event validation to `decodeSessionEventLogV1` and derives state through `replaySessionEventLogV1`.
- A successful load publishes the rebuilt deeply immutable log and matching state together in one Zustand update and one subscriber notification.
- A failed load propagates the original typed domain error unchanged and publishes nothing; prior references and subscriber counts remain unchanged.

### Append

- `appendEvent(event)` forms a candidate log by appending the supplied event after the current canonical events, or as the first event when the adapter is empty.
- The candidate uses the accepted log format/version and is validated as a complete log through the M1-003 boundary before publication; no event is trusted because of a TypeScript assertion alone.
- The matching state is produced only through accepted replay/reducer APIs.
- A successful append publishes a new immutable log and matching state together in one update, preserves stored order, and never mutates the previous log, state, event, or nested values.
- An invalid first event, invalid sequence/identity/reference, duplicate, post-conclusion event, malformed forged event, or other rejection propagates the original typed domain error and leaves the adapter unchanged with no notification.

### Clear

- `clearSession()` atomically returns both fields to `null` without altering any previously returned immutable log/state value.
- Clearing an already empty adapter is an observable no-op.
- Clear means in-memory adapter reset only; it must not delete or write browser storage or legacy progress.

## State and ownership rules

1. Zustand owns reactivity and action orchestration only; it does not validate event payloads or reproduce reducer transitions.
2. The event log remains canonical and the session state remains derived. No setter may replace `session` independently.
3. The adapter does not expose a generic `set`, mutable event array, partial session update, or legacy-state conversion.
4. The adapter does not import the legacy store, legacy session types, content, game rules, scene, UI, audio, browser globals, or persistence middleware.
5. This factory remains uninstantiated by production code until an assigned migration task replaces one current path end to end.

## Scope

1. Add the explicit adapter state/API types and vanilla-store factory.
2. Add atomic validated load, append, and clear operations.
3. Reuse accepted M1-002/M1-003 APIs for every domain transition and validation decision.
4. Add focused tests demonstrating store isolation, state/log consistency, immutable updates, subscription counts, failure atomicity, and no-op clearing.
5. Record conflicts as proposals in implementation notes rather than changing domain or legacy behavior.

## Out of scope

- changing `src/state/store.ts`, `src/state/types.ts`, or any current selector/subscriber/caller;
- a React hook, context provider, production singleton, component integration, or development test adapter change;
- commands, command validation, event creation, clocks, input mapping, batching, cancellation, or gameplay rules;
- localStorage, IndexedDB, repository interfaces, hydration, autosave, migrations, import/export UI, or legacy archive conversion;
- replacing `addThread`, `addDiscovery`, `beginSession`, conclusion, Codex, score, motifs, or another current mutation;
- presentation cues, scene/audio/UI behavior, accessibility behavior, content changes, or dependencies;
- editing accepted identifiers, events, reducer, replay, serialization, or compatibility policy.

## Constraints

- TypeScript strict mode applies; public types are explicit and contain no `any`.
- Use only the already-installed Zustand package; do not add or upgrade dependencies.
- Adapter updates are synchronous, deterministic, atomic, and side-effect free outside the created store.
- Never catch and translate domain validation/transition errors into presentation language.
- Never mutate accepted inputs or expose mutable arrays/objects.
- Do not use wall time, randomness, browser APIs, React, storage middleware, or legacy state.
- Do not create a second persisted source of truth or claim any current path has migrated.

## Acceptance criteria

- The exported vanilla-store factory creates independent empty adapters with the required narrow state/action surface.
- Loading an unknown valid full-session log publishes one rebuilt immutable canonical log and its deeply equal replayed state in one notification.
- Appending the full fixture one event at a time produces the same final log/state as loading and replaying it at once, with exactly one notification per accepted event.
- Invalid loads/appends throw the original typed domain error and preserve prior log/state/action references without notifying subscribers.
- Clear is atomic, preserves old immutable values, and is a no-op when already empty.
- Tests demonstrate deterministic equality, event order, deep immutability, multiple-store isolation, action stability, and non-mutation.
- No legacy store/type, current caller, persistence path, domain contract, gameplay rule, presentation path, content record, browser behavior, or dependency changes.
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
10. focused import inspection confirming `src/state/domainSession/**` has no React, persistence, browser, legacy-store/type, content, game-rule, scene, audio, or UI dependency;
11. focused caller inspection confirming no production module imports or instantiates the adapter;
12. focused rule inspection confirming Zustand delegates validation/replay and cannot update reduced session state independently.

The performance reference is not required because the adapter is not integrated into a runtime path. If any required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- adapter types/factory and operation summary;
- atomicity, subscription, isolation, and immutability tests added;
- all check results;
- confirmation that no current caller, legacy mutation, or persistence path was migrated;
- architecture proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this adapter establishes the state-ownership and atomic publication boundary used by later end-to-end migration tasks. Automated tests are necessary but not sufficient to accept that cutover seam.

## Implementation notes

- None yet.
