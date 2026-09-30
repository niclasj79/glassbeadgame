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

1. **`DocumentedRelationId` must resolve in the pack pinned by
   `session.started.contentPackVersion`, and a pair must have at most one
   authored relation.** The event stores an identity, and everything else —
   relation type, evidence class, sources, intention fit, counterpoint — is a
   pure lookup at replay time. The content validator enforces both halves,
   because an unresolvable id would become a durable, permanently valid,
   permanently meaningless event.

   An earlier draft of this ADR required the id to *be* `relationKey(a, b)`.
   That was stricter than the guarantee needs and it cost readability for
   nothing: the pair is already carried by `thread.committed`, so one relation
   per pair means replay can resolve by pair whether or not the id encodes it.
   Readable ids like `rel.fibonacci-counterpoint` are kept, and the one-relation
   -per-pair rule supplies the property the freeze actually depends on.

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

`bead.attended` is emitted on every explicit Attend and grows without bound.
Attention is retained only as *the latest* attended concept: appending an
attention event when the previous event is also an attention event replaces it
rather than extending the log.

The reason is semantic, not performance. The log is the session's durable
record, and it should say what the player *interpreted*, not where they looked
on the way there. Everything downstream — the portrait, the annotation, the
conclusion performance — is defined over threads; nothing is defined over the
history of glances. I-002 already accepts that clearing presentation attention
does not erase the latest canonical attended concept, so collapsing costs
nothing the specification asks for.

To be accurate about the secondary effect: `appendEvents` currently re-decodes
and re-replays the whole log on every write, and `decodeSessionEventLogV1`
already replays internally, so each append replays twice. That is quadratic in
principle, but at a realistic session size of a few dozen events it is not
close to a real cost, and collapsing attention is not a meaningful optimisation.
It is worth stating plainly rather than dressing the semantic argument in a
performance one. The redundant second replay is a genuine (small) waste and is
noted separately.

**Consequences:** log growth tracks committed interpretation; persisted sessions
stay small for reasons that will matter more as sessions are archived; and the
log reads as a record of what the player did.

## ADR-015 — Studies may pose goals

**Status:** Accepted by the game design director on 2026-09-30; effective after
reviewed merge.

A second mode, **Studies**, may pose explicit, rule-checked goals over the same
loop and the same content, with a *solved* / *not yet* result and up to three
marks of form. `docs/STUDIES-SPEC.md` is the specification that product law 7
requires before any such element exists, and it binds the mode.

The Free Game is not amended: product law 7 and ADR-010 apply to it unchanged,
and no goal, budget, mark or Study copy may appear there.

Four conditions hold for every Study and are stated in full in the
specification: a Study is solvable from public information only (concept
identity, faculty, facets), never from documented relations; its result and
marks are computed from the structure of the woven threads, never from outcome
kind; there is no timer, no failure and nothing lost; and the Free Game is
untouched.

**Reason:** the slice, played end to end, is an honest and beautiful reader that
poses no problem, so nothing can be solved and nothing can be got better at
(`docs/proposals/GAMEPLAY-MODES.md`). Rejecting the challenge lenses removed the
old hidden-answer lottery and the problem together. Studies restore the problem
without restoring the lottery: the answer key is never the goal.

**Consequences:** the event schema does not change (ADR-013); a Study is an
ordinary session whose status is a pure function of its log; retracting a
thread, titles, persistence of results and the Daily Study remain separate
decisions after the spike has been played.


## ADR-016 — The conductor: one musical time for the world

**Status:** Proposed on 2026-09-30 under the director's polish mandate; accepted
by the game design director on reviewed merge, and effective after it.

The arena keeps one musical time, and everything that moves with the music
reads it from one place. **The conductor** is a per-frame read model of
scheduled musical time: the bed's grid (the world's slot, its eighths and
sixteenths, the twelve-slot phrase), the phase within it, and the notes already
scheduled ahead on the Web Audio clock, each with the concept it belongs to. It
is written by the schedulers at the moment they schedule and read by the scene
each frame. It is not an analyser: nothing listens to the output. The scene
knows the notes because the score was written ahead, which is why the
conductor is deterministic, costs no per-frame audio work, and still conducts
when the game is muted.

