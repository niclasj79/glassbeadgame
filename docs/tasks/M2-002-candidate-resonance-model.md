# M2-002 — Implement the pure candidate resonance model

## Status

Done

## Milestone

M2 — New interaction loop

## Dependencies

- M2-001 must be Done.
- Director decisions CAV-001 through CAV-004 must be accepted through reviewed merge.

## Objective

Add a deterministic, presentation-independent domain evaluator that assigns every non-attended concept in the current session one relation-neutral resonance band: `weak`, `medium`, or `high`.

The evaluator consumes explicit prevalidated evidence strengths rather than importing current legacy content or hidden connection tables. It returns only candidate identity and qualitative band, in canonical session order, so later presentation can make possibility perceptible without exposing a correct endpoint, authored tier, source, relation type, numeric score, or hidden ranking.

This task establishes the pure model and calibration only. It does not integrate the Attend command with production input, construct evidence from the current content pack, select or aim at candidates, implement a frustum sweep, present audiovisual signals, add accessibility copy, or change durable session state.

## Why this is next

M2-001 established a reviewed Input → Command → Event → Reducer seam for canonical attention. The next independent rule is the relation-neutral candidate model required immediately after attention. Defining it before scene/input integration keeps hidden-answer logic out of presentation code and makes the non-spoiler contract objectively testable.

The legacy prototype currently plants curated pairs, exposes `curatedAvailable`, uses `connectionByPair`, authored tiers, and keyword prose, and emits sympathy only for undiscovered curated endpoints. Those surfaces are inspection evidence, not accepted inputs. They must not become the new resonance rule or leak into this evaluator.

## Implementation plan

1. Reconfirm the accepted resonance rules, CAV-001 through CAV-004, the directional-metaphor guardrails, current canonical session model, and legacy hidden-pair paths.
2. Define closed resonance-band/support vocabularies, explicit request/evidence/result types, and stable typed input failures under a domain-only module.
3. Validate complete candidate coverage and calculate bands from the reviewed provisional calibration without exposing scores or evidence details.
4. Add focused tests for thresholds, documented/open possibilities, complete coverage, canonical ordering, determinism, immutability, invalid input, and non-spoiler output shape.
5. Run the full repository suite and inspect the diff for content coupling, hidden endpoint leakage, presentation/input integration, duplicated topology/content rules, nondeterminism, or accidental later-M2 work.

## Required reading

- `AGENTS.md`;
- `docs/MASTER-PLAN.md`, especially Perception, Interpretation, and the core loop;
- `docs/VERTICAL-SLICE-SPEC.md`, especially sections 5–8, 19, 22, and 23;
- `docs/ARCHITECTURE.md`, especially sections 2–7, 12, 15, and 18;
- `docs/CURRENT-STATE-AUDIT.md`, especially the hidden-pair outcome and `src/content/`, `src/game/`, `src/state/`, and `src/scene/` migration risks;
- `docs/DECISIONS.md`, especially ADR-006, ADR-007, ADR-008, and ADR-011;
- `docs/ROADMAP.md`, especially M2 and unsafe parallelism;
- `docs/PLAYTEST-PLAN.md`, especially M2-02 and the resonance observation questions;
- `docs/INTERACTION-DECISIONS.md`, especially the attended-viewpoint/directional-sweep metaphor and its guardrails;
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, especially the accepted CAV-001 through CAV-004 decisions and resonance-preview baseline;
- `docs/audits/M0-STATE-MUTATION-MAP.md`;
- `docs/tasks/M2-001-attention-command-boundary.md`.

## Existing code and callers to inspect

- `src/domain/ids.ts` and `src/domain/model/**`, especially canonical concept/session identity and event-derived topology facts;
- `src/runtime/commands/attention/**`, as the accepted preceding command seam only;
- `src/content/types.ts`, `src/content/concepts.ts`, and `src/content/connections/**`, especially legacy keywords, tiers, prose, and pair maps that must not be imported;
- `src/game/session.ts` and `src/game/rules.ts`, especially planted connections, `curatedAvailable`, `pickIlluminationTarget`, and binary curated/faint resolution;
- `src/state/types.ts`, `src/state/store.ts`, and `src/state/domainSession/**`;
- `src/scene/threading.ts`, especially `SYMPATHY_RADIUS`, `connectionByPair`, aim/snap behavior, and the current hidden curated-candidate signal;
- deterministic browser and performance-reference tests.

