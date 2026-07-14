# Glass Bead Game — Interaction Decision Record

## Status

Director decisions I-001 through I-006 and I-010 through I-012 are accepted. I-007 through I-009 and I-013 remain pending before their named production boundaries.

This record refines interaction questions left deliberately open by `VERTICAL-SLICE-SPEC.md`. It does not authorize changes to the accepted domain event schema, reducer, persistence, or accessibility contract. The accepted pre-weave flow is represented as ephemeral draft state so existing durable pair/hypothesis/thread events can remain an atomic commit sequence.

## Binding constraints

- The world remains the primary interface.
- Attention is singular, reversible, and available through pointer, touch, and keyboard/controller-compatible action.
- Long press is not the only accessible inspection route.
- Resonance suggests possibility, not correctness.
- A pair and one of Echo, Passage, Tension, or Ground are required before commitment.
- Relation choice changes preview immediately.
- Cancellation returns to the prior state without durable mutation.
- Expressive weaving is not a dexterity test and does not determine intellectual validity.
- Mouse, touch, and keyboard express the same decisions and consequences.
- Relation meaning is not color-only.
- Every meaningful action produces an immediate perceptible consequence.

## Accepted state separation through candidate selection

The existing implementation combines hover focus, pinned inspection, pressed/threading modes, and direct legacy commit behavior. The accepted domain model separately contains the latest `bead.attended`, selected pair, relation hypothesis, and committed thread. M2 must not preserve accidental legacy coupling or create two durable owners.

Recommended conceptual separation:

| Layer | Examples | Durable? |
| --- | --- | --- |
| Ephemeral pointing/focus | hover, keyboard focus ring, controller focus, current pointer candidate | No |
| Inspection | open concept card, expanded text, source-independent concept description | No |
| Ephemeral interpretation draft | armed intention, provisional candidate pair, gesture in progress, active cancellation stage | No |
| Canonical interpretation state | attended concept and committed thread; the commit batch contains pair, hypothesis, and gesture events | Event-derived |
| Presentation response | dimming, resonance halos, audio space, relation preview, camera response | No; derived from canonical/ephemeral state and cues |

## Proposed interaction sequence

This sequence is accepted through candidate selection. Weaving details remain subject to I-008 and I-009.

1. Move focus to a bead: it responds lightly without changing durable state.
2. Explicitly Attend: the bead becomes primary; a smooth camera sweep places it in a lower-left or lower-right attended posture while preserving the whole arena; noise recedes and candidate resonance appears.
3. Inspect if desired: read the concept without advancing the interpretation.
4. Choose Echo, Passage, Tension, or Ground from four world-anchored icons beside the attended bead, mirrored by an equivalent accessible DOM surface.
5. The chosen intention visibly moves into and arms the attended bead. This changes its tool-ready response immediately but remains an ephemeral draft.
6. While the arena remains in the attended aiming posture, sweep across relation-neutral candidate resonance and activate a second bead. This creates the provisional candidate pair and applies the armed intention to its preview.
7. Weave or confirm expressively.
8. Commit once. A future commit command records `pair.selected`, `relation.hypothesized`, and `thread.committed` as one atomic ordered batch; then the player receives the outcome and coordinated consequence.
9. Cancel at any provisional stage by discarding only the ephemeral draft and restoring the prior accepted stage.

## Director metaphor reference — attended viewpoint and directional sweep

**Status:** Accepted as a directional design metaphor on 2026-07-13, not as a literal fiction, camera prescription, control scheme, or combat system.

Attending to one bead may feel like taking up an embodied viewpoint around it: comparable to seeing one's own vessel in a third-person space game while remaining zoomed out enough to read the whole spherical arena. Directing attention across the visible sphere then feels like sweeping an instrument or field of inquiry. Beads inside the foregrounded sector answer with audiovisual resonance, allowing the player to sense promising material before selecting a candidate.

The useful design translations are:

- **attended bead as temporary point of view:** the chosen idea becomes the player's situated reference without making the rest of the web disappear;
- **whole-arena legibility:** focus increases intimacy but preserves enough overview to compare directions, candidates, and topology;
- **directional inquiry:** aim, sweep, sector, or frustum-like emphasis can make attention feel active rather than menu-based;
- **candidate response:** multiple foregrounded beads may answer with different relation-neutral strengths; the response communicates generative possibility, never target lock or correctness;
- **intention as tool mode:** choosing Echo, Passage, Tension, or Ground changes what kind of action the player is preparing, with an immediate change in preview behavior.

The tool analogies describe semantic energy, not literal weapons:

