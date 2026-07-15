# M2-011 — Cut over the production interpretation loop

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M1-001 through M1-006 and M2-001 through M2-010 must be Done.
- Director decisions CAV-001 through CAV-004, I-001 through I-014, and P-001
  through P-005 must remain accepted.
- The canonical schema-version-1 event order, reducer/replay rules, one domain
  adapter, one reactive interpretation draft, provisional evidence policy,
  deterministic thread identity, and accepted attention/commit coordinators
  must remain the only owners of their respective rules.

## Objective

Replace the active arena's hidden-pair weaving mutation path with one complete
production interpretation path:

```text
Focus → Attend → arm intention → draw toward candidate → latch → release to Commit
```

The production path must compose the accepted canonical domain store,
interpretation-draft store, provisional evidence resolver, attention
coordinator, gesture builder/commit coordinator, and deterministic thread-ID
allocator. Mouse, touch/pen, and keyboard must express the same decisions,
cancellation hierarchy, and canonical result through one input-action boundary.

This is the first active M2 cutover. It owns the minimum placeholder scene and
accessible DOM presentation needed to make every stage legible, and it removes
the corresponding legacy hidden-answer commit path from core arena input. It
does not add documented/Open Thread outcomes, final camera or audio grammar,
persistence, motifs, scoring, or polished onboarding.

## Why this is next

M2-001 through M2-010 deliberately built and reviewed every durable and
headless prerequisite without a production caller. Continuing with another
inert composition packet would violate the accepted M2-007/M2-008 boundary:
production composition, active input arbitration, provisional evidence, stable
thread allocation, and placeholder presentation ownership must be reviewed as
one cutover so the shipped arena never has two active interpretation paths.

The present `src/scene/threading.ts` path still couples pointer gestures to
legacy unordered pair keys, hidden curated endpoints, score/discovery mutation,
and modal outcome presentation. The canonical domain log currently records
only session start in production. This task routes one real interaction end to
end through the accepted M2 owners, makes canonical committed threads the sole
core-play thread source, and proves the M2 gate in the browser before M3 assigns
intellectually honest outcomes.

## Implementation plan

1. Characterize production session start, the legacy pointer state machine,
   scene/HUD thread consumers, inspection, camera arbitration, test mode, and
   every current caller of the accepted M2 boundaries.
2. Add one production interpretation composition with one reactive draft
   instance, one presentation-only owner for exact resonance/status values, and
   actions that delegate to the accepted coordinators and draft transitions.
3. Replace active bead/gesture routing with stage-aware mouse, touch/pen, and
   keyboard adapters; derive the stable thread ID from the exact current
   canonical session immediately before synchronous Commit.
4. Add minimum world-anchored and accessible DOM controls, non-color-only
   resonance/draft/thread placeholders, full cancellation, and explicit
   inspection without adding final audiovisual meaning.
5. Remove the active legacy pair-key/hidden-answer commit route, project core
   committed threads only from canonical reduced state, and update deterministic
   browser coverage to complete and replay-reload the new loop.
6. Run all repository, browser, bundle, and performance checks; conduct a
   focused dual-source/input/accessibility self-review; stop for human device,
   comfort, and interaction review.

## Required reading

- `AGENTS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M1-004-zustand-domain-session-adapter.md`
- `docs/tasks/M1-005-migrate-session-start.md`
- `docs/tasks/M1-006-remove-legacy-session-start.md`
- `docs/tasks/M2-001-attention-command-boundary.md`
- `docs/tasks/M2-002-candidate-resonance-model.md`
- `docs/tasks/M2-003-ephemeral-interpretation-draft.md`
- `docs/tasks/M2-004-atomic-interpretation-commit.md`
- `docs/tasks/M2-005-deterministic-gesture-profile.md`
- `docs/tasks/M2-006-reactive-interpretation-draft-adapter.md`
- `docs/tasks/M2-007-interpretive-attention-coordinator.md`
- `docs/tasks/M2-008-interpretation-commit-coordinator.md`
- `docs/tasks/M2-009-provisional-resonance-evidence.md`
- `docs/tasks/M2-010-deterministic-thread-identity.md`
- `docs/MASTER-PLAN.md`, especially the core loop and product laws
- `docs/ARCHITECTURE.md`, especially commands, Zustand, presentation, testing,
  and incremental migration
