# M2-012 — The focus view: pair before reading, fog, lens and the two-card column

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M2-004, M2-008, and M2-010 must be Done.
- Director decisions I-015 through I-020 and the 2026-09-30 amendments to
  `docs/VERTICAL-SLICE-SPEC.md` §6–§9 must be accepted through reviewed merge.

The merged production interpretation cutover is the base this task revises.
M2-011 is not a dependency in the steering sense: its Review status records the
director's pending device, accessibility and audiovisual gate, and this task
replaces the surface that gate was written against; the gate is re-run on this
task's result instead.

## Objective

Make attention unmistakable and make the pair the object of the act. Replace
the intention-first surface of M2-011 with the focus view accepted in I-015
through I-020:

- **Dwell** opens a bead's card while roaming (I-015).
- **Attend** turns the arena and closes the camera in so the attended bead sits
  lower-left, near and large; the world dims and softens into fog while the
  attended bead stays sharp; other beads glow through the fog by their
  relation-neutral band; the attended card locks at the top of the right column
  and an empty slot beneath it asks for the second bead (I-017, I-018).
- **Sight** with the lens: beads under the pointer come sharp and lit, a faint
  preview thread joins them to the attended bead, and the sighted bead's card
  fills the gap with the shared facets lit in both cards (I-017, I-018).
- **Lock** the second bead; the four sigils bloom on the preview thread
  between the pair; **hovering a sigil previews its grammar** on the locked
  pair; **press-and-hold weaves**, release commits (I-016).
- **Return**: the thread grows, the sky answers, the fog lifts on its own; the
  two cards fold into one thread card that stays until the player's next act
  (I-018).
- **Reopen** a committed thread into the same view (I-019).
- The gesture profile is filled by the lens path and the hold; the durable
  batch and its payloads do not change (I-020).

Nothing in the domain changes. The task is presentation, interaction draft,
coordinators, cues, captions, audio attention, and tests.

## Why this is next

Played end to end, the M2-011 surface demands a verb before the object is
known: in the September playtest five of nine readings were Echo, chosen by
default. The accepted camera posture exists in code but does not carry the
frame; attention is not visibly different from roaming; the margin stands
empty until an outcome arrives. The director's redesign (recorded as I-015
through I-020) fixes all three with one coherent state, and the Studies spike
(M9-001) depends on the facet notation this view delivers, so it is built
first.

## Implementation plan

One reviewable pull request on the emitted branch, in four stages so the
review can follow the order of dependence. Every stage keeps every check green.

1. **Draft and coordinators.** Revise the ephemeral interpretation draft to
   the pair-first stages (attending → locked → reading) with the cancel order
   Read → Lock → Attend → Roam; keep the attention coordinator and the atomic
   commit coordinator's contract; the gesture recorder takes the lens path from
   Attend to Lock plus the hold. Unit tests for every transition, every cancel,
   and the unchanged three-event batch.
2. **World.** Camera: the close attended posture and the locked-pair framing,
   solved in `framing.ts` and phrased by the rig; reduced motion: no travel.
   Fog: dim plus slight blur as one masked pass, attended bead and lens disc
   exempt, per-bead level from the accepted bands with a visible floor;
   dim-only under reduced motion and on the low tier; nothing above CAV-007's
   flicker bound. Lens: pointer-following disc with a soft edge; touch and
   keyboard equivalents. Sigils on the preview thread; grammar preview on
   hover; thread picking for reopening.
3. **Column, captions, mirror.** Dwell inspection; the locked attended card,
   the gap and its hesitation line; the sighted card with lit shared facets or
   the "nothing shared" statement; the thread card after commit; the reopened
   view; the accessible list of woven threads; captions for every new moment
   that pass the existing copy rules.
4. **Proof.** Browser tests for pointer, keyboard and touch-emulated paths,
   reopening, dwell, cancel order, and reduced-motion/low-tier fallbacks; the
   golden path still reachable; the performance reference; the tester brief
   rewritten for this build; the completion report.

