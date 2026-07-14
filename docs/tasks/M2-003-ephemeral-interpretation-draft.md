# M2-003 — Implement the ephemeral interpretation draft state machine

## Status

Ready

## Milestone

M2 — New interaction loop

## Dependencies

- M2-002 must be Done.
- Director decisions I-001 through I-006 and I-010 through I-012 must be accepted through reviewed merge.

## Objective

Add a pure, deterministic, deeply immutable application-runtime state machine for the provisional sequence:

`inactive → attending → armed intention → selected candidate`

The draft represents the accepted “arm intention, then select another bead” flow before expressive weaving. It is explicitly ephemeral: it appends no domain event, mutates no canonical session, and owns no presentation. A future production adapter may drive it only after a canonical Attend succeeds and may later compile an accepted draft plus gesture into one atomic ordered commit batch.

This task resolves the current ordering/cancellation seam without changing schema-version-1 event or reducer semantics. It does not integrate input, camera, scene, audio, React, Zustand, resonance evidence, weaving, persistence, or commit behavior.

## Why this is next

M2-001 established canonical Attend, and M2-002 established relation-neutral candidate bands. The accepted interaction order now arms Echo, Passage, Tension, or Ground beside the attended bead before a candidate is activated. The accepted cancel hierarchy also requires every pre-commit step to restore its prior state without durable mutation.

The current event vocabulary contains `pair.selected` and `relation.hypothesized`, but publishing those events during provisional aiming would make cancellation durable or require a compensating reset event. The compatible incremental path is:

1. keep the live pre-weave draft ephemeral;
2. discard or step it backward on Cancel/re-Attend;
3. leave canonical pair/hypothesis state unchanged during aiming;
4. let a later reviewed commit command append `pair.selected`, `relation.hypothesized`, and `thread.committed` atomically.

## Implementation plan

1. Reconfirm accepted attention, arming, candidate-selection, cancellation, and durable-event boundaries.
2. Define a closed discriminated draft-state vocabulary plus typed stable failures under an isolated runtime module.
3. Implement pure Attend, arm, select-candidate, and Cancel transitions over branded concept IDs and accepted relation intentions.
4. Add focused tests for every state/transition, replacement, cancellation, invalid identity/order, immutability, determinism, and absence of durable effects.
5. Run the full repository suite and inspect the diff for event emission, duplicate durable state, presentation coupling, or accidental weave/commit work.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially the core loop and product pillars;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 6–9, 19, 22, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially `src/state/` and `src/scene/` migration risks;
- `docs/DECISIONS.md`, especially ADR-003, ADR-008, and ADR-011;
- `docs/ROADMAP.md`, especially M2 and unsafe parallelism;
- `docs/PLAYTEST-PLAN.md`, especially the M2 hypotheses and observation questions;
- `docs/INTERACTION-DECISIONS.md`, especially accepted I-001 through I-006 and I-010 through I-012;
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, especially CAV-002 through CAV-004 and the directional-metaphor boundary;
- `docs/tasks/M2-001-attention-command-boundary.md`;
- `docs/tasks/M2-002-candidate-resonance-model.md`.

## Existing code and callers to inspect

- `src/domain/ids.ts` and `src/domain/events/**`, especially `ConceptPair`, `RelationIntention`, and current event ordering;
- `src/domain/model/**` and `src/domain/reducer/**`, especially selected-pair/hypothesis transitions and thread-commit clearing;
- `src/runtime/commands/attention/**`, as the accepted preceding canonical action only;
- `src/domain/relations/resonance/**`, as candidate context only;
- `src/state/types.ts`, `src/state/store.ts`, and `src/state/domainSession/**`;
- `src/scene/threading.ts`, `src/scene/CameraRig.tsx`, `src/scene/frameState.ts`, and current interaction modes;
- deterministic browser and performance-reference tests.

## Owned scope

- new pure draft-state production files and focused unit tests under `src/runtime/interactionDraft/**`;
- this task's status and implementation notes.

All domain identifiers, events, model, reducer, replay, commands, resonance model, session adapter, legacy state, production composition, persistence, input, React, scene, camera, audio, UI, content, browser tests, dependencies, and deployment code are inspection-only. No other active task may introduce a competing pre-weave draft owner while M2-003 is active.

## Required draft contract

Provide a dependency-free boundary equivalent to:

```ts
type InterpretationDraft =
  | Readonly<{ stage: "inactive" }>
  | Readonly<{ stage: "attending"; attendedConceptId: ConceptId }>
  | Readonly<{
      stage: "armed";
      attendedConceptId: ConceptId;
      intention: RelationIntention;
    }>
  | Readonly<{
      stage: "candidate-selected";
      attendedConceptId: ConceptId;
      candidateConceptId: ConceptId;
      intention: RelationIntention;
      pair: ConceptPair;
    }>;

createInterpretationDraft(): InterpretationDraft;
attendDraft(...): InterpretationDraft;
armDraftIntention(...): InterpretationDraft;
selectDraftCandidate(...): InterpretationDraft;
cancelDraft(...): InterpretationDraft;
```

Names may vary if the public contract remains equally closed and explicit. Add a typed error with stable closed codes for invalid session concepts, unknown/identical identities, unsupported intention, and invalid transition order. Do not accept legacy state, display copy, camera state, resonance evidence, gesture data, or event-log adapters.