- `docs/CURRENT-STATE-AUDIT.md`, especially dual-source, legacy-input, hidden
  endpoint, and HUD risks
- `docs/ROADMAP.md`, especially the M2 goal/gate and unsafe parallelism
- `docs/VERTICAL-SLICE-SPEC.md`, especially attention through weaving,
  interface, accessibility, and the golden path
- `docs/INTERACTION-DECISIONS.md`, including all accepted I-001 through I-014
- `docs/PLAYTEST-PLAN.md`, especially the M2 hypotheses and P-001 through P-005
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, especially CAV-001 through CAV-004

## Existing code and callers to inspect

- `src/runtime/session/**` and every production session-start caller;
- `src/runtime/interpretation/**`, `src/runtime/interactionDraft/**`, and
  `src/runtime/gestureProfile/**`;
- `src/state/domainSession/**`, `src/state/interactionDraft/**`,
  `src/state/store.ts`, and `src/state/types.ts`;
- `src/scene/threading.ts`, `src/scene/ThreadingDriver.tsx`,
  `src/scene/Beads.tsx`, `src/scene/Threads.tsx`,
  `src/scene/ThreadPreview.tsx`, `src/scene/frameState.ts`,
  `src/scene/Cosmos.tsx`, `src/scene/CameraRig.tsx`, and camera/control event
  arbitration;
- `src/ui/arena/ArenaHud.tsx`, `src/ui/arena/BeadInspectCard.tsx`, and the
  minimum shared controls used by the arena;
- `src/runtime/testMode.ts`, `src/vite-env.d.ts`, and all browser tests;
- current imports/callers of pair keys, `resolveAttempt`, `addThread`,
  `addDiscovery`, legacy interaction mutation, the canonical domain store,
  the draft factory, all M2 coordinators, provisional evidence, and thread-ID
  derivation.

Inspect audio, camera, effects, content, discovery, motifs, conclusion, Codex,
Lens, persistence, and deployment only to prevent accidental activation or
regression. They do not gain new rules in this task.

## Owned scope

This task may modify only the minimum files required within:

- `src/runtime/interpretation/**` for production composition/actions;
- `src/state/interactionDraft/**` for one production store instance/export;
- a narrowly named new presentation-only state adapter under `src/state/**`;
- `src/platform/input/**` or the existing `src/scene/threading.ts` boundary for
  browser-event normalization and arbitration, but not both as competing paths;
- the listed arena scene files for bead activation, previews, and canonical
  placeholder threads, plus the minimum attended lower-corner camera posture
  and safe cancel/return behavior;
- the listed arena UI files plus narrowly named new arena controls for
  intentions, Weave/Commit, Cancel, inspection, live status, and keyboard
  equivalence;
- `src/runtime/session/**` only for successful new-session draft/presentation
  reset and focused tests;
- `src/runtime/testMode.ts`, `src/vite-env.d.ts`, and `tests/browser/**` only for
  the real M2 browser gate and canonical replay-reload evidence;
- `src/state/store.ts` and `src/state/types.ts` only where required to remove or
  stop active legacy interaction/thread mutation ownership;
- this task file for status and implementation notes.

The domain event schema, IDs, model, reducer, replay codec, accepted command,
resonance, gesture, draft, coordinator, evidence, and thread-identity rules are
inspection-only and must be composed rather than modified. Content claims and
sources, documented/Open/weak outcomes, score/progression rules, motif rules,
final scene/camera/audio/haptic grammar, persistence, dependencies, CI,
deployment, and PWA files are out of owned scope. If an accepted headless
boundary cannot support the cutover as written, stop and record a specification
proposal rather than editing that owner silently.

