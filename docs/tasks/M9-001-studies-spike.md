# M9-001 — Studies spike: authored problems over the same loop

## Status

Done

## Milestone

M9 — Studies

## Dependencies

- M2-012 must be Done: the focus view delivers the facet notation and the
  pair-first preview that every Study relies on.
- M2-004, M2-008, and M2-010 must be Done.
- ADR-015 must be accepted through reviewed merge, together with
  `docs/STUDIES-SPEC.md`.

The merged production interpretation cutover and the M3–M8 completion campaign
are the base this task builds on. M2-011 is not a dependency in the steering
sense: its Review status records the director's pending device, accessibility
and audiovisual gate, not missing code, and this task does not rely on that
gate.

## Objective

Add a second way to play, **Studies**, in which the player solves an authored
problem over a fixed set of beads using the Free Game's own verbs, outcomes and
cards. The spike proves the loop with twelve Studies in three chapters, three
goal kinds (passage, canon, carry), the silence answer, a build-time solver
that proves every authored Study, a pure evaluator, the brief pinned in the
margin, one coordinated *solved* moment, and a restart. The facets a Study
reads are shown by the focus view (M2-012) in both modes; this task adds
nothing to that display. It adds no event type, no persistence, no
progression and nothing to the Free Game.

`docs/STUDIES-SPEC.md` is the binding contract for the mode. This packet turns
it into an executable scope with objective acceptance criteria.

## Why this is next

The slice, played end to end on the deployed build, is an honest and beautiful
reader that poses no problem: any pair is allowed, no pair is better, and
nothing can be got better at (`docs/proposals/GAMEPLAY-MODES.md`). The director
accepted goals in a separate mode (ADR-015). The cheapest test of whether
Studies make the Game fun is to build the smallest complete version and play
it, before retract, titles or the Daily Study are considered.

## Implementation plan

Land as one reviewable pull request on the emitted branch, in four stages so
the review can follow the order of dependence. Each stage keeps every check
green.

1. **Content and domain.** `StudyDefinition` in the pack schema; twelve
   authored Studies; a solver over facets and faculties; the validator proves
   every Study as declared and fails the build otherwise; `evaluateStudy` as a
   pure function over `ConceptStructureLookup`; tests for purity, replay
   stability, R1 and R2.
2. **Runtime.** A Study session start without the draw; Study progression that
   evaluates after each commit and publishes `study.solved` through the cue
   bus after the commit moment settles; the declare-silence command; captions;
   restart; the browser test adapter.
3. **Presentation.** The Studies door and list; the brief pinned in the
   margin above the focus view's cards; the silence control in the margin
   and the DOM mirror; the solved plate; Conclude, Lens and Attunement hidden
   in Study mode.
4. **Proof.** The browser smoke, the Free Game regression run unchanged, the
   copy scans, the performance reference, and the completion report.

Before editing, record a concise plan in the pull request. Implement only this
scope; propose anything else in the implementation notes.

## Required reading

