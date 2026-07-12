# Glass Bead Game — Target Architecture

## 1. Architectural objective

Evolve the existing web game incrementally into a deterministic, local-first audiovisual system in which durable game meaning is independent of React, Three.js, Web Audio, storage, and presentation timing.

The current stack remains the foundation: TypeScript, Vite, React, React Three Fiber, Three.js, Zustand, and Web Audio. The redesign is an extraction and clarification of responsibilities, not an engine rewrite.

## 2. Layer model

```text
Authored content
      ↓
Domain engine: events, reducer, graph, rules, motifs, portrait
      ↓
Application runtime: commands, session clock, repositories, cue planning
      ↓
Presentation adapters
  ├─ React UI
  ├─ R3F/Three scene
  ├─ Web Audio
  ├─ camera and haptics
  └─ accessibility representation
      ↓
Platform adapters
  ├─ IndexedDB
  ├─ service worker/PWA
  ├─ input devices
  └─ optional future sync API
```

Dependencies point downward only through explicit interfaces. Domain code imports no browser, React, Three.js, Zustand, or Web Audio APIs.

## 3. Proposed repository evolution

```text
src/
  domain/
    ids.ts
    events/
    model/
    reducer/
    graph/
    relations/
    motifs/
    portrait/
    annotation/
    replay/
  runtime/
    commands/
    cues/
    clock/
    repositories/
    workers/
  content/
    schemas/
    concepts/
    relations/
    worlds/
    sources/
    validation/
  state/
    zustand adapters and selectors
  scene/
    R3F presentation only
  audio/
    Web Audio presentation only
  ui/
    DOM UI and accessibility surfaces
  platform/
    indexeddb/
    pwa/
    input/
```

Existing directories are migrated incrementally. Do not create duplicate permanent rule systems.

## 4. Domain events

All durable session changes are represented as typed, versioned events. Initial vocabulary includes:

- session started;
- bead attended;
- pair selected;
- relation hypothesized;
- thread committed;
- documented relation revealed;
- Open Thread created;
- motif completed;
- Attunement entered/exited;
- session concluded.

Each event contains stable IDs, schema version, session sequence, game-relative time, and typed payload. Wall-clock time must not determine replay behavior.

Expressive gesture data belongs in an event only when it affects replay or the final composition. Ephemeral hover and frame state do not.

## 5. Reducer and derived state

A pure reducer derives `SessionState` from an initial state and ordered events.

```ts
next = reduceSession(previous, event)
replayed = events.reduce(reduceSession, initial)
```

Rules must not be duplicated in Zustand actions, React handlers, scene components, shaders, or audio scheduling code.

Derived selectors calculate graph topology, available commands, motif eligibility, portrait dimensions, and presentation-relevant summaries.

## 6. Command boundary

UI and input adapters issue commands, not direct state mutation.

```text
Input → Command → validation/rules → one or more events → reducer
```

Commands may fail with explicit domain reasons. Cancellation and preview do not create durable changes unless specified.

## 7. Zustand

Zustand remains a reactive adapter for application and presentation state. It may hold:

- current reduced domain state;
- event log reference;
- ephemeral selection and modal state;
- quality and accessibility preferences;
- presentation cue queue.

It must not become an independent source of game rules.

## 8. Presentation cue system

Domain events describe what happened. Presentation cues describe how that meaning is staged.

```ts
interface PresentationCue {
  id: string;
  type: string;
  sourceEventId: string;
  startAt: number;
  duration: number;
  payload: unknown;
}
```

A cue planner maps events and current presentation context into coordinated cues consumed by scene, audio, camera, UI, and haptics directors.

One semantic event should coordinate the whole response. A documented relation reveal must not be independently approximated by several unrelated subscriptions.

## 9. Rendering

- WebGL2 is the baseline renderer.
- React Three Fiber remains the scene integration layer.
- Per-frame animation uses refs, frame-local structures, shaders, and pooled objects rather than React state.
- Draw calls, transparent layers, DPR, particles, and postprocessing are quality-tiered.
- Materials and effects encode semantic state, not only decoration.
- WebGPU may be explored later behind capability detection, never as the slice baseline.

## 10. Audio

- The Web Audio clock is authoritative for scheduled music.
- A look-ahead scheduler remains the timing foundation.
- Each concept has authored musical identity data.
- Relation rules transform concept motifs.
- AudioWorklet is used only for justified custom DSP or low-latency gesture sonification.
- Every voice has a bounded lifetime.
- Visual synchronization consumes scheduled audio times where appropriate.
- The conclusion score is compiled from the event log.

## 11. Persistence

Define repository interfaces before choosing implementation details.

```ts
interface ProgressRepository {
  loadProfile(): Promise<PlayerProfile>;
  saveSession(session: PersistedSession): Promise<void>;
  loadSession(id: SessionId): Promise<PersistedSession | null>;
  saveCodex(codex: CodexState): Promise<void>;
}
```

Vertical-slice implementation: IndexedDB.

`localStorage` is restricted to small preferences during migration. Persisted schemas are versioned and have explicit migrations. Event logs remain canonical; snapshots may be added for performance without replacing the log.

## 12. Content architecture

Content is authored data validated at build time and runtime boundaries.

Required entities:

- concept;
- facet;
- documented relation;
- source;
- evidence class;
- world rules;
- concept music identity;
- relation audiovisual grammar;
- Open Thread prompt template.

Every documented relation requires at least one source. Evidence class is separate from conceptual depth, rarity, and aesthetic intensity.

## 13. Workers

Web Workers are introduced only when profiling identifies main-thread work, likely for:

- graph analysis;
- motif search;
- conclusion compilation;
- content-pack parsing;
- large layout calculations.

Workers consume serializable domain inputs and return deterministic outputs.

## 14. PWA and hosting

Vertical slice:

- GitHub Pages;
- GitHub Actions deployment;
- web manifest;
- service worker;
- offline core shell and content pack;
- update only between sessions.

Full version may move static hosting and optional APIs to a CDN/serverless platform without changing the core client architecture.

## 15. Testing layers

### Unit

Vitest or the selected lightweight runner for:

- events and validation;
- reducer;
- session generation;
- relation rules;
- motif detection;
- portrait and Annotation;
- persistence migrations;
- content validation.

### Browser

Playwright for:

- mouse, touch, and keyboard golden path;
- audio unlock;
- deterministic test mode;
- offline restore;
- IndexedDB persistence;
- reduced-motion and quality modes;
- conclusion and reload.

### Human review

Required for audiovisual legibility, emotional pacing, comfort, intellectual honesty, and artistic quality.

## 16. Deterministic test mode

A test mode accepts a fixed seed and controlled clock, disables nondeterministic visual noise, exposes safe test commands, fixes viewport/DPR, and allows screenshot or state assertions.

Suggested URL:

```text
?testMode=1&seed=castalia-golden-001
```

## 17. Dependency policy

- inspect existing capability before adding a package;
- production dependencies require task-level justification;
- pin and upgrade deliberately;
- do not combine major dependency upgrades with gameplay architecture changes;
- prefer small adapters over framework lock-in.

## 18. Migration strategy

1. establish checks and baseline;
2. introduce domain types and events alongside existing behavior;
3. implement reducer and replay tests;
4. adapt one interaction end-to-end;
5. remove the corresponding legacy mutation path;
6. repeat by vertical capability;
7. migrate persistence after event state is stable;
8. add final audiovisual systems after the core loop is proven.

At no stage should two durable sources of truth remain indefinitely.