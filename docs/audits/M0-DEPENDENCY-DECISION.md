# M0 Dependency and Upgrade Decision

## Decision

Evidence collected 2026-07-12 on Windows with Node 24.14.1 and npm 11.11.0. The unchanged lockfile installs 413 packages: 95 production, 319 development, and 88 optional entries as categorized by npm (categories overlap npm's graph accounting). `npm ls --all` exits zero with no invalid, extraneous, or peer-conflict finding.

M1 is blocked only until an isolated upgrade from Vite 5.4.21 to patched Vite 6.4.3 is reviewed and merged, or a human explicitly accepts the current development-server risk. No other dependency upgrade blocks domain-only M1 work. No package version, lockfile, source, configuration, or workflow changed in M0-006.

## Reproduction

```text
npm ci
npm ls --all
npm outdated --json
npm audit
npm audit --json
npm explain three-mesh-bvh
```

`npm outdated` exits 1 when outdated packages exist; that exit is evidence, not a validation failure. Registry versions and advisory state are time-sensitive.

## Direct production inventory

| Package | Declared | Installed | Latest 2026-07-12 | Purpose / active evidence | Disposition |
| --- | --- | ---: | ---: | --- | --- |
| `@fontsource-variable/cormorant` | `^5.1.0` | 5.2.8 | 5.2.8 | global display-font CSS | Keep |
| `@fontsource/inter` | `^5.1.0` | 5.2.8 | 5.2.8 | global UI CSS and Drei text URL | Keep |
| `@react-three/drei` | `^9.114.3` | 9.122.0 | 10.7.7 | controls, text, lines, sparkles, performance monitor | Defer coupled major |
| `@react-three/fiber` | `^8.17.10` | 8.18.0 | 9.6.1 | Canvas and every scene frame hook | Defer coupled major |
| `@react-three/postprocessing` | `^2.16.3` | 2.19.1 | 3.0.4 | composer, bloom, vignette, noise | Defer coupled major |
| `clsx` | `^2.1.1` | 2.1.1 | 2.1.1 | UI class composition | Keep |
| `framer-motion` | `^11.11.9` | 11.18.2 | 12.42.2 | screen, HUD, menu, and card motion | Defer major |
| `maath` | `^0.10.8` | 0.10.8 | 0.10.8 | camera easing | Keep |
| `react` / `react-dom` | `^18.3.1` | 18.3.1 | 19.2.7 | application/UI runtime | Defer with R3F group |
| `three` | `0.169.0` | 0.169.0 | 0.185.1 | renderer, geometry, materials, math | Defer with R3F group |
| `zustand` | `^5.0.1` | 5.0.14 | 5.0.14 | reactive and persisted legacy store | Keep |

The rendering majors are coupled: installed Fiber 8 declares React 18 peers; Fiber 9 declares React 19, and current Drei 10/postprocessing 3 declare Fiber 9 and React 19. React's official upgrade guide also requires coordinated React DOM and type updates. This group needs its own later migration and audiovisual review, not an M1 prerequisite.

## Direct development inventory

| Package/group | Installed | Latest | Active evidence | Disposition |
| --- | ---: | ---: | --- | --- |
| `@playwright/test` | 1.61.1 | 1.61.1 | browser and performance suites | Keep pinned |
| `vitest` | 3.2.7 | 4.1.10 | unit/content runner | Defer major |
| `vite` | 5.4.21 | 8.1.4 | dev/build/content plugin | Major follow-up to 6.4.3 now |
| `@vitejs/plugin-react-swc` | 3.11.0 | 4.3.1 | Vite React transform | Keep; installed version supports Vite 4–7 |
| `typescript` | 5.9.3 | 7.0.2 | strict application/test checks | Defer major |
| `@types/node` | 22.20.0 | 26.1.1 | Node/Vite/Playwright types | Patch later; defer major |
| `@types/react` / `@types/react-dom` | 18.3.31 / 18.3.7 | 19.2.17 / 19.2.3 | React TypeScript surface | Defer with React 19 |
| `@types/three` | 0.169.0 | 0.185.1 | Three TypeScript surface | Defer with Three |
| `eslint` / `@eslint/js` | 9.39.4 | 10.7.0 / 10.0.1 | flat lint configuration | Patch 9.x later; defer v10 |
| `typescript-eslint` | 8.62.1 | 8.63.0 | TS lint parser/rules | Patch/minor follow-up |
| React lint plugins | hooks 5.2.0; refresh 0.4.26 | 7.1.1; 0.5.3 | hook/refresh rules | Defer hooks major; refresh minor later |
| `globals` | 15.15.0 | 17.7.0 | lint environment globals | Defer major |
| Tailwind/PostCSS/autoprefixer | 3.4.19 / 8.5.16 / 10.5.2 | 4.3.2 / 8.5.18 / 10.5.2 | CSS build/config | PostCSS patch later; defer Tailwind major |
| `lovable-tagger` | 1.3.1 | 1.3.1 | development-only Vite component tagger | Keep, reassess before release |

Tailwind 4 changes the PostCSS plugin package, config/content model, browser floor, and multiple utility semantics; it is not a routine bump. ESLint 10 has its own migration guide. Vitest 4 supports Vite 6–8 but is not required to remediate Vite. These groups should remain isolated.

## Advisories and deprecation

| Finding | Path / reachability | Patched option | Decision |
| --- | --- | --- | --- |
| esbuild GHSA-67mh-4wv8-2f99, moderate | root Vite 5.4.21 → esbuild ≤0.24.2; development server only, not production bundle | esbuild 0.25.0; Vite 6.4.3 includes `^0.25.0` | Remediate with Vite 6.4.3 |
| Vite GHSA-4w7w-66w2-5vf9, moderate | direct dev server; relevant because repo config binds `server.host: "::"` | Vite 6.4.2+, but superseded by newer findings | Remediate with 6.4.3 |
| launch-editor GHSA-v6wh-96g9-6wx3, moderate | Vite's editor endpoint on Windows; user interaction required; local developer credential risk | Vite 6.4.3 | Remediate with 6.4.3 |
| Vite GHSA-fx2h-pf6j-xcff, high | direct dev server on Windows alternate paths; network exposure condition can apply to `::` bind | Vite 6.4.3 | Blocks M1 until fixed or accepted |
| deprecated `three-mesh-bvh@0.7.8` | Drei 9.122.0 dependency; app imports text/line/control/sparkle/monitor helpers, not demonstrated BVH helpers | Drei 10 pulls a newer line but requires React 19/Fiber 9 | Defer to coupled rendering migration |

The static Pages production output does not run Vite or esbuild, so these findings are not demonstrated production-runtime reachable. They remain development/build supply-chain risks. The high Windows path issue is proportionately urgent because this repository is developed on Windows and its ordinary Vite config exposes the dev server beyond loopback.

## Ordered recommendation

1. Approve and execute blocked task `M0-007-vite-security-upgrade.md`: Vite 5.4.21 → exactly 6.4.3, no unrelated direct upgrades. The installed SWC plugin supports Vite 6; Vite 6 supports the repository's Node 20 CI and local Node 24. Validate content plugin, hosts, Pages base, chunks, browser server, bundle ceilings, and audit removal. Roll back the single upgrade PR if any regression appears.
2. After M1 domain foundations stabilize, separately decide the React 19 + Fiber 9 + Drei 10 + postprocessing 3 + matching Three/types group. Human audiovisual review and M0-005 comparison are mandatory.
3. Schedule small same-major maintenance only in isolated tooling PRs: ESLint 9 patches with `@eslint/js`, typescript-eslint 8.63, PostCSS 8.5.18, and Node 22 type patch. None blocks M1.
4. Defer Tailwind 4, ESLint 10, Vitest 4, TypeScript 7, Motion 12, and unrelated type majors until a task benefits from them or support/security changes.

No removal or replacement is approved. Automated `npm audit fix --force` is rejected because it selects Vite 8.1.4 and crosses several migrations unnecessarily.

## Primary sources

- GitHub advisories: [esbuild CORS](https://github.com/advisories/GHSA-67mh-4wv8-2f99), [Vite sourcemap traversal](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [launch-editor UNC/NTLM](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [Vite Windows path bypass](https://github.com/advisories/GHSA-fx2h-pf6j-xcff).
- Vite: [5→6 migration](https://v6.vite.dev/guide/migration), [6.4.3 release](https://github.com/vitejs/vite/releases/tag/v6.4.3), and [6→7 migration / Node support](https://v7.vite.dev/guide/migration).
- React/R3F: [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) and [React Three Fiber v9 migration](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide).
- Other deferred majors: [Tailwind 4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide) and [ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0).
- Exact installed/latest and peer data: npm registry responses from `npm ls`, `npm outdated`, and `npm view` on the lookup date.

## Residual uncertainty

The npm advisory database is not a complete supply-chain assessment. No candidate package was installed or executed. Tree-shaking/reachability of every transitive module, package maintainer health, compromised-release risk, license drift, physical-device rendering changes, and future advisories remain unproven. Re-run this decision when an advisory affects production runtime, a maintained line reaches end of support, M1 needs a new capability, or six months elapse.

## M0-006 execution report

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | Passed | Installed 330 packages from the unchanged lockfile; reported 2 vulnerabilities and the known BVH deprecation. |
| `npm ls --all` | Passed | Exit 0; optional platform/feature peers are absent as expected, with no invalid or extraneous package. |
| `npm outdated` | Evidence exit 1 | Listed 23 outdated direct packages; exact current/wanted/latest values are summarized above. |
| `npm audit` / `--json` | Evidence exit 1 | 1 moderate + 1 high summarized vulnerable node; four advisory paths described above. |
| `npm run typecheck` | Passed | Application and Playwright strict configurations completed without diagnostics. |
| `npm run lint` | Passed | ESLint completed without diagnostics. |
| `npm test` | Passed | 7 files and 27 tests passed. |
| `npm run validate:content` | Passed | 3 validator tests passed. |
| `npm run build` | Passed | 1,123 modules transformed; existing large-chunk warnings remain. |
| `npm run bundle:check` | Passed | 2,400,583 raw; 1,264,685 gzip-9; all accepted ceilings passed. |
| `npm run test:browser` | Passed | 3 deterministic Chromium scenarios passed. |
| `npm run measure:performance` | Passed | Both profiles emitted SwiftShader-labelled reports; desktop 3.93 and mobile-sized 8.92 effective fps in this run, non-gating. |
| Package/lock/source/config/workflow mutation | None | Git diff contains documentation only. |
| Hosted `Quality Gates` | Pending | Required at the PR boundary. |

## Approved remediation outcome

M0-007 implemented the approved narrow path on 2026-07-13: Vite 6.4.3 exact, esbuild 0.25.12, and no unrelated direct upgrade. `npm audit --json` now reports zero vulnerabilities across 391 graph entries; all four cited Vite/esbuild advisories are absent. The known Drei → `three-mesh-bvh@0.7.8` deprecation remains deliberately deferred and is not an npm advisory.

Vite 6 preserved the content plugin, explicit hosts/ports, Pages asset base, ES2020 production target, and manual chunks. Total bundle changed from 2,400,583/1,264,685 raw/gzip-9 bytes to 2,404,749/1,265,950: +4,166 raw and +1,265 gzip-9, within accepted ceilings. Full unit, content, build, deterministic browser, and renderer-labelled reference checks passed. M1 is no longer blocked by the dependency decision once M0-007 is reviewed and merged.