Four things follow from it, and together they are the first polish spike
(M4-001):

1. **One slot.** The world's slot is the unit for everything that keeps time:
   the bed's grid (already), the director's rhythm unit (today a sixteenth of
   two seconds in every world, whatever the world's slot), the camera's beat
   (today a fixed 0.7 s; from now on 0.35 of the slot, which leaves Castalia
   unchanged), and the breath (four slots, phase-locked to the grid).
2. **Beads sing what they sound.** A note scheduled on a concept lights that
   concept's glass at its onset, through the lane the world already uses to put
   light on a bead for a moment. The light's weight follows the note's role and
   gain, never the thread's outcome kind (CAV-006).
3. **The hand's sounds land on the grid.** The sounds the hand makes (hover,
   select, the settling sighting, the cancel, the clink) and the focus lane's
   answers (sighting, lock, preview, reopen) are scheduled on the sixteenth of
   the slot, at most one of a kind per grid point, while their visual answer
   stays immediate (product law 2). The director's semantic sounds keep the
   eighth they have.
4. **The breath is on the bar.** The bloom's breath, the bed's breath, the
   sky's line breath and a camera breath of at most 0.6 % of the field of view
   share one phase from the conductor: one breath every four slots, cresting on
   a slot boundary. It is off under reduced motion, and the camera breath is
   off on the potato tier.

Conditions:

- The conductor defines no rule and holds no durable state. It is
  presentation timing, rebuilt whenever the room changes; conducting during
  Attunement stays ephemeral (ADR-013, condition 3).
- The Web Audio clock remains authoritative. Onsets are stored in audio time
  and the conductor's *now* is the audio clock in production. In deterministic
  test mode, where no audio exists, it runs on the controlled clock with the
  world's slot, so the browser can prove the grid and the lights without sound.
- CAV-007's bounds are enforced where the conductor is read, not by its
  callers: no light on one bead repeats faster than 3 Hz, and the breath and
  camera-breath amplitudes are constants in the shared comfort table.
- Nothing pulses for decoration: every reactive element traces to a scheduled
  note or to the grid (product law 8).
- No new full-screen pass, no analyser, no dependency, and no raised bundle
  ceiling: the first load has under a kilobyte of headroom, and the remedy for
  crossing it is a dynamic import of audio the title does not need.
- The delay a grid puts on the hand's sounds is a feel judgement. It is one
  constant, reviewed by the director in play; the eighth and the sixteenth are
  both offered, and the visual answer never waits.

**Reason:** the build has the two things a musical game is built on, one clock
and one coordinated moment, but only the director's cues use them. The sounds
the hand makes, the beads themselves, the camera's beat and the breath keep
their own time: the hand's sounds play the instant the pointer moves, the beads
never react to their own notes, the camera counts a fixed 0.7 s in every world,
and the breath runs free at 0.1 Hz on the frame clock. Reading the schedule
ahead is the cheapest synchronization there is, and it is the piece that makes
the interaction track and the polish track one thing: the cue bus carries
meaning and timing, and the conductor makes the timing readable.

**Consequences:** `docs/ARCHITECTURE.md` §10 names the conductor as the
scene's one source of musical time. The thread pulses (`frameState.pulses`)
are unchanged by the spike and become a consumer of the conductor in the next
audio packet, so that no second timing path remains. The event schema
(ADR-013), the conclusion performance and the bed's grammar are untouched; the
bed's grid origin still restarts with each session. Bundles B (stems by
faculty, Attunement as the heightened state, payoff by form) and C (dither, a
dust field, one pass for all screen effects) are separate packets after this
spike has been played, each behind the audiovisual review boundary.
