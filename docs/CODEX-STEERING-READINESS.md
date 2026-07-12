# Codex Steering Readiness

## Status

`NOT_READY`

## Meaning

The repository now has a canonical product direction, vertical-slice contract, target architecture, migration audit, roadmap, foundational decisions, task protocol, a completed repository audit and unit-test baseline, enforced pull-request CI, and CI-gated Pages deployment. The deterministic browser test-mode task is in review.

It is not yet ready for unattended self-deploying implementation loops because the trustworthy baseline has not been completed on the default branch.

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

## What may happen now

Codex may be used as the implementation interface for one supervised task at a time. No next task is eligible until M0-004 is reviewed and merged and the queue is advanced deliberately.

It must create a branch and reviewable PR, report its checks, and stop after the task. Human review is required.

## What may not happen yet

- unattended multi-task loops;
- automatic production deployment from task branches;
- automatic merging;
- concurrent tasks touching state, persistence, input, scene, or audio boundaries;
- event architecture implementation before the audit and test baseline;
- dependency major upgrades;
- gameplay changes.

## Supervised steering prompt

```text
Read AGENTS.md, docs/CODEX-STEERING-READINESS.md, docs/tasks/README.md,
docs/tasks/M0-004-deterministic-test-mode.md, and its required reading.

This is a supervised single-task run. Inspect the existing development hooks and
nondeterministic browser inputs, produce a concise implementation plan, then
execute only M0-004. Run every required check, update only the task deliverables,
and open one reviewable pull request. Do not change gameplay rules or begin
another task.
```

## Future autonomous steering prompt

Use only after status is `READY`:

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
