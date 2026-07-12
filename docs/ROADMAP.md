# Glass Bead Game — Vertical Slice Roadmap

## Operating principle

Milestones are organized by playable capability, not by discipline or department. A milestone is complete only when its gate is satisfied. Codex must not infer that later work is authorized merely because it appears in this document.

## Status vocabulary

- **Draft** — not sufficiently specified;
- **Blocked** — dependency or decision unresolved;
- **Ready** — executable by Codex;
- **In progress** — assigned on a branch;
- **Review** — checks complete, awaiting acceptance;
- **Done** — accepted and merged;
- **Superseded** — intentionally replaced.

## M0 — Trustworthy baseline

### Goal

Make the current repository reproducible, measurable, and safe to change.

### Work

- M0-001 repository architecture and mutation audit;
- M0-002 establish test runner and baseline checks;
- M0-003 CI for typecheck, lint, tests, content validation, and build;
- M0-004 deterministic test mode;
- M0-005 performance and bundle baseline;
- M0-006 dependency-upgrade decision and, if approved, isolated upgrade.

### Gate

The current game builds and deploys from a clean checkout; required checks are automated; a fixed-seed test route is reproducible; major state, persistence, input, audio, and scene call paths are documented.

## M1 — Domain foundation

### Goal

A complete abstract session can be played and replayed without React, Three.js, Zustand, storage, or Web Audio.

### Work

- stable branded IDs;
- versioned domain events;
- pure session reducer;
- command boundary;
- serialization and validation;
- deterministic replay;
- domain selectors;
- event-log compatibility policy;
- Zustand adapter for one migrated path.

### Gate

The golden-path session can be represented as events, reduced deterministically, serialized, parsed, and replayed in unit tests.

## M2 — New interaction loop

### Goal

The player can Attend → Hypothesize → Weave → Commit using placeholder presentation.

### Work

- attention state;
- candidate resonance model;
- pair selection;
- relation declaration;
- expressive gesture profile;
- command validation and cancellation;
- typed thread commit event;
- mouse, touch, and keyboard paths.

### Gate

A browser test completes the new interaction loop and reloads the resulting event-derived state.

## M3 — Documented relations and Open Threads

### Goal

Every committed thread receives an intellectually honest, durable outcome.

### Work

- normalized concept and facet model;
- relation taxonomy;
- evidence classes;
- source schema;
- documented reveal;
- Open Thread generation;
- weak/unresolved outcome;
- build-time content validation;
- migration of the slice content pack.

### Gate

No committed thread produces generic pseudo-insight; documented assertions have sources; replay preserves relation intent and outcome.

## M4 — Semantic audiovisual grammar

### Goal

Every relation is immediately expressed through coordinated form, sound, motion, and consequence.

### Work

- presentation cue planner;
- scene, camera, audio, UI, and haptic directors;
- concept musical motifs;
- relation music transformations;
- semantic thread materials;
- attention sound-space behavior;
- reveal-level hierarchy;
- controlled dissonance for Tension.

### Gate

Human reviewers can distinguish Echo, Passage, Tension, and Ground from audiovisual behavior without relying only on labels or color.

## M5 — Semantic motifs and topology response

### Goal

Different webs produce materially different worlds and music.

### Work

- Dialectic, Canon, and Bridge rules;
- graph/topology selectors;
- motif audiovisual entries;
- environmental response to density, range, cycles, bridges, centrality, tension, coherence, and openness;
- topology-aware camera grammar;
- removal of score-based awakening dependencies.

### Gate

Two deliberately different golden-path variants produce recognizably different environment, orchestration, and motif behavior.

## M6 — Attunement and conclusion performance

### Goal

The session resolves as a performance of the exact web the player created.

### Work

- Attunement eligibility and state;
- UI withdrawal;
- conductive gesture input;
- conclusion compiler from event log;
- creation-order thread entry;
- gesture-aware phrasing;
- topology-driven climax;
- qualitative portrait;
- topology-aware Annotation.

### Gate

Replaying a saved session reconstructs the same domain result and materially equivalent audiovisual performance structure.

## M7 — Persistence, PWA, accessibility

### Goal

The slice is durable, installable, offline-capable, and accessible across target modes.

### Work

- IndexedDB repository;
- schema migrations;
- import of legacy localStorage progress where feasible;
- service worker and manifest;
- offline content/audio caching;
- update-between-sessions behavior;
- reduced motion and reduced bloom;
- color-independent patterns;
- keyboard navigation;
- captions/textual equivalents;
- quality tiers and mobile thermal budget.

### Gate

The golden path works offline after initial load, survives reload, and passes accessibility and target-device smoke tests.

## M8 — Content and release polish

### Goal

A public vertical slice that makes a complete artistic and intellectual statement.

### Work

- final twenty-four concepts;
- final documented relation set and sources;
- Open Thread prompts;
- Castalia art pass;
- final concept motifs and recorded assets where appropriate;
- onboarding overture;
- copy edit;
- performance optimization;
- external playtest instrumentation;
- GitHub Pages release deployment.

### Gate

All technical checks pass; success criteria in the master plan have been evaluated through external playtesting; no P0/P1 defects remain.

## Safe parallelism

Generally safe when files and architectural boundaries do not overlap:

- content-source research alongside CI setup;
- accessibility audit alongside domain-event design;
- asset prototyping alongside M0 performance measurement;
- documentation refinement alongside isolated test-harness work.

Generally unsafe:

- event vocabulary and reducer in separate uncoordinated branches;
- reducer and Zustand migration concurrently;
- cue planner and independent audio/scene event subscriptions concurrently;
- interaction rewrite and pointer-state rewrite concurrently;
- persistence schema and event schema concurrently;
- final visual polish before M2/M3 behavior stabilizes.

## Automation boundary

A self-deploying Codex loop may select only tasks marked Ready whose dependencies are Done and whose declared file boundaries do not overlap active tasks. It must create one branch and one reviewable PR per task. It must never automatically select the next task in the same run.

Auto-merge is prohibited for:

- product or specification changes;
- event-schema changes after public persistence exists;
- persistence migrations;
- content assertions or source changes;
- accessibility regressions;
- dependency major-version upgrades;
- deployment workflow changes;
- tasks with required human audiovisual review.

## Definition of Codex steering readiness

The project is Codex-steerable when:

- canonical product, slice, architecture, and migration documents exist;
- foundational ADRs are accepted;
- task protocol and status index exist;
- M0 tasks are fully specified and Ready;
- validation commands are discoverable;
- branch/PR and self-review rules are explicit;
- the steering-readiness file says `READY` on the default branch.