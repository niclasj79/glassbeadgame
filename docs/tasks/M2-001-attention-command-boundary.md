# M2-001 — Add the canonical Attend command boundary

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M1-006 must be Done.

## Objective

Add a small, injectable application-runtime command that records one attended concept through the accepted schema-version-1 `bead.attended` event and the canonical domain-session adapter.

This task establishes the first M2 command seam only. It does not integrate pointer, touch, keyboard, controller, React, scene, audio, legacy focus state, resonance preview, pair selection, relation declaration, weaving, or cancellation behavior.

## Why this is first

The accepted domain contract already defines `bead.attended`, `SessionStateV1.attendedConceptId`, reducer validation, deterministic event identity, validated replay, and atomic adapter append. The first M2 step can therefore exercise the architecture's Input → Command → Event → Reducer path without inventing a new event, changing product behavior, or coupling domain meaning to presentation.

The current `focusedBeadId`, `pinnedInspectId`, hover, dwell, and press behavior remains a legacy presentation concern. Connecting those paths requires accessibility-sensitive mouse, touch, and keyboard decisions and belongs in a separately specified task after this command boundary is accepted.

## Implementation plan

1. Reconfirm the accepted attention event, reducer transition, adapter append semantics, session-start composition, and current legacy focus/input paths.
2. Define a narrow injectable Attend command factory with an explicit no-active-session error and exact published result.
3. Construct one `bead.attended` event from the current canonical session identity, next sequence, one injected clock read, and requested concept ID; publish only through the adapter's accepted append action.
4. Add focused tests for success, deterministic identity, replacement of attended state, unknown concepts, missing/concluded sessions, clock regression, atomic failure, notifications, and input non-mutation.
5. Run the full repository suite and inspect the diff for duplicated reducer rules, production integration, persistence, presentation coupling, event-schema drift, or accidental later-M2 work.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially Perception and the core loop;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 6–9, 19, 22, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially the `src/state/` and `src/scene/` migration risks;
- `docs/DECISIONS.md`, especially ADR-003, ADR-008, and ADR-011;
- `docs/ROADMAP.md`, especially the M1 gate, M2 work/gate, and unsafe parallelism;
- `docs/PLAYTEST-PLAN.md`, especially the M2 hypotheses and director decision boundaries;
- `docs/INTERACTION-DECISIONS.md`, especially the state-layer separation and M2-001 non-blocking boundary;
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, as reference context only; no content or audiovisual behavior is owned by this task;
- `docs/audits/M0-STATE-MUTATION-MAP.md`;
- `docs/tasks/M1-001-stable-domain-identifiers-and-events.md` through `M1-006-remove-legacy-session-start.md`.

## Existing code and callers to inspect

- `src/domain/events/**`, especially `bead.attended` construction and validation;
- `src/domain/model/**` and `src/domain/reducer/**`, especially attention state and transition failures;
- `src/domain/replay/**` and `src/state/domainSession/**`, especially validated atomic append;
- `src/runtime/session/**`, including production session identity, clock, and adapter composition;
- `src/state/store.ts`, `src/state/types.ts`, and current persistence tests;
- `src/scene/threading.ts`, `src/scene/Beads.tsx`, `src/ui/arena/BeadInspectCard.tsx`, and every focus/inspection caller;
- deterministic browser and performance-reference tests.

## Owned scope

- new command files and focused unit tests under `src/runtime/commands/attention/**`;
- this task's status and implementation notes.

All domain events, IDs, model, reducer, replay, adapter implementation, session-start code, production composition, legacy store, persistence, scene, audio, UI, input, content, browser tests, dependencies, and deployment code is inspection-only. No other active task may introduce or integrate an Attend command while M2-001 is active.

## Required command contract

Provide an application boundary equivalent to:

```ts
interface AttendConceptCommandDependencies {
  readonly domainStore: DomainSessionStore;
  readonly now: () => number;
}

interface AttendConceptResult {
  readonly event: Extract<SessionEventV1, { type: "bead.attended" }>;
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
}

createAttendConceptCommand(
  dependencies: AttendConceptCommandDependencies,
): (conceptId: ConceptId) => AttendConceptResult;
```

Names may vary if the public boundary remains equally narrow. Do not export a production singleton or connect a current caller in this task.

## Required operation semantics

1. Read the adapter once to require a matching active canonical event log and reduced session before calling the clock.
2. If no active session exists, throw an explicit typed command error, do not call the clock, publish nothing, and notify no subscriber.
3. Read the injected clock exactly once for an accepted attempt.
4. Create one immutable `bead.attended` event through `createSessionEvent` using the current session ID, `lastSequence + 1`, captured time, and supplied concept ID.
5. Publish only through the adapter's existing `appendEvent`; do not validate membership, lifecycle, time ordering, identity, or sequence again in the command.
6. Let accepted event/replay/reducer errors propagate without translation. Unknown concepts, concluded sessions, regressed time, forged IDs, or other invalid transitions leave the adapter unchanged with no notification.
7. On success, return the created event and the exact immutable event-log/state references exposed by the adapter after its one atomic update.
8. Repeated valid Attend commands append in order and replace only `attendedConceptId` through the accepted reducer; they do not clear pair, hypothesis, threads, outcomes, motifs, Attunement, or conclusion state beyond existing reducer semantics.

## State and ownership rules

