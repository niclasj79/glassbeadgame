# M0 Repository Map

## Scope and baseline

This is the evidence-backed M0-001 map of the active application on 2026-07-12. `src/` is the production application. `legacy/` is an archived Lovable/Supabase implementation: it is excluded by `eslint.config.js`, not included by `tsconfig.app.json`, and is not reached from `index.html` or `src/main.tsx`. It remains a same-origin persistence concern because `src/main.tsx` deletes four families of legacy keys at startup.

The repository is a single Vite/React package. `package.json` exposes `dev`, `build`, `build:dev`, `lint`, `typecheck`, and `preview`; it exposes no test, content-only, Playwright, performance, or PWA command. The lockfile is npm lockfile version 3.

## Entry points and screen transitions

Call path:

```text
index.html
  -> /src/main.tsx
     -> <App />
        -> persistent <ArenaCanvas /> / <Cosmos />
        -> persistent <AudioBridge />
        -> phase-selected DOM screen
```

- `src/main.tsx` imports fonts/CSS, publishes the development-only `window.__gbg.state` getter, removes archived persistence keys, and mounts `App` in `React.StrictMode`.
- `src/App.tsx::App` selects `phase` from `useStore` and renders `TitleScreen`, `SetupScreen`, `ArenaHud`, or `ConclusionScreen`. `CodexScreen`, `SoundToggle`, the Three canvas, and audio bridge remain mounted across phases.
- `src/ui/screens/TitleScreen.tsx` calls `goToSetup`, `beginSession` for the daily draw, or `setCodexOpen`.
- `src/ui/screens/SetupScreen.tsx` owns only the ephemeral discipline picks in React state; it calls `beginSession(picks)` or `returnToTitle`.
- `src/ui/arena/ArenaHud.tsx` calls `concludeSession`; a 0.7/4.2-second presentation timer then calls `finishConcluding`. With an empty web it calls `returnToTitle` directly.
- `src/ui/screens/ConclusionScreen.tsx` calls `goToSetup`, `returnToTitle`, or `setCodexOpen`.
- There is no router. URL state is limited to the `#gbg=...` progress-transfer token parsed by `src/App.tsx` through `progressFromHash`.

## Active ownership map

| Area | Current owner and exported symbols | Principal callers/consumers |
| --- | --- | --- |
| Reactive and durable state | `src/state/store.ts::useStore`; public state/types in `src/state/types.ts` | All screens/HUD, `src/scene/*`, and `src/audio/useAudio.ts` |
| Session draw | `src/game/session.ts::drawSession` | `useStore.beginSession` |
| Attempt/scoring/motifs | `src/game/rules.ts::{resolveAttempt, faintPoints, composeFaintInsight, detectNewMotifs, consecrateComponent, pickIlluminationTarget}` | `src/scene/threading.ts`, `useStore.spendInsight` |
| Rank and lifetime milestones | `src/game/ranks.ts::{rankFor,nextRank,rankProgress}` and `src/game/progress.ts::{computeMilestones,unlockIdsFor}` | title/conclusion/Codex UI and `useStore.addDiscovery` |
| Lens layout | `src/game/layout.ts::{fibonacciSpherePositions,lensPlanePositions,LENS_VIEWS}` | `src/scene/Cosmos.tsx`, `CameraRig.tsx`, `LensAxes.tsx`, HUD |
| Conclusion Annotation | `src/content/annotations.ts::composeAnnotation` | `src/ui/screens/ConclusionScreen.tsx` |
| Content model/index | `src/content/types.ts::{Concept,CuratedConnection,pairKey}`, `conceptById`, `connectionByPair`, `disciplineById` | session/rules, scene, audio, UI, validation |
| Content validation | `src/content/validate.ts::validateContent` | `vite.config.ts::contentGate.buildStart` |
| Input/commit | `src/scene/threading.ts` handlers and private `commit`; `src/scene/ThreadingDriver.tsx` listeners | bead hit meshes and window listeners |
| Per-frame presentation | `src/scene/frameState.ts::frameState` | scene components, pointer layer, ambient scheduler |
| Audio context and clock | `src/audio/engine.ts::audio` | `AudioBridge`, ambient engine, SFX, voices, `Threads` |
| Scheduled score | `src/audio/ambient.ts::ambient` | `AudioBridge`, `ThreadingDriver` |
| Themes | `src/themes/index.ts::{themeForSession,themeById}` and `src/themes/useTheme.ts::currentTheme` | session initialization, scene, audio, HUD |