## Production ownership contract

### One active composition

- Create exactly one production interpretation-draft store for the application
  lifetime and expose it through a narrow typed module. Tests may continue to
  create isolated stores through the accepted factory.
- Compose the accepted attention coordinator with `domainSessionStore`, the
  one draft store, the accepted game-relative clock, and
  `resolveProvisionalCandidateEvidence` exactly once.
- Compose the accepted Commit coordinator with those same store and clock
  instances exactly once.
- Provide one narrow production action surface equivalent to Attend, arm,
  select candidate, cancel, inspect/clear presentation, begin/update/cancel
  weave capture, and Commit. React, R3F, and browser handlers call this surface;
  they do not reconstruct domain or draft rules.
- A successful new session resets the ephemeral draft, resonance/status, input
  capture, and inspection presentation. It does not append a reset event or
  rewrite the prior canonical log.

### Presentation-only state

- Candidate resonance returned by the accepted attention coordinator needs one
  reactive presentation owner. Store the exact frozen result/reference or a
  lossless presentation projection; do not recalculate bands or copy session,
  draft, pair, intention, thread, or event-log state into it.
- Draft stage, attended/candidate concepts, and intention are read from the one
  accepted draft store. Canonical threads and last durable attention are read
  from the one domain store.
- Transient focus, inspection, gesture samples, hover, camera drag, and
  placeholder cue/status may remain presentation/input state. None is persisted
  or treated as durable game meaning.
- No raw Zustand `setState`, React-owned duplicate draft, mutable thread
  counter, cached thread ID, legacy pair key, hidden-endpoint lookup, or fallback
  evidence source may enter the new production action path.

### Accepted action composition

- Attend invokes the accepted attention coordinator and publishes its complete
  ordered candidate resonance to the presentation owner only after success.
- Arming, candidate selection, and cancellation invoke the accepted draft-store
  actions with concept membership from the exact current canonical session.
- Commit reads the exact current canonical session immediately before the
  synchronous accepted Commit call, derives one M2-010 ID, and supplies the
  captured normalized gesture. It never reserves or persists an allocator.
- A successful Commit leaves the accepted coordinator's inactive draft and
  canonical three-event batch intact, clears provisional presentation/capture,
  and emits only a presentation placeholder consequence.
- Expected typed failures preserve the exact previous domain, draft,
  presentation, capture, and legacy state and surface a non-destructive,
  accessible explanation. Do not catch and fabricate success, retry with a
  fallback intention/gesture/ID, or mutate legacy state as compensation.

## Active input and arbitration contract

All routes must issue the same production actions. Device differences may
change physical phrasing, never the decision, information, cancellation, or
canonical consequence.

### Focus, Attend, and candidate activation

- Hover, roving keyboard focus, and controller-compatible focus remain
  ephemeral. They may emphasize a bead and expose its label but append no event.
- In an inactive or attending draft, explicit primary activation of a different
  session bead invokes Attend. Activating the already actively attended bead is
  an acknowledged no-op rather than duplicate event spam.
- In an armed draft, pointer/touch/pen activation begins one directional Weave
  from the attended bead. Drawing from the source is the expressive primary
  path; directly pressing a candidate is the no-dexterity equivalent. A
  candidate latches only within the bounded screen-space capture radius, and
  release selects that candidate immediately before the same atomic Commit.
  The attended bead cannot select itself. The semantic keyboard/screen-reader
  mirror may still invoke the accepted provisional candidate transition before
  its coordinate-free hold-and-confirm action.
- In a candidate-selected draft, activating a different bead is an explicit
  re-Attend: it announces the new primary, discards provisional state through
  M2-007, and records only the accepted Attend event. It never silently swaps
  the candidate or commits the prior pair. Activating either current endpoint
  is an acknowledged no-op until Weave or Cancel.
- Pointer/touch bead activation and an accessible, session-ordered DOM bead
  activation surface call the same stage-aware action. The DOM surface must not
  expose resonance numbers, hidden endpoint lists, or a conventional answer
  menu; it mirrors the visible arena and becomes legible on keyboard/screen-
  reader use.

