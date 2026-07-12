# M0-002 — Establish test baseline

## Status

Review

## Milestone

M0 — Trustworthy baseline

## Dependencies

- M0-001 must be Done.

## Objective

Create a reliable unit-test and characterization-test baseline for the current game before domain extraction begins.

## Why this exists

The redesign must preserve valuable current behavior while changing state ownership. Characterization tests provide a safety net for session generation, motifs, persistence, content validation, and other existing rules before they are migrated.

## Required reading

- `AGENTS.md`
- all M0-001 audit deliverables;
- `docs/ARCHITECTURE.md`;
- `docs/CURRENT-STATE-AUDIT.md`.

## Scope

Based on the audit:

- adopt or formalize the lightest suitable TypeScript unit-test runner;
- expose a stable `npm test` command;
- convert any ad hoc logic harness into discoverable automated tests where practical;
- add characterization tests for the highest-risk pure or isolatable rules;
- ensure tests run deterministically and without WebGL/audio hardware;
- document which important behaviors still lack test seams.

Priority areas:

1. seeded session generation;
2. curated-connection lookup and canonical pair IDs;
3. current motif detection and consecration behavior;
4. scoring/rank behavior only as legacy characterization, not endorsement;
5. Annotation determinism;
6. content validation;
7. persistence serialization and restore where isolatable.

## Out of scope

- changing game rules;
- introducing the new event architecture;
- browser/E2E automation;
- dependency major upgrades;
- replacing localStorage;
- visual screenshot tests.

## Constraints

- If a new dev dependency is required, justify it in the PR.
- Tests must not assert implementation details where observable rule behavior is available.
- Legacy characterization tests should be labeled clearly so later tasks know which behavior is intentionally superseded.
- Do not make production behavior changes merely to simplify testing unless an explicit seam is behavior-neutral and documented.

## Acceptance criteria

- `npm test` exists and exits nonzero on failure.
- Tests run from a clean checkout in a non-browser CI environment.
- Seeded generation produces stable expected results.
- Curated pair lookup and duplicate prevention are tested.
- Current motif/consecration logic has regression coverage.
- Content validation has a testable failure fixture or equivalent coverage.
- Nondeterministic time/randomness in tested paths is controlled.
- A test-gap section identifies browser, audio, rendering, and persistence work left for later tasks.

## Required checks

- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`.

## Expected completion report

Report:

- test runner and why selected;
- tests added and legacy behaviors characterized;
- production seams changed, if any;
- uncovered risks;
- exact CI commands recommended for M0-003.

## Human review

Required because the selected harness and characterization boundary shape all later migration work.

## Implementation notes

- Added pinned Vitest 3.2.7 with stable `npm test`, local watch, and standalone content-validation commands.
- Added 24 Node-only characterization tests across six suites for session generation, content/pairs, attempts/scoring, motifs/consecration, ranks/progress, Annotation, Zustand mutations, and persistence partialization/restore.
- Added an optional typed fixture input to `validateContent`; its default production behavior remains unchanged.
- Controlled wall time with fake clocks and recorded the remaining browser, audio, rendering, persistence, and nondeterminism gaps in `docs/audits/M0-VALIDATION-COMMANDS.md`.
- M0-003 remains blocked until this task is reviewed, accepted, merged, and transitioned to Done.