- `AGENTS.md`
- `docs/STUDIES-SPEC.md`
- `docs/proposals/GAMEPLAY-MODES.md`
- `docs/MASTER-PLAN.md`, especially the product laws it protects
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 6–11, 19, 20 and 22
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`, especially ADR-003, ADR-008, ADR-009, ADR-010, ADR-013 and ADR-015
- `docs/INTERACTION-DECISIONS.md`, especially I-006, I-009, I-010 and I-014
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, especially CAV-004 and CAV-006
- `docs/audits/DESIGN-REVIEW-SCHELL.md`
- `docs/tasks/M2-011-production-interpretation-loop-cutover.md`
- `docs/tasks/M9-001-studies-spike.md`

## Existing code and callers to inspect

- `src/content/castalia/schema.ts`, `validate.ts`, `index.ts`, `facets.ts`,
  `concepts.ts` and `castalia.test.ts` — how the pack is typed, assembled,
  validated at build and tested for arithmetic drift;
- `src/domain/outcomes/lookup.ts` — `ConceptStructureLookup`, the exact
  lookup the evaluator must be typed over, and `RelationLookup`, which it must
  not accept;
- `src/domain/outcomes/resolveThreadOutcome.ts` — `sharedFacetsOf`, the one
  definition of a shared facet;
- `src/domain/graph/buildTopology.ts` and `src/domain/motifs/detectMotifs.ts`
  — connected components, the Canon detector's carrier logic, and the pattern
  of a pure detector over `SessionStateV1`;
- `src/domain/session/drawCastaliaSession.ts` and
  `src/runtime/session/createCastaliaSessionStart.ts` — session identity and
  the `session.started` event a Study start must build without the draw;
- `src/domain/reducer/reduceSession.ts` and
  `src/domain/replay/decodeSessionEventLog.ts` — what a session start must
  satisfy (non-empty, unique concept ids) and how a log is validated;
- `src/runtime/progression/createSessionProgression.ts` — `afterCommit`,
  motif publication after the commit moment settles, and the invitation edge,
  which Study mode must not surface;
- `src/runtime/cues/types.ts`, `planCues.ts` and
  `src/runtime/captions/describeCue.ts` with its tests — the cue vocabulary,
  the planners, and the copy rules the new captions must pass;
- `src/runtime/content/castaliaLookup.ts` — the content adapter;
- `src/runtime/testMode.ts` and `src/scene/ThreadingDriver.tsx` — the browser
  test adapter's contract and where it is installed;
- `src/state/store.ts` and `src/state/types.ts` — phases and transitions;
- `src/App.tsx`, `src/ui/screens/TitleScreen.tsx`,
  `src/ui/screens/ThresholdScreen.tsx` — the doors and the threshold Studies
  bypass;
- `src/ui/arena/ArenaHud.tsx`, `Marginalia.tsx`, `marginState.ts`,
  `marginaliaNote.ts`, `InterpretationControls.tsx`, `CueCaptions.tsx` — the
  margin state machine, the note model, the DOM mirror and captions;
- `src/scene/labels.ts`, `Beads.tsx`, `IntentionConstellation.tsx` — bead
  name labels and the world-anchored controls, inspection-only: the facet
  display is M2-012's;
- `src/runtime/persistence/sessionArchive.ts` — confirm a Study session is
  never kept (it never concludes);
- `tests/browser/deterministic-mode.spec.ts` and `conclusion.spec.ts` — the
  keyboard route and the adapter usage a Study smoke must mirror; the Study
  smoke joins the former as a separate test.

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M9-001",
  "branch": "codex/M9-001-studies-spike",
  "dependencies": ["M2-012", "M2-004", "M2-008", "M2-010"],
  "requiredReading": [
    "AGENTS.md",
    "docs/STUDIES-SPEC.md",
    "docs/proposals/GAMEPLAY-MODES.md",
    "docs/MASTER-PLAN.md",
    "docs/VERTICAL-SLICE-SPEC.md",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "docs/INTERACTION-DECISIONS.md",
    "docs/CONTENT-AUDIOVISUAL-REFERENCE.md",
    "docs/audits/DESIGN-REVIEW-SCHELL.md",
    "docs/tasks/M2-011-production-interpretation-loop-cutover.md",
    "docs/tasks/M9-001-studies-spike.md"
  ],
  "ownership": {
    "paths": [
      "docs/tasks/M9-001-studies-spike.md",
      "src/content/castalia/schema.ts",
      "src/content/castalia/studies.ts",
      "src/content/castalia/validate.ts",
      "src/content/castalia/index.ts",
      "src/content/castalia/castalia.test.ts",
      "src/domain/studies/**",
      "src/runtime/studies/**",
      "src/runtime/cues/types.ts",
      "src/runtime/cues/planCues.ts",
      "src/runtime/cues/cues.test.ts",
      "src/runtime/captions/describeCue.ts",
      "src/runtime/captions/describeCue.test.ts",
      "src/runtime/content/castaliaLookup.ts",
      "src/runtime/testMode.ts",
      "src/scene/ThreadingDriver.tsx",
      "src/state/types.ts",
      "src/state/store.ts",
      "src/state/studies/**",
      "src/App.tsx",
      "src/ui/screens/TitleScreen.tsx",
      "src/ui/screens/StudiesScreen.tsx",
      "src/ui/screens/StudyPlate.tsx",
      "src/ui/arena/ArenaHud.tsx",
      "src/ui/arena/Marginalia.tsx",
      "src/ui/arena/marginState.ts",
      "src/ui/arena/marginaliaNote.ts",
      "src/ui/arena/InterpretationControls.tsx",
      "src/ui/arena/CueCaptions.tsx",
      "tests/browser/deterministic-mode.spec.ts",
      "src/runtime/interpretation/productionInterpretation.ts",
      "src/runtime/scene/createSceneDirector.ts",
      "src/runtime/scene/createSceneDirector.test.ts",
      "src/audio/director.ts",
      "src/audio/director.test.ts",
      "src/audio/useAudio.ts",
      "src/audio/roomLifecycle.ts",
      "src/audio/roomLifecycle.test.ts",
      "src/ui/screens/studies.render.test.ts",
      "src/ui/screens/studyPlate.render.test.ts",
      "src/ui/screens/titleDoors.render.test.ts",
      "src/ui/arena/FocusColumn.tsx",
      "src/ui/arena/worldVoice.ts",
      "src/ui/arena/StudyNote.tsx",
      "src/ui/arena/studyMode.ts",
      "src/ui/arena/presence.ts",
      "src/ui/arena/studyMode.render.test.ts",
      "src/ui/arena/studyVoice.test.ts",
      "src/ui/arena/testing/studyFixtures.ts"
    ],
    "boundaries": [
      "studies-content",
      "studies-domain-rules",
      "studies-runtime",
      "studies-presentation",
      "presentation-cue-vocabulary",
      "browser-test-mode",
      "audio-room-lifecycle"
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
    "content-authoring",
    "accessibility-interaction",
    "audiovisual-quality"
  ],
  "stopBoundary": "reviewable-pr"
}
```