### Intention and direct Weave

- Echo, Passage, Tension, and Ground appear as four world-anchored controls near
  the attended bead and as one accessible DOM radiogroup using the exact I-007
  names and first-use phrases.
- Each control has a stable label plus glyph/pattern. Color may reinforce but
  never carry relation identity alone. Arming/re-arming is explicit and changes
  the placeholder preview immediately.
- The four intention sigils are temporary bead-local controls with no enclosing
  tray. Tapping one or sliding from the attended bead into one settles that
  intention into the bead.
- Mouse/touch/pen press while armed begins one directional pointer capture with
  game-relative start time and canvas-relative normalized samples. Move adds
  finite strictly increasing samples, a non-color-only provisional trace follows
  the pointer, nearby candidates respond, and one candidate can visibly latch.
  Release on a latch selects and commits once with the actual `mouse`, `touch`,
  or `pen` modality. Release without a latch discards capture only and preserves
  the armed draft.
- Keyboard Enter/Space press begins a hold-and-confirm capture and release
  commits once with `keyboard` modality and no fabricated geometry. Repeated key
  events are ignored. A click-only assistive activation may produce an honest
  zero-duration coordinate-free profile; use `unknown` only when the browser
  does not expose a truthful source modality rather than guessing one.
- Pointer cancel, Escape during capture, loss of the active session, unmount,
  or focus loss discards capture only and returns to the same armed or
  candidate-selected draft with no event. Gesture capture is bounded and
  cleared on every terminal path.
- Empty-space drag remains camera control. Empty-space activation cancels only
  when distinguishable from a drag; touch has the same empty-arena step-back and
  a semantic Cancel action without a persistent visible HUD. No bead event may
  also reach camera/legacy handlers and double-act.

### Cancellation and inspection

- Cancel during direct capture keeps the armed draft; Cancel during the
  coordinate-free hold keeps the candidate-selected draft; candidate-selected
  Cancel returns to armed aiming; armed Cancel returns to Attend; Attend Cancel
  clears active presentation while canonical last-attended history remains.
- Re-Attend through an explicit new-primary action discards the provisional
  draft before the one accepted Attend event, exactly as M2-007 defines.
- Cancel never removes a committed thread or appends a provisional/reset event.
- Inspection remains independent of Attend and pair building. Touch long press
  and one explicit semantic Details action open/close inspection without
  advancing the draft or canonical log. Ordinary focus/hover never auto-opens a
  card over the direct interaction surface.

## Placeholder presentation contract

The task proves comprehension, not final art. Use existing scene/UI assets and
restrained placeholders; do not invent M4 semantic grammar.

- Focus: subtle bead and label emphasis.
- Attend: a non-color-only primary marker, reduced visual noise where already
  supported, complete high/medium/weak candidate differentiation, and an
  accessible status that calls the values resonance/possibility, never answers.
  A restrained camera transition places the attended bead in a stable lower-
  left or lower-right situated posture while preserving whole-arena legibility;
  cancellation/commit has an explicit comfortable return and reduced motion
  communicates the same posture without forced travel.
- Armed intention: the selected labeled glyph/pattern visibly settles into the
  attended bead/control and changes the provisional pattern immediately.
- Directional Weave: one provisional intention-colored patterned line follows
  the source-to-pointer sweep, and the nearest eligible bead gains an enlarged
  ring/scale latch response. The semantic candidate-selected route exposes both
  concept names and the armed intention accessibly. Coordinate-free holds receive
  an authored progress/status response without fake geometry. Reduced motion
  communicates the same decisions without forced travel.
- Commit: the provisional trace resolves into one canonical placeholder thread,
  one coordinated visual/status acknowledgment occurs, and the draft returns to
  inactive. Do not show a documented reveal, Open Thread, correctness, points,
  score, or generic pseudo-insight before M3.
