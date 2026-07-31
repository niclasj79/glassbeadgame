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

## ADR-013 — Event schema version 1 is frozen for the whole slice

**Status:** Accepted

`schemaVersion: 1` carries M3 through M8 without a payload change. The roadmap
names concurrent event-schema and persistence-schema work as explicitly unsafe,
and IndexedDB is scheduled inside this campaign — so the ruling is made once,
up front, rather than discovered during a migration.

Adding one field to one payload today requires coordinated edits across five
files (`domain/events/types.ts`, `createSessionEvent.ts`,
`decodeSessionEventLog.ts` with its exact-key structural validation,
`reduceSession.ts`, and `reducer/fixtures.ts`). That cost is the reason to
decide deliberately, not a reason to avoid deciding.

The freeze holds only because of three binding conditions. Each is a real
constraint on other work, not a restatement of current behaviour:

1. **`DocumentedRelationId` must be `relationKey(a, b)` and must resolve in the
   pack pinned by `session.started.contentPackVersion`.** The event therefore
   stores an identity, and everything else — relation type, evidence class,
   sources, intention fit, counterpoint — is a pure lookup at replay time. The
   content validator must enforce resolvability, because an unresolvable id
   would become a durable, permanently valid, permanently meaningless event.

2. **Open Thread generation must not consult topology.** An `OpenThreadId` is a
   structured handle over `(pair, intention, sharedFacet, packVersion)`, all of
   which are recoverable from the log, so the prompt is re-derivable on replay.
   If generation ever read live topology, the facet would have to move into the
   payload and the freeze would break. This is the condition most likely to be
   violated by accident; it belongs in the outcome resolver's tests.

3. **Conducting during Attunement is non-durable.** Specification §13 says the
   conducting action may influence the conclusion's emphasis, while the M6 gate
   requires replay to reconstruct a materially equivalent performance. Those
   pull in opposite directions unless emphasis is either logged or declared
   ephemeral. It is declared ephemeral: Attunement affects the live state only,
   `attunement.entered`/`attunement.exited` keep their empty payloads, and the
   conclusion is compiled purely from the log. Determinism is preserved at no
   cost to the experience, because emphasis is a performance of the web rather
   than a fact about it.

**Consequences:** persistence may be built against a stable schema; the
conclusion is guaranteed reproducible; and any future need for a payload change
becomes a deliberate versioned migration rather than an emergency.

## ADR-014 — Attention events are not durable session history

**Status:** Accepted

`bead.attended` is emitted on every explicit Attend. In a 12–18 minute session
that grows without bound, and `appendEvents` re-decodes and re-replays the
entire log on every write — so attention traffic makes the whole loop
quadratic, in the one system that also has to stay responsive under visual load.

Attention is retained only as *the latest* attended concept. Consecutive
`bead.attended` events collapse: appending an attention event when the previous
event is also an attention event replaces it rather than extending the log.

This preserves everything the specification actually requires. I-002 already
accepts that clearing presentation attention does not erase the latest canonical
attended concept, and nothing downstream — not the portrait, not the annotation,
not the conclusion — is defined over the history of glances. The composition is
made of threads, not of looking.

**Consequences:** log growth becomes proportional to committed interpretation
rather than to browsing; replay cost stays bounded; and the event log reads as a
record of what the player *did* rather than of where their cursor went.