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

M2 — New interaction loop

## Ready queue

1. `M2-001-attention-command-boundary.md` — add an isolated canonical Attend command over the accepted event/reducer/adapter contracts.

## In review

None.

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
10. `M1-003-replay-and-serialization.md` — accepted and merged in PR #23; established validated canonical serialization and deterministic replay.
11. `M1-004-zustand-domain-session-adapter.md` — accepted and merged in PR #25; established the isolated reactive adapter over the canonical event log and reduced session state.
12. `M1-005-migrate-session-start.md` — accepted and merged in PR #27; migrated standard, Daily Draw, and deterministic-test starts through the canonical domain adapter.
13. `M1-006-remove-legacy-session-start.md` — accepted and merged in PR #29; removed the final deprecated legacy session-start surface and closed the accepted cutover.

## Planned but not yet Ready

M2-002 candidate resonance model sequencing begins only after M2-001 is accepted, the applicable `CAV-001` through `CAV-004` director decisions are reviewed, and a reviewed task packet defines its content inputs and non-spoiler contract.

## Director design companions

- `../PLAYTEST-PLAN.md` — milestone hypotheses, observation protocol, proposed success criteria, and playtest decisions `P-001` through `P-008`;
- `../INTERACTION-DECISIONS.md` — attention, inspection, cancellation, relation-choice, gesture, and input-equivalence decisions `I-001` through `I-013`;
- `../CONTENT-AUDIOVISUAL-REFERENCE.md` — representative pairs, provisional relation grammar, resonance boundaries, and content/audiovisual decisions `CAV-001` through `CAV-010`.

Unanswered director decisions do not authorize Codex to infer product behavior. They block only the task types named in each record. M2-001 remains eligible because it is an isolated command seam with no production input, content, or presentation integration.

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