## Owned scope

### Declared paths

- `docs/tasks/M9-001-studies-spike.md`
- `src/content/castalia/schema.ts`
- `src/content/castalia/studies.ts`
- `src/content/castalia/validate.ts`
- `src/content/castalia/index.ts`
- `src/content/castalia/castalia.test.ts`
- `src/domain/studies/**`
- `src/runtime/studies/**`
- `src/runtime/cues/types.ts`
- `src/runtime/cues/planCues.ts`
- `src/runtime/cues/cues.test.ts`
- `src/runtime/captions/describeCue.ts`
- `src/runtime/captions/describeCue.test.ts`
- `src/runtime/content/castaliaLookup.ts`
- `src/runtime/testMode.ts`
- `src/scene/ThreadingDriver.tsx`
- `src/state/types.ts`
- `src/state/store.ts`
- `src/state/studies/**`
- `src/App.tsx`
- `src/ui/screens/TitleScreen.tsx`
- `src/ui/screens/StudiesScreen.tsx`
- `src/ui/screens/StudyPlate.tsx`
- `src/ui/arena/ArenaHud.tsx`
- `src/ui/arena/Marginalia.tsx`
- `src/ui/arena/marginState.ts`
- `src/ui/arena/marginaliaNote.ts`
- `src/ui/arena/InterpretationControls.tsx`
- `src/ui/arena/CueCaptions.tsx`
- `tests/browser/deterministic-mode.spec.ts`
- `src/runtime/interpretation/productionInterpretation.ts`
- `src/runtime/scene/createSceneDirector.ts`
- `src/runtime/scene/createSceneDirector.test.ts`
- `src/audio/director.ts`
- `src/audio/director.test.ts`
- `src/audio/useAudio.ts`
- `src/audio/roomLifecycle.ts`
- `src/audio/roomLifecycle.test.ts`
- `src/ui/screens/studies.render.test.ts`
- `src/ui/screens/studyPlate.render.test.ts`
- `src/ui/screens/titleDoors.render.test.ts`
- `src/ui/arena/FocusColumn.tsx`
- `src/ui/arena/worldVoice.ts`
- `src/ui/arena/StudyNote.tsx`
- `src/ui/arena/studyMode.ts`
- `src/ui/arena/presence.ts`
- `src/ui/arena/studyMode.render.test.ts`
- `src/ui/arena/studyVoice.test.ts`
- `src/ui/arena/testing/studyFixtures.ts`

### Declared boundaries

- `studies-content`
- `studies-domain-rules`
- `studies-runtime`
- `studies-presentation`
- `presentation-cue-vocabulary`
- `browser-test-mode`
- `audio-room-lifecycle`

The Study browser smoke is added as its own test inside
`tests/browser/deterministic-mode.spec.ts`, which already hosts several
independent deterministic paths and is already in the `test:browser` script;
`package.json` is not owned, so no script or dependency changes. Every other
file in the repository is inspection-only, and in particular the event
schema, reducer, replay, outcome resolution, motif detection, portrait,
annotation, conclusion compiler, persistence, audio grammar, the threshold
copy and every Free Game surface must not change.