- Canonical committed threads, endpoint standing/counts used by core play, and
  duplicate identity checks derive from `SessionStateV1.threads`. The active
  scene must not read legacy `session.threads` as a second committed web.
- Remove or suppress the legacy hidden-answer welcome, luminous-connection
  counter, Illuminate endpoint hint, score-first core HUD, direct discovery
  modal, and old weave hints from the active M2 arena. Preserve unrelated
  shell/navigation only when it does not assert stale progress or ownership.
- Final camera path/easing/cadence polish, intention-specific sound/material
  grammar, haptics, outcome intensity, and artistic pacing remain M4/human-
  review work. This task owns only the legible M2 situated posture and safe
  return needed by the accepted interaction. It must not use silence as a
  reason to fabricate meaning.

## Legacy cutover and compatibility

- Remove the active `resolveAttempt`/`pairKey`/`addThread`/`addDiscovery` route
  from arena input. No real or test interaction may commit a core thread through
  the legacy store after this task.
- Existing legacy session projection may continue to own layout, theme, and
  unmigrated shell features temporarily. It must not receive a mirrored
  canonical thread/discovery/score write.
- Do not translate canonical thread IDs back into unordered pair keys or create
  a fake legacy `curated`/`faint` outcome for presentation compatibility.
- Existing persisted Codex/archive/preferences are not migrated or deleted.
  This task neither promises refresh persistence nor changes localStorage/
  IndexedDB behavior.
- Test mode may expose a guarded canonical serialize/decode/load operation to
  prove replay reload in one browser session. It must use the accepted codec and
  domain adapter, remain absent in ordinary development, and not masquerade as
  production persistence.

## Browser gate

Add deterministic Playwright coverage that exercises the real active adapters,
not a direct legacy commit shortcut:

1. start `castalia-golden-001` and complete Fibonacci Sequence → Attend → Echo
   → Counterpoint → directional latch → release-to-Commit with real canvas
   mouse/pointer controls;
2. assert exactly `bead.attended`, `pair.selected`,
   `relation.hypothesized`, and `thread.committed` after `session.started`, the
   exact ordered pair/intention, deterministic M2-010 thread ID, honest mouse
   gesture fields, inactive draft, and one canonical placeholder thread;
3. serialize/decode/load that event log through the guarded test adapter and
   prove byte-equivalent reduced state and thread identity after reload;
4. cover a touch/pen-capable context through the same decisions and a touch
   gesture profile;
5. cover the complete keyboard path, including roving bead activation,
   radiogroup choice, hold-and-confirm with absent geometry, and visible focus;
6. prove each cancellation level changes no durable event count and permits
   recovery, and prove pointer cancel/Escape during capture does not Commit;
7. prove resonance is complete but exposes no strength number or hidden
   documented endpoint, and relation identity remains legible without color;
8. prove the legacy session receives no thread, discovery, score, reveal, or
   direct hidden-pair mutation from the new loop;
9. retain fixed-seed repeatability, ordinary-development test-adapter absence,
   reduced-motion behavior, and existing WebGL fallback coverage where present.

If reliable real touch or a required personal device cannot run in CI, retain a
deterministic browser-level touch-emulation test and report the physical-device
pass as a mandatory human review item rather than claiming it passed.

## Ownership rules

1. Domain events/reducer/replay remain the only durable meaning and validation.
2. M2-002/M2-009 remain the only candidate-band and provisional-evidence rules;
   presentation never derives or labels strength independently.
3. M2-003/M2-006 remain the only draft transition and reactive draft owners.
4. M2-007 remains the only canonical Attend/resonance/draft coordinator.
5. M2-005/M2-008 remain the only gesture profile and atomic Commit/reset owners.
6. M2-010 remains the only deterministic thread identity policy.
7. This task owns only production composition, browser-event mapping,
   presentation-only resonance/capture/status ownership, and removal of the
   corresponding active legacy route.
