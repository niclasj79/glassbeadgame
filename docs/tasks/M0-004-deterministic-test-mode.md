# M0-004 — Establish deterministic browser test mode

## Status

Review

## Milestone

M0 — Trustworthy baseline

## Dependencies

- M0-001 must be Done.
- M0-002 must be Done.
- M0-003 must be Done.

## Objective

Create a fixed-seed, controlled-clock browser test mode and the first repeatable Playwright smoke test without changing ordinary gameplay behavior.

## Why this exists

The unit baseline characterizes framework-light rules, but the current browser experience still depends on wall time, animation time, audiovisual randomness, device-derived quality, and development-only global hooks. Later interaction, persistence, accessibility, and performance tasks need a reproducible browser route that exposes safe test controls without exposing hidden connection endpoints during ordinary play.

## Required reading

- `AGENTS.md`;
- `docs/ARCHITECTURE.md`, especially sections 15 and 16;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 5 and 23;
- all M0 audit deliverables;
- M0-002 implementation notes and test gaps;
- M0-003 CI and branch-protection documentation.

## Existing code to inspect

- `src/main.tsx` development-only `window.__gbg` state getter;
- `src/scene/ThreadingDriver.tsx` development-only `window.__gbgTest` adapter;
- `src/scene/threading.ts::devCommit` and the private commit path;
- `src/game/session.ts::drawSession` and `src/lib/utils.ts` seeded helpers;
- `src/state/store.ts` session timestamps and `beginSession`;
- `src/scene/frameState.ts` plus `performance.now()` consumers;
- `src/audio/{engine,ambient,sfx,voices}.ts` random and clock inputs;
- `src/lib/device.ts` quality, pointer, and reduced-motion detection;
- `vite.config.ts`, `vitest.config.ts`, `package.json`, and `.github/workflows/ci.yml`.

## Scope

Implement a test-only runtime boundary that:

1. recognizes `?testMode=1&seed=<stable-seed>` only in development or an explicit test build/server path;
2. converts the supplied stable seed deterministically and routes session creation through the existing seeded `drawSession` path;
3. supplies a controlled game wall clock for browser-tested timestamps without redefining the Web Audio scheduling clock;
4. fixes viewport, device-pixel ratio, quality tier, reduced-motion inputs, and other device-derived test inputs;
5. disables or deterministically controls audiovisual noise that would make state or screenshots unstable, including current `Math.random()` presentation paths;
6. exposes a typed, minimal browser adapter only while test mode is active;
7. preserves the real session/store and commit paths behind adapter commands rather than duplicating rules;
8. adds a Playwright Chromium smoke command that proves two clean runs of the same route produce the same observable session result;
9. adds the browser smoke command to CI after the existing quality gates;
10. documents the exact local command and remaining browser gaps.

The canonical route for acceptance is:

```text
?testMode=1&seed=castalia-golden-001
```

## Test adapter boundary

The adapter may expose only what deterministic automation needs, such as:

- starting the existing session flow with explicit discipline picks;
- reading a sanitized session snapshot;
- locating rendered beads after the scene is ready;
- committing through the existing `devCommit`/commit seam;
- advancing or reading the controlled game clock when required.

It must not create an alternative game-rule implementation. Hidden curated endpoints and write commands must not be exposed when test mode is absent, including during ordinary development.

## Out of scope

- redesigning session generation or gameplay rules;
- implementing domain events, replay, commands, or IndexedDB;
- full golden-path interaction coverage;
- touch, keyboard, audio-unlock, offline, or accessibility suites;
- screenshot approval or visual-regression baselines;
- performance budgets or profiling;
- production debug controls;
- dependency major upgrades unrelated to the selected browser runner.

## Constraints

- Any new browser-test dependency must be development-only, pinned deliberately, and justified in the PR.
- The public production build must not expose test globals, hidden connection endpoints, or test-only write commands.
- A supplied seed must remain deterministic; invalid or missing test parameters must fail safely or use an explicitly documented fallback.
- The controlled game clock must not replace `AudioContext.currentTime` as the authority for scheduled audio.
- Tests must use clean browser storage and must not depend on execution order, network services, audio hardware, or a physical GPU.
- Do not use React state for frame animation or duplicate durable rules in test helpers.

## Acceptance criteria

- `npm run test:browser` exists, runs headless Chromium, and exits nonzero on failure.
- The canonical test URL is reproducible from a clean checkout using documented commands.
- Two fresh browser contexts using `castalia-golden-001` produce identical sanitized session snapshots, including numeric seed, bead order, theme, and controlled timestamps.
- A different stable seed produces a different draw while remaining repeatable.
- The smoke test exercises at least one real store/session path and one real thread commit path.
- Test mode fixes or suppresses the identified device, wall-clock, and audiovisual randomness relevant to assertions.
- The browser adapter is typed, test-mode-only, and absent when the flag/build gate is not active.
- Ordinary development and production behavior remain unchanged when test mode is off.
- CI installs the required Chromium runtime and runs the browser smoke after unit/content/build validation.
- Remaining mouse, touch, keyboard, audio, rendering, offline, persistence, and accessibility gaps are documented rather than implied covered.

## Required tests and checks

- dependency installation from the lockfile;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run validate:content`;
- `npm run build`;
- `npm run test:browser`;
- workflow syntax and the pull request's `Quality Gates` run.

Targeted performance checks are not required; M0-005 owns the measured baseline.

## Expected completion report

Report:

- test-mode boundary and why it cannot leak into ordinary production;
- clock, seed, device, audio, and visual nondeterminism controlled;
- Playwright version and browser-install strategy;
- browser scenarios and observable snapshots covered;
- local/CI command parity;
- remaining browser and audiovisual gaps;
- every required check and exact outcome.

## Human review

Required because the task introduces a browser automation boundary, test-only state access, and CI runtime changes. Automated checks do not validate audiovisual comfort or artistic quality.

## Implementation notes

- Added a development-gated `testMode` runtime that converts the stable URL seed, supplies controlled game and presentation clocks, and replaces browser-tested random inputs without changing the Web Audio scheduling clock.
- Fixed test-mode device inputs, canvas DPR, reduced motion, and audio startup. Ordinary development and production retain their existing device, timing, randomness, and audio behavior.
- Replaced the broad development globals with a typed `window.__gbgTest` adapter that exists only for a valid test-mode route and delegates to the real session store and thread commit seam.
- Pinned `@playwright/test` 1.61.1 as a development dependency. CI installs its Chromium runtime after the production build and runs `npm run test:browser`.
- Browser coverage proves identical clean-context snapshots for `castalia-golden-001`, repeatability plus a different draw for another seed, controlled timestamp advancement, a real thread commit, and absence of test globals in ordinary development.
- Remaining gaps are pointer/touch/keyboard interaction, audio unlock and scheduling behavior, screenshot approval, WebGL fallback and recovery, offline/PWA behavior, real-browser persistence failures, accessibility auditing, and performance budgets.
