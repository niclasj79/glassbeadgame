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

1. `M2-010-deterministic-thread-identity.md` — derive one stable,
   session-namespaced, collision-safe thread ID from the canonical reduced
   session without time, randomness, persistence, or a production caller.

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
14. `M2-001-attention-command-boundary.md` — accepted and merged in PR #32; established the isolated canonical Attend command seam without production input integration.
15. `M2-002-candidate-resonance-model.md` — accepted and merged in PR #34; established the pure complete-candidate, non-spoiling weak/medium/high resonance evaluator.
16. `M2-003-ephemeral-interpretation-draft.md` — accepted and merged in PR #36; established the isolated immutable Attend → arm intention → select candidate draft and accepted pre-weave cancellation transitions.
17. `M2-004-atomic-interpretation-commit.md` — accepted and merged in PR #38; established one validated atomic pair → hypothesis → thread publication boundary.
18. `M2-005-deterministic-gesture-profile.md` — accepted and merged in PR #40; established deterministic normalized pointer and honest hold-only gesture profiles.
19. `M2-006-reactive-interpretation-draft-adapter.md` — accepted and merged in
    PR #42; established the isolated reactive owner for the accepted ephemeral
    interpretation draft.
20. `M2-007-interpretive-attention-coordinator.md` — accepted and merged in PR
    #44; established one headless coordinator for canonical Attend, complete
    candidate resonance, and reactive draft publication.
21. `M2-008-interpretation-commit-coordinator.md` — accepted and merged in PR
    #46; established one headless coordinator for exact gesture construction,
    atomic interpretation commit, and post-success reactive draft reset.
22. `M2-009-provisional-resonance-evidence.md` — accepted and merged in PR #48;
    established the deterministic private six-fixture evidence resolver with
    complete canonical candidate coverage and no production caller or final
    content claim.

## Planned but not yet Ready

Tasks after M2-010 are not yet Ready. Production composition must remain in the
same separately reviewed cutover packet that owns active input arbitration and
placeholder presentation, as required by M2-007 and M2-008. Browser capture,
input-equivalent controls, and camera/audio/UI work must respect their personal
device, comfort, accessibility, and artistic-quality human-review boundaries.

## Director design companions

- `../PLAYTEST-PLAN.md` — milestone hypotheses, observation protocol, proposed success criteria, and playtest decisions `P-001` through `P-008`;
- `../INTERACTION-DECISIONS.md` — attention, inspection, cancellation, relation-choice, gesture, and input-equivalence decisions `I-001` through `I-013`;
- `../CONTENT-AUDIOVISUAL-REFERENCE.md` — representative pairs, provisional relation grammar, resonance boundaries, and content/audiovisual decisions `CAV-001` through `CAV-010`.

Director decisions `CAV-001` through `CAV-004`, `I-001` through `I-013`, and
`P-001` through `P-005` are accepted. The attended-viewpoint/directional-sweep,
armed-intention, and camera-performance metaphors in
`INTERACTION-DECISIONS.md` are binding design guidance with their stated
non-combat, accessibility, comfort, and durable-state guardrails. P-001 through
P-004 establish director self-play as the primary evidence source and make
feedback from acquaintances optional and informal. Other unanswered decisions
continue to block only the later task types named in their records.

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
