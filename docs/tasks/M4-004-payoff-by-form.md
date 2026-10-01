# M4-004 — The commit moment scales with the form of the web

## Status

Blocked

## Milestone

M4 — Semantic audiovisual grammar

## Dependencies

- M4-002 must be Done: the pulse's fill is one of the moment's voices.
- ADR-019 must be accepted through reviewed merge.

M2-011 is not a dependency in the steering sense: its Review status records
the director's pending device, accessibility and audiovisual gate, not missing
code, and this task does not rely on that gate.

## Objective

Let the moment a thread is woven grow with what the player has built and with
nothing else: the number of threads in the web, the faculties it spans, and
whether the commit completed a motif. Bounded to one and a half times the
first thread's moment, identical for every outcome kind (CAV-006), and never
counted for the player.

## Why this is next

The twelfth thread of a wide web answers today exactly like the first. The
conclusion's climax already belongs to the player's web (§14); the live moment
should say the same thing, in size, without a score. It comes after the bed
has its pulse, because the fill is part of the moment.

## Implementation plan

1. **The form factor, once.** A pure function in the runtime's cue planning
   (`formFactor({ threadCount, facultyCount, completedMotif })` in [1, 1.5])
   computed where `thread.woven` is planned, carried in the cue's payload as
   one number; the domain and the events are untouched.
2. **The scene.** The scene director's response table scales the weave's
   bursts and the kick by the factor; outcomes are unchanged (they carry no
   factor).
3. **The audio.** The landing's gain scales by the factor within the bed's
   ceiling; the pulse's fill gains its bell's octave at the third faculty.
4. **Parity.** A test proves the three outcome plans and bursts are equal at
   every factor, and that the factor never reads an outcome kind.

## Required reading

- `AGENTS.md`
- `docs/VERTICAL-SLICE-SPEC.md` — §10, §14
- `docs/ARCHITECTURE.md` — §8
- `docs/DECISIONS.md` — ADR-009, ADR-010, ADR-017 and ADR-019
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md` — CAV-006
- `docs/tasks/M4-002-pulse-and-stems.md`
- `src/runtime/cues/planCues.ts` — where the weave is planned
- `src/runtime/scene/createSceneDirector.ts` — the response table
- `src/audio/director.ts` — the weave landing

## Existing code and callers to inspect

- The cue planner's `thread.woven` plan and the outcomes staged at 0.42 of
  the phrasing; the scene director's `RESPONSE` table (bursts 8 at 0.9 for
  the weave, flare 0.55 for outcomes, kick 0.22 on the camera channel); the
  audio director's landing (both identity notes 0.11 s apart at 0.4 × bed);
  the pulse's fill (M4-002); the session's threads, faculties and completed
  motifs as the planner can read them.

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M4-004",
  "branch": "codex/M4-004-payoff-by-form",
  "dependencies": ["M4-002"],
  "requiredReading": [
    "AGENTS.md",
    "docs/VERTICAL-SLICE-SPEC.md",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "docs/CONTENT-AUDIOVISUAL-REFERENCE.md",
    "docs/tasks/M4-002-pulse-and-stems.md",
    "src/runtime/cues/planCues.ts",
    "src/runtime/scene/createSceneDirector.ts",
    "src/audio/director.ts"
  ],
  "ownership": {
    "paths": [
      "docs/tasks/M4-004-payoff-by-form.md",
      "src/runtime/cues/**",
      "src/runtime/scene/**",
      "src/audio/director.ts",
      "src/audio/pulse.ts"
    ],
    "boundaries": [
      "cue-planning",
      "scene-director",
      "commit-moment"
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
    "git diff --check"
  ],
  "humanReview": ["product-specification", "audiovisual-quality"],
  "stopBoundary": "reviewable-pr"
}
```

## Owned scope

### Declared paths

- `docs/tasks/M4-004-payoff-by-form.md`
- `src/runtime/cues/**`
- `src/runtime/scene/**`
- `src/audio/director.ts`
- `src/audio/pulse.ts`

### Declared boundaries

- `cue-planning`
- `scene-director`
- `commit-moment`

The domain, the events and the content must not change.

## Functional contract

- `formFactor` is 1 for the first thread, rises linearly with thread count to
  1.3 at twelve, adds 0.05 per faculty beyond the first (to 1.45 at four),
  and 0.05 for a commit that completed a motif; capped at 1.5. It reads the
  session's shape only.
- The weave's bursts (count and speed) and the kick scale by it; the
  landing's gain scales by it within the bed's ceiling; the fill gains a
  bell octave at three faculties. Outcomes, flares and the solved moment are
  unchanged.
- No number, bar, rank or word reaches the player.

## Out of scope

- Any change to outcomes, the conclusion, the Studies' marks or the
  portrait.

## Constraints

- CAV-006 parity; ADR-010 (no score); ADR-013 (no event change); law 7 (no
  conventional gamification: the moment grows, nothing is awarded).

## Acceptance criteria

1. `formFactor` is pure, bounded to [1, 1.5], and never reads an outcome.
2. The weave's bursts, kick, landing gain and fill scale by it with tests;
   outcomes are proven unchanged at every factor.
3. Every existing browser test passes; the first load is within the
   ceilings.

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
- `git diff --check`

## Expected completion report

- The branch and the pull request; the factor table; every check with its
  result; the director's question: does a big web's moment read as the world
  answering more, or as a reward.

## Human review boundary

### Declared categories

- `product-specification`
- `audiovisual-quality`

Human review is required because the line between the world answering more
and a reward loop is a product judgement (law 7), and ADR-019 draws it.

## Implementation notes

- Proposed on 2026-09-30 with ADR-019 under the director's polish mandate;
  blocked behind M4-002.