Before editing, record a concise plan in the pull request. Implement only this
scope; propose anything else in the implementation notes.

## Required reading

- `AGENTS.md`
- `docs/INTERACTION-DECISIONS.md`, especially the accepted sequence and I-015 through I-020
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 6–9, 11, 19 and 22
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`, especially ADR-008, ADR-009 and ADR-013
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, especially CAV-003, CAV-004 and CAV-007
- `docs/PLAYTEST-PLAN.md`, especially M2 and P-005
- `docs/audits/DESIGN-REVIEW-SCHELL.md`, especially finding 1
- `docs/proposals/GAMEPLAY-MODES.md`
- `docs/STUDIES-SPEC.md`, section 7, for what the Studies will rely on
- `docs/tasks/M2-011-production-interpretation-loop-cutover.md`
- `docs/tasks/M2-012-focus-view.md`

## Existing code and callers to inspect

- `src/runtime/interactionDraft/interpretationDraft.ts` and its tests — the
  stages `attending`, `armed`, `candidate-selected` and every transition to
  revise;
- `src/runtime/interpretation/createInterpretationAttentionCoordinator.ts`,
  `createInterpretationCommitCoordinator.ts`,
  `createProductionInterpretation.ts` — the seams the new order must keep;
- `src/runtime/gestureProfile/buildGestureProfile.ts` — the fields the lens
  path and the hold must fill;
- `src/state/interactionDraft/**` and `src/state/interpretationPresentation/**`
  — the reactive owners of draft and presentation state;
- `src/scene/CameraRig.tsx`, `framing.ts`, `cameraHold.test.ts` — the
  existing lower-corner posture, the phrasing law, and the hold;
- `src/scene/Effects.tsx`, `salience.ts`, `quality.ts`, `resolution.ts` — the
  bloom pass, the three-tier focal hierarchy the fog should extend rather than
  duplicate, and the tiers the fallbacks key on;
- `src/scene/ThreadingDriver.tsx`, `threading.ts`, `ThreadPreview.tsx`,
  `Threads.tsx`, `ribbon.ts`, `IntentionConstellation.tsx`, `Beads.tsx`,
  `labels.ts`, `identity.ts` — the pointer state machine, the preview, the
  committed ribbons (to be pickable), the sigil plate, and labels;
- `src/audio/attention.ts`, `director.ts`, `grammar.ts`, `useAudio.ts` — the
  sound-space, the cue director, and the grammar transforms the sigil preview
  reuses;
- `src/runtime/cues/types.ts`, `planCues.ts`, `createCueBus.ts` and
  `src/runtime/captions/describeCue.ts` with tests — the vocabulary and copy
  rules;
- `src/ui/arena/ArenaHud.tsx`, `BeadInspectCard.tsx`, `Marginalia.tsx`,
  `marginState.ts`, `marginaliaNote.ts`, `InterpretationControls.tsx`,
  `CueCaptions.tsx`, `src/ui/components/inspection.ts`, `ReadingColumn.tsx`
  — the column, the pinned inspection, the margin state machine, and the DOM
  mirror;
- `src/runtime/testMode.ts` — the browser adapter and snapshot fields;
- `tests/browser/*.spec.ts` — every browser test that drives the M2-011
  surface and must be rewritten for this one;
- `docs/TESTER-BRIEF.md` — describes the build and must describe this one.

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M2-012",
  "branch": "codex/M2-012-focus-view",
  "dependencies": ["M2-004", "M2-008", "M2-010"],
  "requiredReading": [
    "AGENTS.md",
    "docs/INTERACTION-DECISIONS.md",
    "docs/VERTICAL-SLICE-SPEC.md",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "docs/CONTENT-AUDIOVISUAL-REFERENCE.md",
    "docs/PLAYTEST-PLAN.md",
    "docs/audits/DESIGN-REVIEW-SCHELL.md",
    "docs/proposals/GAMEPLAY-MODES.md",
    "docs/STUDIES-SPEC.md",
    "docs/tasks/M2-011-production-interpretation-loop-cutover.md",
    "docs/tasks/M2-012-focus-view.md"
  ],
  "ownership": {
    "paths": [
      "docs/tasks/M2-012-focus-view.md",
      "docs/TESTER-BRIEF.md",
      "src/runtime/interactionDraft/**",
      "src/runtime/interpretation/**",
      "src/runtime/commands/interpretationCommit/**",
      "src/runtime/gestureProfile/**",
      "src/runtime/cues/**",
      "src/runtime/captions/**",
      "src/runtime/scene/**",
      "src/runtime/testMode.ts",
      "src/state/interactionDraft/**",
      "src/state/interpretationPresentation/**",
      "src/state/store.ts",
      "src/state/types.ts",
      "src/scene/**",
      "src/audio/attention.ts",
      "src/audio/attention.test.ts",
      "src/audio/director.ts",
      "src/audio/director.test.ts",
      "src/audio/useAudio.ts",
      "src/audio/focusVoicing.ts",
      "src/audio/focusVoicing.test.ts",
      "src/audio/focusLane.ts",
      "src/audio/focusLane.test.ts",
      "src/audio/productionAudio.ts",
      "src/audio/scheduler.ts",
      "src/audio/scheduler.test.ts",
      "src/audio/voices.ts",
      "src/audio/sfx.ts",
      "src/audio/describe.ts",
      "src/ui/arena/**",
      "src/ui/components/inspection.ts",
      "src/ui/components/ReadingColumn.tsx",
      "src/ui/components/readingColumn.render.test.ts",
      "src/App.tsx",
      "tests/browser/**"
    ],
    "boundaries": [
      "interaction-draft",
      "interpretation-coordinators",
      "presentation-cue-vocabulary",
      "camera-phrasing",
      "scene-focus-rendering",
      "arena-ui",
      "audio-attention",
      "browser-test-mode",
      "audio-voice-retirement"
    ]
  },
  "unresolvedDecisions": [],
  "requiredChecks": [
    "npm ci",
    "npm run steering:test",
    "npm run steering:check",
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run validate:content",
    "npm run build",
    "npm run bundle:check",
    "npm run test:browser",
    "npm run measure:performance",
    "git diff --check"
  ],
  "humanReview": [
    "product-specification",
    "accessibility-interaction",
    "audiovisual-quality"
  ],
  "stopBoundary": "reviewable-pr"
}
```

## Owned scope

### Declared paths

- `docs/tasks/M2-012-focus-view.md`
- `docs/TESTER-BRIEF.md`
- `src/runtime/interactionDraft/**`
- `src/runtime/interpretation/**`
- `src/runtime/commands/interpretationCommit/**`
- `src/runtime/gestureProfile/**`
- `src/runtime/cues/**`
- `src/runtime/captions/**`
- `src/runtime/scene/**`
- `src/runtime/testMode.ts`
- `src/state/interactionDraft/**`
- `src/state/interpretationPresentation/**`
- `src/state/store.ts`
- `src/state/types.ts`
- `src/scene/**`
- `src/audio/attention.ts`
- `src/audio/attention.test.ts`
- `src/audio/director.ts`
- `src/audio/director.test.ts`
- `src/audio/useAudio.ts`
- `src/audio/focusVoicing.ts`
- `src/audio/focusVoicing.test.ts`
- `src/audio/focusLane.ts`
- `src/audio/focusLane.test.ts`
- `src/audio/productionAudio.ts`
- `src/audio/scheduler.ts`
- `src/audio/scheduler.test.ts`
- `src/audio/voices.ts`
- `src/audio/sfx.ts`
- `src/audio/describe.ts`
- `src/ui/arena/**`
- `src/ui/components/inspection.ts`
- `src/ui/components/ReadingColumn.tsx`
- `src/ui/components/readingColumn.render.test.ts`
- `src/App.tsx`
- `tests/browser/**`

### Declared boundaries

- `interaction-draft`
- `interpretation-coordinators`
- `presentation-cue-vocabulary`
- `camera-phrasing`
- `scene-focus-rendering`
- `arena-ui`
- `audio-attention`
- `browser-test-mode`
- `audio-voice-retirement`

Within `src/scene/**`, the conclusion performance, constellation reveal,
firmament, opening and idle modules are inspection-only unless the fog or the
camera framing genuinely requires a change, which the report must name. The
domain (`src/domain/**`), the content pack, persistence, the audio grammar and
comfort tables, the conclusion, the portrait, the annotation, the threshold
copy, `package.json` and the workflows do not change.

## Functional contract

### Draft stages

```ts
type InterpretationDraft =
  | { readonly stage: "inactive" }
  | { readonly stage: "attending"; readonly attendedConceptId: ConceptId }
  | { readonly stage: "locked"; readonly attendedConceptId: ConceptId; readonly candidateConceptId: ConceptId }
  | { readonly stage: "reading"; readonly attendedConceptId: ConceptId; readonly candidateConceptId: ConceptId; readonly intention: RelationIntention };
```

Sighting (the bead under the lens) and the reopened thread are presentation
state, not draft: they publish no draft transition. Cancel: `reading` →
`locked` → `attending` → `inactive`, one step per Cancel, never a durable
event (I-010 as adapted by I-016). A new Attend from any stage discards the
draft and records `bead.attended` as today (I-004). Commit requires `reading`
and publishes the unchanged atomic batch `pair.selected`,
`relation.hypothesized`, `thread.committed` through the existing commit
coordinator. The keyboard hold-and-confirm remains the coordinate-free route.

### Camera

- Attended posture: the bead lower-left, close enough that its internal motif
  reads and its apparent size is unmistakably larger than any other bead,
  with the sphere's silhouette still inside the frame. The values live in
  `framing.ts` as named constants for the director to tune.
- Locked framing: both beads in frame, the attended one lower-left, the second
  up and to the right where the sphere allows; a turn, never a cut.
- Reduced motion: no travel; scale and brightness set the attended bead apart.
- Return: the roaming framing after the commit performance ends; a reopened
  thread uses the locked framing.

### Fog and lens

- Fog: dim plus a slight blur as one pass with a mask that exempts the
  attended bead and the lens disc; per-bead level from the accepted band
  (initial values 0.7 high, 0.45 medium, 0.25 weak of roaming brightness, all
  tunable; the floor is never lower than 0.2); no luminance change faster
  than CAV-007's bound; dim-only under reduced motion and on the low tier.
  Fog extends the existing focal hierarchy rather than duplicating it.
- Lens: a disc of about one sixth of the viewport width with a soft edge,
  following the pointer with light damping (none under reduced motion);
  beads under it at full brightness and sharpness with their name; a faint
  preview thread from the attended bead to the sighted bead. Touch: one-finger
  drag over the arena moves the lens, two-finger drag orbits; keyboard: the
  lens sits on the focused bead.
- The lens is presentation of the accepted directional sweep: it never
  filters, ranks or locks candidates, and the band a bead shows is computed
  once on Attend by the existing resonance path.

### The column

- Roaming dwell (~700 ms) opens the hovered bead's card at the top; leaving
  closes it after ~300 ms. The explicit details control, long press and `I`
  stay.
- On Attend the attended card locks at the top; beneath it an empty slot with
  a faint outline. After ~3 s without a sighted bead one line appears: "Find a
  second bead." Never sooner (I-013).
- The sighted bead's card fills the slot after ~250 ms; facets both beads
  carry are lit in both cards; if none: "These two share no facet Castalia
  knows." Lock keeps both cards.
- After the commit performance the two cards fold into one thread card: the
  outcome's title, evidence line, one sentence, and sources on request; it
  stays until the player's next act. The margin's rule that no timer closes a
  page holds. Earlier readings remain reachable as today.
- Reopened thread: both bead cards and the thread card.
- The DOM mirror lists the woven threads as buttons ("Fibonacci Sequence ·
  Echo · Counterpoint") so reopening needs no pointer.

### Sigils and preview

- On Lock, Echo, Passage, Tension and Ground bloom on the preview thread
  between the pair, world-anchored, with the accessible radiogroup mirroring
  them.
- Hover or focus a sigil: the preview thread is constructed in that grammar,
  both beads move in it, and one bar of the two motifs sounds in that grammar
  through the existing transforms. No sigil is marked, ordered or weighted by
  fit; the reception ("confirmed", "refined", "complicated") appears only
  after commit, as today.
- Press and hold a sigil to weave; release commits. A tap without a hold is a
  short hold.

### Gesture

The lens path from Attend to Lock supplies `pathLengthViewport`, `curvature`,
`averageSpeedViewportPerSecond` and `speedVariance`; the sigil hold supplies
`durationMs`; pressure where available. Keyboard and controller supply
`durationMs` and modality only. No field is added or removed.

### Cues and captions

New cue types in `CuePayloadMap`, each with a caption that passes the existing
copy rules: `attention.sighted` (sighted bead and shared facets),
`pair.locked`, `reading.previewed` (the intention being heard), and
`thread.reopened`. `attention.enter`, `candidate.latched`, `weave.released`,
`thread.woven` and the outcome cues keep their payloads; `intention.armed` is
retired or re-pointed at `reading.previewed`, whichever keeps the directors
simplest, and the report says which.

### Sound

Attention still thins the bed. The sighted bead's motif answers at a level set
by its band; Lock alternates the two motifs in call and response; a sigil
preview plays one bar in that grammar; the commit phrase is unchanged.

### Test mode

The adapter's snapshot reports `draftStage` in the new vocabulary,
`sightedConceptId`, `reopenedThreadId`, and a `focus` object (`fogActive`,
`blurActive`, `lensConceptId`, `attendedCardOpen`, `gapOpen`,
`sightedCardOpen`); `presentationProfile()` continues to expose the tier and
reduced motion so fallbacks are testable.

## Out of scope

- any change to `src/domain/**`, the event schema, the reducer, replay,
  outcome resolution, motif detection, the portrait, the annotation or the
  conclusion;
- retracting a thread; the Studies (M9-001 follows this task);
- facet glyph art; the threshold copy; the shelf;
- new dependencies, workflow or deployment changes;
- the audio grammar and comfort tables (the preview reuses them);
- performance work beyond the reference measurement and the tier fallbacks.

## Constraints

- TypeScript strict; explicit public types; no `any`.
- Domain untouched; every rule stays where it is (ADR-008); every moment is
  staged once through the cue boundary (ADR-009).
- No durable event before commit; the commit batch and every payload are
  byte-identical to M2-011's (ADR-013).
- Fog level derives from the accepted bands only; the lens never filters or
  ranks; no surface shows a documented flag, a fit, or a number.
- CAV-007 comfort bounds hold; reduced motion and the low tier are honoured
  as specified; no per-frame React state.
- Every action keeps a mouse, touch and keyboard path with the same decision,
  reversibility, information and consequence.
- The golden path (seed `castalia-golden-001`: Fibonacci Sequence ↔
  Counterpoint as Echo) stays reachable and its browser test is rewritten,
  not removed.
- If the implementation needs a domain change, a new dependency, a change to
  the accepted decisions, or a comfort bound outside CAV-007, stop and record
  a proposal instead of expanding scope.

## Acceptance criteria

- The draft state machine has exactly the stages above; unit tests cover every
  transition, every Cancel step, a new Attend from every stage, and prove no
  durable event is appended before commit.
- Commit from `reading` publishes the unchanged three-event batch with a
  gesture profile whose geometric fields come from the lens path and whose
  duration comes from the hold; keyboard commit produces the hold-only
  profile; a test compares payload shapes with M2-011's fixtures.
- Attend moves the camera to the close lower-left posture and Lock to the
  pair framing, solved in `framing.ts` with unit tests; under reduced motion
  the camera does not travel and the attended bead is set apart by scale and
  brightness.
- Fog and lens behave as specified; a test shows per-bead fog level is a
  function of band alone with the floor; a test shows dim-only under reduced
  motion and on the low tier; no luminance change exceeds CAV-007's bound.
- Dwell inspection, the locked card, the gap, the hesitation line's timing,
  the sighted card with lit shared facets or the "nothing shared" statement,
  the thread card after commit that stays until the next act, and the
  reopened view are present and covered by render tests.
- The sigils bloom on the preview thread on Lock; hovering previews the
  grammar visually and audibly through existing transforms; no sigil shows
  fit, order or weight; press-and-hold weaves.
- Committed threads are pickable in the world and listed as buttons in the DOM
  mirror; activating either enters the reopened view; Escape leaves it;
  nothing durable changes.
- Captions exist for every new cue and pass the existing copy tests; the
  screen-reader route reports sighting, lock, preview, commit and reopening.
- Browser tests cover: the pointer path attend → sight → lock → preview → hold
  → commit; the keyboard path; the touch-emulated path; reopening; dwell; the
  cancel order; and reduced-motion and low-tier fallbacks; the golden path
  passes; `test:browser` is green.
- The performance reference is recorded beside the previous one, on the base
  tier with fog on, and the low tier with dim only.
- `docs/TESTER-BRIEF.md` describes this build: what can now be judged (the
  focus view, the four readings previewed before commit, reopening) and what
  cannot.
- Every required check passes.

## Required tests and checks

- `npm ci`
- `npm run steering:test`
- `npm run steering:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run validate:content`
- `npm run build`
- `npm run bundle:check`
- `npm run test:browser`
- `npm run measure:performance`
- `git diff --check`

Focused scans, recorded in the report: a diff scan proving `src/domain/**`,
the content pack, persistence, the audio grammar and comfort tables, the
conclusion, the portrait and the annotation are unchanged; a payload scan
comparing the commit batch with M2-011's fixtures; a copy scan of new captions
and column text for numbers, fit words and documented flags before commit. If
any required check cannot run, report the exact reason and do not mark the
task complete.

## Expected completion report

- the draft stages, coordinators and gesture capture, with tests;
- camera constants and framing tests; fog and lens implementation, mask,
  tiers and fallbacks; the performance reference beside the previous one;
- the column, dwell, gap, cards, thread card and reopened view;
- cues, captions and the DOM mirror;
- every check result and the focused scans;
- what changed in `docs/TESTER-BRIEF.md`;
- proposals discovered during implementation, and the human-review items.

## Human review boundary

### Declared categories

- `product-specification`
- `accessibility-interaction`
- `audiovisual-quality`

Human review is required before merge because this replaces the core
interaction surface. The director must judge, with headphones, on desktop and
on a phone: whether Attend is unmistakable and the close posture is
comfortable; whether the fog reads as attention rather than damage, at every
tier and under reduced motion; whether the lens feels like looking, not
aiming; whether the gap invites without nagging; whether the four grammar
previews are distinguishable and honest; whether the return after commit is
calm and the thread card stays long enough to read; whether reopening a thread
feels like returning to a thought; and whether the keyboard and touch routes
are the same experience. This is the P-005 gate re-run on the new surface.
Automated checks prove the state machine, the batch, the bounds and the
fallbacks; they cannot establish comfort or legibility.

## Implementation notes

- Stage 1 (core contract) landed first on `codex/M2-012-focus-view`: the
  pair-first draft (`inactive`/`attending`/`locked`/`reading`), the commit
  command accepting only a `reading` draft, the gesture builder's `approach`
  input (lens path supplies geometry, the hold supplies duration; payload
  fields unchanged), a focus presentation store (sighted, dwell, hovered
  reading, reopened thread), one pure `deriveFocusView` read by every surface,
  the cue vocabulary (`attention.sighted`, `pair.locked`, `reading.previewed`,
  `thread.reopened`; `intention.armed` and `candidate.latched` retired, their
  director behaviour re-pointed), captions, and the production interpretation
  API. Scene and UI callers were adapted to a working baseline only.
- Declared paths corrected in stage 1: the commit command
  (`src/runtime/commands/interpretationCommit/**`) had to accept the new draft
  type, the cue directors (`src/runtime/scene/**`) consume the vocabulary, the
  audio director's test drives it. No path outside this list changed.
  `README.md`'s Play section still describes the intention-first loop; README
  is owned by M0-008 (in Review), so its update is left for a change after
  M0-008 closes rather than claimed here.
- Directly assigned by the game design director on 2026-09-30 with I-015
  through I-020 and the spec amendments reviewed in one pull request. Not
  selected by the autonomous loop: while M2-011 remains in Review without a
  steering ownership projection, no packet can validate as Ready. The branch
  `codex/M2-012-focus-view` is created on merge of the packet. M9-001 is
  Blocked behind this task and relies on the facet notation it delivers.

- Stage 2 (surfaces) landed as four workstreams on the stage-1 contract, each
  one commit, integrated in order: the pointer layer and sigils
  (`src/scene/threading.ts`, `dwell.ts`, `threadPicking.ts`, the plate on the
  unread strand), the column and the DOM mirror (`src/ui/arena/**`), the voice
  of the focus view (`src/audio/director.ts`, `focusVoicing.ts`,
  `focusLane.ts`), and the camera, fog and beads (`CameraRig.tsx`,
  `framing.ts`, `focusFog.ts`, `FocusFogEffect.tsx`, `focusFogPass.ts`,
  `focusPosture.ts`, `Beads.tsx`, `salience.ts`). No durable event, payload or
  schema changed; the commit batch and its identity are M2-011's.
- Declared-path correction in stage 2, same protocol as stage 1:
  `src/audio/focusVoicing.ts`, `focusLane.ts` and their tests are the new pure
  planners the audio contract needed; `src/audio/productionAudio.ts`,
  `scheduler.ts` (with its test) and `voices.ts` carry the retire seam that
  lets a new focus voice take the last one back (boundary
  `audio-voice-retirement`); `src/audio/sfx.ts` and `src/audio/describe.ts`
  lose code this task made dead (the drag's silk shimmer and the describer's
  branch for the retired `armed:` plans);
  `src/ui/components/readingColumn.render.test.ts` is the declared
  `ReadingColumn.tsx`'s own test. The comfort tables, the grammar and every
  other audio file are unchanged.
- Decisions taken inside the contract, for review:
  - The Lock's answer is immediate (the unread strand, the second card, the
    call and response), and the sigils bloom once the locking hand has let go
    and the camera has arrived: 11 frames under reduced motion (about 0.18 s
    at 60 fps); with motion, after the pair framing turn (about 0.7 s), and
    they then move 0.1 px. The old law "at once" (B2) is now measured under
    reduced motion.
  - Attend turns the world until the attended bead sits in the left of the
    frame and as low as the ±19° elevation limit allows. Beads near the top of
    the sphere (4 of 12 in the measured draw, Fibonacci among them) stay above
    centre. The browser test holds the "left" part only.
  - The fog runs as one pass before the bloom and is switched off in clear
    air. Its dim level is a function of the relation-neutral band alone (0.7 /
    0.45 / 0.25, floor 0.2). Low tier and reduced motion get no blur code.
  - A dwell card hides the margin while the look lasts; the pair's cards leave
    on release and the thread card writes itself in about 0.4 s later; the
    column carries its own visible Step back (I-011) for touch.
  - Hover previews are audible one at a time: each new focus voice retires the
    last, so the reading the pointer rests on is always the one heard.
  - A weave now ends the thinned attention sound-space, as it ends the fog.
    Before this branch the bed stayed thinned from the first weave until the
    next Attend.
  - The arena's page (`ArenaHud` and everything under it) loads behind a
    dynamic import prefetched after the title paints, as the conclusion does:
    with every workstream in, the first load measured 531,608 bytes gzip
    against the 524,000 ceiling, and the budget's policy prescribes a dynamic
    import, not a raise.
- Browser tests: the golden, keyboard, assistive, touch, cancel-ladder,
  replay, seed and adapter paths, and the focus view (column states, the gap
  line's delay, lit shared facets and "nothing shared", dwell, reopening from
  the mirror and from the world, full-motion fog with blur) all run in
  `deterministic-mode.spec.ts`, because `test:browser` runs a fixed list of
  specs and `package.json` belongs to M0-008. `gesture-holds-the-world` and
  `the-world-answers` keep their laws on the new surface. The adapter gains
  `threadScreen(threadId, at)` and `beadScreen(id, { evenIfUnsettled })`.
  `kept-games.spec.ts` no longer presses the shelf toggle blind on its second
  visit: a quick Leave can revive the title that was still fading out, shelf
  already open. That race predates this task.
- Checks on the final head, run locally in the cloud container (4 cores,
  SwiftShader): `npm ci` resolved the unchanged lockfile (dry run; no
  dependency changed); `steering:test` 82 passed; `steering:check` passed for
  27 packets; typecheck (app and Playwright) passed; lint passed with the
  container's own agent worktrees under `.claude/worktrees/` excluded (they do
  not exist in a checkout); `npm test` 1,713 passed; `validate:content`
  passed; build passed; `bundle:check` passed at 523,445 bytes gzip and
  1,744,878 raw initial JavaScript (ceilings 524,000 and 1,760,000);
  `test:browser` 17 of 17 passed, and the four specs outside it 11 of 11;
  `git diff --check` clean. `measure:performance`: the mobile profiles
  passed; both desktop profiles fell below the spec's own floor of more than
  ten frames in five seconds, which main's own desktop-base also misses on
  this container (9 and 11 frames in two runs), so the gate is the container,
  and the numbers are recorded below.
- Performance reference (SwiftShader, same container, back to back; effective
  frames per second, evidence only per M0-005):

  | Profile | main `a87f18d` | this branch |
  | --- | --- | --- |
  | desktop-base, idle | 2.20, 1.82 | 2.08, 2.01, 2.23 |
  | mobile-potato, idle | 6.08 | 6.49, 6.11 |
  | desktop-base, focus (fog and blur) | — | 1.28 |
  | mobile-potato, focus (dim only) | — | 3.64, 3.95 |

  Idle cost is unchanged. On a software renderer the fog pass costs about 40
  percent of the frame on the base tier and 35 percent on the low tier; one
  full-screen pass is far cheaper on a GPU, and only a device pass can say
  whether the low tier needs another form of fog.
- Proposals, not implemented (specification change protocol):
  - Low-tier fog as per-material dimming instead of a full-screen pass, if
    the device pass finds the pass too dear where the low tier is chosen.
    Affects `src/scene/**` only; alternative considered: keep the pass and
    drop the fog on the low tier, rejected because the focus would lose its
    one visible cue there.
  - The Attend pose cannot bring a bead near the top of the sphere below
    centre without relaxing the ±19° elevation limit, which exists for
    comfort. A director call: accept "left and as low as comfort allows", or
    relax the limit for Attend alone.
  - The shelf at the title keeps whatever state a fading title instance had
    (see the kept-games note). A separate UI task should reload the shelf
    when the title reopens; out of this task's paths.
  - README's Play section still describes the intention-first loop; README is
    M0-008's until it closes.
- Human review (declared categories): the whole surface is judgement by eye,
  ear and hand and has not been seen on a GPU or heard on headphones: the
  close-in and pair framing, the fog and lens, the lit-facet styling and the
  dashed gap, the plate's timing after a Lock with motion, the instant fold at
  commit, the dwell hiding the margin, the audio ladder (sighting 0.55 / 0.42
  / 0.30 of the bed by band, lock 0.72 / 0.64, hover 0.42 of a reading for a
  1.4 s bar, chosen 0.62, recall 0.45), and the whole flow by mouse, touch,
  keyboard and screen reader.
