# M2-009 — Resolve provisional resonance evidence

## Status

Review

## Milestone

M2 — New interaction loop

## Dependencies

- M2-002, M2-007, and M2-008 must be Done.
- Director decisions CAV-001 through CAV-004 must be accepted through reviewed
  merge.

## Objective

Create one deterministic read-only `ResolveCandidateEvidence` implementation
for the provisional M2 interaction slice. It must return complete evidence in
canonical session order for every non-attended concept, using only the accepted
M2 reference-pair and Open Thread fixture classifications. It must enable the
existing resonance evaluator to produce honest high, medium, and weak bands
without importing legacy score/tier semantics, asserting that provisional
fixtures are documented facts, exposing pair endpoints to presentation, or
inventing significance for unclassified pairs.

This task supplies the final headless dependency required by the accepted
interpretive-attention coordinator. It does not compose production stores,
migrate browser input, display resonance, reveal content, resolve a committed
thread, or make the provisional fixture set part of the final M3 content model.
The shipped game remains unchanged.

## Why this is next

M2-007 deliberately injects evidence rather than owning content or topology
policy, and M2-008 completes the corresponding headless commit/reset seam. A
production cutover cannot honestly call Attend until exactly one evidence owner
exists. The current content pack exposes legacy curated-pair tiers, keywords,
score values, and unsourced prose that the accepted design explicitly forbids
using as if they were the new evidence model.

CAV-001 authorizes the five representative pairs and one Open Thread example
as provisional M2 fixtures, while CAV-002 through CAV-004 require multiple
possible readings, relation-neutral bands, no hidden correctness, and no normal
numeric/category HUD. The smallest safe next step is therefore an isolated
resolver that translates only those accepted fixture classifications into the
already-reviewed evidence input vocabulary. Production composition, input, and
presentation can then consume one explicit seam in later reviewed tasks.

## Implementation plan

1. Reconfirm the M2-002 evidence vocabulary and thresholds, M2-007 resolver
   request contract, accepted CAV fixture classifications, and all existing
   content/interaction callers.
2. Add one pure provisional evidence resolver beside the accepted
   interpretation coordinators and export only its callable public surface.
3. Keep the fixture table private, symmetric, immutable, and limited to the
   accepted five reference pairs plus one Open Thread example.
4. Return high-support reference evidence, medium-support Open Thread evidence,
   and explicit zero-support weak evidence for every other session candidate,
   always with no topology or documented-relation assertion.
5. Prove complete ordering, non-disclosure, failure isolation, immutability,
   determinism, absence of production callers, and absence of legacy content
   semantics through focused tests and scans.

## Required reading

- `AGENTS.md`
- `docs/CODEX-STEERING-READINESS.md`
- `docs/tasks/README.md`
- `docs/tasks/M2-002-candidate-resonance-model.md`
- `docs/tasks/M2-007-interpretive-attention-coordinator.md`
- `docs/tasks/M2-008-interpretation-commit-coordinator.md`
- `docs/MASTER-PLAN.md`, especially Perception, Interpretation, and
  Intellectual honesty
- `docs/ARCHITECTURE.md`, especially content, commands, and presentation
  boundaries
- `docs/CURRENT-STATE-AUDIT.md`, especially legacy connection, scoring, and
  content limitations