## Functional contract

### Content

Add to the Castalia pack, validated like everything else in it:

```ts
type StudyGoal =
  | { readonly kind: "passage"; readonly from: ConceptId; readonly to: ConceptId; readonly threads: number }
  | { readonly kind: "canon"; readonly facet: FacetId; readonly faculties: number }
  | { readonly kind: "carry"; readonly facet: FacetId; readonly into: FacultyId };

type StudyAnswer =
  | { readonly kind: "threads"; readonly pairs: readonly ConceptPair[] }
  | { readonly kind: "silence" };

interface StudyDefinition {
  readonly id: StudyId;                 // "study.eschholz-1"
  readonly chapter: "eschholz" | "waldzell" | "vicus-lusorum";
  readonly ordinal: number;             // 1–4 within the chapter
  readonly conceptIds: readonly ConceptId[];  // exactly eight, pack order
  readonly goal: StudyGoal;
  readonly answer: StudyAnswer;         // the Magister's answer
}
```

The brief is rendered from the goal by one function, never authored per Study.
Names may vary if the contract stays equally closed and explicit.

### The twelve Studies

Goals and the Magister's answers are fixed by this packet; every line below
was checked against the pack at `b08c07c`. The eight-bead sets are authored
under the rules in `docs/STUDIES-SPEC.md` §9 and proven by the solver.

| Study | Chapter | Brief | Answer | The Magister's line (facet carried) |
| --- | --- | --- | --- | --- |
| eschholz-1 | Eschholz | From The Möbius Band to Counterpoint in two threads | threads | Möbius Band —Continuity→ Continuous Symmetry —Invariance→ Counterpoint (the only two-thread way in the pack) |
| eschholz-2 | Eschholz | Carry Superposition through three faculties | threads | The Fourier Series → Counterpoint → The Standing Wave |
| eschholz-3 | Eschholz | Carry Threshold into Matter | threads | Cantor's Diagonal Argument —Threshold→ Diffraction |
| eschholz-4 | Eschholz | Carry Proportion into Matter | silence | no Matter bead carries Proportion, in the whole pack |
| waldzell-1 | Waldzell | From The Möbius Band to Polyrhythm in three threads | threads | Möbius Band —Self-Reference→ Cantor's Diagonal Argument —Discreteness→ Prime Numbers —No Common Measure→ Polyrhythm (four ways in the pack) |
| waldzell-2 | Waldzell | Carry Decomposition through all four faculties | threads | Prime Numbers → The Overtone Series → Conservation of Energy → Divisionism |
| waldzell-3 | Waldzell | From Just Intonation to Polyrhythm in two threads | silence | no bead in the pack carries a facet of both; the set must hold a three-thread way |
| waldzell-4 | Waldzell | From Girih Tiling to Polyrhythm in two threads | threads | Girih Tiling —Recursion→ Isorhythm —No Common Measure→ Polyrhythm (two ways in the pack) |
| vicus-1 | Vicus Lusorum | From Coupled Pendulums to The Möbius Band in three threads | threads | Coupled Pendulums —Interference→ Diffraction —Threshold→ Cantor's Diagonal Argument —Self-Reference→ Möbius Band (three ways in the pack) |
| vicus-2 | Vicus Lusorum | Carry Return through three faculties | threads | The Fourier Series → Polyrhythm → Coupled Pendulums |
| vicus-3 | Vicus Lusorum | Carry No Common Measure into Image | silence | no Image bead carries No Common Measure, in the whole pack |
| vicus-4 | Vicus Lusorum | Carry Discreteness through all four faculties | threads | Fibonacci Sequence → Equal Temperament → The Crystal Lattice → Divisionism |

Chapters are shown in this order and Studies within a chapter by ordinal. A
silence Study is indistinguishable from a solvable one until it is solved.

### Solver and validator

`solveStudy(study, lookup)` enumerates every answer of the brief within the
Study's beads over facets and faculties alone. The pack validator uses it and
refuses to build when: a solvable Study's authored answer is not an answer of
the brief's exact count; a shorter answer exists; a passage Study has more than
four answers; a silence Study has any answer; a passage silence has no answer
within count + 1; a Study has other than eight beads, a distractor sharing no
facet with the set, fewer than three faculties, or a bead set identical to
another Study's.

