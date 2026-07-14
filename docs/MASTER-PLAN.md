# Glass Bead Game — Master Plan

## Executive thesis

The Glass Bead Game is a contemplative audiovisual instrument in which players discover and perform structural echoes across human knowledge.

The player fantasy is not finding hidden author-selected pairs. It is learning to perceive how ideas rhyme, expressing an interpretation, and hearing and seeing that understanding become a living composition.

## Core design law

> Every act of thought must immediately become form, sound, motion, and consequence.

## Why the game deserves to exist

Most knowledge games test recall, optimize trivia, or turn ideas into collectibles. This game treats understanding as composition. It makes the relationships among ideas perceptible, gives the player authorship over those relationships, and turns the resulting web into an audiovisual performance.

## Protected qualities

The following qualities are already distinctive and must survive the redesign:

- contemplative pace without timers or failure;
- the Castalian and Hessean frame;
- glass beads as ideas made tangible;
- interdisciplinary breadth;
- hand-authored, intellectually substantial connections;
- a sphere or field that feels larger than a conventional menu;
- generative music that grows with play;
- the Codex, daily draw, Lens, Consecration, and conclusion ritual;
- local-first, account-free, browser-native play.

## Current-state diagnosis

The current implementation is an elegant interactive codex wrapped around a weaker discovery loop. The player mostly probes for concealed authored pairs. A curated hit receives a rich audiovisual reward; an uncurated pair receives a generic faint resonance. This makes the core interaction feel closer to a hidden-answer lottery than to perception, interpretation, or composition.

## Required transformation

Replace:

- binary hidden connections;
- generic faint-thread prose;
- score-first progress;
- repeated modal reveals;
- mechanically interchangeable world skins;
- abstract graph patterns that ignore meaning;

with:

- perceptible candidate resonance before commitment;
- player-declared relation intent;
- documented connections and honest Open Threads;
- semantic motifs;
- topology-driven audiovisual transformation;
- mechanically distinct worlds;
- a conclusion that performs the exact web the player created.

## Product pillars

### Perception

The player should detect possible resonances before committing.

### Interpretation

The player should express what kind of relationship they perceive.

### Consequence

Every committed thread changes the visual, musical, spatial, or systemic composition.

### Intellectual honesty

Documented, contested, analogical, and speculative relations must not be presented as equivalent.

### Ownership

The completed web should feel like the player's interpretation, not the author's answer key.

### Contemplation

No timer, failure state, aggressive reward loop, or distracting HUD should dominate the experience.

## Core loop

1. Attend to a bead.
2. Notice candidate resonances.
3. Arm a relation intention.
4. Select another bead through that intention.
5. Weave expressively.
6. Receive a documented revelation or an Open Thread.
7. Transform the world.
8. Form semantic motifs.
9. Enter Attunement.
10. Perform the completed web.
11. Receive a qualitative portrait and Annotation.

## Player-facing relation vocabulary

The vertical slice uses four simple relation intentions:

- **Echo** — shared form, pattern, mechanism, or structural rhyme;
- **Passage** — influence, translation, transmission, or transformation;
- **Tension** — opposition, contradiction, complication, or unresolved polarity;
- **Ground** — evidence, embodiment, foundation, material basis, or enabling condition.

The authored content model may use more precise underlying relation types.

## Vertical-slice objective

Create one definitive fifteen-minute Castalia experience that proves the new loop, the semantic audiovisual grammar, and the performed conclusion. The slice is not a smaller version of every future system; it is a complete statement of the game's identity.

See `VERTICAL-SLICE-SPEC.md` for the binding behavioral contract.

## Full-version direction

- multiple worlds with distinct rules, motion models, musical character, and climaxes;
- a stable personal Great Web;
- persistent Open Threads that may be resolved later;
- a richer Codex with sources, interpretations, and counterarguments;
- Many Minds asynchronous community reflection without leaderboards;
- shareable Games that another player may extend or reinterpret;
- additional faculties and conceptual lenses;
- optional cross-device sync while preserving offline and account-free core play;
- PWA-first distribution with optional desktop and mobile wrappers.

## Explicit non-goals for the vertical slice

- multiplayer;
- accounts or backend dependency;
- monetization;
- a complete ninety-concept migration;
- a global community graph;
- WebGPU-first rendering;
- native-only distribution;
- conventional XP, score chasing, battle passes, or streak pressure;
- user-generated public content tooling.

## Success criteria

### Experience

- a new player understands the basic interaction without a text-heavy tutorial;
- the first meaningful recognition occurs within ninety seconds;
- the player can explain at least half of the threads in the finished web;
- the player distinguishes at least three relation categories;
- the resulting web feels personally authored;
- the conclusion feels like the consequence of the exact session;
- the player wants to begin another Game for expressive reasons, not to grind progress.

### Technical

- current desktop browsers run the slice reliably;
- modern mobile devices receive a functional, intentional experience;
- the game remains playable offline after installation or first load;
- replay is deterministic from the durable event log;
- quality tiers meet defined frame-time budgets;
- type, lint, unit, content-validation, build, and smoke checks pass.

## Authority and precedence

1. Assigned task acceptance criteria
2. `VERTICAL-SLICE-SPEC.md`
3. `ARCHITECTURE.md`
4. Accepted ADRs
5. This master plan
6. Existing implementation

If authoritative documents conflict, implementation must stop and report the conflict rather than silently choosing.
