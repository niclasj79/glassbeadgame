# Glass Bead Game — Vertical Slice Specification

## 1. Slice definition

The vertical slice is one complete Castalia session lasting approximately 12–18 minutes. It proves the redesigned core loop, semantic audiovisual language, topology-driven transformation, Attunement, and the performed conclusion.

It is intentionally narrow:

- one world: Castalia;
- four faculties;
- twenty-four authored concepts in the content pack;
- approximately twelve concepts present in a session;
- thirty-five to forty-five documented relations;
- four player-facing relation intentions;
- three semantic motif families;
- local-only persistence;
- no backend or accounts.

## 2. Player experience arc

### 0–1 minute: Overture

The player enters through interaction, not explanation. Three initial beads demonstrate attention, resonance, relation choice, and weaving. Minimal text appears only when an action cannot be inferred.

### 1–4 minutes: Recognition

The player experiences at least one clear documented connection and learns that relation choice changes how the pair behaves.

### 4–8 minutes: Composition

Multiple threads enter the score and environment. Open Threads appear as meaningful unanswered questions rather than consolation text.

### 8–12 minutes: Transformation

A semantic motif completes. The world changes structurally and musically. Attunement becomes available.

### 12–15 minutes: Performance

The player enters Attunement, conducts or foregrounds a motif, then concludes. The web is performed in creation order and resolves into a qualitative portrait and short Annotation.

## 3. Faculties

The slice reframes disciplines as faculties of thought. Working names:

- **Measure** — mathematics and formal structure;
- **Sound** — music, rhythm, and temporal form;
- **Matter** — physics and embodied mechanism;
- **Image** — visual art, perspective, and representation.

Names are player-facing. Existing discipline identifiers may remain internally during migration, but new content must not depend on those legacy labels.

## 4. Concept granularity

Slice concepts should be specific enough to have perceptible structure. Prefer:

- theorem;
- technique;
- work;
- phenomenon;
- instrument;
- historical formation;
- formal pattern;
- defined philosophical idea.

Avoid mixing broad fields such as “mathematics” with specific objects such as “the Fibonacci sequence” in the same play set.

## 5. Session generation

- Sessions are deterministic from a stable seed.
- The draw must contain enough documented and open relation possibilities to support the intended arc.
- At least one strong cross-faculty relation must be available within the overture.
- The draw must support at least one semantic motif.
- The generator must not expose hidden endpoint pairs to the player.
- Session generation is domain logic and must be testable without React, Three.js, or Web Audio.

## 6. Attention

### Player experience

Selecting or dwelling on a bead brings its identity into focus. Nearby or semantically relevant candidates respond without declaring a correct answer.

### Rules

- Only one bead is the primary attended bead at a time.
- Attention may be entered by pointer, touch, keyboard, or controller-compatible action.
- Attention is reversible and creates no durable event unless the architecture records it for replay.
- Long press may open inspection, but must not be the only accessible inspection route.

### Presentation

- non-relevant noise recedes;
- the bead’s internal motif becomes legible;
- candidate beads emit relation-neutral resonance signals;
- audio leaves space through reduced density or call-and-response.
- a smooth camera transition may place the attended bead in a lower-left or lower-right situated posture while the whole spherical arena remains legible;
- reduced-motion presentation communicates the same situated attention without requiring camera travel.

## 7. Resonance preview

### Purpose

Make potential relationships perceptible before commitment without turning the game into a hint system.

### Rules

- Resonance strength may derive from authored facets, documented relations, session structure, and current topology.
- A strong resonance does not mean “correct.”
- Different relation interpretations may remain possible for the same pair.
- The preview must not reveal source text or full authored insight.

### Acceptance criteria

- the player can distinguish high, medium, and weak candidate resonance without reading a number;
- previews are reproducible under a fixed seed and state;
- no hidden connection endpoint list is exposed in normal play.

## 8. Relation declaration

After attending to one bead, the player arms one intention before selecting the second bead:

- Echo;
- Passage;
- Tension;
- Ground.

### Rules

- the four intention choices appear world-anchored beside the attended bead with an equivalent accessible DOM control;
- arming changes the attended bead’s preview appearance and sound immediately;
- while the intention is armed, the player selects a second bead from the still-visible arena;
- choice does not determine candidate strength, correctness, or whether the eventual pair is documented;
- armed intention and candidate selection remain an ephemeral draft until commitment;
- cancel or re-Attend returns to the applicable prior state without durable mutation;
- on commitment, the selected pair, declared relation, and thread are recorded as one ordered atomic event batch;
- the declared relation is included in the durable thread event.

## 9. Expressive weaving

The gesture is expressive, not a dexterity test.

Capture a normalized gesture profile including, where available:

- duration;
- path length;
- curvature;
- average speed;
- speed variance;
- pressure or pointer-force proxy;
- input modality.

Gesture qualities may influence articulation, visual growth, or replay phrasing. They must not determine intellectual validity.

## 10. Thread outcomes

### Documented relation

A documented relation has authored evidence and a precise underlying relation type. The game may confirm, refine, or complicate the player’s declared intention.

A documented result includes:

- concise title;
- relation type;
- evidence class;
- short insight;
- relevant facets;
- at least one source reference;
- optional direction;
- optional counterpoint or uncertainty.

### Open Thread

An Open Thread is an interpretable but not currently documented connection.

It must contain:

- the player’s declared relation;
- a specific question, tension, or shared facet to investigate;
- an honest indication that the game is not asserting a documented fact;
- persistence in the local session or Codex model.

It must not contain generic praise, pseudo-profound filler, or invented historical influence.

