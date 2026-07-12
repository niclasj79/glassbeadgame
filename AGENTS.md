# Glass Bead Game — Codex Instructions

## Mission

This repository contains a contemplative audiovisual web game inspired by Hermann Hesse's *Glass Bead Game*.

The current target is the vertical slice defined by:

- `docs/MASTER-PLAN.md`
- `docs/VERTICAL-SLICE-SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT-STATE-AUDIT.md`
- `docs/ROADMAP.md`
- the assigned file under `docs/tasks/`

Read the assigned task and all required documents before editing code.

## Product laws

1. The player composes an interpretation; they are not merely guessing hidden correct pairs.
2. Every meaningful action must produce an immediate visual, musical, spatial, or systemic consequence.
3. The experience remains contemplative, legible, and free from time pressure or failure punishment.
4. Documented connections, contested claims, analogies, and Open Threads must remain distinguishable.
5. The game remains playable locally, offline, and without an account.
6. The world is the primary interface; avoid unnecessary persistent HUD.
7. Do not add conventional gamification unless the specification explicitly requires it.
8. Silence or uncertainty is preferable to fabricated significance.

## Technical direction

- TypeScript strict mode.
- React for application UI and accessibility surfaces.
- Three.js through React Three Fiber for the 3D world.
- WebGL2 is the baseline renderer.
- Zustand may expose reactive state, but durable game rules belong in pure TypeScript.
- Durable session state is produced by replaying typed, versioned domain events.
- Rendering, audio, persistence, UI, and shaders do not define independent game rules.
- The Web Audio clock is authoritative for scheduled music.
- IndexedDB is the target durable store; localStorage is limited to small preferences during migration.
- Preserve offline/PWA compatibility.
- Do not introduce a backend dependency for core play.

## Coding rules

- Inspect the existing implementation and all callers before replacing behavior.
- Prefer incremental migration over broad rewrites.
- Do not leave two durable sources of truth after a migration task is complete.
- Do not add a production dependency unless the task requires and justifies it.
- Do not duplicate domain logic in React components, Zustand actions, shaders, audio code, or persistence adapters.
- Do not use React state for per-frame animation.
- Keep public types explicit and avoid `any`.
- Validate authored and persisted data at boundaries.
- Preserve deterministic behavior whenever a seed is supplied.
- Add or update tests for every changed rule.
- Delete obsolete code only after confirming no active path depends on it.
- Do not combine dependency major upgrades with gameplay or architecture changes.

## Task execution protocol

1. Read this file, the assigned task, and its required reading.
2. Inspect all affected existing code, callers, tests, persistence, and presentation consequences.
3. Before editing, write a concise implementation plan in the task/PR context.
4. Implement only the assigned scope.
5. Add or update tests and documentation required by the task.
6. Run every available required check.
7. Review the diff for scope expansion, duplicate state, nondeterminism, and accidental regressions.
8. Update task status and implementation notes only when the task defines that workflow.
9. Open one reviewable PR for one task.
10. Do not begin another roadmap task in the same run.

## Required checks

Use the repository's available equivalents of:

1. dependency installation from lockfile;
2. type checking;
3. linting;
4. unit tests;
5. content validation;
6. production build;
7. relevant Playwright/browser smoke tests;
8. targeted performance checks when required.

Report every check, including any that could not run and the exact reason.

## Human review boundaries

Do not auto-merge or treat automated tests as sufficient for:

- product/specification changes;
- content claims, sources, or evidence classes;
- event-schema compatibility changes;
- persistence migrations;
- accessibility-sensitive interaction changes;
- dependency major upgrades;
- deployment changes;
- audiovisual legibility, comfort, pacing, or artistic quality.

## Task selection for autonomous loops

An autonomous Codex run may select a task only when:

- its status is `Ready`;
- every listed dependency is `Done`;
- no active task owns overlapping files or architectural boundaries;
- the task contains objective acceptance criteria and required checks;
- the task does not require an unresolved product decision.

Create a branch named `codex/<task-id>-<short-name>` unless the repository workflow specifies otherwise. Produce a PR and stop.

## Conflict precedence

1. Assigned task acceptance criteria
2. `docs/VERTICAL-SLICE-SPEC.md`
3. `docs/ARCHITECTURE.md`
4. Accepted architecture decisions
5. `docs/MASTER-PLAN.md`
6. Existing implementation

If authoritative documents conflict, stop and report the conflict rather than silently choosing.

## Specification change protocol

Implementation discoveries do not silently rewrite the design. Record a proposal in implementation notes or an ADR update with:

- discovered problem;
- proposed change;
- affected specifications;
- compatibility impact;
- alternatives considered.

Do not change canonical product behavior within an engineering task unless the task explicitly authorizes it.