## Current game-rule call paths

### Session generation

`beginSession` -> `drawSession(picks, optionalSeed)` -> seeded `mulberry32` shuffle. The draw plants up to four curated pairs within the selected-discipline quotas, fills remaining slots, adds one or two outside bridge concepts, shuffles the result, and counts available curated pairs. A supplied seed is deterministic; the default seed uses `Math.random`. The session additionally records wall-clock `startedAt` and selects a theme from the seed/daily flag.

### Attempt, score, motifs, and consecration

`beadPointerHandlers`/global pointer listeners -> `threading.ts::commit` -> `resolveAttempt` -> `detectNewMotifs` -> `useStore.addThread` -> `useStore.addDiscovery` -> optional `consecrateComponent`/`useStore.consecrateThreads`.

- A pair present in `connectionByPair` becomes a tier 1-3 curated discovery worth 8/13/21 points.
- Any other pair becomes a deterministic prose `Faint Resonance`; the first two are worth 2 points and later faint attempts 1 point.
- `detectNewMotifs` awards each motif ID at most once per session: triangle `triad` (15), three-discipline connected component `symposium` (20), or a simple five-bead path `fugue` (25).
- The first completed motif consecrates unconsecrated faint threads in its connected component for 3 points each.
- Each curated discovery and each motif grants one Insight. `spendInsight` deterministically selects an unwoven highest-tier curated pair from the current draw.

Rule results include `Date.now()` timestamps in threads/motif awards. Rule calculation is pure enough to extract, but it currently imports state types and wall time and the commit is not atomic.

### Rank, Lens, conclusion, and replay

- Rank is the number of distinct persisted curated connection IDs. Thresholds in `src/game/ranks.ts::RANKS` are 0/6/18/40/75.
- `cycleLens` rotates off -> Good x True -> Good x Beautiful -> True x Beautiful -> off. It cancels an in-flight interaction. `Cosmos` morphs the same bead set to `lensPlanePositions`; `CameraRig` moves to a front-facing chart view.
- `composeAnnotation(session)` is deterministic from `session.seed`, but selects authored fragments using dominant disciplines, highest-tier discoveries, the last motif, faint count, and score band. The conclusion UI still exposes numeric score, connection counts, motif counts, and rank.
- `finishConcluding` archives a snapshot. `src/ui/screens/SessionReplay.tsx` is a timer-driven DOM discovery slideshow; it is not a replay of input or audiovisual/domain events.

## Input and accessibility paths

- Pointer/mouse/touch weaving is centralized in `src/scene/threading.ts`: bead mesh `onPointerDown`, window `pointermove`/`pointerup`, a 6 px drag threshold, sphere raycast, 0.78-world-unit snap radius, and tap-then-tap sticky mode all converge on `commit`.
- Coarse pointers gain a 600 ms long-press inspection path. Hover updates `focusedBeadId`; the HUD provides a DOM close control for pinned inspection.
- Keyboard support in the world is limited to Escape cancellation. Beads are Three meshes rather than focusable DOM controls, so attention, selection, and weaving have no keyboard-equivalent path. Keyboard events also unlock audio and dismiss several DOM overlays.
- DOM controls use native buttons, focus-visible rings, selected/switch states, several dialog/label attributes, and an atlas SVG label. `MotionConfig reducedMotion="user"` covers Framer Motion; `prefersReducedMotion()` also suppresses scene bobbing, breath, camera transits, kick, and reveal time dilation.
- Reduced motion is sampled once when the store initializes; there is no media-query change listener or player-facing toggle. Relation meaning is heavily color/brightness/material based, and there is no caption/text equivalent for ambient or interaction audio.
- `probeWebGL` provides a text fallback with Codex access when progress exists. There is no 2D gameplay fallback.

