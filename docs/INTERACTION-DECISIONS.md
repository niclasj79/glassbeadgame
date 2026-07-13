# Glass Bead Game — Interaction Decision Record

## Status

Director decisions required before production M2 input integration.

This record refines interaction questions left deliberately open by `VERTICAL-SLICE-SPEC.md`. It does not authorize changes to the accepted domain event schema, reducer, persistence, or accessibility contract. M2-001 may implement its isolated Attend command because it touches none of the unresolved presentation/input choices below.

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

## State model under discussion

The existing implementation combines hover focus, pinned inspection, pressed/threading modes, and direct legacy commit behavior. The accepted domain model separately contains the latest `bead.attended`, selected pair, relation hypothesis, and committed thread. M2 must not preserve accidental legacy coupling or create two durable owners.

Recommended conceptual separation:

| Layer | Examples | Durable? |
| --- | --- | --- |
| Ephemeral pointing/focus | hover, keyboard focus ring, controller focus, current pointer candidate | No |
| Inspection | open concept card, expanded text, source-independent concept description | No |
| Canonical interpretation state | attended concept, selected pair, declared intention, committed gesture/thread | Event-derived where the accepted event vocabulary records it |
| Presentation response | dimming, resonance halos, audio space, relation preview, camera response | No; derived from canonical/ephemeral state and cues |

## Proposed interaction sequence

This is a discussion baseline, not an accepted flow.

1. Move focus to a bead: it responds lightly without changing durable state.
2. Explicitly Attend: the bead becomes primary; noise recedes and candidate resonance appears.
3. Inspect if desired: read the concept without advancing the interpretation.
4. Select a second bead: the pair becomes provisional.
5. Choose Echo, Passage, Tension, or Ground from a world-anchored relation constellation with an equivalent accessible DOM surface.
6. Preview changes immediately to express the intention.
7. Weave or confirm expressively.
8. Commit once; then receive the outcome and coordinated consequence.
9. Cancel at any provisional stage to restore the previously accepted state.

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
- The metaphor does not resolve I-001 through I-013. Camera distance, focus activation, candidate-selection gesture, relation-choice presentation, cancellation, and input equivalence still require their named decisions and human testing.
- The world remains the primary interface. Any supporting DOM surface mirrors the spatial act instead of replacing it with a conventional target list or weapons HUD.

### Relationship to M2 sequencing

M2-002 may use this metaphor to explain why every session candidate receives a neutral internal resonance band and why presentation may foreground a directional subset. The pure model must remain camera-, frustum-, input-, and audiovisual-implementation independent. A later production-integration task may test directional sweep behavior only after the applicable interaction decisions are accepted.

## Input-equivalence proposal

Equivalent means the same decision, reversibility, information, and consequence—not identical physical motion.

| Action | Mouse/trackpad | Touch/pen | Keyboard | Controller-compatible |
| --- | --- | --- | --- | --- |
| Move focus | hover or spatial navigation | tap target without commitment only if a separate Attend affordance exists | arrows/WASD or spatial navigation | stick/D-pad |
| Attend | primary click | tap | Enter/Space | primary action |
| Inspect | dwell or explicit details control | long press or explicit details control | `I`/details control | secondary/details action |
| Select candidate | click second bead | tap second bead | focus candidate + Enter/Space | focus candidate + primary action |
| Choose intention | world-anchored four-way control | four large touch targets | arrows/number shortcut + Enter | D-pad/stick + primary action |
| Weave/confirm | drag path or deliberate confirm | drag path or deliberate confirm | hold/confirm sequence producing a neutral keyboard gesture profile | hold/confirm sequence producing a neutral controller profile |
| Cancel/back | Escape, secondary click, or background action | explicit Back/Cancel target; background tap only if unambiguous | Escape | secondary/back action |

## Decision records

Director answers become binding only after reviewed merge. If an answer changes the vertical-slice contract or accepted event semantics, update the authoritative document/ADR in the same reviewed change or record a follow-up proposal.

### I-001 — Focus versus Attend

- **Question:** Does pointer hover/touch focus itself enter canonical attention, or is Attend always an explicit activation?
- **Recommended default:** Hover and spatial focus are ephemeral previews; click, tap, Enter/Space, or controller primary action records Attend. This avoids event spam and gives touch/keyboard equivalent intent.
- **Alternatives:** Dwell automatically records Attend; first tap focuses and second tap attends; every focus transition records Attend.
- **Director answer:** _Pending._
- **Blocks:** Production attention integration and event emission from input.

### I-002 — Meaning of reversible attention

- **Question:** When visual attention is cleared, must canonical `attendedConceptId` return to `null`, or may the log retain the last attended concept while active presentation focus clears ephemerally?
- **Recommended default:** The event log retains the last attended concept as session history; active presentation attention may clear without a durable event. Re-attending another bead records the next event.
- **Compatibility impact:** A requirement for canonical `null` would need a reviewed event/reducer change such as an explicit attention-cleared event; M2 must not simulate it through direct state mutation.
- **Director answer:** _Pending._
- **Blocks:** Cancellation integration and replay semantics for cleared attention.

