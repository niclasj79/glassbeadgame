# Glass Bead Game — Current-State Audit

## Purpose

This document maps the current implementation to the vertical-slice target. It is a migration guide, not a condemnation of the existing prototype.

## Current strengths

- coherent TypeScript/Vite/React/R3F foundation;
- persistent WebGL canvas and distinct scene layer;
- functional pointer state machine supporting drag and tap-to-tap weaving;
- touch inspection behavior;
- adaptive quality tiers and cinematic camera work;
- strong glass-bead, luminous-thread, bloom, and cosmic presentation foundation;
- centralized score configuration and hand-rolled Web Audio scheduling;
- deterministic content and session concepts;
- substantial curated interdisciplinary corpus;
- local, account-free, static deployment;
- Codex, ranks, Lens, motifs, worlds, daily draw, and conclusion already prove broad product ambition.

## Central product debt

The interaction asks players to discover concealed authored pairs. Curated hits receive the richest response, while non-curated pairs receive generic faint-resonance text. The authored corpus is stronger than the act of play used to access it.

## System classification

### Keep

- TypeScript strict mode;
- Vite build and GitHub Pages distribution;
- React for screens and accessibility surfaces;
- Three.js and React Three Fiber;
- WebGL2 baseline;
- Zustand as a reactive adapter;
- Web Audio scheduler and centralized musical taste configuration;
- existing bead/thread/camera/backdrop/effects components as reusable presentation assets;
- content validator principle;
- seeded session generation principle;
- local-first and account-free behavior;
- the best curated connection entries;
- the Lens, Codex, Consecration, daily draw, and conclusion as product concepts.

### Adapt

- `src/game/`: extract durable rules into `src/domain/` and leave layout/presentation math where appropriate;
- `src/state/`: convert from rule-owning store into domain adapter plus ephemeral presentation state;
- `src/scene/threading.ts`: preserve mature input handling but route committed actions through commands/events;
- audio motifs: evolve single-note identities into concept motifs and relation transformations;
- motif detection: replace purely topological/discipline-count patterns with semantic rules;
- worlds: evolve data-driven skins into `WorldRules` with mechanical and climax behavior;
- Annotation: derive from topology, order, relation types, facets, and unresolved threads;
- Codex: preserve documented discoveries while adding relation prediction, sources, Open Threads, and session provenance;
- Great Web: preserve the concept but remove spoilers and move toward stable personal geography;
- replay: replace text slideshow with event-log audiovisual reconstruction;
- Lens: evolve from fixed coordinate answer to transparent rationale and player interpretation.

### Replace

- binary curated/faint intellectual outcome model;
- generic deterministic faint-resonance prose;
- score and points as primary session feedback;
- visible “available/found” completion counters;
- modal ceremony for every curated connection;
- hidden endpoint exposure in Atlas/Codex;
- theme rotation that changes presentation but not play;
- localStorage as the durable store for complex progression.

### Remove from core play

- diminishing-return point optimization;
- conventional rank progress bars during the session;
- achievement-chip dominance;
- generic score-band Annotation fragments;
- any assumption that all simultaneous pitches must remain consonant;
- any response that fabricates significance to avoid silence.

## Existing directory mapping

### `src/content/`

Current role: concepts, curated connections, annotation fragments, validation.

Target role: versioned content pack with normalized concepts, facets, documented relations, evidence classes, sources, concept music, relation grammar, and Open Thread prompts.

Migration risk: content IDs may already be persisted. New IDs require mapping and migration policy.

### `src/game/`

Current role: session draw, scoring, motifs, ranks, layout.

Target: separate pure domain rules from layout and legacy progression. Scoring should not be used as a hidden dependency for audiovisual awakening.

### `src/state/`

Current role: Zustand store and localStorage persistence.

Target: adapter over event-derived domain state plus ephemeral UI/presentation state. IndexedDB repository handles durable logs and Codex.

Highest risk: temporary dual sources of truth.

### `src/scene/`

Current role: R3F cosmos, beads, threads, camera, effects, pointer state machine.

Target: presentation consuming reduced state and coordinated cues. Most visual components should be retained and semantically upgraded.

Highest risk: effects currently subscribe independently to store changes; the cue director must be introduced incrementally.

### `src/audio/`

Current role: engine, voices, pitch theory, generative ambience, score configuration.

Target: concept motifs, relation transforms, controlled tension, event-log performance compiler, and audio-clock-synchronized cues.

Highest risk: current global consonance assumption conflicts with semantic Tension.

### `src/ui/`

Current role: screens and arena HUD.

Target: thinner HUD, relation declaration, accessible equivalents, source display, Attunement invitation, portrait, and Codex depth.

## Migration invariants

- the current public build must remain deployable while the slice is developed on a branch;
- preserve stable content IDs unless a migration is supplied;
- every replaced state path must be removed after its adapter is proven;
- no big-bang scene or audio rewrite;
- no backend dependency;
- no dependency upgrade mixed with domain extraction unless isolated in its own task;
- visual polish does not begin before the new loop works with placeholders.

## Unknowns to resolve through M0 inspection

- actual test harness and undocumented scripts beyond package metadata;
- bundle size and runtime performance by device tier;
- full localStorage schema and migration exposure;
- all direct Zustand mutation call sites;
- whether content validator runs through a Vite plugin or build import;
- current GitHub Actions deployment and branch protections;
- accessibility behavior across keyboard and touch;
- exact route/base-path assumptions for PWA scope.

These are implementation-discovery questions, not reasons to revisit the product direction.