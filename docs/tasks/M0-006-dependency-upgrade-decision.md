# M0-006 — Make the dependency-upgrade decision

## Status

Done

## Milestone

M0 — Trustworthy baseline

## Dependencies

- M0-001 through M0-005 must be Done.

## Objective

Produce an evidence-backed dependency and security-advisory decision for the current application, identifying which packages should be kept, removed, upgraded in isolated follow-up tasks, or deliberately deferred. Do not change package versions or the lockfile in this task.

## Why this exists

The clean-install baseline reports one moderate and one high audit finding plus a deprecated `three-mesh-bvh@0.7.8` transitive package. Several direct dependencies use broad compatible ranges while the lockfile may lag current releases. Major rendering, React, state, build, lint, and test upgrades can interact across the WebGL scene and must not be mixed with the upcoming domain migration without an explicit compatibility and sequencing decision.

## Required reading

- `AGENTS.md`;
- `docs/ARCHITECTURE.md`, especially sections 9, 10, 15, and 17;
- `docs/ROADMAP.md` M0 gate and automation boundaries;
- all M0 audit deliverables, especially validation and performance baselines;
- `package.json` and the complete direct dependency graph in `package-lock.json`;
- CI and deployment workflows.

## Evidence to collect

- exact installed direct and relevant transitive versions from the lockfile;
- `npm outdated` and both human-readable and JSON audit output;
- dependency paths for every advisory, deprecation, duplicate major, invalid, extraneous, or peer-conflict finding;
- package purpose and active import/caller evidence for every direct production and development dependency;
- current Node/npm, TypeScript, Vite, React, R3F, Three, Zustand, Playwright, Vitest, ESLint, Tailwind/PostCSS, font, and deployment constraints;
- primary-source release notes, migration guides, support matrices, and advisory records for proposed version changes;
- clean-install, validation, browser, bundle, and reference-performance baseline implications.

## Scope

1. Generate a reproducible dependency inventory separating direct production, direct development, optional/peer, and relevant transitive packages.
2. Trace every npm advisory and deprecation to the introducing direct package and state whether the vulnerable/deprecated code is reachable in production, build/test only, or not demonstrated reachable.
3. Inspect active imports and configuration before recommending removal; unused package metadata alone is insufficient.
4. Compare installed versions with currently supported releases using primary package documentation and release/migration notes.
5. Group candidate work into compatible upgrade sets. Rendering packages, React, build tooling, test tooling, lint tooling, CSS tooling, and content/font packages must be assessed separately unless primary documentation requires coordination.
6. For each direct dependency, record one disposition: Keep, Remove, Patch/minor follow-up, Major follow-up, Replace, or Defer.
7. For each non-Keep disposition, document rationale, compatibility risks, required migration work, expected bundle/runtime effect, validation plan, rollback boundary, and whether human review is mandatory.
8. Decide whether the two current audit findings require immediate isolated remediation before M1 or can be accepted temporarily with a documented reason and review date/trigger.
9. Produce an ordered set of proposed follow-up task packets only for approved, independently reviewable upgrade groups. Keep them Draft or Blocked pending human approval; do not make an upgrade implementation task Ready implicitly.
10. Record the final recommendation and residual risks under `docs/audits/` and update validation documentation only when factual command/advisory evidence changed.

## Out of scope

- modifying `package.json`, `package-lock.json`, source, configuration, workflows, or generated assets to perform an upgrade;
- running `npm audit fix`, `npm update`, or automated dependency rewrite tools;
- accepting breaking changes on behalf of product or human reviewers;
- combining any dependency change with gameplay, architecture, rendering, audio, persistence, accessibility, or deployment work;
- replacing the stack or introducing a new framework;
- treating an absence of npm advisories as proof of supply-chain safety;
- speculative optimization unsupported by the M0-005 baseline.

## Constraints

- Internet research must use primary sources: official package documentation/repositories, maintainers' release notes, npm advisory records, and authoritative security databases.
- Record lookup date and exact source links because versions and advisories change.
- Do not expose authentication tokens, private registry configuration, or environment secrets in reports.
- Do not install candidate versions in the repository working tree. If compatibility experiments are necessary, use an isolated temporary checkout and report them as non-authoritative evidence.
- A major version change always requires a separate task, branch, PR, full validation, and human review.
- A security severity label alone does not establish reachability, but uncertainty must not be presented as safety.
- Preserve the accepted bundle ceilings; any proposed upgrade must include a bundle-regression plan.

## Acceptance criteria

- The audit lists every direct dependency with exact installed version, declared range, purpose, active evidence, latest relevant supported version, and disposition.
- Every current npm advisory and deprecation has a dependency path, authoritative reference, reachability classification, remediation options, and explicit recommendation.
- Peer requirements and coupled compatibility for React/R3F/Three/postprocessing, Vite/SWC/TypeScript, ESLint/typescript-eslint, and Playwright/Vitest are documented.
- Candidate upgrades are grouped into isolated, ordered changes with migration and rollback boundaries rather than one broad upgrade.
- The report explicitly decides whether any dependency remediation blocks M1 and why.
- No package version, lockfile, source, build configuration, CI/deployment workflow, or runtime behavior changes.
- Proposed follow-up task packets, if any, remain Draft or Blocked until separately approved.
- The existing clean install and full required validation suite still pass from the unchanged lockfile.
- Remaining supply-chain, browser-support, package-maintenance, and transitive-risk uncertainties are explicit.

## Required checks

- `npm ci`;
- `npm ls --all` with findings recorded;
- `npm outdated` with its expected nonzero outdated result handled as evidence, not hidden;
- `npm audit` and `npm audit --json` with exact findings recorded;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run validate:content`;
- `npm run build`;
- `npm run bundle:check`;
- `npm run test:browser`;
- `npm run measure:performance` when the local renderer can produce a labeled report;
- workflow syntax and the pull request's `Quality Gates` run.

## Expected completion report

Report:

- lookup date, commands, environment, and authoritative sources;
- direct inventory and active-use evidence;
- advisories, deprecations, reachability, and remediation choices;
- compatibility groups and proposed sequencing;
- Keep/Remove/Upgrade/Replace/Defer dispositions;
- whether M1 is blocked by dependency remediation;
- proposed isolated follow-up tasks and their approval state;
- every required check and exact outcome;
- residual maintenance and supply-chain uncertainty.

## Human review

Required to accept risk, approve any removal/replacement, and authorize every major-version or security-sensitive follow-up. Completing this decision task does not authorize an upgrade implementation.

## Implementation notes

- Recorded the complete direct inventory, active-use evidence, outdated set, peer constraints, advisories, deprecation path, reachability classification, and primary sources in `docs/audits/M0-DEPENDENCY-DECISION.md`.
- Recommended one immediate isolated Vite 6.4.3 security follow-up and marked its task Blocked pending human approval; no package or lockfile mutation occurred.
- Deferred coupled React/R3F/Drei/postprocessing/Three, CSS, lint, motion, test, and TypeScript majors to separate future decisions rather than combining them with M1.
- Decided M1 is blocked only until the Vite security follow-up is approved and merged; the deprecated BVH transitive and other outdated majors do not independently block domain work.
