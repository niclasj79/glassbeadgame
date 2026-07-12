# M0 Performance and Bundle Baseline

## Measurement boundary

This M0-005 report does not optimize the game or certify physical hardware. Bundle evidence is deterministic and portable enough to gate CI. Frame evidence is a hardware-reference report because browser scheduling and WebGL performance vary by host, and this Windows Chromium run used SwiftShader software rendering.

```text
npm run build
npm run bundle:report
npm run bundle:check
npm run measure:performance
```

Transient JSON is written under ignored `artifacts/performance/`. The bundle report records every asset's original path, stable hash-independent name, category, raw and gzip-9 bytes, aggregate totals, production `/glassbeadgame/` base, and `es2020` target.

## Production bundle

| Category | Raw bytes | gzip-9 bytes |
| --- | ---: | ---: |
| JavaScript | 1,559,927 | 459,746 |
| CSS | 38,525 | 7,171 |
| Fonts | 788,504 | 788,088 |
| Images | 11,634 | 8,906 |
| Other, including HTML | 1,993 | 773 |
| Total | 2,400,583 | 1,264,685 |

Largest stable JavaScript assets are `vendor-three-[hash].js` at 683,657 raw bytes, `vendor-r3f-[hash].js` at 506,464, application `index-[hash].js` at 247,518, and `vendor-motion-[hash].js` at 122,288. Fonts are the largest aggregate non-JavaScript contributor and are already compressed formats. Sizes identify contributors; they do not prove runtime cost.

## Proposed portable bundle budgets

These first budgets become accepted only if this PR is reviewed and merged. They provide roughly 4–7% headroom and must not be silently loosened.

| Gate | Baseline | Proposed ceiling |
| --- | ---: | ---: |
| Total raw | 2,400,583 | 2,550,000 |
| Total gzip-9 | 1,264,685 | 1,350,000 |
| JavaScript raw | 1,559,927 | 1,700,000 |
| JavaScript gzip-9 | 459,746 | 500,000 |
| Largest asset raw | 683,657 | 720,000 |

`npm run bundle:check` fails for missing `dist`, missing measurements, or an exceeded ceiling. CI runs it after the production build and browser smoke.

## Frame methodology and observations

Both profiles use Chromium 149.0.7827.55, canonical seed, clean storage, DPR 1, explicit test-only inputs, a two-second warm-up, and five seconds of real R3F deltas in an idle arena. A long frame is over 50 ms. Percentiles use nearest rank; effective fps is `1000 / mean frame time`.

| Profile | Viewport | Quality / motion | Samples | Median | p95 | p99 | Long | Effective fps |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop baseline | 1280×720 | base / full | 22 | 247.2 ms | 332.9 ms | 347.9 ms | 22 | 3.88 |
| Mobile-sized fallback | 390×844 | potato / reduced | 65 | 114.6 ms | 134.7 ms | 178.0 ms | 65 | 8.54 |

Renderer: `ANGLE ... SwiftShader Device (Subzero)`, vendor `Google Inc. (Google)`, four reported hardware threads. Software results do not validate or refute the physical-device intent of 16.67 ms/60 fps desktop and 33.33 ms/30 fps mobile minimum. Those remain reference targets, not CI gates. The mobile profile emulates layout and quality inputs, not mobile CPU, GPU, thermals, or touch cost.

## Presentation hot paths

Inspection identifies, without claiming profiler causation:

- 3,000 animated star points, Drei Sparkles, and nebula layers;
- twelve glass beads with physical material, sprites, text, hit mesh, and per-frame work;
- per-frame thread, camera, motif, membrane, lattice, burst, illumination, and effects work;
- base/high postprocessing, omitted by the potato tier;
- synthesized ambient, motif, binaural, and effect voices after audio unlock.

GPU captures, browser task attribution, audio-thread profiling, memory timelines, and interaction traces remain necessary before attributing a bottleneck.

## Resource-lifetime inspection

Demonstrably bounded or cleaned:

- impacts use one 256-slot ring pool and starfield storage is fixed at 3,000 points;
- ambient motifs retain at most twelve entries, visual audio pulses at most 24, and noise uses one shared buffer per sample rate;
- inspected oscillators/buffer sources schedule finite stops; the ambient interval clears on stop;
- store subscriptions, unlock/interaction/context listeners, and the Illumination interval return cleanup functions;
- textures are module caches or component-owned memoized values; R3F owns mounted component resources while the persistent canvas avoids normal context churn.

Unverified with runtime counters or memory tooling:

- peak concurrent Web Audio nodes in a dense awakened web and prompt reclamation of connected filters/gains;
- the singleton audio engine's anonymous visibility listener across hot reloads;
- GPU resource counts across context loss, Lens changes, conclusion, and session restart;
- temporary Three vectors/colors in some per-frame calculations;
- pending burst-request growth when producers outrun rendering;
- heap growth across long sessions, background throttling, reload, and repeated Games.

## Remaining evidence gaps

Physical desktop/mobile GPUs, high DPR, thermals, battery, real audio hardware and jitter, unlocked-audio counters, memory/GC, cold font transfer, slow storage, input latency, context recovery, background tabs, and accessibility modes are not certified. Human review remains required before accepting budgets or trading audiovisual quality for performance.
