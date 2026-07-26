# M0-008 — Establish steering harness v2

## Status

Review

## Milestone

M0 — Trustworthy delivery infrastructure (steering maintenance; this does not
reopen or weaken the completed M0 product gate)

## Dependencies

- M0-003, M0-004, M0-005, and M0-007 must be Done.
- M1-001 must be Done so task IDs and repository validation have a stable
  baseline.
- `docs/CODEX-STEERING-READINESS.md` must remain `READY`.
- The selected base must be exact, protected `main`, its Quality Gates must
  pass, and no open pull request may own the steering/tooling boundary.
- M2-011 is not a dependency. It remains in Review until the director records
  the P-005 physical-device and qualitative acceptance gate; this infrastructure
  task must not infer or claim that acceptance.

## Objective

Replace the prose-only steering preflight with one deterministic, read-only,
repository-local harness that can carry an authorized Codex run from task
selection through a complete execution contract without repeated orientation
questions.

The harness must:

1. validate the task index and active task packets fail-closed;
2. select only the first eligible Ready task in declared queue order;
3. emit a complete human-readable or JSON run contract containing the task,
   branch, dependencies, required reading, ownership, checks, human-review
   categories, evidence limitations, and PR stop boundary;
4. distinguish repository-only validation from live GitHub verification;
5. preserve one task, one branch, and one reviewable PR per run; and
6. never edit repository state, create or merge a PR, deploy, resolve a product
   decision, or chain into another task.

“Longer autonomy” means uninterrupted, well-specified work inside one task. It
does not authorize unattended multi-task loops, automatic merge, automatic
deployment, bypassed human review, or inferred product acceptance.

## Why this is next

The repository is steering-ready, but each run still reconstructs queue order,
dependency state, owned scope, required reading, checks, and stop conditions
from prose. That has produced many manual “proceed” turns and makes drift between
task files and `docs/tasks/README.md` difficult to detect before work starts.

This task adds a zero-production-dependency validator and selector around the
accepted protocol. It does not change gameplay, the vertical-slice sequence, or
the authority of reviewed Markdown specifications.

## Implementation plan

1. Characterize existing task packet/status/index shapes, repository scripts,
   CI gates, live Git/GitHub preconditions, and ADR-011 safety boundaries.
2. Define a narrowly versioned steering-contract block for future Ready tasks
   while retaining read-only compatibility with historical Done packets and the
   current M2-011 Review packet.
3. Implement a zero-dependency Node parser, validator, deterministic selector,
   JSON contract emitter, and optional fail-closed live preflight.
4. Add exhaustive positive and negative fixtures for queue drift, malformed
   metadata, dependency failures/cycles, unresolved decisions, unknown checks,
   ownership conflicts, dirty/outdated branches, open PRs, and truthful
   repository-only evidence.
5. Document the operator contract, wire the pure validator/tests into the
   existing Quality Gates workflow, and update Codex instructions to consume the
   emitted contract without weakening any review boundary.
6. Run the full repository gate, self-review for write behavior and policy drift,
   move this task to Review, open one reviewable PR, and stop.

## Required reading

- `AGENTS.md`
- `README.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M0-003-ci-pipeline.md`
- `docs/tasks/M0-004-deterministic-test-mode.md`
- `docs/tasks/M0-005-performance-bundle-baseline.md`
- `docs/tasks/M1-001-stable-domain-identifiers-and-events.md`
- `docs/tasks/M2-011-production-interpretation-loop-cutover.md`
- `docs/ROADMAP.md`, especially sequencing and unsafe parallelism
- `docs/DECISIONS.md`, especially ADR-011
- `docs/audits/M0-VALIDATION-COMMANDS.md`
- `package.json`
- `.github/workflows/ci.yml`

## Existing code and callers to inspect

- all files under `docs/tasks/`, including status, dependencies, required
  reading, owned scope, checks, and human-review headings;
- `AGENTS.md`, `README.md`, `docs/CODEX-STEERING-READINESS.md`,
  `docs/ROADMAP.md`, and ADR-011;