## Owned scope

- new resonance-model production files and focused unit tests under `src/domain/relations/resonance/**`;
- narrow exports under `src/domain/relations/**` only when required for the new model;
- this task's status and implementation notes.

All identifiers, events, model, reducer, replay, commands, current content/game rules, session generation, Zustand adapters, legacy state, persistence, scene, camera, audio, UI, input, browser tests, dependencies, and deployment code are inspection-only. No other active task may introduce a competing candidate resonance rule while M2-002 is active.

## Required model contract

Provide a dependency-free boundary equivalent to:

```ts
const RESONANCE_BANDS = ["weak", "medium", "high"] as const;
type ResonanceBand = (typeof RESONANCE_BANDS)[number];
type ResonanceSupportLevel = 0 | 1 | 2;

interface CandidateResonanceEvidence {
  readonly candidateId: ConceptId;
  readonly facetSupport: ResonanceSupportLevel;
  readonly topologySupport: ResonanceSupportLevel;
  readonly contextSupport: ResonanceSupportLevel;
  readonly documentedRelationPresent: boolean;
}

interface CandidateResonanceRequest {
  readonly attendedConceptId: ConceptId;
  readonly sessionConceptIds: readonly ConceptId[];
  readonly candidates: readonly CandidateResonanceEvidence[];
}

interface CandidateResonance {
  readonly candidateId: ConceptId;
  readonly band: ResonanceBand;
}

evaluateCandidateResonance(
  request: CandidateResonanceRequest,
): readonly CandidateResonance[];
```

Names may vary if the public contract remains equally closed, explicit, and non-spoiling. Add a typed error with stable closed codes for invalid session concepts, missing attended concept, candidate coverage/identity, and support levels. Do not accept `any`, unbounded numeric weights, display copy, or current content records.

## Evidence semantics

All evidence is explicit input prepared by a later reviewed adapter. The evaluator does not discover or validate content truth.

- `facetSupport`: `0` means no reviewed shared facet/structure is supplied; `1` means one specific interpretable bridge; `2` means multiple compatible facets or one especially strong structural correspondence.
- `topologySupport`: `0` means the current canonical web adds no structural relevance; `1` means a local structural opportunity; `2` means a strong bridge, recurrence, or motif-relevant opportunity.
- `contextSupport`: `0` means no current session/interpretive-context support; `1` means a specific contextual affinity; `2` means the current composition makes the candidate especially generative.
- `documentedRelationPresent`: indicates only that reviewed documented potential exists. It carries no relation ID, type, source, title, prose, tier, direction, or intended player interpretation.

The accepted M2 reference pairs may appear in tests as explicit synthetic evidence fixtures. That use does not validate or ship their prototype factual claims. Current `Concept.keywords`, transcendental coordinates, `CuratedConnection.tier`, pair membership, source count, hidden completion value, score, and legacy `curatedAvailable` are not evidence inputs.

## Required provisional calibration

For each candidate:

1. `generativeSupport = facetSupport + topologySupport + contextSupport`;
2. `documentedBonus = 1` only when `documentedRelationPresent` is true **and** `generativeSupport > 0`; otherwise it is `0`;
3. `totalSupport = generativeSupport + documentedBonus`;
4. `weak` when `totalSupport` is `0` or `1`;
5. `medium` when `totalSupport` is `2` or `3`;
6. `high` when `totalSupport` is `4` or greater.

Consequences:

- documented-relation presence by itself remains `weak` and cannot act as a known-pair oracle;
- a high result may be documented or open;
- contextual/topological richness can strengthen a candidate without inventing a content claim;
- the numeric support total is internal calibration and is never returned;
- the evaluator assigns bands, not correctness, relation intention, outcome, or player value.

This formula is a provisional vertical-slice calibration accepted through this reviewed task packet. Later playtest evidence may propose a separately reviewed tuning change; implementation must not make thresholds configurable through presentation code.

## Complete-candidate and ordering rules