### Evaluator

```ts
type StudyMark = "economical" | "wide" | "varied";

type StudyStatus =
  | { readonly kind: "not-yet"; readonly statement: string }
  | {
      readonly kind: "solved";
      readonly by: "threads" | "silence";
      readonly threadIds: readonly ThreadId[];   // the player's answer; empty for silence
      readonly marks: readonly StudyMark[];      // empty for silence
      readonly explanation: string;              // structural, never an outcome
    };

evaluateStudy(
  session: SessionStateV1,
  study: StudyDefinition,
  lookup: ConceptStructureLookup,
  declaredSilence: boolean
): StudyStatus;
```

Pure, synchronous, deterministic, deeply frozen, no clock, no randomness, no
import from content, runtime, state, scene, audio, UI, browser or storage. The
lookup type is `ConceptStructureLookup` and nothing wider: the evaluator cannot
see a documented relation (R1). The *not yet* statement is short and
structural, never names a bead the player has not woven, and never hints.

### Runtime

- `createStudySessionStart`: builds `session.started` with seed
  `study:<studyId>`, the Study's beads in authored order, the Castalia world
  and the pinned pack version, session id
  `session:<packVersion>:study:<studyId>`, decodes it through
  `decodeSessionEventLogV1` and loads it into the canonical store. No draw.
- Study progression wraps the existing progression: after each `afterCommit`
  it evaluates; on the transition to *solved* it publishes a `study.solved`
  cue plan after the commit moment settles, the way a motif is staged after
  its outcome. The declare-silence command evaluates immediately and publishes
  `study.solved` or a caption-only `study.not-yet`. Both cue types join
  `CuePayloadMap`; `describeCue` gives each a caption that passes the existing
  copy rules.
- Restart leaves the session and starts the same Study again. Leaving discards
  the session; nothing is written to the shelf, and the session never
  concludes.
- The Attunement invitation is not surfaced in Study mode.
- The browser test adapter gains `startStudy(studyId)`, `studyStatus()` and
  `declareSilence()`.

### Presentation

- Title: a second door, *Studies*, beneath *Begin*, in the title's own
  register and reachable by keyboard. A new phase shows the Studies list:
  three chapters, each Study's brief, and *Begin*; no results, no counts.
- The Study opens straight into the arena; the threshold is not shown.
- The brief is pinned above the focus view's cards in the right column and
  re-openable; outcome cards and motif notes arrive as in the Free Game.
- Facets come from the focus view: the two cards light what both beads carry
  and the thread card names what a thread carried. A Study adds no facet
  display of its own.
- *It cannot be done* exists in the margin under the brief and in the DOM
  mirror on every Study, with a test id.
- The solved plate: the player's line with the facets each thread carried, the
  Magister's line, "solved in N; the brief asked for M", up to three marks as
  words, and *Again*, *Next Study*, *Back to the Studies*. *Not yet* is a
  caption and a margin line, never a plate.
- No Conclude, no Lens, no Attunement invitation in Study mode. Reduced motion
  shortens the solved moment as elsewhere.

## Out of scope

- retracting a thread or any event-schema change (ADR-013);
- hints, remembered results, chapter titles, progression, the Daily Study,
  Open Thread quests, share links;
- Bridge and Dialectic Study families;
- facet glyph art, or facets shown in the Free Game;
- a solution that "sounds like its logic": `study.solved` may reuse an
  existing ensemble voice through the audio director and introduces no
  grammar;
- any change to the threshold copy, the portrait, the annotation, the
  conclusion, the shelf, the Lens, or the Free Game's cues and captions;
- dependencies, deployment, PWA, and performance work beyond the reference
  measurement.

## Constraints

- TypeScript strict; explicit public types; no `any`.
- Domain purity: `src/domain/studies/**` imports nothing from content,
  runtime, state, scene, audio, UI, browser or storage.
- Determinism: identical logs and identical content give identical status,
  marks and statements; nothing reads the clock or randomness.
- Authored Studies are validated at build; an invalid Study fails the build.
- No durable event is added; declaring silence is ephemeral; restart is a new
  session.
- R1 and R2 are enforced by type and proven by test, not merely by care.
- No Study surface may show a count of Studies, a total, a percentage or a
  progress indicator, nor the words *score*, *points*, *rank* or *wrong*.
- The Free Game's behaviour, copy, cues and tests do not change; every
  existing browser test passes unmodified.