### I-003 — Inspect versus Attend

- **Question:** Can a player inspect a concept without attending to it, and can an attended concept be inspected without changing the pair-building state?
- **Recommended default:** Yes to both. Inspection is reversible presentation state; Attend is an interpretive selection. Long press is a shortcut, never the sole route.
- **Director answer:** _Pending._
- **Blocks:** Concept card behavior and touch/keyboard inspection mapping.

### I-004 — Attention replacement

- **Question:** Does attending a new primary bead clear a provisional selected pair and relation hypothesis?
- **Recommended default:** If no thread has been committed, a new primary Attend starts a new interpretation and clears provisional pair/intention through an explicit command/event policy. It never removes committed threads.
- **Compatibility impact:** The accepted reducer currently replaces `attendedConceptId` but does not automatically clear pair/hypothesis on `bead.attended`; changing that requires a reviewed domain decision rather than UI-only cleanup.
- **Director answer:** _Pending._
- **Blocks:** Multi-step command sequencing after M2-001.

### I-005 — Candidate selection gesture

- **Question:** After Attend, should selecting a candidate be a second click/tap, the start of a drag, or either?
- **Recommended default:** A second activation selects the pair; drag may be a fluent shortcut that selects the endpoint when released, but both paths enter the same provisional pair state before commitment.
- **Director answer:** _Pending._
- **Blocks:** Pointer/touch state-machine migration.

### I-006 — Relation-choice presentation

- **Question:** Where and how should Echo, Passage, Tension, and Ground appear?
- **Recommended default:** A world-anchored four-part constellation near the selected pair, mirrored by an accessible DOM radiogroup. Each option includes label, stable glyph/pattern, short verb phrase, immediate preview, and full keyboard focus semantics.
- **Alternatives:** Persistent HUD tray; radial pointer menu; sequential four-card chooser; gesture-only selection.
- **Do not accept:** Color-only wedges, unlabeled first-use icons, or a modal that visually replaces the world.
- **Director answer:** _Pending._
- **Blocks:** Relation-declaration UI and M4 grammar hooks.

### I-007 — Relation vocabulary and microcopy

- **Question:** Are the player-facing names final, and what first-use phrase accompanies each?
- **Recommended default:** Keep the four names and test these phrases: Echo — “shares a form”; Passage — “carries or transforms”; Tension — “opposes or complicates”; Ground — “supports or embodies.”
- **Director answer:** _Pending._
- **Blocks:** Onboarding copy, accessible labels, captions, and content authoring examples.

### I-008 — Timing of declaration

- **Question:** Must relation intention always be chosen before expressive weaving begins?
- **Recommended default:** Yes. Pair selection opens the relation constellation; intention changes preview immediately; weaving then performs that declared interpretation. A fluent shortcut may remember focus position but never silently reuse a prior intention.
- **Director answer:** _Pending._
- **Blocks:** Commit-state machine and gesture capture order.

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
- **Director answer:** _Pending._
- **Blocks:** Command cancellation and input integration.

### I-011 — Background activation

- **Question:** Should clicking/tapping empty world space cancel, rotate the world, or do nothing?
- **Recommended default:** Pointer drag on empty space retains camera control; a deliberate click/tap on empty space cancels only when it cannot be confused with camera motion. Touch receives a visible Cancel target rather than relying on background taps.
- **Director answer:** _Pending._
- **Blocks:** Camera/input arbitration and mobile ergonomics.

### I-012 — Immediate consequences by step

- **Question:** What minimum response proves each action was understood before M4 polish?
- **Recommended default:**
  - focus: subtle bead/label response;
  - Attend: world noise recedes, identity motif foregrounds, candidates awaken;
  - pair: spatial/thread preview joins the two without asserting outcome;
  - intention: preview motion/sound/pattern changes categorically;
  - weave: gesture is traced and sonified;
  - commit: one coordinated placeholder cue plus durable state update.
- **Director answer:** _Pending._
- **Blocks:** M2 placeholder-presentation acceptance.

### I-013 — Overture teaching strategy

- **Question:** Should the first three beads constrain the available path, demonstrate through staging, or permit free exploration with contextual help?
- **Recommended default:** Stage a strong first resonance and progressively reveal affordances without locking incorrect actions; show text only after hesitation or an unavailable action.
- **Director answer:** _Pending._
- **Blocks:** Overture/onboarding task, not isolated command work.

## Decision gate by task type

| Work | Required decisions |
| --- | --- |
| M2-001 isolated Attend command | None; no input/presentation integration |
| Production attention integration | I-001, I-002, I-003, I-012 |
| Pair selection and cancellation | I-004, I-005, I-010, I-011 |
| Relation declaration | I-006, I-007, I-008, I-012 |
| Gesture/input equivalence | I-005, I-009, I-010, plus playtest device decision P-005 |
| Overture | I-001 through I-013 as applicable |