## Audio lifecycle and synchronization

- `src/audio/engine.ts::AudioEngine` owns the singleton `AudioContext`, buses, compressor, generated convolution reverb, mute gain, breath filter, and binaural oscillators. `AudioBridge` unlocks it on the first pointer or key event.
- `AudioBridge` subscribes independently to phase, binaural preference, thread count, motif count, discovery count, interaction mode, and score. Phase starts/stops `ambient`; new threads/motifs add scheduled voices; discoveries trigger SFX; `concluding` triggers a cadence; score changes ambient gain.
- `src/audio/ambient.ts::AmbientEngine` uses a 25 ms JavaScript interval only as a look-ahead driver. It schedules up to 1.2 seconds ahead against `AudioContext.currentTime`; the Web Audio clock is authoritative for notes.
- When a motif note is scheduled, `AmbientEngine` appends `{threadId, atAudioTime, duration, flip}` to `frameState.pulses`. `src/scene/Threads.tsx` reads `audio.now()` each frame to place a light pulse along the thread, dropping stale entries after suspension. This is the one explicit audio-clock-to-visual synchronization path.
- The shared visual breath runs oppositely: `Cosmos` advances `frameState.breathPhase` on frame time and `ThreadingDriver` samples it at about 15 Hz into `audio.applyBreath`. Camera azimuth similarly drives the air-bed pan.
- SFX and voices schedule and stop against `AudioContext.currentTime`; random detune/gain/noise and ambient shimmer use `Math.random`, so audiovisual output is not replay deterministic even when the session draw is seeded.

## Scene subscriptions and frame ownership

`src/scene/frameState.ts` is the mutable 60 Hz presentation owner for positions/targets/rendered coordinates, time scale/clock, aim/snap/sympathy, breath, illumination, particle bursts, duplicate-thread pulse, audio-timed pulses, flare, camera kick, awakening, and recentering. It is intentionally outside React/Zustand and is not durable.

- `Cosmos` initializes/morphs positions, advances time/breath, and derives `awakening` from curated discoveries divided by `curatedAvailable`.
- `threading.ts::commit` directly queues bursts and sets flare, kick, and reveal time-scale target after store mutations.
- `CameraRig` reacts separately to phase, Lens, `concluding`, and reveal ID; it also reads `frameState.kick`, `recenter`, and idleness each frame.
- `Backdrop`, `Lattice`, `Effects`, `Beads`, `Threads`, `Membranes`, and `MotifMarks` independently read store or frame state. `Threads`, `MotifMarks`, and ambient audio each react to the same new thread/motif through separate paths; no coordinated cue planner exists.
- `ArenaCanvas` is persistent. Drei `PerformanceMonitor` mutates the nonpersisted quality tier between high/base/potato, and WebGL context restore remounts the canvas.

## Content model and ID stability

- `Concept.id` is a hand-authored stable string such as `math.fibonacci-sequence`; maps are built by `new Map(concepts.map(...))` without runtime duplicate protection outside the build validator.
- `CuratedConnection.id` must equal `pairKey(a,b)`, the lexical sort of stable concept IDs joined by `+`. `connectionByPair` is the authoritative lookup and those IDs are persisted as Codex keys.
- Current concepts contain discipline, description, TBG coordinates, pitch degree, keywords, and optional bridge status. Connections contain endpoints, title, insight, tier, and optional quote. They do not contain vertical-slice facets, relation/evidence class, sources, direction, counterpoint, content-pack version, or Open Thread templates.
- `validateContent` enforces six disciplines, 15 concepts per discipline, unique concept/pair IDs, valid references/ranges, keyword/description bounds, canonical pair IDs, connection insight/title bounds, and reports coverage warnings. It does not validate persisted store data.