| Intention | Directional metaphor | Transferable feel |
| --- | --- | --- |
| Echo | echolocation pulse | emit, listen, receive a returning structural answer |
| Passage | bolt or directed discharge | send something across the interval and transform it in transit |
| Tension | lasso, tether, or tractor beam | catch, hold, pull against, or sustain an unresolved relation |
| Ground | area-of-effect restorative field | establish a surrounding base that supports, settles, or enables |

### Guardrails

- Do not introduce enemies, damage, ammunition, cooldown optimization, lock-on correctness, twitch targeting, failure punishment, or militarized tone.
- A directional sweep is presentation/input context, not part of the pure resonance rule and not a hidden endpoint filter.
- The same decisions and information must remain available through touch, keyboard, controller-compatible, reduced-motion, audio-reduced, and simplified representations; a literal free-aim frustum cannot be the only route.
- The metaphor does not override the accepted I-001 through I-006/I-010 through I-012 constraints or resolve pending I-007 through I-009/I-013. Exact camera comfort, expressive input, microcopy, weave transition, and overture behavior still require their named decisions and human testing.
- The world remains the primary interface. Any supporting DOM surface mirrors the spatial act instead of replacing it with a conventional target list or weapons HUD.

### Relationship to M2 sequencing

M2-002 may use this metaphor to explain why every session candidate receives a neutral internal resonance band and why presentation may foreground a directional subset. The pure model must remain camera-, frustum-, input-, and audiovisual-implementation independent. A later production-integration task may test directional sweep behavior only after the applicable interaction decisions are accepted.

## Camera traversal as performance phrasing

**Status:** Accepted as a core synesthetic design direction on 2026-07-14; exact paths, timing, comfort bounds, and device variants require later human testing.

Smooth, distinct camera sweeps are a primary response to changes of focus, explicit Attend, armed intention, candidate selection, commitment, and return. The sequence of attention points and intentions is itself the player's Game or performance: curious, harmonious, hectic, hesitant, or otherwise shaped by their cadence. Camera phrasing may mirror that cadence through path, easing, duration, framing, and return behavior without grading it or assigning a hidden personality score.

Guardrails:

- the whole spherical arena remains legible during the attended lower-corner posture;
- camera phrasing consumes semantic interaction/cue state and never owns domain rules, candidate strength, or correctness;
- user camera authority, cancellation, and a comfortable return path remain explicit;
- reduced-motion and simplified representations preserve the same focus and intention information through restrained framing, emphasis, sound, pattern, and text rather than forced travel;
- no sweep may create time pressure, aiming difficulty, motion punishment, or a tactical advantage unavailable to equivalent inputs;
- play style may shape the performance descriptively, never through a conventional score, rank, or fabricated psychological diagnosis.

## Input-equivalence proposal

Equivalent means the same decision, reversibility, information, and consequence—not identical physical motion.

| Action | Mouse/trackpad | Touch/pen | Keyboard | Controller-compatible |
| --- | --- | --- | --- | --- |
| Move focus | hover or spatial navigation | tap target without commitment only if a separate Attend affordance exists | arrows/WASD or spatial navigation | stick/D-pad |
| Attend | primary click | tap | Enter/Space | primary action |
| Inspect | dwell or explicit details control | long press or explicit details control | `I`/details control | secondary/details action |
| Choose intention | world-anchored four-way control | four large touch targets | arrows/number shortcut + Enter | D-pad/stick + primary action |
| Select candidate after arming | click second bead | tap second bead | focus candidate + Enter/Space | focus candidate + primary action |
| Weave/confirm | drag path or deliberate confirm | drag path or deliberate confirm | hold/confirm sequence producing a neutral keyboard gesture profile | hold/confirm sequence producing a neutral controller profile |
| Cancel/back | Escape, secondary click, or background action | explicit Back/Cancel target; background tap only if unambiguous | Escape | secondary/back action |

## Decision records

Director answers become binding only after reviewed merge. If an answer changes the vertical-slice contract or accepted event semantics, update the authoritative document/ADR in the same reviewed change or record a follow-up proposal.

### I-001 — Focus versus Attend

- **Question:** Does pointer hover/touch focus itself enter canonical attention, or is Attend always an explicit activation?
- **Recommended default:** Hover and spatial focus are ephemeral previews; click, tap, Enter/Space, or controller primary action records Attend. This avoids event spam and gives touch/keyboard equivalent intent.
- **Alternatives:** Dwell automatically records Attend; first tap focuses and second tap attends; every focus transition records Attend.
- **Director answer:** Accepted as recommended. Hover and spatial focus remain ephemeral; explicit click, tap, Enter/Space, or controller primary action records Attend.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Clears:** Production attention integration may separate focus from canonical Attend.

### I-002 — Meaning of reversible attention