1. The event log remains canonical and the reduced session remains derived.
2. The command owns orchestration only: current identity/sequence capture, one clock read, event construction, adapter append, and result publication.
3. Domain constructors, decoder/replay, reducer, and adapter retain all validation and transition ownership.
4. The command does not read or write `focusedBeadId`, `pinnedInspectId`, legacy interaction mode, frame state, React state, or browser globals.
5. No new persistence key, database, snapshot, hydration path, or second session owner is introduced.
6. This task records Attend because that event and replay behavior are already accepted. It does not define attention cancellation, dwell thresholds, resonance strength, or accessible input mapping.

## Out of scope

- changing any accepted event payload, identifier, reducer transition, replay rule, adapter action, or session-start behavior;
- production command composition or integration with pointer, hover, dwell, long press, touch, keyboard, controller, test mode, or React;
- clearing/cancelling attention or changing legacy focus/inspection behavior;
- candidate resonance, pair selection, relation intention, gesture capture, thread commit, documented outcomes, Open Threads, motifs, Attunement, or conclusion;
- presentation cues, scene/audio/camera/UI/accessibility behavior, content, persistence, dependencies, performance budgets, or deployment.

## Constraints

- TypeScript strict mode applies; public types are explicit and contain no `any`.
- Do not add or upgrade dependencies.
- Use only accepted constructors and adapter actions; do not duplicate transition rules or mutate adapter state directly.
- The factory is deterministic for identical injected store/clock inputs and has no import-time side effects.
- Do not use `Date.now`, `performance.now`, randomness, browser APIs, React, Three.js, Web Audio, storage, or the legacy store.
- If implementation requires changing cancellation semantics, event vocabulary, reducer behavior, accessibility interaction, or presentation, stop and record a proposal rather than expanding scope.

## Acceptance criteria

- The isolated factory exposes the narrow dependency, command, result, and typed missing-session error contracts.
- A valid command appends exactly one canonical `bead.attended` event with the current identity, next sequence, one captured time, and requested concept ID.
- The adapter emits exactly one notification and exposes the returned exact immutable log/state references; replay yields the requested `attendedConceptId`.
- Consecutive valid commands are deterministic, ordered, and use accepted reducer semantics.
- Missing sessions and reducer/replay rejections leave prior log/state/action references and subscriber counts unchanged; the original typed failures remain inspectable.
- Tests prove clock-call counts, event identity, sequence/time mapping, atomicity, non-mutation, action stability, and absence of forbidden dependencies.
- No production caller, event schema, reducer rule, adapter implementation, legacy state, persistence, presentation, browser behavior, content, dependency, or deployment changes.
- Typecheck, lint, unit tests, content validation, production build, bundle check, deterministic browser smoke, and focused inspections pass.

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
10. focused import scan proving `src/runtime/commands/attention/**` has no React, scene, audio, UI, browser, storage, content, game-rule, legacy-store, or production-composition dependency;
11. focused caller scan proving no production module imports or instantiates the command;
12. focused ownership scan proving validation remains in the accepted event/replay/reducer/adapter boundaries and the command reads its clock once.

The targeted performance reference is not required because the command remains unintegrated and no active runtime path changes. If any required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- command factory, types, and missing-session error added;
- exact event and adapter mapping;
- deterministic, atomicity, failure, notification, and non-mutation tests;
- all check results and focused scan results;
- confirmation that no production, persistence, presentation, accessibility, or later-M2 path changed;
- architecture proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this establishes the first reusable post-start command boundary over the canonical event log. Automated checks are necessary but not sufficient to accept the orchestration seam or the deliberate absence of production input integration.

## Implementation notes

- Added an isolated `createAttendConceptCommand()` factory under `src/runtime/commands/attention/` with explicit dependency, result, attended-event, command, and typed `no-active-session` error contracts. No production singleton or caller was added.
- The command reads the canonical adapter once before the clock, captures the injected clock exactly once, constructs one accepted schema-version-1 `bead.attended` event from the current session identity and next sequence, and publishes only through the adapter's stable `appendEvent` action. It returns the created event plus the exact immutable log/state references published by that atomic update.
- Domain constructors, replay validation, the reducer, and the adapter retain all validation ownership. Missing canonical state fails before the clock; unknown concepts, concluded sessions, time regression, and invalid captured time propagate the accepted typed failures without translation or partial publication.
- Added 8 focused tests covering exact event identity/sequence/time mapping, deep immutability, one notification, action/reference stability, byte determinism, consecutive attention replacement, preservation of provisional pair/hypothesis and committed thread/outcome/motif state, input non-mutation, missing sessions, unknown concepts, concluded sessions, clock regression, and event-construction failure.
- No production composition, input, React, legacy focus/inspection state, scene, audio, UI, persistence, content, browser behavior, accepted domain contract, adapter implementation, dependency, or deployment path changed. Focused scans found no forbidden production dependency and no production import or instantiation of the command; the command contains one clock read, one event construction, and one adapter append with no duplicated validation/reducer rule.
- Required validation passed: clean lockfile install with zero vulnerabilities; typecheck; lint; 14 unit-test files with 122 tests; 3 content-validation tests; production build; bundle ceilings at 2,422,418 raw bytes / 1,270,711 gzip bytes total and 1,581,776 raw / 465,775 gzip JavaScript bytes; 3 deterministic browser tests; `git diff --check`; and all focused dependency, caller, and ownership scans. The existing `three-mesh-bvh@0.7.8` deprecation and established large-chunk build notices remain unchanged.
- The targeted performance reference was not required because the command remains unintegrated and no active runtime path changes. Human review remains required for this first reusable post-start command seam; no architecture conflict, compatibility exception, or specification proposal was discovered.