## Deployment, base path, offline, and environment

- `.github/workflows/deploy.yml` runs only on pushes to `main` or manual dispatch, uses Node 20, `npm ci`, `npm run typecheck`, and `npm run build`, uploads `dist`, then deploys GitHub Pages. It does not run lint or tests. Pull requests have no workflow in this repository.
- `vite.config.ts` uses `/glassbeadgame/` only for build and `/` for dev. `index.html` uses `%BASE_URL%` for icons, while its module entry is Vite's root-style `/src/main.tsx`. The dev server binds `::` on port 8080.
- There is no manifest, service worker, registration code, or PWA plugin. The app is static/account-free, but the README claim “fully offline-capable” is not implemented as an installable/offline-cached PWA. This is a current-code gap against `docs/ARCHITECTURE.md` section 14 and the vertical-slice offline requirement, not a change authorized by M0-001.
- Production dependencies include React/R3F/Three, Zustand, Framer Motion, fonts, Tailwind-era utilities, and the development-only Lovable tagger. No backend is imported by active `src/`.

## Bundle and asset structure before new tooling

- All authored concepts/connections and all audio are code-generated or synthesized; there are no recorded audio, image textures, or model assets in active `src/`/`public`.
- `public/` contains two favicons, `placeholder.svg`, and `robots.txt`. Fonts are bundled from npm packages. Scene textures are generated by canvas in `src/scene/textures.ts`.
- Vite manually splits `vendor-three`, `vendor-r3f`, and `vendor-motion`; remaining application/content code is in the application chunk. The production build report in `M0-VALIDATION-COMMANDS.md` is the bundle-size baseline available without adding tooling.

## Migration hazards and safe seams

Highest-risk hazards:

1. `useStore` is simultaneously rule engine, reactive adapter, and persistence source. An event migration can create two durable truths unless each mutation is replaced end-to-end.
2. A weave is multiple observable mutations (`addThread`, `addDiscovery`, optional `consecrateThreads`) plus direct frame/SFX writes. Subscribers may observe intermediate state and cannot coordinate a semantic moment.
3. Persistence accepts unvalidated historical JSON, has `version: 1` but no `migrate`, and stores content IDs and full session snapshots. Content-ID or shape changes can silently retain incompatible data.
4. Wall-clock timestamps and audio randomness prevent deterministic replay; the archived snapshot is insufficient to reconstruct gesture, ordering semantics beyond arrays, Lens use, or presentation timing.
5. Keyboard play, offline/PWA behavior, and automated browser coverage are absent despite canonical requirements.
6. The build/deploy workflow couples validation and production deployment on `main`, while PR validation is absent.

Safe seams:

- `drawSession`, layout functions, progress token cleaners, rank functions, content validation, and most graph helpers are framework-light and suitable for direct M0-002 characterization tests.
- `pairKey`, `conceptById`, and `connectionByPair` are stable boundaries that can anchor fixtures before schema expansion.
- `threading.ts::commit` is already the single convergence point for pointer gestures and `devCommit`; it is the safest later command-boundary insertion point, but M0-001 does not change it.
- `AudioBridge` centralizes React-to-audio subscriptions, `AudioEngine.now()` exposes the audio clock, and `frameState.pulses` demonstrates a working explicit sync seam.
- Zustand `partialize` clearly enumerates the current durable slice, enabling fixture capture before a repository/event migration.

## Canonical-specification gaps found

No authoritative documents conflict with each other. Current code conflicts with or has not yet implemented canonical direction in these known areas: hidden curated endpoints and generic faint prose; direct Zustand rule ownership; localStorage rather than event-log/IndexedDB persistence; score/rank-first results; topological rather than semantic motifs; no relation declaration/Open Threads/sources; no deterministic event replay; independent presentation subscriptions; missing keyboard-equivalent world interaction; and missing PWA/offline cache. These are migration inputs, not changes made by M0-001.