- If the implementation needs a schema change, a new Study family, a change to
  the twelve Studies' goals, a Free Game change, or a dependency, stop and
  record a proposal in the implementation notes instead of expanding scope.

## Acceptance criteria

- The twelve Studies exist as authored data with the goals and answers in the
  table; the validator proves each as declared, and a deliberately broken
  fixture fails the build in a test.
- `evaluateStudy` is typed over `ConceptStructureLookup`; a test evaluates the
  same session with the full lookup and with a lookup built from facets and
  faculties only and gets byte-identical status.
- Marks and statements come only from structure; a test evaluates the same
  threads with every outcome documented and with every outcome unresolved and
  gets byte-identical status.
- A Study session starts without the draw with the authored beads in authored
  order, the seed and session id stated above, and no new event type or
  payload; decoding and replaying its log reproduces the same status.
- Solving a passage, a canon and a carry Study, declaring silence on a silence
  Study, and declaring silence on a solvable Study each produce the specified
  status, cue and caption in unit tests.
- In the browser, by keyboard: eschholz-1 is solved and the plate shows both
  lines and the marks; eschholz-4 is solved by declaring silence; declaring
  silence on eschholz-1 yields *not yet* and no plate; restart starts a fresh
  session with the same seed.
- The Studies door, the list, the pinned brief, the silence control in both
  places, the solved plate's three ways on, and the absence of Conclude, Lens
  and Attunement in Study mode are all present and covered by render or
  browser tests; the focus view's cards and thread card behave in a Study
  exactly as in the Free Game.
- A scan of Study surfaces and captions finds no count, total, percentage or
  the words *score*, *points*, *rank* or *wrong*.
- Existing browser tests pass unmodified; a diff scan shows no change to the
  event schema, reducer, replay, outcome resolution, motif detection,
  portrait, annotation, conclusion, persistence, audio grammar or threshold
  copy.
- Every required check passes; the performance reference is recorded in the
  report with the comparison to the previous reference.

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

Focused scans, recorded in the report: an import scan proving
`src/domain/studies/**` depends on nothing outside the domain; a type scan
proving no production caller passes a `RelationLookup` to the evaluator; a copy
scan over Study surfaces and captions for counts, totals, percentages and the
forbidden words; and a diff scan proving the inspection-only files listed under
Owned scope are unchanged. If any required check cannot run, report the exact
reason and do not mark the task complete.

## Expected completion report

- the content schema, the twelve Studies and the solver's proof for each;
- the evaluator contract, the R1 and R2 tests, and the replay test;
- the Study session start, progression, cues and captions;
- the presentation surfaces and their accessibility mirror;
- every check result, the focused scans, and the performance reference beside
  the previous one;
- confirmation that the Free Game, the event schema and persistence did not
  change;
- proposals discovered during implementation, and the human-review items.

## Human review boundary

### Declared categories

- `product-specification`
- `content-authoring`
- `accessibility-interaction`
- `audiovisual-quality`

Human review is required before merge because this introduces a mode. The
director must judge, by playing all twelve Studies: whether a Study feels like
a problem worth solving rather than a form to fill; whether the briefs read in
the Game's voice; whether the bead sets are fair and the silence Studies are
not guessable from their wording; whether the new controls are legible by
mouse, touch and keyboard; whether the solved moment and the facet text are
comfortable and read as the world rather than as chrome; and whether the Free
Game is unchanged. Automated checks prove determinism, the honesty rules and
the absence of counters; they cannot establish that Studies are fun. That
judgement is the milestone gate.

## Implementation notes

- Accepted and merged in PR #62 on 2026-09-30. The exact `main` merge commit
  `ee9402b` passed Quality Gates run `36729346643` and Pages deployment run
  `36730339337`.

- Directly assigned by the game design director on 2026-09-30 after ADR-015,
  with the packet, the specification and the roadmap entry reviewed in one
  pull request. Not selected by the autonomous loop: while M2-011 remains in
  Review without a steering ownership projection, no packet can validate as
  Ready.
- Blocked behind M2-012 on the same day: the director's focus-view redesign
  (I-015 through I-020) delivers the facet notation and the pair-first
  preview in both modes, so the Study-mode facet display and the scene paths
  it needed left this packet. The branch `codex/M9-001-studies-spike` is
  created when M2-012 is Done and this packet returns to In progress.

