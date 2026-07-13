# M1-006 — Remove the replaced legacy session-start surface

## Status

Ready

## Milestone

M1 — Domain foundation

## Dependencies

- M1-005 must be Done.

## Objective

Complete the reviewed session-start cutover by deleting the deprecated `useStore.beginSession` API and its inactive throwing implementation, removing the focused guard test and now-unused type import, and proving that every session start remains owned by the M1-005 runtime coordinator.

This is a cleanup task only. It removes the replaced surface after the canonical path has been accepted; it does not change the coordinator, compatibility projection, domain adapter, session behavior, or another legacy mutation.

## Why this exists

M1-005 deliberately retained one deprecated throwing entry so the first production ownership cutover and its compatibility projection could be reviewed independently. PR #27 is now accepted, all active standard, Daily Draw, and deterministic-test callers use `startSession`, and the exact `main` merge commit passed Quality Gates. Keeping the dead API longer would leave a misleading alternate entry in the legacy store and weaken the architectural guarantee that session-start meaning has one owner.

## Implementation plan

1. Reconfirm PR #27 acceptance, exact-merge CI, all `beginSession` references, all `startSession` callers, and the current persistence boundary.
2. Remove the deprecated `GBGState.beginSession` declaration, throwing implementation, and the import used only by that declaration.
3. Remove only the focused test for the deprecated guard; preserve canonical-start, projection, persistence, store-characterization, and browser coverage.
4. Run the full repository suite and inspect the diff for accidental coordinator, projection, persistence, gameplay, presentation, or task-queue changes.

## Required reading

- `AGENTS.md`;
- `docs/ARCHITECTURE.md`, especially sections 5–7 and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially the `src/state/` migration invariants;
- `docs/DECISIONS.md`, especially ADR-003, ADR-008, and ADR-011;
- `docs/ROADMAP.md`, especially the M1 gate and migration steps 4–6;
- `docs/audits/M0-STATE-MUTATION-MAP.md`;
- `docs/tasks/M1-004-zustand-domain-session-adapter.md`;
- `docs/tasks/M1-005-migrate-session-start.md`.

## Existing code and callers to inspect

- `src/state/store.ts`, including the `GBGState` action surface and persistence middleware;
- `src/runtime/session/**` and `src/state/domainSession/**`;
- `src/runtime/session/startSession.test.ts` and `src/state/store.test.ts`;
- `src/ui/screens/SetupScreen.tsx`, `src/ui/screens/TitleScreen.tsx`, and `src/scene/ThreadingDriver.tsx`;
- deterministic browser and performance-reference tests;
- every repository reference to `beginSession`, `startSession`, and `applySessionStart`.

## Owned scope

- `src/state/store.ts` removal of the deprecated action declaration/implementation and its now-unused import;
- `src/runtime/session/startSession.test.ts` removal of the deprecated-guard test only;
- this task's status and implementation notes.

All coordinator, adapter, projection, caller, persistence, domain, gameplay, scene, audio, UI, content, browser-test, dependency, and deployment code is inspection-only. No other active task may change session-start ownership while M1-006 is active.

## Required removal

Remove exactly:

1. the `DisciplineId` import from `src/state/store.ts` when it is no longer used;
2. the `GBGState.beginSession` function declaration and deprecation comment;
3. the throwing `beginSession` implementation in the Zustand initializer;
4. the focused unit test that invokes the deprecated guard.

Do not rename or replace the symbol with an alias, wrapper, compatibility export, generic setter, no-op, or forwarding function. After this task, `beginSession` must not occur anywhere under active `src/` or `tests/`.

## State and ownership rules

1. `startSession` remains the sole public application entry for standard, daily, and deterministic-test session starts.
2. `createSessionStartCoordinator` remains the sole owner of draw, clock, theme, domain-event, and prepared-projection orchestration.
3. `applySessionStart` remains the narrow legacy presentation projection action until its consumers are migrated in later capabilities.
4. The production `domainSessionStore` remains canonical and non-persisted; no lifecycle, hydration, or repository behavior changes.
5. Removing dead code must not alter active runtime output, notifications, event bytes, session identity, draw order, theme, initial legacy values, or browser snapshot shape.

## Scope

1. Delete the four explicitly listed deprecated artifacts.
2. Preserve all accepted M1-005 production and test boundaries.
3. Update this task's status and implementation notes after validation.

## Out of scope

- changing `startSession`, `createSessionStartCoordinator`, `domainSessionStore`, or `applySessionStart`;
- changing setup, Daily Draw, test-mode, return-to-title, reset, conclusion, or another caller;
- removing the temporary legacy presentation projection or any unrelated legacy action;
- weaving, relation intention, gestures, discoveries, motifs, Attunement, conclusion, or M2 behavior;
- event schema, reducer, replay, serialization, content, persistence, IndexedDB, localStorage configuration, or migration changes;
- scene, audio, UI, accessibility, audiovisual, dependency, bundle-budget, or deployment changes.

## Constraints

- TypeScript strict mode applies and no `any` may be introduced.
- Do not add files, dependencies, replacement abstractions, compatibility shims, or generic store mutation APIs.
- Preserve every accepted M1-005 test except the one whose sole subject is the deleted guard.
- Do not edit generated artifacts or claim a broader legacy-state migration.
- If any active `beginSession` caller or undocumented dependency is found, stop and report it rather than deleting the surface.

## Acceptance criteria

- `beginSession` has no declaration, implementation, caller, test, comment, string, or export under active `src/` or `tests/`.
- `src/state/store.ts` no longer imports `DisciplineId` and its only session-start mutation is the prepared `applySessionStart` projection action.
- Standard, daily, and deterministic-test callers still import and invoke the same runtime `startSession` function.
- The coordinator, canonical domain store, compatibility projection, persistence middleware, and browser snapshot are byte-unchanged by the task.
- Existing deterministic event/session tests, legacy store characterization, persistence exclusion, browser smoke, build, and bundle ceilings pass.
- The diff contains only the declared dead-surface removal plus task status/implementation notes.

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
10. repository scan proving `beginSession` is absent from active `src/` and `tests/`;
11. caller scan proving setup, Daily Draw, and deterministic test mode still use `startSession`;
12. focused diff inspection proving coordinator, adapter, projection, persistence, domain, browser snapshot, and production callers did not change.

The targeted performance reference is not required because only an unreachable throwing guard and its test are removed; no active runtime path changes. If any required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- exact declarations, implementation, import, and test removed;
- all check results;
- zero-reference scan result;
- confirmation that canonical ownership, persistence, callers, and active behavior are unchanged;
- architecture conflicts or human-review items, if any.

## Human review boundary

Human review is required before merge because this cleanup removes the final legacy rollback surface and completes the accepted session-start ownership cutover. Automated checks are necessary but not sufficient to confirm that no undocumented caller depends on the old API.

## Implementation notes

- None yet.
