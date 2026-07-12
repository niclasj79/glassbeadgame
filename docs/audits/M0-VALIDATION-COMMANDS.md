# M0 Validation Commands

## Discovered command surface

| Concern | Repository command | How it is wired |
| --- | --- | --- |
| Lockfile install | `npm ci` | `package-lock.json` lockfile v3; also used by Pages workflow |
| Type checking | `npm run typecheck` | `tsc --noEmit -p tsconfig.app.json`; strict active `src/` only |
| Lint | `npm run lint` | ESLint over repository; `dist`, `legacy`, and `node_modules` ignored |
| Unit/logic tests | None | No test dependency, config, files, or package script found |
| Content validation | `npm run build` (or `npm run dev`) | `vite.config.ts::contentGate.buildStart` invokes `validateContent()` |
| Production build | `npm run build` | Vite build, ES2020 target, Pages base path |
| Browser smoke | None | No Playwright/Cypress dependency, config, files, or package script found |
| Performance check | None | Runtime Drei `PerformanceMonitor` changes quality, but no repeatable command/budget assertion exists |
| Preview | `npm run preview` | Serves the built output; no automated smoke consumes it |

`npm run build` is both the content-validation invocation and the production build. There is no independent content command, so one successful build is reported for both concerns. The build prints content coverage warnings via the Vite plugin and throws on validation errors.

## Development-only browser seam

`src/scene/ThreadingDriver.tsx` publishes `window.__gbgTest` only in Vite development mode. It exposes bead screen coordinates/IDs, the canvas, curated pairs, and `weave(a,b)` routed through `threading.ts::devCommit` and the real private commit path. `src/main.tsx` similarly publishes `window.__gbg.state`. These are useful harness seams, but no current command or checked-in test invokes them, and both are stripped/disabled in production mode.

## GitHub Actions and deployment validation

`.github/workflows/deploy.yml` runs on `main` push and manual dispatch:

```text
checkout -> Node 20/npm cache -> npm ci -> npm run typecheck
-> npm run build/content gate -> upload dist -> deploy Pages
```

It omits lint and all tests. There is no pull-request workflow, and deployment is part of the same workflow as validation. Branch-protection settings are hosted GitHub configuration and are not defined in the repository.

## M0-001 execution report

Run from repository root on the task branch. This section is filled with the observed result after the documentation is complete.

| Check | Result | Evidence/notes |
| --- | --- | --- |
| `npm ci` | Passed | PowerShell blocked the `npm.ps1` launcher before npm ran; the equivalent `npm.cmd ci` completed, installing/auditing 293 packages. npm reported retrying two apparently corrupt cached tarballs, one deprecated transitive `three-mesh-bvh@0.7.8`, and 2 audit findings (1 moderate, 1 high). M0-001 did not alter dependencies. |
| `npm run typecheck` | Passed | `npm.cmd run typecheck`; strict TypeScript completed with no diagnostics. |
| `npm run lint` | Passed | `npm.cmd run lint`; ESLint completed with no diagnostics. |
| Content validation | Passed | `vite.config.ts::contentGate` ran during the successful production build and emitted no content errors. |
| `npm run build` | Passed | `npm.cmd run build`; Vite 5.4.21 transformed 1,122 modules and completed in 13.41 seconds. |
| Unit/logic harness | Not runnable | No command, runner, config, or test files exist |
| Browser smoke | Not runnable | No Playwright/browser test command, dependency, config, or spec exists |
| Targeted performance | Not required/runnable | M0-001 asks only for structure discoverable without tooling; no repository command exists |

Production bundle output (minified / gzip where reported): application JS 243.98/80.04 kB, motion vendor 122.29/40.39 kB, R3F vendor 506.46/162.97 kB, Three vendor 683.66/176.21 kB, and CSS 38.53/7.22 kB. Fonts are emitted as many 4.97-48.67 kB WOFF/WOFF2 files. Vite warned that the R3F and Three chunks exceed 500 kB; no bundle budget is configured, so this is a recorded baseline rather than a failure.

## Exact recommended scope for M0-002

M0-002 should establish a discoverable non-browser test baseline without changing gameplay behavior:

1. Add the selected lightweight TypeScript unit runner and a single documented `npm test`/`npm run test` command.
2. Characterize stable seeded `drawSession` output/invariants, pair/connection indexing, curated versus faint `resolveAttempt`, diminished faint scoring, all three motif rules, consecration, deterministic illumination selection, ranks/milestones, shared-progress validation/round-trip, deterministic Annotation, and `validateContent` success/failure boundaries.
3. Inject or isolate wall time for rule/store tests rather than asserting live `Date.now` values.
4. Add store before/after characterization for `addDiscovery`, duplicate threads, Insight, consecration, progress merge/reset, archive cap, daily completion, and persistence partialization/merge.
5. Add a standalone content-validation command so content integrity is testable without producing `dist`.
6. Do not add Playwright, deterministic scene mode, CI, performance tooling, event architecture, IndexedDB, or gameplay/spec changes; those belong to later M0 tasks.