- **Question:** When visual attention is cleared, must canonical `attendedConceptId` return to `null`, or may the log retain the last attended concept while active presentation focus clears ephemerally?
- **Recommended default:** The event log retains the last attended concept as session history; active presentation attention may clear without a durable event. Re-attending another bead records the next event.
- **Compatibility impact:** A requirement for canonical `null` would need a reviewed event/reducer change such as an explicit attention-cleared event; M2 must not simulate it through direct state mutation.
- **Director answer:** Accepted as recommended. Clearing active presentation attention does not erase the latest canonical attended concept; re-Attend records the next event.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Clears:** Presentation attention may be reversible without an attention-cleared event.

### I-003 — Inspect versus Attend

- **Question:** Can a player inspect a concept without attending to it, and can an attended concept be inspected without changing the pair-building state?
- **Recommended default:** Yes to both. Inspection is reversible presentation state; Attend is an interpretive selection. Long press is a shortcut, never the sole route.
- **Director answer:** Accepted as recommended. Inspection and Attend remain independent, and inspection never requires long press.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Clears:** Later concept-card and inspection mapping work, subject to input-equivalence testing.

### I-004 — Attention replacement

- **Question:** Does attending a new primary bead clear a provisional selected pair and relation hypothesis?
- **Recommended default:** If no thread has been committed, a new primary Attend starts a new interpretation and clears provisional pair/intention through an explicit command/event policy. It never removes committed threads.
- **Compatibility impact:** The accepted reducer currently replaces `attendedConceptId` but does not automatically clear pair/hypothesis on `bead.attended`; changing that requires a reviewed domain decision rather than UI-only cleanup.
- **Director answer:** Accepted with the no-durable-cancel constraint. A new Attend discards any ephemeral armed intention/candidate draft before recording the new `bead.attended` event. It does not rewrite a prior `bead.attended` transition, append a reset event, or remove committed threads. Pair/hypothesis events remain reserved for the later atomic commit batch.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Compatibility resolution:** This preserves existing schema-version-1 replay and the vertical-slice rule that provisional cancellation creates no durable mutation.
- **Clears:** M2-003 may define the isolated ephemeral interpretation-draft state machine without changing accepted event semantics.

### I-005 — Candidate selection gesture

- **Question:** After Attend, should selecting a candidate be a second click/tap, the start of a drag, or either?
- **Recommended default:** A second activation selects the pair; drag may be a fluent shortcut that selects the endpoint when released, but both paths enter the same provisional pair state before commitment.
- **Director answer:** Accepted as a combined I-005/I-006 flow. After Attend and intention arming, activating another bead while still in the attended aiming posture selects it as the provisional candidate. “Firing” is a directional interaction metaphor only: it implies no weapon, damage, correctness lock, dexterity gate, or punishment.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Clears:** Candidate selection may follow intention arming; concrete pointer/touch/keyboard/controller mapping remains subject to I-009 and human testing.

### I-006 — Relation-choice presentation

- **Question:** Where and how should Echo, Passage, Tension, and Ground appear?
- **Recommended default:** A world-anchored four-part constellation near the selected pair, mirrored by an accessible DOM radiogroup. Each option includes label, stable glyph/pattern, short verb phrase, immediate preview, and full keyboard focus semantics.
- **Alternatives:** Persistent HUD tray; radial pointer menu; sequential four-card chooser; gesture-only selection.
- **Do not accept:** Color-only wedges, unlabeled first-use icons, or a modal that visually replaces the world.
- **Director answer:** Accepted as a combined I-005/I-006 flow. Four world-anchored intention icons appear beside the attended bead in its lower-corner aiming posture. Selecting one visibly moves it into and arms the bead. An accessible DOM radiogroup exposes the same four choices and state; first-use labels/microcopy remain governed by I-007.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Compatibility resolution:** Arming is ephemeral. After candidate activation, a later commit boundary may record the existing pair and hypothesis events in accepted order without changing their payloads.
- **Clears:** Spatial intention-presentation prototyping, subject to I-007 copy and I-009 input-equivalence decisions.

### I-007 — Relation vocabulary and microcopy

- **Question:** Are the player-facing names final, and what first-use phrase accompanies each?
- **Recommended default:** Keep the four names and test these phrases: Echo — “shares a form”; Passage — “carries or transforms”; Tension — “opposes or complicates”; Ground — “supports or embodies.”
- **Director answer:** _Pending._
- **Blocks:** Onboarding copy, accessible labels, captions, and content authoring examples.

### I-008 — Timing of declaration

