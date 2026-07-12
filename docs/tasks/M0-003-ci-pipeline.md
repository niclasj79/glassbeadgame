# M0-003 — Establish CI quality gates

## Status

Done

## Milestone

M0 — Trustworthy baseline

## Dependencies

- M0-001 must be Done.
- M0-002 must be Done.

## Objective

Create a GitHub Actions quality-gate workflow that validates every pull request and clearly separates validation from GitHub Pages deployment.

## Required reading

- `AGENTS.md`
- M0 audit validation and deployment maps;
- M0-002 implementation notes;
- `docs/ROADMAP.md`.

## Scope

Implement CI that:

- installs dependencies from the lockfile;
- runs typecheck;
- runs lint;
- runs unit tests;
- runs content validation through the canonical command;
- runs the production build;
- uploads useful build/test diagnostics on failure where proportionate;
- avoids duplicate or conflicting Pages deployments from pull requests;
- documents required branch protection checks.

The production deployment workflow may be adjusted only as needed to separate it safely from validation. Do not redesign hosting.

## Out of scope

- browser/E2E tests before M0-004 defines deterministic mode;
- automatic merging;
- release versioning;
- backend deployment;
- performance budgets not yet measured;
- dependency upgrades.

## Constraints

- use supported maintained GitHub Actions versions;
- pin runtime major versions explicitly;
- use the existing package manager and lockfile;
- CI and local validation commands must match;
- pull requests must not publish over the production Pages site;
- deployment remains restricted to the intended default-branch workflow.

## Acceptance criteria

- a pull request runs all required validation jobs;
- a deliberate unit-test failure causes CI failure;
- a type error, lint error, content error, or build error causes failure;
- the default branch remains the only automatic production deployment source unless explicitly documented otherwise;
- required check names are listed for branch protection;
- the workflow uses caching only where it cannot hide stale generated output;
- README or validation documentation tells contributors exactly what to run locally.

## Required checks

Validate workflow syntax and run all local equivalents:

- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- content validation command;
- `npm run build`.

## Expected completion report

Report workflow files, job/check names, local command parity, deployment behavior, branch-protection recommendations, and any permissions required.

## Human review

Required because deployment and repository policy are affected. Auto-merge is prohibited.

## Implementation notes

- Added `.github/workflows/ci.yml` for pull requests, `main` pushes, and manual validation with the single branch-protectable check context `Quality Gates`.
- CI uses Node 20, installs from `package-lock.json`, and runs the exact documented local sequence: typecheck, lint, unit tests, standalone content validation, and production build.
- npm caching stores only downloaded package data; `node_modules`, `dist`, and generated test output are never restored from cache.
- Pages deployment remains a separate elevated-permission workflow. Automatic deployment now follows only a successful CI run caused by a push to `main`, and checks out that validated commit SHA. Manual deployment is limited to `main`.
- Updated official GitHub actions to the maintained major versions current during implementation. No application dependency changed.
- Repository administrators must require `Quality Gates` on `main`; branch protection remains hosted configuration and is not changed by this PR.