## Required transition semantics

1. `createInterpretationDraft()` returns the frozen `inactive` singleton/value.
2. Attend requires a unique session concept set containing the attended concept and returns `attending`.
3. Attend from any active stage replaces the draft with `attending` for the new concept; armed intention and candidate are discarded.
4. Arming is valid only from `attending` or `armed`. It returns `armed`; choosing another accepted intention replaces the previous intention without selecting a candidate.
5. Candidate selection is valid only from `armed`. The candidate must be a different member of the same supplied session concept set. It returns `candidate-selected` with pair order `[attendedConceptId, candidateConceptId]`.
6. Candidate selection does not sort IDs, evaluate resonance, determine correctness, inspect documented relations, or publish pair/hypothesis events.
7. Cancel transitions exactly:
   - `candidate-selected → armed`, preserving attended concept and intention;
   - `armed → attending`, preserving only attended concept;
   - `attending → inactive`;
   - `inactive → inactive`, returning the same inactive reference.
8. Re-arming from `candidate-selected` is rejected because re-arming after pair selection remains part of pending I-008.
9. Inputs are not mutated. Every returned object and pair tuple is frozen; identical values produce deeply equal, byte-stable JSON.

## Durable-state boundary

- The state machine imports only accepted domain identity/intention/pair types or constants; it imports no event constructor, reducer, replay, store, or command.
- No transition appends, constructs, queues, or returns a domain event.
- Canonical `SessionStateV1.selectedPair` and `hypothesis` remain unchanged during the draft.
- A later task must define the one atomic commit command that maps an accepted final draft plus gesture to existing ordered events.
- I-002 presentation-attention clearing and I-004 re-Attend discard the draft without attempting to set canonical attention to `null` or rewrite prior events.

## Out of scope

- any event-schema, reducer, replay, canonical model, command, adapter, or persistence change;
- production integration with Attend or resonance;
- evidence assembly, candidate ranking/filtering, frustum/aim selection, spatial navigation, or hidden endpoint logic;
- intention icons, accessible radiogroup, labels, copy, camera paths, cue planning, animation, sound, haptics, or reduced-motion presentation;
- pointer, touch, keyboard, controller, background activation, focus, inspection, or mobile ergonomics;
- expressive weaving, gesture profile, atomic commit, documented/Open outcomes, motifs, Attunement, or conclusion;
- dependencies, performance budgets, browser behavior, or deployment.

## Constraints

- TypeScript strict mode; explicit public types; no `any`.
- Pure, synchronous, deterministic, deeply immutable, and side-effect free.
- Use branded `ConceptId` and accepted `RelationIntention` values.
- Do not use time, randomness, browser APIs, storage, network, framework state, or mutable module registries.
- Do not duplicate candidate-resonance, reducer, event-construction, content, input, camera, or presentation rules.
- Fail closed with typed errors; do not coerce, trim, repair, sort, or default invalid values.
- If implementation requires deciding I-007, I-008, I-009, I-013, changing durable semantics, or integrating production behavior, stop and record a proposal.

## Acceptance criteria

- Closed inactive/attending/armed/candidate-selected draft types and pure transition functions exist under the owned runtime path.
- Attend, intention replacement, candidate selection, re-Attend replacement, and the accepted Cancel hierarchy behave exactly as specified.
- Candidate pair order preserves attended → candidate identity and all outputs are deeply frozen and deterministic.
- Invalid sessions, identities, intentions, and transition orders fail with stable typed codes without input mutation.
- Tests prove no function returns an event/log/store field and no accepted domain/session state is mutated.
- No production caller, event/model/reducer/replay/command/adapter, current game/state/persistence/input/presentation/content/browser/dependency/deployment path changes.
- Typecheck, lint, unit tests, content validation, production build, bundle check, deterministic browser smoke, and focused inspections pass.

## Required checks

1. `npm ci`;
2. `npm run typecheck`;
3. `npm run lint`;
4. `npm test`;
5. `npm run validate:content`;
6. `npm run build`;
7. `npm run bundle:check`;
8. `npm run test:browser`;
9. `git diff --check`;
10. focused import scan proving `src/runtime/interactionDraft/**` has no event-construction, reducer, replay, command, store, content, scene, audio, UI, framework, browser, network, or storage dependency;
11. focused caller scan proving no production module outside the owned path imports or instantiates the draft state machine;
12. focused durable-boundary scan proving no draft result exposes event/log/store/time/presentation fields;
13. focused ownership scan proving candidate resonance, session membership, event sequencing, and presentation behavior are not reimplemented outside the stated draft validation/transition scope.

The targeted performance reference is not required because the state machine remains unintegrated and no active runtime path changes. If a required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- draft states, transition functions, and typed error contract;
- exact Attend/arm/select/Cancel mapping;
- deterministic, immutability, invalid-input, and durable-boundary tests;
- full check and focused-scan results;
- confirmation that no production, durable, content, input, camera, audiovisual, persistence, or later-M2 path changed;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this state machine fixes the interaction order and cancellation semantics that later accessible input and audiovisual presentation will consume. Automated checks prove isolation and determinism but cannot establish whether the armed-intention flow feels legible, contemplative, or comfortable.

## Implementation notes

- None yet.
