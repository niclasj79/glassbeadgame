# Codex Steering Readiness

## Status

`READY`

## Meaning

The repository has a reviewed canonical product direction, vertical-slice contract, target architecture, migration audit, roadmap, foundational decisions, task protocol, trustworthy measurement baseline, enforced pull-request CI, CI-gated Pages deployment, deterministic browser test mode, accepted bundle budgets, and a completed low-risk steering dry run. The M1 domain foundation gate is closed; M2-001 through M2-008 established canonical Attend, pure candidate resonance, the ephemeral interpretation draft, its atomic durable commit boundary, deterministic expressive gesture profiles, one reactive draft owner, and headless attention and expressive-commit coordinators; M2-009 is specified as the next isolated provisional resonance-evidence resolver.

It is ready for one isolated autonomous task-selection run at a time. `READY` does not authorize automatic merge, deployment from task branches, overlapping work, or bypassing a task's human-review boundary.

## Required transition gate

Change this status to `READY` only when all of the following are true:

- the documentation foundation PR is reviewed and merged;
- M0-001 repository audit is Done;
- M0-002 test baseline is Done;
- M0-003 CI quality gates are Done;
- M0-004 deterministic test mode is Done;
- M0-005 performance baseline is Done;
- local and CI validation commands are documented and passing;
- deployment is isolated from pull-request validation;
- at least one M1 domain task is fully specified and Ready;
- branch protection requires the established quality checks;
- an autonomous loop has been dry-run on a documentation-only or low-risk task.

## Transition evidence

- Documentation foundation: accepted and merged in PR #5.
- Trustworthy baseline: M0-001 through M0-005 are Done via PRs #6, #8, #10, #12, and #14; the accepted dependency decision and Vite security remediation are Done via PRs #16 and #17.
- Validation: local commands are documented in `docs/audits/M0-VALIDATION-COMMANDS.md`; protected `Quality Gates` passed for the completed task PRs and their exact `main` merge commits, most recently PR #46 at `46c29ba` in CI run `29406943154`.
- Deployment isolation: pull requests run read-only CI; Pages runs separately only after successful `main` push CI or a manual dispatch on `main` and checks out the validated SHA.
- Ready domain work: M2-008 was accepted in PR #46, establishing one injectable coordinator over the accepted gesture builder, atomic commit command, canonical adapter, and reactive draft reset. Director decisions CAV-001 through CAV-004 authorize provisional M2 resonance fixtures while forbidding unreviewed claims, hidden correctness, and endpoint disclosure; I-001 through I-013 accept the complete M2 interaction ordering and immediate-consequence direction; P-001 through P-005 establish director-led personal playtesting and its device gate. M2-009 is fully specified as one deterministic read-only resolver that supplies complete session-ordered provisional evidence to the accepted attention coordinator without adding production composition, presentation, durable meaning, or final content claims.
- Hosted protection: `main` requires strict `Quality Gates`, pull requests, resolved conversations, and administrator enforcement; force pushes and deletion are disabled.
- Dry run: M1-001 was selected from Ready with dependencies Done and no ownership overlap, implemented on one isolated branch, fully validated, reviewed, and merged in PR #19 without automatic merge or next-task selection.

## What may happen now

Codex may select M2-009 as the first eligible Ready task after this queue-advancement change is reviewed and merged.

Each run must create one branch and one reviewable PR, report every required check, and stop. Human review remains required wherever the task or repository boundaries require it.

## Recorded steering-loop dry run

- Date: 2026-07-13.
- Protection precondition: GitHub's hosted `main` protection required strict `Quality Gates`, required pull requests and resolved conversations, included administrators, and disabled force pushes and deletion.
- Selection: M1-001 was the first Ready task; M0-001 through M0-007 were Done and no active task owned `src/domain/ids.ts` or `src/domain/events/**`.
- Isolation: the run created `codex/M1-001-domain-events`, implemented only the declared low-risk domain-contract scope, ran every required check, and opened one reviewable PR.
- Safety boundary: no automatic merge, deployment mutation, persistence migration, current-state integration, gameplay change, or next-task selection occurred.
- Acceptance: the protected check passed, and PR #19 was reviewed and merged on 2026-07-13. The exact merge commit then passed the complete `main` Quality Gates workflow.

## What remains prohibited

- unattended multi-task loops;
- automatic production deployment from task branches;
- automatic merging;
- concurrent tasks touching state, persistence, input, scene, or audio boundaries;
- selecting tasks that are not Ready or whose dependencies are not Done;
- work outside the selected task's declared scope;
- bypassing human review for specification, compatibility, persistence, accessibility, dependency-major, deployment, content, or audiovisual-quality changes.

## Supervised steering prompt

```text
Read AGENTS.md, docs/CODEX-STEERING-READINESS.md, docs/tasks/README.md,
the assigned task, and its required reading.

This is a supervised single-task run. Execute only the assigned task.
Run every required check, update only its task deliverables, and open one reviewable
pull request. Do not change gameplay rules or begin another task.
```

## Autonomous steering prompt

Use while status is `READY`:

```text
Read AGENTS.md, docs/CODEX-STEERING-READINESS.md, and docs/tasks/README.md.

Select the first Ready task whose dependencies are Done and whose declared
ownership does not overlap active work. Create an isolated task branch, inspect
the relevant code, record a concise plan, implement only that task, run all
required checks, self-review the diff, update task status and implementation
notes, and open one reviewable pull request. Stop after the PR. Never auto-merge
a category requiring human review.
```

## Authority

Only a reviewed repository change may set this file to `READY`. Chat statements, local experiments, or an unmerged branch do not satisfy the gate.
