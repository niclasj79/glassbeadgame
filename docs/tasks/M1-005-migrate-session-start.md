# M1-005 — Migrate session start to the canonical domain adapter

## Status

Done

## Milestone

M1 — Domain foundation

## Dependencies

- M1-001 must be Done.
- M1-002 must be Done.
- M1-003 must be Done.
- M1-004 must be Done.

## Objective

Migrate the existing standard, daily, and deterministic-test session-start interaction through one application-runtime coordinator that initializes the accepted domain-session adapter with a canonical `session.started` event and publishes the existing non-persisted session shape only as a temporary presentation compatibility projection.

This is the first production integration of the M1 event log. It migrates session-start meaning only. It does not migrate weaving, relation intention, discoveries, motifs, conclusion, persistence, or another current mutation.

## Why this path is first

All three active session-start callers already converge on `useStore.beginSession`, and the accepted `session.started` event can represent the existing deterministic draw without inventing a new player decision. Migrating weave commit first would require the M2 relation-intention interaction that the current UI does not yet provide. Session start therefore provides an objective end-to-end cutover seam while preserving current play and leaving the richer interaction redesign in its assigned milestone.

The current legacy store still has to supply a presentation-compatible session object while scene, audio, UI, and later mutations are migrated incrementally. That object is not persisted today. In this task it becomes an explicitly derived compatibility projection for session-start fields; the canonical fact for the migrated operation is the validated event log. M1-006 will remove the now-unused legacy `beginSession` mutation surface after this cutover is reviewed.

## Implementation plan

1. Characterize the three active start callers, deterministic draw, theme selection, clock use, legacy persistence behavior, and browser-test snapshot.
2. Add a small injectable runtime coordinator that draws once, captures time once, creates and validates one `session.started` event, and prepares the legacy presentation projection without publishing partial state.
3. Compose one production domain-session store instance at the runtime boundary and route standard, daily, and deterministic-test starts through the coordinator.
4. Narrow the legacy store to a projection-application action for the prepared session; leave the old `beginSession` surface unused and explicitly deprecated for M1-006 removal.
5. Add focused unit and browser coverage proving deterministic parity, canonical event ownership, failure atomicity, caller cutover, and unchanged persistence/presentation behavior.
6. Run the full repository suite and inspect the diff for duplicate draws, clocks, session-start rules, persisted sources, active legacy callers, nondeterminism, and accidental M2 work.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially protected qualities and technical success criteria;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 5–10, 20, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 11, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially the current Zustand migration risk;
- `docs/DECISIONS.md`, especially ADR-003 and ADR-008;
- `docs/ROADMAP.md`, especially the M1 gate, M2 boundary, migration order, and unsafe parallelism;
- `docs/audits/M0-STATE-MUTATION-MAP.md` and `docs/audits/M0-PERSISTENCE-MAP.md`;
- `docs/tasks/M1-001-stable-domain-identifiers-and-events.md` through `M1-004-zustand-domain-session-adapter.md`.

## Existing code and callers to inspect

- `src/state/store.ts`, `src/state/types.ts`, and `src/state/store.test.ts`;
- `src/state/domainSession/**`;
- `src/domain/ids.ts`, `src/domain/events/**`, `src/domain/model/**`, `src/domain/reducer/**`, and `src/domain/replay/**`;
- `src/game/session.ts` and its tests;
- `src/themes/index.ts`, the world registry, and current theme consumers;
- `src/runtime/testMode.ts` and its tests;
- `src/ui/screens/SetupScreen.tsx` and `src/ui/screens/TitleScreen.tsx`;
- `src/scene/ThreadingDriver.tsx`, its `startTestSession` adapter, and deterministic browser smoke tests;
- all current selectors and subscribers of `phase`, `session`, and session-start fields;
- all direct callers of `beginSession` and any direct external store writes.

## Owned scope

- new session-start coordination files under `src/runtime/session/**`;
- production composition/export of one domain-session store under `src/state/domainSession/**`;
- the session-start action boundary in `src/state/store.ts` and its explicit public type;
- the three active session-start callers in `SetupScreen`, `TitleScreen`, and `ThreadingDriver`;
- focused unit tests for the coordinator, adapter composition, and legacy projection;
- the existing deterministic browser smoke needed to prove the migrated path;
- this task's status and implementation notes.

All weave/commit code, relation behavior, content claims, audio/scene cues, persistence configuration, conclusion/archive logic, and unrelated legacy actions are inspection-only. No other active task may change session-start ownership, the domain adapter singleton, or the legacy session initialization path while M1-005 is active.

## Required runtime contract

Provide an application boundary equivalent to:

```ts
interface StartSessionOptions {
  readonly seed?: number;
  readonly daily?: boolean;
}

interface SessionStartResult {
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
}

startSession(
  picks: readonly DisciplineId[],
  options?: StartSessionOptions,
): SessionStartResult;
```

The coordinator may use an injected factory internally for tests, but production callers receive one stable function and do not access draw, clock, event creation, adapter mutation, or the legacy projection separately.

