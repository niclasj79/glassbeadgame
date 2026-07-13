# M0-007 — Upgrade Vite to the patched 6.x line

## Status

Done

## Objective

Upgrade only Vite from 5.4.21 to 6.4.3, regenerate the lockfile, remove the current Vite/esbuild advisories, and prove no build, development-server, Pages-base, content-gate, browser-test, bundle, or deployment regression.

## Dependencies and boundary

- M0-006 must be Done with this follow-up approved.
- Do not upgrade React, R3F, Three, SWC plugin, Vitest, TypeScript, ESLint, Tailwind, or any unrelated package unless the Vite lockfile resolution strictly requires a compatible transitive change.
- Human review is required because this is a security-sensitive major upgrade.

## Acceptance criteria

- `vite` resolves to exactly 6.4.3 and its bundled esbuild is 0.25.0 or newer.
- `npm audit` no longer reports GHSA-67mh-4wv8-2f99, GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3, or GHSA-fx2h-pf6j-xcff through Vite.
- Development content validation, explicit hosts/ports, Pages base, manual chunks, production target, Playwright web server, and Lovable development tagger behavior are inspected.
- Clean install, full validation, browser smoke, bundle ceiling, and labelled performance reference pass.
- Bundle changes versus M0-005 are reported and remain within accepted ceilings.
- Rollback is one commit/PR reverting only the Vite/lockfile upgrade.

## Required reading and sources

- `docs/audits/M0-DEPENDENCY-DECISION.md`;
- Vite 6 migration guide and 6.4.3 release notes;
- the four advisory records cited by M0-006;
- current CI/deployment workflows and `vite.config.ts`.

## Required checks

All repository checks plus `npm ls --all`, `npm audit --json`, development-server smoke, and workflow syntax.

## Implementation notes

- Accepted and merged in PR #17 on 2026-07-13 after the required Quality Gates check passed.
- Human authorization was provided by the 2026-07-13 instruction to proceed after the merged M0-006 decision boundary.
- Updated only direct Vite to exact 6.4.3 and regenerated its lockfile graph. Vite and Lovable tagger resolve esbuild 0.25.12; no unrelated direct dependency changed.
- `npm audit --json` reports zero vulnerabilities and no longer contains any of the four M0-006 advisory paths. `npm ls --all` exits zero.
- Verified the development content gate on explicit loopback port 4180, Playwright's explicit server, production `/glassbeadgame/` asset paths, ES2020 target, and named manual chunks.
- Bundle delta versus M0-005 is +4,166 raw and +1,265 gzip-9 bytes total; every accepted ceiling passes.
- The first `npm ci` attempt hit Windows `EPERM` because the manual dev smoke left its Vite child holding `esbuild.exe`; after stopping only that process tree, the clean install passed. This is a test-process cleanup issue, not a dependency failure.