- `docs/ROADMAP.md`, especially the M2 and M3 ownership boundary
- `docs/VERTICAL-SLICE-SPEC.md`, especially session generation, resonance
  preview, thread outcomes, and the golden path
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md`, especially the resonance baseline,
  five reference pairs, Open Thread example, CAV-001 through CAV-004, and
  Acceptance use
- `docs/INTERACTION-DECISIONS.md`, especially I-001, I-012, and I-013
- `docs/PLAYTEST-PLAN.md`, especially the M2 interaction-comprehension gate

## Existing code and callers to inspect

- `src/domain/relations/resonance/**`
- `src/runtime/interpretation/**`
- `src/domain/model/**`
- `src/domain/ids.ts`
- `src/content/concepts.ts`
- `src/content/connections/**`
- `src/content/types.ts`
- `src/game/session.ts` and `src/game/rules.ts`
- `src/state/domainSession/**`
- `src/state/interactionDraft/**`
- `src/runtime/testMode.ts`
- `src/state/store.ts` and `src/state/types.ts`
- every current import or caller of `ResolveCandidateEvidence`,
  `CandidateResonanceEvidence`, and the interpretation runtime index

The existing content and game files are inspection-only. They are useful for
proving that the resolver does not inherit legacy tier, score, discovery,
connection-copy, keyword-overlap, draw, or endpoint-reveal behavior.

## Owned scope

The task may modify only:

- new production and test files under `src/runtime/interpretation/**`;
- the local `src/runtime/interpretation/index.ts` export surface;
- this task file for status and implementation notes.

All domain types, evidence fields, resonance thresholds, events, reducer,
replay, adapters, coordinators, content data, session draw, legacy state,
production composition, persistence, input, React, scene, camera, audio, UI,
browser tests, dependencies, CI, and deployment are inspection-only. If an
honest provisional resolver requires changing one of those boundaries, stop
and record a specification proposal rather than expanding scope.

## Required resolver contract

Provide an exported callable equivalent to:

```ts
type ResolveProvisionalCandidateEvidence = ResolveCandidateEvidence;

const resolveProvisionalCandidateEvidence:
  ResolveProvisionalCandidateEvidence;
```

Names may vary only when the boundary remains equally explicit. Reuse the
accepted `CandidateEvidenceResolutionRequest`, `ResolveCandidateEvidence`, and
`CandidateResonanceEvidence` types; do not introduce a parallel request or
evidence vocabulary. Export the callable and its public alias through the local
interpretation index. Keep the fixture table, pair lookup, and classification
private so no production or presentation caller can use it as an endpoint list.

Do not add a factory, mutable singleton, store, cache, clock, seed, random
source, browser global, or fallback callback. The resolver is a pure
deterministic mapping from the exact request to a new frozen evidence array.

## Provisional fixture policy

The private fixture set contains exactly these unordered classifications from
the accepted audiovisual reference:

### High reference fixtures

- Fibonacci Sequence (`math.fibonacci-sequence`) ↔ Counterpoint
  (`music.counterpoint`);
- Prime Numbers (`math.prime-numbers`) ↔ Polyrhythm (`music.polyrhythm`);
- Perspective (`art.perspective`) ↔ Renaissance (`hist.renaissance`);
- Consonance (`music.consonance`) ↔ Dissonance (`music.dissonance`);
- Abstract Algebra (`math.abstract-algebra`) ↔ Energy Conservation
  (`phys.energy-conservation`).

For either attended direction, a high reference fixture returns:

```ts
{
  candidateId,
  facetSupport: 2,
  topologySupport: 0,
  contextSupport: 2,
  documentedRelationPresent: false,
}
```

The facet value represents only the structural material described in the
accepted provisional reference, and the context value represents director
selection of that pair for M2 interaction testing. Neither value is a source,
final fact claim, relation intention, correctness marker, or M3 evidence class.

### Medium Open Thread fixture

- Fibonacci Sequence (`math.fibonacci-sequence`) ↔ Perspective
  (`art.perspective`).

For either attended direction, the Open Thread fixture returns:

```ts
{
  candidateId,
  facetSupport: 1,
  topologySupport: 0,
  contextSupport: 1,
  documentedRelationPresent: false,
}
```

This means only that the accepted reference contains a specific interpretable
question. It does not assert a historical influence, documented relation, or
future Open Thread outcome.

### Weak unclassified candidates

Every other non-attended session concept returns:

```ts
{
  candidateId,
  facetSupport: 0,
  topologySupport: 0,
  contextSupport: 0,
  documentedRelationPresent: false,
}
```

Unclassified never means impossible, incorrect, or rejected. It means only
that this provisional M2 resolver has no accepted support to assert. Silence or
weakness remains preferable to deriving significance from unreviewed legacy
keywords, tiers, prose, or pair availability.

## Required operation semantics

### Resolution

- Read the exact immutable `request.session.conceptIds` once as the sole
  candidate membership and ordering source.
- Return exactly one evidence entry for every session concept other than the
  exact attended concept, in unchanged canonical session order.
- Classify pairs symmetrically: either endpoint may be attended, but the
  returned `candidateId` always matches the current session candidate.
- Create and deeply freeze a fresh evidence entry and result array on each
  call. Do not return or expose a fixture object.
- Supply only the exact support values above. Do not infer from content
  keywords, disciplines, transcendental coordinates, curated connection
  presence, legacy tier, score, discovery, source count, draw order, current
  threads, camera/frustum state, or relation intention.
- Leave `topologySupport` at zero because no accepted M2 topology evidence
  resolver exists. Leave `documentedRelationPresent` false because M3 has not
  normalized, sourced, evidence-classed, and reviewed the reference claims.
- Do not call `evaluateCandidateResonance`; M2-002 remains the sole owner of
  evidence validation and high/medium/weak calculation.

### Boundary behavior

- The resolver receives requests only through the accepted M2-007 dependency
  shape and does not validate or repair canonical session state.
- Do not validate attended membership. If a direct caller supplies an attended
  ID absent from the session, still map every session concept against that
  supplied ID; passing the result to the accepted evaluator must preserve its
  `attended-concept-not-in-session` rejection. The accepted coordinator owns
  the valid production call sequence.
- Unknown but valid concept IDs are unclassified and receive zero support.
- Importing or calling the resolver performs no publication, persistence,
  clock, timer, random, network, logging, browser, presentation, or legacy-state
  work.
- The resolver neither mutates nor retains the request, session, concept array,
  returned arrays, or any caller-owned value.

### Meaning and replacement

- Evidence remains internal and relation-neutral. The resolver returns no band,
  label, numeric score, source, prose, intention, outcome, or reveal cue.
- A high fixture is rich material for thought, never a correct endpoint. All
  candidates remain selectable and all four intentions remain available.
- The private fixture classifications are temporary M2 test scaffolding. M3
  must replace this resolver with normalized reviewed facets, documented
  relations, topology/context evidence, and source-aware outcome policy rather
  than silently treating it as final content.
- No fixture or evidence is durable. Only the existing canonical Attend event
  is published by the later coordinator call.

## Ownership rules

1. M2-009 owns only the provisional evidence mapping; it does not own resonance
   validation, thresholds, bands, or presentation.
2. M2-002 remains the sole resonance evaluator and the sole owner of translating
   support evidence into weak/medium/high.
3. M2-007 remains the sole attention coordinator and session-membership owner;
   this task adds no production composition or alternate attention path.
4. CAV-001 through CAV-004 are the sole authority for the provisional fixture
   set and meaning. Legacy content data is not grandfathered as evidence.
5. M3 owns final facets, documented-relation truth, sources, evidence classes,
   Open Thread resolution, and replacement of this provisional resolver.
6. Presentation tasks may consume only the resulting resonance bands from the
   coordinator, never import or inspect the private fixture mapping.

## Out of scope

- adding, editing, validating, or approving concept or relation claims;
- source records, evidence classes, documented reveals, Open Thread outcomes,
  weak-result copy, or relation-intention compatibility;
- production singleton composition or any active caller;
- session generation, planted connection policy, golden-path overture control,
  or deterministic test-mode changes;
- browser pointer/touch/pen, keyboard, controller, camera/frustum, focus,
  inspection, Attend, intention, candidate, gesture, commit, or cancel mapping;
- resonance visuals, audio, labels, patterns, DOM controls, captions, camera
  sweeps, haptics, reduced-motion behavior, or other presentation;
- current topology analysis or support derived from committed threads;
- changing domain IDs, events, model, reducer, replay, stores, coordinators,
  evidence fields, thresholds, dependencies, CI, deployment, or persistence;
- modifying or removing the shipped legacy interaction/content path.

## Constraints

- TypeScript strict mode; explicit public types; no `any`.
- Add no production dependency and no mutable module singleton.
- Pure synchronous deterministic mapping with no store, browser, time, random,
  seed, network, persistence, content-module, or legacy-state import.
- The fixture set must remain private, fixed, symmetric, and limited to the six
  accepted classifications.
- Do not weaken accepted validation or fabricate fallback support.

## Acceptance criteria

1. One exported pure resolver implements the accepted M2-007 evidence
   dependency without a production caller, store, or second resonance model.
2. Every non-attended session concept appears exactly once in canonical order
   with an exact frozen evidence object.
3. The five accepted reference pairs receive exact high-support evidence in
   either direction, the accepted Open Thread pair receives exact
   medium-support evidence in either direction, and every other pair receives
   exact zero support.
4. All results set topology support to zero and documented-relation presence to
   false; no final factual, source, relation, outcome, or correctness claim is
   introduced.
5. Passing the resolver output to the unchanged M2-002 evaluator yields high,
   medium, and weak for representative complete sessions without exposing the
   private pair classifications.
6. Equal requests produce byte-identical values in fresh calls while returning
   distinct deeply frozen arrays/entries; inputs and prior results are neither
   mutated nor retained.
7. No legacy tier, score, keyword, curated connection, draw, discovery, state,
   presentation, input, or persistence dependency enters the resolver.
8. No current production module imports or invokes the resolver.
9. No production dependency is added.

## Required tests and checks

- Clean dependency installation from the lockfile.
- Typecheck.
- Lint.
- Full unit suite plus focused tests for:
  - import and call side-effect absence;
  - complete canonical session ordering and attended-concept exclusion;
  - both directions of all five exact high reference fixtures;
  - both directions of the exact medium Open Thread fixture;
  - unrelated and unknown concepts receiving exact zero support;
  - sessions containing overlapping classifications, including Fibonacci with
    Counterpoint, Perspective, and an unrelated candidate;
  - exact topology/documented flags for every result;
  - integration through the unchanged M2-002 evaluator yielding high, medium,
    and weak in canonical order;
  - fresh-reference isolation, deep freezing, input/prior-result non-mutation,
    non-retention, repeat determinism, and byte identity;
  - invalid coordinator/evaluator membership remaining owned by accepted
    boundaries rather than duplicated here.
- Content validation.
- Production build.
- Bundle report and accepted ceiling check.
- Deterministic browser smoke tests.
- Targeted performance reference only if implementation affects an active
  runtime path; otherwise report why it was not required.
- `git diff --check`.
- Focused dependency scan proving the resolver imports only accepted domain
  IDs/types, resonance evidence types, and the M2-007 resolver type.
- Focused caller scan proving no production module imports or invokes it.
- Focused ownership scan proving no resonance threshold/band calculation,
  content keyword/tier/connection logic, store access, or generic mutation was
  copied.
- Focused diff scan proving no content, domain, state, coordinator, production
  input, legacy path, scene, audio, UI, persistence, dependency, browser-test,
  CI, or deployment file changed.

## Expected completion report

- exact resolver API and changed files;
- exact fixture classifications and support values;
- ordering, symmetry, immutability, isolation, and determinism evidence;
- proof that documented/topology support remains unset and legacy content is
  not imported;
- tests added with final counts and every required check result;
- performance-reference disposition and focused scan results;
- confirmation that no production interaction, presentation, persistence,
  outcome policy, content claim, or durable schema changed;
- compatibility proposals and human-review items, if any.

## Human review boundary

Human review is required before merge because this packet defines temporary
evidence meaning from director-approved content/audiovisual fixtures. Automated
tests can prove exact mapping, determinism, and non-disclosure boundaries, but
cannot authorize final content truth, intellectual adequacy, resonance feel,
accessible presentation, input equivalence, or replacement timing in M3.

## Implementation notes

- Implemented `resolveProvisionalCandidateEvidence` and its public callable
  alias as a pure deterministic adapter over one private, deeply frozen table
  containing exactly the five accepted reference pairs and one accepted Open
  Thread pair. Both endpoint directions produce the specified support; every
  other valid candidate receives explicit zero support in unchanged canonical
  session order.
- Each call returns fresh deeply frozen evidence entries and a fresh frozen
  array. The resolver neither validates session membership nor calculates
  bands: focused integration confirms that the unchanged M2-002 evaluator
  produces high, medium, and weak and retains its exact
  `attended-concept-not-in-session` rejection.
- Added 12 focused tests covering the public/private boundary, both directions
  of all six fixtures, unknown and overlapping candidates, exact fields and
  ordering, evaluator integration, deep freezing, fresh-reference isolation,
  byte identity, non-mutation, non-retention, and boundary-owned validation.
- Required checks passed on 2026-07-15: clean `npm ci` (330 packages, zero
  vulnerabilities; existing `three-mesh-bvh@0.7.8` deprecation warning only),
  typecheck, lint, 22 unit files / 297 tests, content validation (3 tests),
  production build, bundle report and ceiling, and all 3 deterministic browser
  smoke tests. The build retained its existing over-500 kB chunk warning.
- Bundle ceilings passed at 2,422,605 raw / 1,270,785 gzip total,
  1,581,963 raw / 465,848 gzip JavaScript, and 683,665 bytes for the largest
  asset. A targeted runtime performance reference was not required because the
  resolver deliberately has no active production caller and changes no shipped
  runtime path.
- `git diff --check` and focused dependency, caller, ownership, and changed-file
  scans passed. No content, domain model, state, coordinator, production input,
  legacy path, scene, audio, UI, persistence, dependency, browser-test, CI, or
  deployment file changed; topology support remains zero and documented
  relation presence remains false throughout.
- No production interaction, presentation, persistence, outcome policy,
  content claim, or durable schema changed. No compatibility proposal or
  authoritative-document conflict was discovered. Human review remains
  required for the temporary director-approved evidence meaning and its future
  M3 replacement.
- Selected on 2026-07-15 after PR #47 was reviewed and merged. Its exact
  `main` merge commit `f1cf7b5` passed Quality Gates run `29421280180`; no PR
  remained open, every dependency was Done, and no active work owned
  `src/runtime/interpretation/**` or the provisional evidence seam.
- Implementation plan: add one pure exported resolver over a private frozen
  six-fixture classification table; map canonical session candidates to exact
  reference, Open Thread, or zero-support evidence without validation or band
  calculation; prove symmetry, ordering, evaluator integration, immutability,
  determinism, non-retention, and absent production/legacy dependencies; then
  run every required repository and focused boundary check.
- Ready packet proposed on 2026-07-15 after PR #46 was reviewed and merged. Its
  exact `main` merge commit `46c29ba` passed Quality Gates run `29406943154`
  and Pages deployment run `29407049510`; no PR remained open and no active
  work owned `src/runtime/interpretation/**` or the provisional evidence seam.
- Packet plan: translate only the six accepted CAV provisional classifications
  into complete relation-neutral evidence; keep documented/topology support
  unset, leave all validation and band calculation with M2-002/M2-007, and
  defer production composition, browser input, presentation, outcomes, final
  content, and persistence to separately reviewed tasks.
