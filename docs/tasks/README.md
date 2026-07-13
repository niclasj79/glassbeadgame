# Codex Task Index

## Current steering status

See `../CODEX-STEERING-READINESS.md`.

## Status definitions

- Draft — insufficiently specified;
- Blocked — waiting on dependency or decision;
- Ready — may be assigned;
- In progress — active branch/PR exists;
- Review — implementation complete, awaiting acceptance;
- Done — accepted and merged;
- Superseded — intentionally replaced.

## Selection protocol

Codex may select only the first Ready task whose dependencies are Done and whose declared architectural/file scope does not overlap active work. One run produces one branch and one PR, then stops.

## Current milestone

M1 — Domain foundation

## Ready queue

None while M1-003 is in review.

## In review

1. `M1-003-replay-and-serialization.md` — validated canonical event-log serialization and deterministic domain replay.

## Blocked queue

None.

## Completed

1. `M0-001-repository-audit.md` — accepted and merged in PR #6.
2. `M0-002-test-baseline.md` — accepted and merged in PR #8.
3. `M0-003-ci-pipeline.md` — accepted and merged in PR #10.
4. `M0-004-deterministic-test-mode.md` — accepted and merged in PR #12.
5. `M0-005-performance-bundle-baseline.md` — accepted with initial bundle budgets and merged in PR #14.
6. `M0-006-dependency-upgrade-decision.md` — accepted and merged in PR #16; authorized isolated Vite remediation next.
7. `M0-007-vite-security-upgrade.md` — accepted and merged in PR #17; Vite/esbuild advisories cleared.
8. `M1-001-stable-domain-identifiers-and-events.md` — accepted and merged in PR #19; also completed the recorded low-risk steering dry run.
9. `M1-002-pure-session-reducer.md` — accepted and merged in PR #21; established the immutable schema-version-1 session model and exhaustive pure reducer.

## Planned but not yet Ready

- M1-004 Zustand adapter;
- M1-005 migrate one current interaction;
- M1-006 remove replaced mutation path.

## Ownership rules

A task must declare the directories or architectural boundaries it expects to modify. Tasks that overlap cannot run concurrently unless both task files explicitly authorize it.

## Completion rules

A task becomes Done only when:

- acceptance criteria are demonstrated;
- required checks pass or an explicit accepted exception exists;
- the PR is reviewed and merged;
- task status and implementation notes are updated;
- newly discovered architectural decisions are recorded rather than buried in code.

## Task packet template

Every task contains:

- status and dependencies;
- objective and rationale;
- required reading;
- existing code to inspect;
- scope and exclusions;
- constraints;
- acceptance criteria;
- required tests and checks;
- expected completion report;
- human-review requirements.