- `package.json`, existing `scripts/**`, `.gitignore`, and the CI workflow;
- local `git` and authenticated `gh` read-only commands used to establish a
  clean/up-to-date base and open-PR state.

Production code under `src/**`, browser test adapters, content, persistence,
deployment, and branch-protection settings are inspection-only.

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M0-008",
  "branch": "codex/M0-008-steering-harness-v2",
  "dependencies": ["M0-003", "M0-004", "M0-005", "M0-007", "M1-001"],
  "requiredReading": [
    "AGENTS.md",
    "README.md",
    "docs/CODEX-STEERING-READINESS.md",
    "docs/tasks/README.md",
    "docs/tasks/M0-003-ci-pipeline.md",
    "docs/tasks/M0-004-deterministic-test-mode.md",
    "docs/tasks/M0-005-performance-bundle-baseline.md",
    "docs/tasks/M1-001-stable-domain-identifiers-and-events.md",
    "docs/tasks/M2-011-production-interpretation-loop-cutover.md",
    "docs/ROADMAP.md",
    "docs/DECISIONS.md",
    "docs/audits/M0-VALIDATION-COMMANDS.md",
    "package.json",
    ".github/workflows/ci.yml"
  ],
  "ownership": {
    "paths": [
      "AGENTS.md",
      "README.md",
      "package.json",
      ".github/workflows/ci.yml",
      "scripts/steering/**",
      "docs/STEERING-HARNESS.md",
      "docs/CODEX-STEERING-READINESS.md",
      "docs/ROADMAP.md",
      "docs/tasks/README.md",
      "docs/tasks/M0-008-steering-harness-v2.md",
      "docs/tasks/M2-011-production-interpretation-loop-cutover.md",
      "docs/audits/M0-VALIDATION-COMMANDS.md"
    ],
    "boundaries": ["repository-steering", "task-selection", "ci-quality-gates"]
  },
  "unresolvedDecisions": [],
  "requiredChecks": [
    "npm ci",
    "npm run steering:test",
    "npm run steering:check",
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run validate:content",
    "npm run build",
    "npm run test:browser",
    "npm run bundle:check",
    "git diff --check"
  ],
  "humanReview": ["steering-policy", "ci-quality-gates"],
  "stopBoundary": "reviewable-pr"
}
```

The reviewed Markdown task remains authoritative. The contract is a
machine-readable projection of the exact run-critical fields, and validation
must reject drift between the contract and the human-readable packet.

## Owned scope

### Declared paths

- `AGENTS.md`
- `README.md`
- `package.json`
- `.github/workflows/ci.yml`
- `scripts/steering/**`
- `docs/STEERING-HARNESS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/ROADMAP.md`
- `docs/tasks/README.md`
- `docs/tasks/M0-008-steering-harness-v2.md`
- `docs/tasks/M2-011-production-interpretation-loop-cutover.md`
- `docs/audits/M0-VALIDATION-COMMANDS.md`

### Declared boundaries

- `repository-steering`
- `task-selection`
- `ci-quality-gates`

The paths above are exhaustive. The M2-011 packet may change only to record PR
#52 merge/main-CI/Pages evidence and its still-pending P-005 review. The CI
workflow may change only to run the new pure steering validation and tests.

No `src/**`, production dependency, lockfile, content, browser behavior,
persistence, PWA, deployment workflow, GitHub permission, branch-protection
setting, or product specification may change.

## Functional contract

### Repository validation

`npm run steering:check` must be deterministic, offline, and read-only. It must
fail with actionable diagnostics for:

- duplicate or unknown task IDs and invalid statuses;
- missing required active-packet headings or malformed contract JSON;
- task filename/title/status/contract mismatch;
- Ready queue entries missing from disk, out of order, duplicated across index
  sections, or inconsistent with task status;
- active dependencies that are missing, not Done, or cyclic;
- Ready tasks with unresolved decisions, invalid `codex/` branch names, empty
  ownership, empty acceptance/check/review sections, unknown required package
  scripts, or a stop boundary other than `reviewable-pr`;
- contract/human packet drift in task ID, dependency IDs, required reading,
  owned paths/boundaries, executable checks, or human-review categories.

Historical Done packets may remain legacy prose. Review packets created before
this task may omit a steering contract, but no new Ready task may do so.

### Deterministic selection

`npm run steering:next -- --json` must select the first locally eligible Ready
task in the exact index order and emit:

- eligibility result and every blocker/reason;
- evidence mode (`repository-only` or `live-verified`);
- task ID, title, task file, branch, dependencies, and their statuses;
- required reading, owned paths/boundaries, unresolved decisions, checks,
  human-review categories, and stop boundary;
- an explicit statement that external GitHub/open-work state has not been
  verified unless the live preflight completed.

No Ready task is a valid non-error result with an explicit reason; malformed or
unsafe state must return a non-zero exit.

### Live preflight

An explicit live flag may use read-only `git` and `gh` commands. It must fail
closed unless:

- the requested repository root is the canonical Git worktree root;
- the worktree is clean;
- the current branch is the repository default branch;
- local HEAD equals `origin/<default>`;
- local HEAD also equals GitHub's current default-branch SHA;
- authenticated GitHub metadata is available;
- no open PR exists; and
- the latest exact-main Quality Gates conclusion is successful.

The live preflight must never push, create/switch/delete a branch, edit a task,
open/merge/close a PR, dispatch a workflow, change protection, or deploy.

### Safety and autonomy boundary

- The harness supplies context; it does not perform task work or publication.
- One invocation may implement one selected/assigned task and must stop after
  one reviewable PR.
- Human-review categories remain blocking and cannot be converted into a test.
- A run never automatically selects a second task, even after a merge.
- Missing authority, unresolved product decisions, unverifiable live state, and
  ownership overlap fail closed.

## Acceptance criteria

1. `steering:check` validates the real repository and fails every specified
   malformed fixture with stable actionable diagnostics.
2. `steering:next -- --json` deterministically selects only the first eligible
   Ready fixture and emits the complete execution contract without writing.
3. Dependency ranges and explicit IDs are normalized deterministically; missing,
   non-Done, and cyclic dependencies block selection.
4. Index/status drift, unresolved decisions, malformed contracts, unknown check
   scripts, and invalid ownership/branch/stop boundaries fail closed.
5. Repository-only output never claims GitHub state; live mode proves clean exact
   default-branch state, authenticated metadata, no open PR, and successful
   exact-main Quality Gates or refuses selection.
6. Tests prove the commands leave the fixture and real worktrees unchanged.
7. `AGENTS.md` and operator documentation require the emitted contract while
   preserving ADR-011, human-review, one-task/one-PR, and PR-stop boundaries.
8. CI runs the pure steering tests/check without adding permissions, changing
   triggers, dispatching workflows, or touching deployment.
9. No production dependency, lockfile, `src/**`, runtime bundle behavior,
   product rule, persistence, deployment, or branch-protection setting changes.
10. M2-011 remains Review unless its separate P-005 director acceptance is
    explicitly recorded; this task claims no physical or artistic acceptance.

## Required tests and checks

- `npm ci`
- `npm run steering:test`
- `npm run steering:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run validate:content`
- `npm run build`
- `npm run test:browser`
- `npm run bundle:check`
- `git diff --check`

The completion evidence must additionally record fixture coverage for every
functional-contract refusal and successful selection, warning-free lint,
workflow syntax/self-review, a read-only command scan, and the hosted PR Quality
Gates result.

Targeted rendering performance is not required because no runtime/rendering file
or production dependency may change.

## Expected completion report

- exact commands and emitted contract shape;
- parser/validator/selector/live-preflight behavior;
- fixture matrix and final test counts;
- every repository check result;
- proof of read-only behavior and CI trigger/permission preservation;
- exact documentation/protocol changes;
- confirmation that no game/runtime/deployment or M2 acceptance changed;
- mandatory steering/CI human-review items.

## Human review boundary

### Declared categories

- `steering-policy`
- `ci-quality-gates`

Human review is required before merge because this changes repository steering
policy and the protected Quality Gates workflow. The reviewer must confirm:

- selection fails closed and queue order remains authoritative;
- repository-only versus live evidence is truthful;
- no automatic merge, deployment, branch mutation, or multi-task loop exists;
- ADR-011 and every task-specific human-review boundary remain intact; and
- CI triggers and permissions are not broadened.

Automated tests cannot authorize a weaker governance policy.

## Implementation notes

- Implemented on `codex/M0-008-steering-harness-v2`: one zero-dependency,
  read-only parser/validator/selector now emits a schema-version-1 execution
  contract, reports a valid no-Ready state without authorizing work, and
  optionally performs a fail-closed live preflight against the canonical Git
  root, current GitHub default SHA, open pull requests, and exact-commit Quality
  Gates.
- The active-packet contract now has exact human projections for dependencies,
  required reading, owned paths/boundaries, executable checks, and human-review
  categories. Validation also covers queue/status drift, active dependency
  status and cycles, unresolved decisions, conservative ownership overlap,
  unsafe or missing paths/checks, malformed schemas, and legacy Review
  ownership that cannot be verified.
- Independent adversarial review found and drove fixes for malformed-field
  crashes, unspaced dependency ranges and mixed negation, root-wide/case
  ownership overlap, stale remote evidence, nested Git roots, optional Git
  locks, incomplete live evidence, fenced titles, duplicate JSON keys,
  directory/symlink reading escapes, active dependency validation, and
  contract/prose drift. The final deterministic fixture matrix contains 82
  passing tests.
- Verification passed: steering tests (82), repository steering validation,
  typecheck, warning-free lint, 312 unit tests, 3 content tests, production
  build, 7 deterministic browser tests, bundle ceiling, workflow YAML
  parse/trigger/permission review, runtime read-only command scan, and diff
  whitespace review. The bundle remains at 1,583,730 JavaScript raw bytes /
  467,724 gzip bytes. Targeted rendering performance was not required because
  no runtime or rendering file changed. A real live invocation on the dirty
  task branch correctly refused with `LIVE_DIRTY_WORKTREE`; the successful live
  path and every intermediate refusal are covered by the read-only runner
  fixtures because a task branch is intentionally not a valid start context.
- The first lockfile-install attempt was blocked by a stale repo-local Vite
  process holding esbuild. After stopping only that old development server,
  `npm ci` installed 330 packages successfully. npm reported the existing
  deprecated `three-mesh-bvh` transitive package and two newly observed high
  audit findings; dependencies and lockfile remain unchanged because remediation
  requires a separate reviewed task.
- CI retains its pull-request/main/manual triggers, read-only contents
  permission, and stable `Quality Gates` job. It adds only the pure steering
  tests and repository check after lockfile installation. Hosted PR Quality
  Gates and mandatory steering/CI human review remain pending at this boundary.
- No `src/**`, game rule, content claim, event/persistence schema, dependency,
  lockfile, PWA, deployment workflow, branch protection, or M2 acceptance
  changed. M2-011 remains Review pending its separately recorded P-005 director
  gate.
- Directly assigned on 2026-07-26 after PR #52 merged into `main` at `6972ead`.
  Exact-main Quality Gates run `30183601376` and Pages run `30183731006` passed,
  and no PR remained open.
- M2-011 remains Review: PR #52 has merged, but no repository record yet covers
  the complete P-005 physical device/audio/reduced-motion/low-tier-GPU gate.
  This task records no inferred pass, issue, unavailable setup, or artistic
  acceptance.
- Plan: add one read-only, zero-dependency parser/validator/selector with
  exhaustive fail-closed fixtures; expose it through package scripts and CI;
  document its single-task execution contract; run every required gate; then
  stop at one human-review PR.