8. Scene, UI, and input handlers issue actions and render accepted state; they
   do not define session membership, candidate strength, draft transitions,
   gesture math, event order, collision policy, or intellectual outcomes.

## Out of scope

- changing event schemas, IDs, reducer/replay, command validation, resonance
  thresholds/evidence, draft transitions, gesture math, coordinators, or thread
  identity format;
- documented relation, source, evidence-class, Open Thread, weak/rejected
  outcome, motif, Attunement, conclusion, portrait, or Annotation rules;
- final intention-specific camera, audio, material, particle, haptic, cue-
  planner, or artistic-quality implementation;
- literal weapons, targets, lock-on correctness, damage, cooldowns, failure,
  scoring, timers, or dexterity gates;
- production persistence, reload/resume, IndexedDB, migrations, PWA/offline,
  legacy progress import, accounts, backend, or cross-device coordination;
- final onboarding/overture, final concept granularity/content migration, or
  source review;
- native Gamepad API integration. Keep the keyboard action boundary compatible
  with later controller mapping and preserve the accepted controller modality;
- dependency changes, CI, deployment, branch protection, or Pages behavior.

## Constraints

- TypeScript strict mode, explicit public types, no `any`, and no new production
  dependency.
- Preserve deterministic behavior under fixed seed and controlled game clock.
- Browser handlers normalize input and delegate once; no direct durable store
  mutation, copied rule, unbounded gesture buffer, or per-frame React state.
- Use pointer capture safely; release it and restore camera controls on success,
  cancellation, error, unmount, pointer loss, and session replacement.
- Keep per-frame presentation in refs/frame-local structures and bound all
  traces/materials/objects according to existing performance budgets.
- Keep the world primary while providing real DOM semantics, visible focus,
  touch-sized targets, labels/patterns, and non-audio equivalents.
- No active path may write both canonical and legacy committed thread state.

## Acceptance criteria

1. The live arena completes Attend → arm → directional candidate latch →
   release-to-Commit through the accepted canonical M2 owners with one
   production draft and no copied rule; keyboard/screen-reader operation retains
   the coordinate-free candidate/hold equivalent.
2. Mouse, touch/pen, and keyboard routes express the same decisions,
   cancellation hierarchy, and one atomic canonical result with honest modality
   and geometry availability.
3. Thread identity is derived from the exact current canonical session
   immediately before Commit and advances after replay without a mutable counter.
4. Candidate resonance is complete, deterministic, relation-neutral,
   non-numeric in normal presentation, and never reveals a hidden endpoint.
5. Every provisional stage and gesture capture has an immediate non-color-only,
   accessible placeholder consequence and a no-durable-mutation cancel path;
   attended framing preserves the whole arena and has a reduced-motion
   equivalent plus comfortable return.
6. Commit produces exactly one canonical three-event batch and one canonical
   placeholder thread; no legacy thread/discovery/score/reveal mutation occurs.
7. Canonical threads are the sole core-play committed-web source, while
   unmigrated layout/theme/shell state remains read-only with respect to the new
   interpretation.
8. New-session replacement, expected failures, pointer loss, Escape, focus
   loss, and unmount clear transient capture safely without duplicate actions,
   leaked controls, or fabricated success.
9. Deterministic browser tests complete mouse, touch-emulated, and keyboard
   paths and replay-reload the resulting canonical event log/state.
10. Existing session start, fixed-seed test mode, WebGL fallback, quality tiers,
    reduced motion, inspection, camera orbit, and unrelated shell navigation do
    not regress.
11. The active hidden-answer pair-key commit route and its test shortcut are
    removed; focused scans find no production caller that can bypass commands.
12. No domain schema, content claim, persistence behavior, dependency, CI, or
    deployment contract changes.

## Required tests and checks

