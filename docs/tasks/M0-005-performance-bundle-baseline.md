# M0-005 — Establish performance and bundle baseline

## Status

Ready

## Milestone

M0 — Trustworthy baseline

## Dependencies

- M0-001 must be Done.
- M0-002 must be Done.
- M0-003 must be Done.
- M0-004 must be Done.

## Objective

Measure the current production bundle and representative browser runtime, establish explicit reviewable budgets for the existing quality tiers, and add repeatable regression checks without changing gameplay or optimizing the implementation.

## Why this exists

The vertical-slice specification requires stable desktop 60 fps, a modern-mobile 30 fps minimum, bounded audiovisual resources, and responsive interaction and scheduling. Existing build output records large chunks and the scene adapts quality at runtime, but there is no repeatable measurement method, accepted budget, machine-readable report, or regression command. Later rendering and audiovisual work needs an honest baseline before optimization decisions are made.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially technical success criteria;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 21–23;
- `docs/ARCHITECTURE.md`, especially sections 9, 10, 15, and 16;
- `docs/CURRENT-STATE-AUDIT.md` performance unknowns;
- all M0 audit deliverables;
- M0-004 implementation notes, deterministic route, and browser gaps.

## Existing code to inspect

- `vite.config.ts` chunking, target, and build output;
- `package.json`, `playwright.config.ts`, and `.github/workflows/ci.yml`;
- `src/lib/device.ts` quality selection;
- `src/scene/ArenaCanvas.tsx` DPR and `PerformanceMonitor` behavior;
- `src/scene/frameState.ts` and all `useFrame` consumers;
- particle, material, postprocessing, thread, and texture allocation paths under `src/scene/`;
- voice, oscillator, buffer, scheduler, and cleanup paths under `src/audio/`;
- the production assets emitted to `dist/`;
- the canonical deterministic route and adapter introduced by M0-004.

## Scope

1. Add a deterministic bundle-report command that builds or inspects the production output and records every emitted JavaScript, CSS, font, image, and other asset with raw and compressed sizes.
2. Produce stable aggregate totals and named chunk measurements that can be compared across commits without depending on hashed filenames.
3. Add a repeatable Chromium performance scenario using the M0-004 route, fixed viewport/DPR, explicit quality tier, clean storage, and a documented warm-up and sampling window.
4. Measure frame-time distribution rather than a single average, including sample count, median, p95, p99, long-frame count, and effective fps for at least desktop baseline and mobile-sized fallback profiles.
5. Record relevant browser/runtime context with each report: commit, browser version, viewport, DPR, quality tier, reduced-motion state, hardware-concurrency signal, and whether software rendering is detected.
6. Inspect and document boundedness of particles, materials, render targets, textures, audio voices/nodes, timers, and event listeners. Add targeted assertions only where a stable observable seam already exists or can be introduced without duplicating presentation logic.
7. Establish proposed bundle and frame-time budgets from the measured baseline and specification intent. Separate portable CI regression limits from hardware-dependent reference targets.
8. Add discoverable local commands and CI coverage for deterministic, portable checks. Hardware-sensitive measurements may report evidence without gating CI when runner variance makes a threshold misleading.
9. Write the baseline report, measurement limitations, accepted/proposed budgets, and exact reproduction commands under `docs/audits/`.
10. Preserve existing gameplay, quality adaptation, rendering, audio scheduling, and device behavior outside explicit measurement mode.

## Required measurement profiles

- Desktop baseline: Chromium, 1280×720 CSS viewport, DPR 1, base quality, reduced motion disabled where determinism permits.
- Mobile-sized fallback: Chromium, 390×844 CSS viewport, DPR 1, potato quality, reduced motion enabled.
- Production bundle: a clean `npm run build` output using the repository's configured Pages base and ES target.

The profiles emulate layout and quality inputs; they do not claim to reproduce physical mobile GPU performance. Any software-rendered CI result must be labeled accordingly.

## Out of scope

- performance optimization or visual-quality reduction;
- changing quality-tier selection or fallback behavior;
- gameplay, content, event, persistence, input, or audio-design changes;
- production telemetry or third-party analytics;
- Lighthouse scoring as a substitute for scene frame-time measurement;
- native-device certification;
- dependency upgrades except a narrowly justified development-only measurement tool when existing Playwright/Node capability is insufficient;
- treating one CI runner's GPU timing as universal device evidence.

## Constraints

- Do not fabricate thresholds before measuring the checked-in baseline.
- Measurement code must not become a second animation loop or durable source of truth.
- Prefer the existing pinned Playwright and Node standard-library capabilities before adding dependencies.
- Reports must distinguish raw, compressed, portable CI, software-rendered, and hardware-reference measurements.
- Generated transient reports must not dirty ordinary working trees unless an intentionally reviewed baseline artifact changes.
- A regression command must exit nonzero when a portable accepted budget is exceeded or its required measurements are missing.
- Do not silently loosen an accepted budget to make a check pass.

## Acceptance criteria

- At least one documented command emits a deterministic machine-readable bundle report and exits nonzero on an accepted bundle-budget regression.
- Bundle reporting includes per-asset raw/compressed size, stable chunk identity, aggregate JavaScript/CSS/font/other totals, and the configured base/target context.
- The canonical route yields repeatable frame samples for both required profiles with median, p95, p99, long-frame count, effective fps, and environment metadata.
- Measurement methodology documents warm-up, sample duration/count, animation state, quality tier, viewport, DPR, reduced motion, and renderer limitations.
- The audit names the current largest bundle contributors and presentation hot paths without claiming causation unsupported by profiling evidence.
- Resource-lifetime inspection records which particle, material, texture, render-target, audio-node, timer, and listener paths are demonstrably bounded and which remain unverified.
- Proposed frame-time and bundle budgets are explicit, traceable to the measured evidence and specification intent, and clearly identify which values gate CI.
- CI runs all deterministic portable regression checks after the existing build/browser validation without relying on network services or physical GPU access.
- Ordinary development and production behavior are unchanged when measurement mode is absent.
- Remaining physical-device, audio-hardware, GPU, thermal, memory, loading, and interaction-latency gaps are explicit.

## Required tests and checks

- dependency installation from the lockfile;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run validate:content`;
- `npm run build`;
- `npm run test:browser`;
- new bundle and performance measurement/regression commands;
- workflow syntax and the pull request's `Quality Gates` run.

## Expected completion report

Report:

- commands, profiles, warm-up, sampling, and renderer context;
- raw and compressed bundle totals plus largest stable chunks/assets;
- frame-time distributions for both profiles;
- bounded and unverified resource-lifetime paths;
- accepted/proposed portable and hardware-reference budgets;
- CI gating decisions and variance rationale;
- every required check and exact outcome;
- remaining device, GPU, audio, memory, loading, and latency gaps.

## Human review

Required to accept the first budgets and interpret audiovisual quality, comfort, and hardware representativeness. Automated measurements do not authorize visual or audio degradation and must not be treated as physical-device certification.