1. `sessionConceptIds` must contain at least two unique concept IDs and include the attended concept.
2. Evidence must contain exactly one entry for every other session concept: no attended candidate, duplicate, omitted, or extra ID.
3. Every support value must be exactly the integer `0`, `1`, or `2`; do not clamp, coerce, round, default, or normalize invalid input.
4. Results contain every non-attended session concept, including weak candidates, in `sessionConceptIds` order regardless of evidence-input order.
5. The request, nested candidate values, and ID array are not mutated. The result array and every result are frozen.
6. Identical values produce deeply equal, byte-stable JSON regardless of evidence-input ordering.

Complete coverage is part of the non-spoiler contract: neither omission nor result sorting may reveal a hidden authored endpoint list.

## Directional-metaphor boundary

The accepted attended-viewpoint/directional-sweep metaphor informs later presentation but does not enter this rule:

- the evaluator knows no camera, frustum, aim vector, pointer position, viewport, distance, visibility, sound, color, animation, or input modality;
- a later presentation adapter may foreground candidates within a directional sector, but it must consume the same precomputed neutral bands rather than recalculate correctness from view direction;
- Echo, Passage, Tension, and Ground tool-mode behavior begins only after relation declaration and is not an input or output of candidate resonance;
- no target lock, weapon state, combat statistic, dexterity test, or persistent HUD value is introduced.

## Non-spoiler output contract

Each result exposes only `candidateId` and `band`. Production code must not add or return:

- numeric support/score, rank, sorted-best list, confidence, authored tier, source count, or completion value;
- documented-relation presence, ID, title, insight, evidence class, source, relation type, direction, or intended intention;
- shared facet IDs or explanatory prose before pair commitment;
- camera/frustum eligibility, target-lock state, presentation intensity, or audiovisual recipe.

CAV-004 governs presentation: ordinary play receives no persistent band/number HUD. Accessible descriptive text and deterministic test inspection belong to later reviewed integration work, not this task.

## Out of scope

- changing the event vocabulary, reducer, canonical session model, replay, adapter, or Attend command;
- evidence assembly from current or future authored content, facet schemas, relation schemas, sources, evidence classes, or content migration;
- importing `src/content/**`, `src/game/**`, `src/state/**`, `src/runtime/**`, `src/scene/**`, `src/audio/**`, `src/ui/**`, browser, storage, React, Three.js, Zustand, or Web Audio;
- production composition, caching, subscriptions, selectors, persistence, workers, commands, or durable resonance events;
- focus/Attend integration, camera behavior, directional sweep/frustum selection, pair selection, intention choice, gesture, cancellation, thread commit, outcome resolution, Open Threads, motifs, Attunement, or conclusion;
- audiovisual cues, labels, accessibility copy, input equivalence, onboarding, telemetry, dependencies, performance budgets, or deployment.

## Constraints

- TypeScript strict mode applies; public types are explicit and contain no `any`.
- The model is pure, synchronous, deterministic, deeply immutable, and side-effect free.
- Use branded `ConceptId` values without downcasting public identities to interchangeable strings.
- Do not use time, randomness, seeds, browser APIs, storage, network, framework state, or mutable module registries.
- Do not import current authored content or duplicate content, topology, session-generation, reducer, or presentation rules.
- Fail closed with typed stable errors; do not trim, coerce, repair, sort away invalid data, or translate failures into player copy.
- If implementation requires choosing real content facets, changing the accepted calibration, exposing evidence details, or integrating presentation/input, stop and record a proposal rather than expanding scope.

## Acceptance criteria