## Required operation semantics

### Prepare once

- Validate the existing two-or-three distinct-discipline precondition at the runtime boundary before changing either store.
- Call `drawSession` exactly once.
- Read `gameNow` exactly once for the session start.
- Select the current theme exactly once from the completed draw and daily flag.
- Derive every domain and compatibility value from those captured results; do not independently redraw, reread time, or recalculate a possibly different theme in separate stores.

### Canonical event

- Create one schema-version-1 `session.started` event with sequence `0` through `createSessionEvent`.
- Use the drawn numeric seed's canonical decimal string as the domain seed.
- Derive a non-empty deterministic session ID from the captured start time and drawn seed. Identical injected inputs must produce the same ID and event ID.
- Use an explicit migration content-pack version constant `legacy-content.v1`; do not imply that the current authored content has completed the later content-pack migration.
- Use the selected current theme ID as the event world ID.
- Convert the drawn bead IDs, in their existing order, through `toConceptId` without renaming, sorting, or filtering.
- Validate the complete one-event log through the accepted replay boundary before publishing it.

### Atomic publication

- Prepare and validate the domain event/log and complete legacy compatibility projection before publishing either.
- Replace the domain adapter's prior log with the validated one-event log in one adapter update; starting a new session must not append to the prior session.
- Publish the legacy compatibility projection through one narrow store action that accepts the prepared projection and owns no draw, clock, theme, event, or domain rule.
- A preparation or domain-validation failure leaves both stores unchanged and emits no subscriber notification.
- The coordinator must not catch and translate typed domain errors.
- The returned log and state must be the exact immutable values exposed by the production domain adapter after publication.

### Current behavior parity

- Standard setup, Daily Draw, and deterministic test-mode starts all use the same coordinator.
- The current legacy session fields remain observably equal for identical controlled inputs: seed, disciplines, bead order, empty thread/discovery/motif collections, score, start time, interaction, curated count, Insight, daily flag, and theme ID.
- The existing phase transition, scene rendering, audio setup, current-session persistence exclusion, and deterministic browser snapshot remain unchanged.
- The domain adapter is empty before the first start and contains exactly one matching `session.started` event afterward.

## State and ownership rules

1. The domain event log is canonical for session ID, seed, content version, world, concept membership/order, and start time after this task.
2. The legacy session object is a temporary non-persisted presentation compatibility projection. Its start fields are prepared from the same captured values and are not independently generated.
3. The runtime coordinator owns orchestration only. Domain constructors, decoder/replay, the existing deterministic draw, and the existing theme registry retain their current responsibilities.
4. No React component, Three.js module, audio module, or legacy Zustand action may construct a domain session event directly.
5. No caller may invoke `useStore.beginSession` after the cutover. The unused legacy surface remains only for the separately reviewed M1-006 deletion task.
6. No second persisted event log, snapshot, localStorage key, IndexedDB database, or hydration path is introduced.

## Scope

1. Add the injectable session-start coordinator and one production composition.
2. Instantiate one production domain-session store at the application runtime boundary.
3. Route all three current start paths through the coordinator.
4. Convert legacy initialization into a narrow prepared-projection application step without changing its observable values.
5. Add focused tests and extend the deterministic browser snapshot with canonical domain-session evidence available only through the existing development test adapter.
6. Mark the legacy `beginSession` surface unused/deprecated and reserve its deletion for M1-006.

## Out of scope

- weaving, pair selection, relation intention, gesture capture, thread commit, outcome resolution, motifs, Attunement, or conclusion;
- changing draw probabilities, seeded content, daily seed behavior, theme selection, initial Insight, score, or legacy presentation fields;
- adding the M2 interaction loop or mapping current curated/faint outcomes to Echo, Passage, Tension, or Ground;
- persistence, autosave, import/export, IndexedDB, event-log hydration, archives, Codex conversion, or legacy progress migration;
- changing accepted domain identifiers, event schemas, reducer rules, replay, serialization, or compatibility policy;
- changing scene, audio, camera, accessibility, content, or audiovisual behavior;
- deleting the old `beginSession` surface or unrelated legacy mutations;
- dependencies, deployment, service-worker, or bundle-budget changes.

## Constraints

- TypeScript strict mode applies; public types are explicit and contain no `any`.
- Do not add or upgrade dependencies.
- Preserve deterministic behavior for supplied seeds and controlled clocks.
- Do not use React state for domain or compatibility session ownership.
- Do not import presentation modules into domain or adapter code.
- Do not add a generic external Zustand setter or expose mutable domain values.
- Do not persist the reduced domain state or the temporary compatibility projection.
- Record any discovered need to alter product behavior, event vocabulary, content identity, or persistence as a proposal and stop rather than silently expanding scope.

## Acceptance criteria

