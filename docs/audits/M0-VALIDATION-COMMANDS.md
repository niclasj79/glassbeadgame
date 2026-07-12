# M0 Validation Commands

## Discovered command surface

| Concern | Repository command | How it is wired |
| --- | --- | --- |
| Lockfile install | `npm ci` | `package-lock.json` lockfile v3; also used by Pages workflow |
| Type checking | `npm run typecheck` | `tsc --noEmit -p tsconfig.app.json`; strict active `src/` only |
| Lint | `npm run lint` | ESLint over repository; `dist`, `legacy`, and `node_modules` ignored |
| Unit/logic tests | `npm test` | Vitest 3.2.7 runs the deterministic Node-only characterization suite once; `npm run test:watch` is the local watch mode |
| Content validation | `npm run validate:content` | Runs the content-validator suite without producing `dist`; `npm run build` and `npm run dev` continue to invoke `validateContent()` through `vite.config.ts::contentGate.buildStart` |
| Production build | `npm run build` | Vite build, ES2020 target, Pages base path |
| Browser smoke | None | No Playwright/Cypress dependency, config, files, or package script found |
| Performance check | None | Runtime Drei `PerformanceMonitor` changes quality, but no repeatable command/budget assertion exists |
| Preview | `npm run preview` | Serves the built output; no automated smoke consumes it |

The standalone content command exercises both the authored corpus and deliberately malformed fixture data. The production build remains independently gated by the same validator and prints coverage warnings through the Vite plugin.

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

## M0-002 test baseline

Vitest 3.2.7 is pinned as a development-only dependency. It is the smallest compatible runner that reuses the repository's Vite/TypeScript module resolution, supports ESM and fake clocks, and remains compatible with the existing Vite 5 and Node 20 baseline. Version 3.2.7 was selected instead of 3.2.4 because 3.2.4 is affected by a critical Vitest advisory.

Six Node-only suites provide 24 characterization tests covering:

- fixed-seed draw output, selected-discipline quotas, and curated-pair counts;
- canonical pair IDs, curated lookup, faint outcomes, tier/faint scoring, and controlled timestamps;
- Triad, Symposium, Fugue, duplicate-motif prevention, consecration, and deterministic Illumination;
- legacy ranks, corpus milestones, progress sanitization, transfer round trips, and malformed tokens;
- deterministic Annotation output, including the empty-web response;
- Zustand duplicate-thread prevention, discovery/Codex/Insight updates, progress merge/reset, archive cap, daily completion, durable partialization, and in-memory hydration.

The only production seam changed is `validateContent(input?)`: production still calls it with the authored corpus, while tests may supply immutable fixture arrays. No game rule, persistence schema, or player-facing behavior changed.

### Test gaps remaining after M0-002

- Browser interaction is not covered: pointer drag, tap-to-tap, touch inspection, Escape cancellation, DOM accessibility, WebGL fallback, and the development test adapter require later Playwright work.
- Audio is not instantiated: unlock, scheduler timing, voice lifetime, random humanization, and audio-clock-to-thread-pulse synchronization need browser/audio seams.
- Three.js/R3F rendering, camera choreography, effects, quality-tier demotion, and WebGL context recovery remain outside the Node suite.
- Persistence tests cover Zustand's declared partialization and merge using in-memory localStorage. They do not validate real-browser quota failures, storage-denied behavior, corrupt nested `gbg.v1` data, or future IndexedDB migrations.
- Unseeded draws, daily theme selection, audio randomness, and frame timing still use wall time or randomness. Tests control the seeded and rule/store clock paths they exercise; M0-004 owns deterministic browser mode.
- Faint prose is deterministic for the same ordered endpoints, but reversing the same canonical pair changes names/keywords in the sentence. This is recorded legacy behavior, not corrected in this baseline task.

### Exact local and M0-003 CI command order

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run validate:content
npm run build
```

M0-003 should run that sequence for every pull request. Browser smoke and performance commands remain intentionally absent until their later M0 tasks establish deterministic mode and measured budgets.

### M0-002 execution report

| Check | Result | Evidence/notes |
| --- | --- | --- |
| `npm ci` | Passed | Installed 327 packages from the lockfile. npm reports the existing deprecated transitive `three-mesh-bvh@0.7.8` plus 2 audit findings (1 moderate, 1 high); resolving them requires the isolated dependency-upgrade workflow. |
| `npm run typecheck` | Passed | Strict application TypeScript completed with no diagnostics, including all tests under `src/`. |
| `npm run lint` | Passed | ESLint completed with no diagnostics. |
| `npm test` | Passed | 6 files and 24 tests passed in the Node environment. An earlier red run confirmed the command exits nonzero on failing assertions. |
| `npm run validate:content` | Passed | 3 validator tests passed, including malformed fixture rejection, without producing `dist`. |
| `npm run build` | Passed | Vite transformed 1,122 modules and the production content gate passed. Existing warnings remain for the R3F and Three chunks above 500 kB. |
| Browser smoke | Not runnable | No Playwright/browser dependency, configuration, or command exists; browser automation is explicitly outside M0-002. |
| Targeted performance | Not required/runnable | M0-002 does not define a performance check and no measured command exists; M0-005 owns the baseline. |
