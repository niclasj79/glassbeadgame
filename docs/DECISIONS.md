# Glass Bead Game — Foundational Decisions

These decisions are accepted for the vertical slice unless superseded by a later ADR.

## ADR-001 — Web-first platform

**Status:** Accepted

The game remains a browser-native web game and installable PWA. Native wrappers may be added later for distribution, but there will not be separate native and web gameplay codebases.

**Reason:** instant link access, sharing, offline installation, procedural audiovisual scope, and current working implementation make the web a strategic advantage rather than a compromise.

## ADR-002 — Incremental evolution of the current stack

**Status:** Accepted

Retain TypeScript, Vite, React, React Three Fiber, Three.js, Zustand, and Web Audio. Do not rewrite the vertical slice in Unity, Godot, Babylon.js, or another engine.

**Reason:** the existing renderer, input, camera, effects, and audio foundation already solve important problems. Product design and architecture are the bottlenecks.

## ADR-003 — Event-sourced durable session state

**Status:** Accepted

Every durable session mutation is represented as a typed, versioned domain event reduced by pure TypeScript.

**Consequences:** deterministic replay, testing, sharing, persistence migration, topology-aware conclusion, and future sync become tractable. Event versioning and migration become permanent responsibilities.

## ADR-004 — WebGL2 baseline, optional future WebGPU

**Status:** Accepted

The slice targets WebGL2. WebGPU may later provide enhanced paths after a measured need and compatible fallback exist.

**Reason:** WebGPU migration does not solve the current design problem and would expand compatibility and maintenance risk.

## ADR-005 — Local-first and account-optional

**Status:** Accepted

Core play, saves, Codex, Open Threads, and replay remain functional offline and without an account. Any future backend adds sync, sharing, aggregation, or entitlement rather than authorizing basic play.

## ADR-006 — Documented relations and Open Threads

**Status:** Accepted

A player-created thread does not need to match an authored connection to matter, but the game must distinguish evidence-backed relations from interpretation. Unsupported relations become specific Open Threads or honest unresolved states, never generic fabricated insight.

## ADR-007 — Content as validated data

**Status:** Accepted

Concepts, facets, relations, sources, evidence classes, musical identities, and world rules are versioned authored data validated during build and at persistence/import boundaries.

## ADR-008 — Domain rules independent of presentation

**Status:** Accepted

React, Zustand, Three.js, shaders, Web Audio, and persistence adapters may present or store results but do not own durable game rules.

## ADR-009 — Coordinated presentation cues

**Status:** Accepted

Semantic events are staged through a cue-planning boundary coordinating scene, camera, audio, UI, and haptics. Independent subscriptions must not produce contradictory approximations of the same moment.

## ADR-010 — Qualitative outcome over score

**Status:** Accepted

The slice removes conventional score as the primary player-facing result. It uses a qualitative portrait derived from the session's topology, relation semantics, order, and unresolved questions.

## ADR-011 — One task, one branch, one reviewable PR

**Status:** Accepted

Autonomous Codex work stops after one scoped task and PR. It does not chain into the next roadmap item. Human review is mandatory for the categories listed in `AGENTS.md`.

## ADR-012 — No backend for the vertical slice

**Status:** Accepted

The vertical slice uses static hosting and local persistence only. Backend interfaces may be designed but not implemented unless a later approved task changes scope.