- Clean dependency installation from the lockfile.
- Typecheck.
- Lint.
- Full unit suite plus focused tests for:
  - isolated factory tests and exactly one production composition;
  - stage-aware Attend/candidate routing and exact dependency call counts;
  - exact resonance publication/clearing without duplicated draft/domain state;
  - arm, candidate, cancellation, re-Attend, and new-session reset semantics;
  - thread-ID derivation immediately before synchronous Commit;
  - pointer/touch/pen sample normalization, direct candidate latching, missed
    release preservation, strict time ordering, capture bounds, and
    release/cancel/error cleanup;
  - keyboard hold/confirm and assistive click with no fabricated geometry;
  - expected failure atomicity across domain, draft, presentation, capture, and
    legacy state;
  - canonical committed-thread projection and absent legacy thread/discovery/
    score/reveal mutation;
  - input/prior-value non-mutation, deterministic clocks, and cleanup on
    unmount/session replacement.
- Content validation.
- Production build.
- Bundle report and accepted ceiling check.
- Existing deterministic browser smoke plus the complete M2 browser gate above.
- Targeted performance reference because this changes active input, React/R3F
  presentation, and committed-thread rendering; compare with the accepted M0
  reference and report renderer/profile limitations.
- `git diff --check`.
- Focused composition/caller scan proving each accepted M2 owner has one active
  production composition and no direct domain/draft rule is copied.
- Focused legacy scan proving active input/test code has no `resolveAttempt`,
  hidden `connectionByPair`, pair-key identity, `addThread`, `addDiscovery`,
  score, or reveal commit route.
- Focused dual-source scan proving core threads render from canonical reduced
  state only and canonical commits are never mirrored into legacy state.
- Focused input scan proving every pointer/key listener is installed/removed
  once, propagation/camera arbitration is explicit, gesture buffers are bounded,
  and every terminal path releases capture.
- Focused accessibility scan for DOM roles/names, radiogroup semantics, visible
  focus, touch targets, status/live text, non-color identity, reduced motion,
  inspection, and keyboard operation.
- Focused scope scan proving no domain, content, persistence, dependency, CI,
  deployment, PWA, or final audiovisual-rule file changed.

## Expected completion report

- exact production composition/action surfaces and changed files;
- active mouse, touch/pen, keyboard, cancellation, inspection, and camera-
  arbitration mapping;
- exact placeholder resonance/draft/gesture/commit presentation and accessibility
  semantics;
- canonical event sequence, deterministic thread identity, replay-reload, and
  legacy-removal evidence;
- tests added with final counts and every required check result;
- bundle/performance comparison and physical-device limitations;
- confirmation that no intellectual outcome, durable schema, persistence,
  dependency, deployment, or final audiovisual meaning changed;
- compatibility proposals, known placeholder limitations, and mandatory human
  review items.

## Human review boundary

Human review is required before merge. This task changes the live product's
primary interaction, pointer/camera arbitration, touch and keyboard behavior,
accessible controls, and placeholder audiovisual legibility. Automated tests
cannot approve whether attention feels contemplative, resonance avoids answer-
seeking, the directional metaphor avoids combat tone, the cancellation flow is
clear, touch targets and keyboard phrasing feel intentional, or motion is
comfortable.

Before acceptance, the director must personally exercise the P-005 desktop
mouse/keyboard, modern touch, headphones and muted/textual, reduced-motion, and
available low-tier GPU passes. Record an unavailable setup honestly. This review
accepts only the M2 placeholder loop; it does not accept final camera, audio,
content truth, persistence, M3 outcomes, or M4 artistic quality.

## Implementation notes

- Director playtest correction accepted and implemented on 2026-07-15: the
  persistent bead-list/intention/Weave tray is removed. Four bare intention
  controls now appear as a temporary world-anchored constellation at the
  attended bead; tap or slide-to-arm settles the selected sigil into that bead;
  a bounded source-to-target mouse/touch/pen sweep provides live aim and latch
  feedback before release-to-Commit. World-local Back and Details controls and
  a non-dominant semantic DOM preserve cancellation, inspection, keyboard, and
  assistive-technology access without restoring the overlay.