- Standard, daily, and deterministic test session starts have no active direct `beginSession` call and all use one runtime coordinator.
- One draw, one clock read, and one theme selection produce one validated `session.started` event and the matching legacy projection.
- The production domain adapter atomically exposes exactly that one-event canonical log and replayed immutable state after each start.
- Starting a second session replaces rather than extends the prior domain log.
- Invalid input or preparation/validation failure preserves both stores and subscriber counts.
- Controlled inputs produce byte-identical serialized event logs and deeply equal domain/legacy start projections across fresh test instances.
- Existing legacy session-start values, UI transition, Daily Draw behavior, current persistence envelope, and deterministic browser behavior remain unchanged.
- Tests prove caller cutover, canonical ownership, isolation from persistence, non-mutation, action stability, and deterministic parity.
- No weave, relation, gameplay, content, persistence, presentation, dependency, or deployment behavior changes.
- Typecheck, lint, unit tests, content validation, production build, bundle check, deterministic browser smoke, and the targeted performance reference all pass.

## Required checks

1. `npm ci`;
2. `npm run typecheck`;
3. `npm run lint`;
4. `npm test`;
5. `npm run validate:content`;
6. `npm run build`;
7. `npm run bundle:check`;
8. `npm run test:browser`;
9. `npm run measure:performance` because a production runtime path changes;
10. `git diff --check`;
11. focused caller inspection proving no active `beginSession` caller remains;
12. focused import inspection proving domain modules remain framework/platform independent and the runtime coordinator does not import scene, audio, or UI;
13. focused persistence inspection proving no new storage key/database, persisted event log, or reduced-state persistence;
14. focused ownership inspection proving draw/time/theme/event construction occurs once in the runtime coordinator and the legacy projection action cannot create domain meaning.

If a required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- coordinator, production composition, and caller-cutover summary;
- exact canonical event and compatibility projection mapping;
- deterministic, atomicity, persistence, and browser tests added or updated;
- all check and targeted performance results;
- confirmation that no weave/M2 behavior or persistence path changed;
- the exact deprecated legacy surface reserved for M1-006;
- architecture proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this task introduces the first production owner of canonical domain-session state and changes the session-start state-ownership boundary. Automated tests are necessary but not sufficient to accept the temporary legacy projection or cutover seam.

## Implementation notes

- Added an injectable application-runtime coordinator that validates two-or-three distinct disciplines, performs exactly one draw, clock read, and theme selection, then prepares one schema-version-1 `session.started` event plus the complete legacy presentation projection from those captured values.
- Added the explicit `legacy-content.v1` migration content-pack marker, deterministic `session:<startedAt>:<seed>` identity, canonical decimal seed, selected theme/world ID, and ordered branded concept IDs. The complete one-event log is rebuilt and replay-validated before publication.
- Added one runtime-owned, deliberately non-persisted domain-session store. Each start replaces its prior log atomically through the accepted adapter and returns the exact immutable log/state references exposed by that store.
- Added the narrow legacy `applySessionStart` projection action. It performs no draw, clock, theme, event, or domain work, clones the prepared compatibility values, and preserves the existing arena transition and initial live-session fields. The old `beginSession` entry remains only as an unused deprecated guard reserved for M1-006 deletion.
- Routed setup, Daily Draw, and deterministic test-mode starts through the single stable runtime `startSession` function. No active production or browser-test caller invokes `beginSession`.
- Extended the development-only browser snapshot with canonical event count, session ID, seed, world, and concept order. The existing real weave still follows its unchanged legacy path and remains outside this task.
- Added 8 focused coordinator/composition tests covering one-time dependency calls, exact event/projection mapping, input non-mutation, byte determinism across fresh stores, replacement rather than append, invalid-input and preparation-failure atomicity, exact production references, persistence exclusion, and the deprecated guard. Updated the legacy store characterization tests to start through the migrated runtime path.
- No event schema, reducer, replay, draw, theme, gameplay, weave, relation, content, persistence, scene/audio behavior, dependency, or deployment contract changed. No storage key/database or persisted domain snapshot was added.
- Required validation passed: clean lockfile install with zero vulnerabilities; typecheck; lint; 13 unit-test files with 115 tests; 3 content-validation tests; production build; bundle ceilings at 2,422,517 raw bytes / 1,270,758 gzip bytes total and 1,581,875 raw / 465,817 gzip JavaScript bytes; 3 deterministic browser tests; `git diff --check`; and focused caller, import, persistence, and ownership inspections. The existing `three-mesh-bvh@0.7.8` deprecation and established large-chunk build notices remain unchanged.
- The required targeted performance reference passed both profiles on local SwiftShader: desktop-base sampled 22 frames with 249.7 ms median / 330.0 ms p95, and mobile-potato sampled 52 frames with 109.5 ms median / 171.3 ms p95. These software-renderer measurements are recorded as environment evidence, not hardware or human audiovisual acceptance.
- Human review remains required for the first production canonical-session ownership cutover and its temporary legacy presentation projection. No architecture conflict or additional specification proposal was discovered.
- Accepted and merged in PR #27 on 2026-07-13. The exact `main` merge commit `243e15f` passed the complete Quality Gates workflow in CI run `29270714954`.
