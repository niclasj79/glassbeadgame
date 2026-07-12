# M0-001 — Repository architecture and mutation audit

## Status

Done

## Milestone

M0 — Trustworthy baseline

## Dependencies

None.

## Objective

Produce an evidence-backed current-state map of the repository before architecture migration begins.

## Why this exists

The repository already contains valuable systems and hidden coupling. Codex must identify actual state ownership, mutation paths, persistence schemas, event-like behaviors, tests, deployment, and audiovisual synchronization before replacing anything.

## Required reading

- `AGENTS.md`
- `docs/MASTER-PLAN.md`
- `docs/VERTICAL-SLICE-SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT-STATE-AUDIT.md`
- `docs/DECISIONS.md`

## Scope

Inspect and document:

1. repository tree and package scripts;
2. application entry points and screen/state transitions;
3. every Zustand store slice, action, selector, and persistence key;
4. every durable mutation call site;
5. current session generation, scoring, motif, rank, Lens, conclusion, and Annotation logic;
6. pointer/touch/keyboard interaction paths;
7. audio lifecycle, clock, scheduling, and visual synchronization;
8. scene subscriptions, camera triggers, reveal effects, and frame-state ownership;
9. content schemas, validators, connection indexing, and ID stability;
10. localStorage schema and migration exposure;
11. tests or logic harnesses and how they run;
12. GitHub Actions, Pages deployment, base path, and environment assumptions;
13. current accessibility mechanisms;
14. bundle and asset structure discoverable without adding new tooling.

## Deliverables

Create or update:

- `docs/audits/M0-REPOSITORY-MAP.md`;
- `docs/audits/M0-STATE-MUTATION-MAP.md`;
- `docs/audits/M0-PERSISTENCE-MAP.md`;
- `docs/audits/M0-VALIDATION-COMMANDS.md`.

Each map must cite concrete repository paths, exported symbols, and call paths rather than summarizing from README prose.

## Constraints

- Do not change gameplay behavior.
- Do not add dependencies.
- Do not refactor production code.
- Small documentation-only comments are out of scope unless essential to correct a false statement.
- Do not assume the existing `CURRENT-STATE-AUDIT.md` is exhaustive; verify it.

## Acceptance criteria

- Every durable state mutation path has an identified owner and caller set.
- Every localStorage key and serialized shape is documented.
- The current logic-test or harness command is identified and actually run.
- Build-time content validation is traced to its invocation.
- GitHub Pages deployment flow and Vite base path are documented.
- Audio-clock and camera/reveal synchronization paths are mapped.
- The audit explicitly lists migration hazards and safe seams.
- No production behavior changes appear in the diff.

## Required checks

Run and report, without silently fixing unrelated failures:

- dependency installation from lockfile;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- every discovered test or logic-harness command.

## Expected completion report

Summarize:

- documents added;
- commands and outcomes;
- highest-risk couplings;
- missing tests;
- recommended exact scope for M0-002;
- any conflict between current code and canonical specifications.

## Human review

Required before merge because this audit defines the basis for later autonomous work.

## Implementation notes

- Completed by PR #6 and merged to `main` on 2026-07-12.
- Added the repository, state-mutation, persistence, and validation-command maps under `docs/audits/`.
- Recorded the missing automated test baseline, pull-request validation, deterministic browser mode, and performance budgets for follow-up M0 tasks.