- Built early and stacked, 2026-09-30. The director asked for the work to go
  as far as it could be seen clearly, so the branch was created on
  M2-012's pull-request head instead of after M2-012 is Done, and its pull
  request is a draft based on `codex/M2-012-focus-view`. It cannot merge
  before its base, and this packet stays Blocked until M2-012 is Done; the
  branch is rebased onto the base when it moves. M2-012 merged in PR #61
  (`537b7bd`) on 2026-09-30, a merge commit whose history holds the stacked
  base, so the pull request (#62) was retargeted to `main` without a rebase
  and this packet moved to Review.
- Stage 1, content and domain. The twelve Studies carry the goals and
  answers of the table, and every claim in the table holds over the whole
  pack (a test checks each one). The bead sets were searched for under §9
  with fairness constraints — every bead shares a facet with at least two
  others, and each set holds near misses; all twenty-four beads are used,
  and no two sets share more than four. The solver, the validator and
  `evaluateStudy` are in `src/domain/studies/**`, which imports nothing
  outside the domain (an import scan test). The evaluator is typed over
  `ConceptStructureLookup`, which has no facet names, so `explanation` and the
  *not yet* statement are closed structured unions rendered by pure functions
  (`describeStudyStatus`, `describeStudyLine`, `renderStudyBrief`): a shape
  the packet permits ("names may vary if the contract stays equally closed
  and explicit"). Definitions chosen: Economical is the session's thread count
  equal to the brief's; consecutive threads are threads that meet at a bead,
  so a canon is never Varied; a one-thread answer is neither Varied nor Wide.
  Two validator codes were added beyond the packet's list: a malformed goal,
  and a Magister's line not written bead to bead.
- The first load. With the Studies in the pack object the first load measured
  524,251 bytes gzip against the 524,000 ceiling: the runtime reads the pack
  from the first frame. The Studies left the pack object and are built on
  first use (`castaliaStudies()`), the validator proves the authored twelve by
  default so the build gate still refuses an invalid Study, and the threshold
  page loads after the title as the arena's page does. With every stage in,
  the first load is 523,137 bytes gzip and 1,744,582 raw, and no chunk in it
  carries a Study.
- Stage 2, runtime. A Study session is built without the draw (seed
  `study:<id>`, session id `session:castalia.v1:study:<id>`, the Study's beads
  in authored order) and replays to the same status. The Study progression
  follows commits through a small follower registry in
  `productionInterpretation.ts` (`followCommits`), after the session
  progression and in the same turn, registered only while a Study is
  attached: a store subscriber would run before the outcome is staged. It
  stages `study.solved` after the commit's own moment (the `thread.woven`
  plan's duration) and after a motif that commit completed
  (`MOTIF_MOMENT_SECONDS`), and the plate opens on its ui delivery. A declared
  silence that solved a Study stands for the rest of that session. Leaving
  discards the session; a Free Game can never inherit a Study (R4); the
  Attunement invitation is not surfaced in Study mode.
- Cues: `study.solved` {studyId, by, threadIds, conceptIds, marks, brief} on
  scene, audio, ui and caption — `conceptIds` and `brief` added so the
  directors and the caption layer need no Study access — and a caption-only
  `study.not-yet`. Captions: "Solved: <brief>.", "Solved: <brief> — it cannot
  be done with these beads.", "Not yet — it can be done with these beads."
  The scene answers with the outcome's flare and a burst at the answer's
  beads; the audio reuses the motif ensemble over them; a silence is not
  voiced. Nothing depends on documented, open or unresolved outcomes.
- Stage 3, presentation. The title's *Studies* door is held shut with *Begin*
  until the world is ready; the list shows three chapters, each Study's brief
  and *Begin*, and nothing counted. In a Study the brief is the first note in
  the column and can be set aside and reopened; *It cannot be done* is under
  it and in the DOM mirror; *not yet* is a margin line and a polite caption,
  said again when given again; the plate shows the player's line, the
  Magister's line, the counts, the marks and three ways on (*Next Study* only
  when one follows). Study mode shows no Conclude, Lens or Attunement, and a
  leaving Study keeps its own chrome through the fade instead of flashing the
  Free Game's.
- The room. The ambient lifecycle knew the title and the threshold as empty
  rooms, not the Studies list, and Again and Next Study go from arena to
  arena: the last attempt's bed and choir kept singing. `roomIsEmpty` and
  `choirMustReset` (`src/audio/roomLifecycle.ts`) decide it now.
- Declared-path correction, the same protocol as M2-012's: the commit
  follower (`productionInterpretation.ts`), the scene and audio directors
  that answer `study.solved`, the audio room lifecycle (`useAudio.ts`,
  `roomLifecycle.ts`), the column, the screen-reader table and the new
  presentation modules under `src/ui/arena/`, and the render tests beside the
  new screens (boundary `audio-room-lifecycle`). The event schema, reducer,
  replay, outcome resolution, motif detection, portrait, annotation,
  conclusion, persistence, audio grammar, threshold copy and every existing
  browser test are unchanged (diff scan against M2-012's head).
- Checks on the stacked head, in the cloud container: `npm ci` resolved the
  unchanged lockfile (dry run); `steering:test` and `steering:check` passed;
  typecheck and lint passed (the container's agent worktrees excluded);
  `npm test` 1,989 passed; `validate:content` passed; build passed;
  `bundle:check` passed (above); `test:browser` 16 of 16 passed, three of
  them the Study paths by keyboard; `git diff --check` clean. Focused scans:
  the import scan (`src/domain/studies/imports.test.ts`), the type scan
  (`src/runtime/studies/publicInformation.test.ts`: no `RelationLookup`
  reaches the evaluator), the first-load scan
  (`src/runtime/studies/firstLoad.test.ts`), the copy scans over the list,
  the plate, the brief, the margin line and the captions (render and caption
  tests, and the browser smoke over the list and the marks), and the diff
  scan above.
- Performance reference (SwiftShader, same container, effective frames per
  second; evidence only per M0-005): mobile-potato idle 4.95 and 5.51, focus
  3.17 and 3.76, against M2-012's 6.49 and 6.11 idle and 3.64 and 3.95 focus
  measured earlier the same day; the Studies run no code in a Free Game, and
  the spread is the container's. Both desktop profiles miss the spec's frame
  floor here, as main's do.
- Proposals, not implemented: a stated per-session `attempt` in the Study
  store for the column's key (today it keys on the projection's identity);
  a way to set the plate aside without leaving (none is specified). Seen in
  passing: the Free Game's `attention.enter` caption carries numerals ("3
  beads answer…"); it is not a Study surface and predates this task.
- Human review: whether a Study feels like a problem worth solving; the
  fairness of the twelve bead sets and whether a silence Study can be
  guessed from its set; the briefs in the Game's voice and the new copy (the
  list's lead line, "Your answer", "The Magister's answer", "The form of your
  answer"); the solved moment's flare and ensemble; the controls by mouse,
  touch and keyboard; and that the Free Game is unchanged.
- The director's first play, 2026-09-30, answered in a follow-up pull
  request on the same day. Two findings. *Keep weaving*: a solved Study
  offered only Again, Next Study and Back, and the director wanted to linger
  on the solved set and go on weaving. Specification amendment, a product
  decision by the director (`STUDIES-SPEC.md` §7): the plate offers a fourth
  way on, *Keep weaving*, which sets the plate aside and leaves the solved
  session as it stands, and Escape is that way; the brief's note in the
  column then says *Solved.* and offers *See the answer*, which reopens the
  plate. The status stays solved and nothing is counted; the proposal above
  for a way to set the plate aside is closed by it. *Back to the Studies*
  left a black page: two faults on the leaving path, where the domain session
  is cleared while the arena fades. The screen-reader table's bead-id selector
  returned a fresh empty list once the session was gone, which the store
  subscription read as a new value on every render until React gave up and
  unmounted the root (`selectBeadIds.ts`: one frozen list, with a test); and
  the focus fog's cleanup called `dispose` on a slot whose dispose the scene
  graph had voided (its pass is disposed instead). A third fault surfaced by
  the browser watch that now guards these paths: three's `compileAsync`
  throws from its own timer when a material it waits on is disposed, and the
  title's warm-up recompiles on every theme change, the theme is the
  session's, and a compile of the whole scene collected the live beads'
  materials, which leaving disposes. The warm-up now compiles only its own
  group, under the scene's lights and fog, and waits with a poll that lets a
  disposed material go (`scene/prewarmLinks.ts`, with tests). The passage,
  silence and door browser tests walk Keep weaving, See the answer, Next
  Study and Leave/Back under a page-error watch that must stay empty.