### Weak or rejected relation

The game may respond with near-silence, fragility, or an unresolved thread when no credible relation is supported. “Nothing meaningful yet” is preferable to fabricated meaning.

## 11. Relation presentation grammar

### Echo

- synchronized or mirrored motion;
- intervallic consonance or rhythmic alignment;
- bilateral thread behavior.

### Passage

- directional flow;
- transformation of one concept motif into the other;
- visible transmission or translation.

### Tension

- phase opposition, controlled dissonance, torsion, or counter-motion;
- no automatic resolution;
- visual and musical instability remains legible but not unpleasant.

### Ground

- anchoring, inward motion, resonance below the surface, or materialization;
- lower register or stabilizing harmonic function.

The relation category should be recognizable from audiovisual behavior without relying exclusively on color or text.

## 12. Semantic motifs

The slice contains three motif families. Exact names may change during content design, but their rules must be semantic rather than purely topological.

### Dialectic

A triadic structure in which at least one Tension is meaningfully reframed or grounded by a third concept.

### Canon

A pattern or facet recurs across at least three concepts through transformation rather than simple repetition.

### Bridge

A concept or thread meaningfully connects otherwise separate faculty regions and becomes structurally central.

Motif detection must be domain logic with deterministic tests. Completion changes the score and world, not merely a badge or point total.

## 13. Attunement

Attunement is a held heightened state, not a consumable hint.

### Entry

- becomes available after sufficient compositional development, preferably after a motif or topology threshold;
- is explicitly invited but not forced.

### Behavior

- HUD recedes;
- time and camera motion soften;
- threads become individually audible;
- relation channels shimmer according to their grammar;
- the player may conduct pulses, foreground a motif, or listen spatially;
- no new intellectual assertions are generated.

### Exit

- releasing or completing the gesture returns to ordinary play;
- the action may influence the concluding performance’s emphasis but not its factual content.

## 14. Conclusion performance

The conclusion is an audiovisual reconstruction of the actual session, not a generic cinematic or text slideshow.

- threads enter in creation order;
- gesture profiles influence phrasing;
- documented relations and Open Threads remain distinguishable;
- completed motifs enter as ensemble structures;
- topology variables shape camera, density, orchestration, and climax;
- unresolved tensions may remain unresolved;
- the climax belongs to the player’s web, not a fixed score threshold.

## 15. Qualitative portrait

Do not show a conventional score as the primary result. Produce a portrait using interpretable dimensions such as:

- Range;
- Depth;
- Tension;
- Coherence;
- Openness;
- Return.

The portrait must be derived from actual session data and remain stable under replay.

## 16. Annotation

The Annotation is a short topology-aware coda. It may reference:

- central concepts;
- bridges;
- recurring facets;
- unresolved Open Threads;
- a meaningful tension;
- the order in which the web developed.

It must not merely combine generic fragments based on score bands or dominant faculties.

## 17. Visual direction

Castalia is not generic outer space. It combines:

- glasswork;
- astronomical instruments;
- illuminated diagrams;
- musical notation;
- cathedral geometry;
- ink, gold leaf, and living manuscript behavior.

Each concept has a recognizable internal procedural motif. Threads have semantic material behavior. Environment evolution is driven by topology, not percentage completion.

## 18. Audio direction

- each concept owns a short motif, rhythm, register, and articulation identity;
- relation types transform motifs according to semantic rules;
- controlled dissonance is allowed and required for Tension;
- gesture affects articulation and timing;
- the score creates space during attention;
- the conclusion is generated from the event log.

## 19. Interface

- the world is the primary interface;
- persistent counters, points, and “N/N luminous” indicators are absent from core play;
- text appears when it adds understanding, not as constant chrome;
- all critical actions have mouse, touch, and keyboard paths;
- relation meaning is not color-only.

## 20. Persistence

The slice stores locally:

- versioned event logs;
- completed sessions;
- documented discoveries;
- Open Threads;
- settings;
- content-pack version.

IndexedDB is the target durable store. `localStorage` remains acceptable only for small preferences during migration.

## 21. Performance targets

Target budgets must be measured in M0 work. Initial intent:

- desktop baseline: stable 60 fps at capped device pixel ratio;
- modern mobile: stable 30 fps minimum, 60 where the quality tier permits;
- no unbounded particle, audio-voice, or material allocation;
- optional assets load progressively;
- interaction and audio scheduling remain responsive under visual load.

## 22. Accessibility

Required for the public slice:

- reduced motion;
- reduced bloom/photosensitivity mode;
- color-independent relation patterns;
- scalable text;
- keyboard navigation;
- captions or textual equivalents for critical audio meaning;
- mobile touch ergonomics;
- quality fallback;
- a simplified 2D or low-complexity fallback plan, even if not fully implemented in the first internal build.

## 23. Golden path

Seed: `castalia-golden-001`.

The canonical integration scenario must demonstrate:

1. session start;
2. attention to Fibonacci Sequence;
3. perceptible resonance with Counterpoint;
4. Echo arming beside the attended bead;
5. Counterpoint selection through the armed Echo intention;
6. expressive weave;
7. documented Bartók/Fibonacci revelation;
8. semantic thread and musical transformation;
9. a later Prime Numbers and Polyrhythm relation;
10. completion of a Canon-like motif;
11. Attunement;
12. conclusion performance;
13. qualitative portrait;
14. deterministic reload from the event log.

## 24. Explicit exclusions

The slice does not include backend sync, public sharing, leaderboards, monetization, full progression, all current concepts, all current worlds, WebGPU-only effects, or native-specific features.