- Implemented on `codex/M2-011-production-interpretation-loop`: one production
  controller now composes the accepted Attend and Commit coordinators over the
  singleton draft adapter and a presentation-only resonance/capture/status
  store. World beads and accessible DOM controls share its stage-aware actions;
  gesture capture is capped at 128 strictly ordered samples; session
  replacement, cancellation, blur, pointer loss, and unmount clear transient
  state. Rejected Commits restore the held draft and prior status while a
  separate assertive live message explains the non-destructive failure.
- The active arena now presents Attend, the four named intentions, direct
  directional aiming/latching, staged Cancel, Details, complete non-numeric
  resonance, an attended camera posture, provisional patterned threads, and
  canonical committed placeholder threads. Empty-space misses keep an armed
  intention available, capture loss never commits, and camera focus returns
  home after Commit or full cancellation. Core thread rendering and endpoint
  standing read only `SessionStateV1.threads`; no canonical commit mirrors into
  legacy threads, discoveries, score, or reveal state.
- Removed the live and test `resolveAttempt`/hidden-pair/pair-key commit route.
  Browser coverage exercises the declared `castalia-golden-001` Mathematics +
  Music + Art draw and exact Fibonacci → Counterpoint interpretation through
  real mouse, touch-emulated, and keyboard paths. It also covers qualitative-
  only complete resonance, non-color intention identity, honest modality and
  geometry fields, input arbitration, every provisional cancellation level,
  pointer loss, exact five-event ordering and deterministic thread identity,
  canonical serialization byte stability and reload, fixed-seed repeatability,
  and ordinary-mode adapter absence.
- Verification: clean `npm ci` (0 vulnerabilities); typecheck and warning-free
  lint passed; 312 unit tests and 7 deterministic browser tests passed; content
  validation, production build, bundle ceiling, `git diff --check`, and focused
  ownership, legacy, and dual-source scans passed. The bundle remains within the
  accepted ceiling at 1,583,730 JavaScript raw bytes / 467,724 gzip bytes.
- Targeted performance completed only on software SwiftShader: desktop-base
  4.20 effective FPS (26 samples) and mobile-potato/reduced-motion 10.24
  effective FPS (67 samples). These results record the constrained runner and do not
  replace director review on physical desktop/touch devices and available
  low-tier GPU, headphones and muted/textual use, or motion comfort.
- No domain schema, intellectual outcome, content claim, persistence,
  dependency, CI, deployment, PWA, or final audiovisual grammar changed.
  M2 presentation remains deliberately placeholder-quality pending human
  review and later M3/M4 work.
- Selected on 2026-07-15 after PR #51 was reviewed and merged. Its exact
  `main` merge commit `8685612` passed Quality Gates run `29444480534`; all 16
  dependencies were Done, no PR remained open, and no active work owned the
  production interpretation, arena input, scene-thread, or placeholder-control
  boundaries.
- Implementation plan: compose one production draft/presentation/controller
  stack over the accepted M2 seams; replace the active legacy pair commit with
  stage-aware bead, intention, cancellation, inspection, and bounded gesture
  actions; render resonance, preview, camera posture, and committed threads from
  accepted draft/domain state; update the guarded test adapter and real mouse,
  touch-emulated, keyboard, cancellation, and replay-reload browser gates; then
  run all repository, bundle, performance, ownership, accessibility, and
  dual-source checks before human review.

- Ready packet proposed on 2026-07-15 after M2-010 was reviewed and merged in
  PR #50. Its exact `main` merge commit `68d3c25` passed Quality Gates run
  `29443245356` and Pages deployment run `29443359078`; no PR remained open and
  no active work owned production interpretation composition, arena input
  arbitration, or its placeholder presentation.
- Packet plan: compose all accepted M2 owners once, route mouse/touch/keyboard
  through one stage-aware production action boundary, derive the thread ID at
  Commit, render canonical placeholder state, remove the active hidden-pair
  mutation route, and prove canonical replay reload in the browser. The packet
  deliberately keeps final outcomes, persistence, camera/audio grammar, and
  artistic acceptance in their later milestones.