- The closed support/band vocabularies, evidence/request/result types, pure evaluator, and typed stable error boundary exist under the owned domain path.
- Valid complete input produces one frozen `{ candidateId, band }` result per non-attended session concept in canonical session order.
- The exact accepted formula distinguishes weak/medium/high boundaries; documented presence can contribute only alongside generative support and cannot independently reveal a known pair.
- Tests demonstrate high documented and high open candidates, medium and weak boundaries, documented-only weakness, context/topology influence, input-order independence, deterministic JSON, deep immutability, and non-mutation.
- Tests reject invalid/duplicate session IDs, an absent attended concept, attended/duplicate/missing/extra candidates, and every invalid support-level shape with the expected stable error code.
- Tests prove output keys contain no numeric score, evidence detail, documented flag, authored identity, relation intention, rank, or presentation state.
- No accepted event/model/reducer/replay/command/adapter contract, current content/game rule, production caller, persistence path, presentation/input path, browser behavior, dependency, or deployment change.
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
10. focused import scan proving `src/domain/relations/resonance/**` has no content, game, runtime, state, scene, audio, UI, framework, browser, network, or storage dependency;
11. focused caller scan proving no production module outside the owned domain path imports or instantiates the evaluator;
12. focused non-spoiler scan proving the public result contains only candidate identity/band and no legacy pair/tier/keyword/source/score or presentation field;
13. focused ownership scan proving calibration occurs once in the pure evaluator and no current content/topology/session/presentation rule is copied into the module.

The targeted performance reference is not required because the evaluator remains unintegrated and no active runtime path changes. If any required check cannot run, report the exact reason and do not mark the task complete.

## Expected completion report

- model types, evaluator, error contract, and calibration summary;
- complete-candidate and non-spoiler guarantees;
- deterministic, threshold, invalid-input, immutability, and output-shape tests;
- all check and focused-scan results;
- confirmation that no current content, game, command, state, persistence, input, or presentation path changed;
- architecture/content/calibration proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because the provisional calibration becomes the first reusable gameplay rule for perceptible candidate possibility. Automated checks prove determinism and non-spoiler shape but cannot establish whether the bands feel inviting, honest, or legible. Production integration and audiovisual acceptance remain separate reviewed tasks.

## Implementation notes

- Selected on 2026-07-14 after PR #33 and its protected checks were accepted, the exact `main` merge commit `524b7a8` passed push CI run `29288430660`, and no open PR or active task owned the declared domain boundary.
- Implementation plan: add closed resonance/support and typed-error contracts under `src/domain/relations/resonance/`; validate complete candidate coverage before applying the accepted calibration once; return only frozen candidate identity/band results in canonical session order; cover thresholds, determinism, immutability, invalid inputs, and non-spoiler shape; then run the full required suite and focused ownership scans.
- Added closed, frozen `weak`/`medium`/`high` and `0`/`1`/`2` vocabularies; explicit evidence, request, and result types over branded `ConceptId`; and a typed `CandidateResonanceError` boundary with stable codes for session concepts, attended membership, candidate identity/coverage, support levels, and documented-presence shape.
- The pure evaluator validates an exact evidence entry for every non-attended session concept, applies the accepted generative-support plus conditional documented-bonus calibration in one internal function, and returns every frozen `{ candidateId, band }` result in canonical session order. Evidence order cannot affect deep equality or serialized JSON, and documented presence alone remains weak.
- Added 30 focused tests covering closed vocabularies, every threshold, documented/open high candidates, documented-only weakness, topology/context influence, canonical order, evidence-order independence, byte determinism, deep result immutability, input non-mutation, exact non-spoiler output keys, and typed failures for invalid sessions, attention, identities, coverage, every support field/invalid value shape, and documented-presence shape.
- Required validation passed: clean lockfile installation with zero vulnerabilities; typecheck; lint; 15 unit-test files with 152 tests; 3 content-validation tests; production build; bundle ceilings at 2,422,418 raw bytes / 1,270,711 gzip bytes total and 1,581,776 raw / 465,775 gzip JavaScript bytes; 3 deterministic browser tests; and `git diff --check`. The existing `three-mesh-bvh@0.7.8` deprecation and established large-chunk notices remain unchanged.
- Focused scans found only the branded ID type and local-module production imports, no browser/framework/content/game/runtime/state/scene/audio/UI/platform dependency, no external production caller, exactly `{ candidateId, band }` on the result contract, and one calibration owner. No current content, game, event, reducer, command, state, persistence, input, scene, audiovisual, browser, dependency, or deployment path changed.
- The targeted performance reference was not required because the evaluator remains unintegrated and does not change an active runtime path. Human review remains required for the provisional calibration; no architecture conflict, content assertion, compatibility exception, or specification proposal was discovered.
- Accepted and merged in PR #34 on 2026-07-14. The exact `main` merge commit `20a3402` passed the complete Quality Gates workflow in CI run `29289284887`.