- **Question:** After intention arming and candidate selection, when does the armed intention become the durable declared hypothesis and how may the player re-arm before weaving?
- **Recommended default:** Keep arming and candidate selection ephemeral; apply the intention immediately to the provisional pair preview; record the pair, hypothesis, and committed thread only as one ordered atomic commit batch. A fluent shortcut may remember focus position but never silently reuse a prior intention.
- **Director answer:** _Pending._
- **Blocks:** Commit-state machine and gesture capture order.
- **Accepted partial direction from I-005/I-006:** Intention arming precedes candidate selection and expressive weaving. This record remains pending only for fluent shortcuts, re-arming after candidate selection, and the exact transition into gesture capture/commit.

### I-009 — Keyboard/controller expressive equivalent

- **Question:** What counts as expressive weaving when no free pointer path exists?
- **Recommended default:** A hold-and-confirm interaction captures duration and input modality, with optional directional modulation; unavailable geometric fields remain absent. It receives the same intellectual outcome and a deliberately authored audiovisual phrasing, not a penalty or fake pointer path.
- **Director answer:** _Pending._
- **Blocks:** Keyboard/controller gesture profile and accessibility acceptance.

### I-010 — Cancel hierarchy

- **Question:** What does one Cancel action restore at each stage?
- **Recommended default:**
  - during weave: return to declared intention;
  - at intention: return to selected pair;
  - at selected pair: return to primary Attend;
  - at Attend: clear active presentation attention while retaining accepted event history per I-002;
  - during inspection: close inspection only.
- **Constraint:** No cancel path removes a committed thread or publishes a durable provisional event that the specification says should not exist.
- **Director answer:** Accepted as recommended in principle and adapted to the armed-intention order: during weave, Cancel returns to the armed pair/intention preview; after candidate selection, Cancel returns to armed aiming; at armed aiming, Cancel returns to primary Attend; at Attend, Cancel clears active presentation attention while retaining event history; inspection Cancel closes inspection only. Every provisional transition discards ephemeral draft state and publishes no durable event.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Clears:** M2-003 cancellation rules through candidate selection; weave-stage details remain subject to I-008/I-009.

### I-011 — Background activation

- **Question:** Should clicking/tapping empty world space cancel, rotate the world, or do nothing?
- **Recommended default:** Pointer drag on empty space retains camera control; a deliberate click/tap on empty space cancels only when it cannot be confused with camera motion. Touch receives a visible Cancel target rather than relying on background taps.
- **Director answer:** Accepted as recommended. Empty-space drag retains camera control; a deliberate empty-space activation cancels only when unambiguous, and touch receives a visible Cancel target.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Clears:** Later camera/input arbitration prototypes, subject to device and comfort testing.

### I-012 — Immediate consequences by step

- **Question:** What minimum response proves each action was understood before M4 polish?
- **Recommended default:**
  - focus: subtle bead/label response;
  - Attend: world noise recedes, identity motif foregrounds, candidates awaken;
  - pair: spatial/thread preview joins the two without asserting outcome;
  - intention: preview motion/sound/pattern changes categorically;
  - weave: gesture is traced and sonified;
  - commit: one coordinated placeholder cue plus durable state update.
- **Director answer:** Accepted with the armed-intention order: focus receives subtle bead/label response; Attend recedes noise, foregrounds identity, awakens candidates, and establishes the situated camera posture; arming changes the bead's tool-ready motion/sound/pattern; candidate selection joins the pair provisionally without asserting outcome; weave is traced and sonified; commit coordinates one placeholder cue with the durable batch. Smooth distinct camera phrasing is a core synesthetic response throughout, with equivalent reduced-motion state communication and no forced travel.
- **Status:** Accepted by the game design director on 2026-07-14; effective after reviewed merge.
- **Clears:** Placeholder consequence planning for accepted M2 stages; audiovisual quality still requires human review.

### I-013 — Overture teaching strategy

- **Question:** Should the first three beads constrain the available path, demonstrate through staging, or permit free exploration with contextual help?
- **Recommended default:** Stage a strong first resonance and progressively reveal affordances without locking incorrect actions; show text only after hesitation or an unavailable action.
- **Director answer:** _Pending._
- **Blocks:** Overture/onboarding task, not isolated command work.

## Decision gate by task type

| Work | Required decisions |
| --- | --- |
| M2-001 isolated Attend command | None; no input/presentation integration |
| M2-003 ephemeral interpretation draft | I-001 through I-006, I-010 through I-012; accepted |
| Production attention/camera integration | Accepted I-001, I-002, I-003, I-011, I-012 plus human comfort/input testing |
| Pair selection and pre-weave cancellation | Accepted I-004, I-005, I-006, I-010, I-011 |
| Relation declaration and weave transition | Accepted I-006/I-012 plus pending I-007/I-008 |
| Gesture/input equivalence | I-005, I-009, I-010, plus playtest device decision P-005 |
| Overture | I-001 through I-013 as applicable |
