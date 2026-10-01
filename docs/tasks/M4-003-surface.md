# M4-003 — The surface: dither, a dust field, and one pass for all screen effects

## Status

Done

## Milestone

M4 — Semantic audiovisual grammar

## Dependencies

- M4-001 must be Done: the dust field answers the light the conductor puts
  on a bead, read from the kindling lane the bead pass writes each frame.

M2-011 is not a dependency in the steering sense: its Review status records
the director's pending device, accessibility and audiovisual gate, not missing
code, and this task does not rely on that gate.

## Objective

Give the world a finished surface at no new full-screen cost: kill the colour
banding in the void, put a sparse living field of dust between the beads that
ripples outward from a bead when it sounds, and fix the rule that every screen
effect from now on joins the one effect pass the frame already ends with. The
target is a dark frame that reads as continuous depth rather than steps, a
space that is inhabited rather than empty, and a frame budget that does not
move.

## Why this is next

The polish assessment named banding as the largest cheap tell in a dark game,
and the empty space between the beads as the place where a mesmerising world
differs from a diagram. Both are surface work that neither the interaction
track nor the bed depends on, so they can be built while the bed grows
(M4-002) and heard against it. The one-pass rule is the performance discipline
that lets the rest of the polish track add effects without adding passes.

## Implementation plan

1. **Dither in the final pass.** The frame ends in bloom's `EffectPass`,
   whose material already carries three's dithering include, switched off.
   Turn it on for that pass, and re-apply it whenever the composer rebuilds
   its passes (a tier change reconstructs bloom). If the hash dither proves
   too coarse on a real display, replace it with a small non-convolution
   `Effect` appended after bloom carrying an interleaved-gradient dither,
   which merges into the same pass. Either way the dither is static per
   pixel: no temporal noise, nothing flickers.
2. **The dust field.** One `points` draw modelled on the star field: a
   sparse cloud in the arena's shell (count per tier), animated in the vertex
   shader from the dilated clock and from at most twenty-four bead lights.
   Each frame the scene writes the beads' rendered positions and their
   kindling into one preallocated uniform array (no allocation), and keeps a
   per-bead onset clock that starts when a bead's kindling rises, so a ring
   can travel outward from the bead at a fixed speed and fade. Off on potato,
   thinned on base; under reduced motion the field holds still and only
   brightens where a ring would have passed.
3. **One pass for all screen effects.** Record the rule in the composer's
   header and prove it with a source scan: the composer's children are the
   fog slot (its own pass only while fog is active, by design) and then
   bloom followed by any non-convolution effects, which the composer merges
   into bloom's pass. No `Pass` may be added after the fog slot; no
   convolution effect may follow bloom.
4. **Evidence.** The rest-frame browser spec still passes (the field must not
   move the luminance centroid); a screenshot-based band count on the void
   gradient before and after the dither; the performance reference beside
   M4-001's.

## Required reading

- `AGENTS.md`
- `docs/MASTER-PLAN.md`
- `docs/VERTICAL-SLICE-SPEC.md` — §6, §21, §22
- `docs/ARCHITECTURE.md` — §9 and §10
- `docs/DECISIONS.md` — ADR-016
- `docs/CONTENT-AUDIOVISUAL-REFERENCE.md` — CAV-007
- `docs/tasks/M4-001-conductor.md` — the kindling lane and the conductor's
  light
- `docs/audits/M0-PERFORMANCE-BASELINE.md`
- `src/scene/Effects.tsx` — the composer tree and the bloom breath
- `src/scene/FocusFogEffect.tsx` — the fog slot
- `src/scene/focusFogPass.ts` — the fog's effect pass and its attributes
- `src/scene/Firmament.tsx` — the star field as the model
- `src/scene/glsl.ts` — the void gradient
- `src/scene/frameState.ts` — `rendered`, `kindling`, `beadIndex`, the clock
- `src/scene/quality.ts` — the tier budget
- `src/scene/threadGrammar.ts` — the comfort table
- `src/scene/ArenaCanvas.tsx` — the canvas, DPR and the performance monitor

## Existing code and callers to inspect

- The composer (`Effects.tsx`): `<EffectComposer multisampling={0}>` with
  `<FocusFogPass />` then `<Bloom …/>`; HalfFloat buffers; `NoToneMapping`
  forced by the composer; the tier bloom table; `BreathDriver`. The r3f
  composer groups consecutive non-convolution `Effect` children into one
  `EffectPass` and adds a `Pass` child as-is; postprocessing's `EffectPass`
  throws when two convolution effects meet; `EffectPass.dithering` is a
  setter and defaults to false; the composer is reachable through its ref.
- The fog slot: `enabled` only while fog is active or easing out; its inner
  `EffectPass` holds one `FocusFogEffect` whose attributes switch between
  CONVOLUTION (blur taps) and NONE (potato, reduced motion).
- The void: `gbgEnvironment` in `glsl.ts` (`mix(ground * 0.72, depth,
  smoothstep(-0.55, 0.55, y))` plus the horizon band), drawn by the Vault
  sphere; Castalia's ground `#070912` to depth `#0d1226`, a span of a few
  8-bit steps across the whole vault, which is where the banding lives.
- The star field (`Firmament.tsx`): `points` with `position`, `aMagnitude`,
  `aFigure`; uniforms `uStarlight`, `uScale`, `uFlare`, `uAttuned`; one draw
  call; rotation on the dilated clock, skipped under reduced motion.
- Bead data: `frameState.rendered` (xyz per bead at `index * 3`),
  `frameState.kindling[index]` (the lane the glass shows, written in the bead
  pass), `frameState.beadIndex`, at most twenty-four beads; the fog already
  reads `rendered` per frame inside its effect's `update`.
- Quality: `SceneBudget` fields per tier; `presentationProfile`;
  `PerformanceMonitor` demotes and promotes the tier; DPR `[1, 2]` and never
  changed by code.
- Tests that pin shapes: `focusFog.test.ts` scans `Effects.tsx` for the fog
  slot before bloom; `quality.test.ts` pins tier fields; `stations.test.ts`
  requires every `frameState.` read inside `useFrame`;
  `tests/browser/rest-frame.spec.ts` measures the luminance-energy centroid
  at rest.

## Steering contract

```json
{
  "schemaVersion": 1,
  "taskId": "M4-003",
  "branch": "codex/M4-003-surface",
  "dependencies": ["M4-001"],
  "requiredReading": [
    "AGENTS.md",
    "docs/MASTER-PLAN.md",
    "docs/VERTICAL-SLICE-SPEC.md",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "docs/CONTENT-AUDIOVISUAL-REFERENCE.md",
    "docs/tasks/M4-001-conductor.md",
    "docs/audits/M0-PERFORMANCE-BASELINE.md",
    "src/scene/Effects.tsx",
    "src/scene/FocusFogEffect.tsx",
    "src/scene/focusFogPass.ts",
    "src/scene/Firmament.tsx",
    "src/scene/glsl.ts",
    "src/scene/frameState.ts",
    "src/scene/quality.ts",
    "src/scene/threadGrammar.ts",
    "src/scene/ArenaCanvas.tsx"
  ],
  "ownership": {
    "paths": [
      "docs/tasks/M4-003-surface.md",
      "src/scene/**",
      "tests/browser/**"
    ],
    "boundaries": [
      "screen-effects",
      "scene-surface",
      "quality-tiers"
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
  "humanReview": ["audiovisual-quality", "accessibility-interaction"],
  "stopBoundary": "reviewable-pr"
}
```

## Owned scope

### Declared paths

- `docs/tasks/M4-003-surface.md`
- `src/scene/**`
- `tests/browser/**`

### Declared boundaries

- `screen-effects`
- `scene-surface`
- `quality-tiers`

The audio layer is not owned (M4-002 owns it); the dust field reads the light
through `frameState.kindling` and needs nothing from the conductor directly.
The domain, the cue planner, the UI and the content must not change.

## Functional contract

Names may vary if the contract stays equally closed and explicit.

### Dither

- The final `EffectPass` (bloom's) renders with dithering on. It is switched
  on through the composer's ref after the passes are built and again after
  every rebuild (the composer rebuilds when its children change, which a tier
  change causes).
- The dither is static per pixel (three's hash of the fragment coordinate,
  ±0.5 of an 8-bit step); no time term, so nothing flickers (CAV-007, §6).
- If the hash dither is judged too coarse, a `DitherEffect` (non-convolution,
  interleaved-gradient noise, ±0.5 step, static) is appended after bloom and
  merges into the same pass; the source scan below allows exactly that.
- Evidence: a headless screenshot of the rest frame at base tier, the count
  of distinct 8-bit values along a vertical line through the vault, before and
  after; after must be at least twice before, and the rest-frame centroid
  test must still pass.

### The dust field

- One `points` draw in a component beside the star field, mounted only when
  the tier's budget gives it a count: high 600, base 300, potato 0 (a new
  `SceneBudget.dust` field).
- Positions are seeded deterministically (the seeded random, as the sky is)
  in a shell between the arena's bead radius and the vault, avoiding the
  camera's near field.
- Vertex shader inputs: `uTime` (the dilated frame clock), `uTimeScale`,
  `uAttuned`, `uReducedMotion`, and `uBeads[24]` as vec4 (rendered xyz and
  the ring's age in seconds, negative when no ring is travelling) plus
  `uLights[24]` (the kindling lane). Both arrays are preallocated
  `Float32Array`s written each frame inside `useFrame`; no allocation per
  frame.
- Drift: each particle drifts on a slow curl of the time (period tens of
  seconds), amplitude a fraction of the spacing; under reduced motion the
  drift is zero.
- The ring: when a bead's kindling rises above 0.5 from below, its onset
  clock starts; a ring travels outward from the bead at a fixed speed for a
  fixed life (about 1.6 s), and a particle within the ring's band brightens
  and is pushed outward by a small amount. Under reduced motion the ring
  brightens and does not push. The brightening decays with the light; no
  particle changes brightness faster than the comfort bound (the ring's
  band is wide enough that a particle's brightness rises and falls once per
  ring).
- Brightness: whisper level at rest (well under the stars' magnitude), so
  the rest-frame luminance centroid is unmoved; the field never carries hue.
- Attunement raises the field's rest brightness with `uAttuned`, as the sky
  does.
- The field carries no meaning: nothing about a bead's outcome, faculty or
  facet reaches it; only its position and its light.

### One pass for all screen effects

- The composer's children are `<FocusFogPass />`, then `<Bloom />`, then any
  non-convolution effects, in that order; a source scan in the tests proves
  no `Pass` child follows the fog slot and nothing convolution follows bloom.
- The header of `Effects.tsx` states the rule and why (the r3f composer
  merges consecutive non-convolution effects into one pass; a `Pass` or a
  convolution effect costs a full-screen draw).
- The frame's full-screen work stays: render, the fog (while active), bloom's
  luminance and mipmap passes, and one effect pass.

## Out of scope

- Any audio change; the conductor's API; the bed.
- A vignette, chromatic pulse, grain pass, film grain or any other new
  screen effect; those come as non-convolution effects under the rule, later.
- Changes to the star field, the vault's gradient colours, the fog, or the
  glass.
- DPR changes; MSAA; a new render target.
- Attunement's material and sky changes (a separate decision).

## Constraints

- No new full-screen pass; no new render target; no new dependency; no
  change to `package.json`, CI or the steering scripts.
- CAV-007: no luminance flicker above 3 Hz anywhere; the dither is static;
  the ring brightens a particle once per ring.
- §6: nothing flickers; reduced motion keeps the same information without
  travel; §22: reduced bloom keeps the field and the dither.
- Law 8: the field answers only real light on a bead; nothing pulses for
  decoration; the drift is slow and meaningless by design and says so in a
  comment.
- No React state per frame; every `frameState.` read inside `useFrame`; no
  allocation per frame.
- Determinism: positions from the seeded random; the ring from the kindling
  lane, which is deterministic in test mode.
- The first load: the dust component is part of the scene chunk; if the
  first load crosses the ceiling, the field's module loads lazily like the
  fog's pass.

## Acceptance criteria

1. Bloom's `EffectPass` renders with dithering on, re-applied after a tier
   change; a unit test over a fake composer proves both.
2. The band count along a vertical line through the vault at least doubles
   with the dither on, recorded in the notes with the method; the rest-frame
   browser spec passes unchanged.
3. `SceneBudget.dust` is 600 / 300 / 0; the field is not mounted on potato;
   the quality tests pin it.
4. The dust component is one `points` draw with the uniforms above, writes
   its bead uniforms inside `useFrame` without allocation, and its shader
   has no time term faster than the comfort bound; a source scan proves the
   `useFrame` rule and a pure helper test proves the onset clock (rises on
   a kindling edge above 0.5, ends after the ring's life, never restarts
   while travelling).
5. Under reduced motion the drift is zero and the ring does not push; a
   pure helper test proves both.
6. The source scan for one pass: no `Pass` after the fog slot, nothing
   convolution after bloom; the header states the rule.
7. Every existing browser test passes without a changed expectation; the
   performance reference is recorded beside M4-001's; the first load is
   within the ceilings.
8. This packet's notes record the band counts, the field's rest brightness
   relative to the stars, and any proposal the work raised.

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

Report every check, including any that could not run and the exact reason.

## Expected completion report

- The branch and the pull request.
- The dither as shipped (hash or interleaved gradient) and the band counts.
- The field's counts, rest brightness, ring speed and life.
- The performance reference beside M4-001's and the first-load bytes.
- Every check with its result.
- The director's open questions for the screen session: whether the void
  reads as depth; whether the dust reads as air or as noise; whether a ring
  reads as the bead's sound reaching the room.

## Human review boundary

### Declared categories

- `audiovisual-quality`
- `accessibility-interaction`

Human review is required before merge because the point is the look. The
director must judge on a real display, at each tier and under reduced
motion: that the void reads as continuous depth; that the dust is air, not
noise, and never draws the eye from the beads; that a ring reads as a sound
reaching the room and never as an effect; and that the frame rate on the
device pass did not move. Automated checks prove the pass count, the bounds
and the determinism; they cannot establish beauty.

## Implementation notes

- Accepted for live testing and merged in PR #71 on 2026-10-01, retargeted
  to `main` after #67 merged and updated with M4-002's merge, on the
  director's instruction to merge the polish track and test everything new
  live. The `main` merge commit `79e9953` runs Quality Gates as run
  `36837313231`, and the Pages deployment that follows it is the first to
  carry M4-002 and M4-003 together. The human review
  boundary is not closed by the merge: the screen session's questions below
  stand.

- Directly assigned on 2026-09-30 under the director's mandate to go on with
  the polish track autonomously, as Bundle C of the polish assessment: the
  surface, built while the bed grows in M4-002. No product decision is
  needed: CAV-007, §6, §21 and §22 already bound it.
- Built the same night on `codex/M4-003-surface`, stacked on the design
  branch that carries this packet (#67); its pull request is retargeted to
  `main` once that merges.
- Dither (`src/scene/dither.ts`, `Effects.tsx`): `ditherLastPass(passes)`
  switches `dithering` on for the last pass that has it and writes only when
  the flag is off, because the setter recompiles the material; a
  `DitherDriver` calls it every frame before the composer renders, so a
  rebuild from a tier, camera or reduced-motion change is dithered before it
  reaches the screen, at the cost of one property read per frame. The hash
  dither shipped (three's own, static per pixel, ±0.5 of a step); the
  interleaved-gradient effect was not needed. The composer's header states
  the one-pass rule and `effectsOrder.test.ts` scans it: the fog slot, then
  bloom, then only effects proven non-convolution against postprocessing's
  own classes; nothing named a pass after the fog slot.
- Banding, measured on SwiftShader at 1280×720, base tier, reduced motion,
  the golden seed, a vertical line at x = 128 from y = 36 to 684
  (`tests/browser/surface.spec.ts`, not in the CI set). The luma count the
  packet asked for cannot tell banded from dithered here: the line crosses
  the vault's drawn courses and carries 47 to 48 distinct luma values either
  way, and three's dither moves red and blue against green, so rounded luma
  barely changes. What does move: distinct colours 164 → 243, colour changes
  184 → 452, the longest single-colour run 34 px → 7 px, runs of 8 px or
  more 15 → 0. The spec asserts the longest run is at most 16 px, which
  fails with the dither off and passes with it on. Acceptance criterion 2 is
  met on the measures that can see the dither, not on the luma count as
  written; a real display still needs the director's look.
- The dust field (`src/scene/dust.ts`, `src/scene/Dust.tsx`): one `points`
  draw, `SceneBudget.dust` 600 / 300 / 0, mounted after the sky; positions
  from a fixed seed, uniform in radius through the shell so a bead's ring
  has about eight motes to light at base and sixteen at high (uniform in
  volume left about 2.6, invisible); the base field is the first half of
  the high field. Uniforms: the dilated clock, the time scale (which scales
  the drift's amplitude, so the air settles as time slows), the sky's
  attuned ease (moved into `skyAttunement.ts` and shared, the sky's
  behaviour unchanged), motion, twenty-four bead slots (rendered xyz and the
  ring's age) and the kindling lane, written each frame inside `useFrame`
  without allocation. The ring: starts when a bead's kindling rises strictly
  above 0.5, speed 3 units/s, band 0.9, life 1.6 s, a 0.25 s rise and a
  squared fade (the linear fade cut faint motes at the ring's edge in about
  0.1 s, a 10 Hz pulse; with the square every pulse above one 8-bit step
  stays under 3 Hz, worst 2.7), push 0.12 scaled by motion; the ring's
  strength does not read the light's value (a product with the light could
  flicker), the light only starts the clock. Drift period 40 s, amplitude
  0.08, zero under reduced motion. Alpha 0.05 at rest (the faintest field
  star peaks at 0.24), at most 0.35 in a ring (under the brightest field
  star's 0.37), and Attunement adds 0.15 — a rest level of 0.20 in full
  Attunement, above the faintest attuned stars (0.13), for the director's
  eye. About 145 motes are visible in the base rest frame at roughly a
  pixel each, about +21 8-bit luma over a background of about 15. The dust
  is also drawn in the glass's backdrop pass, so it is two draw calls on
  high and base; no new pass, no new target. The rest-frame centroid is
  unmoved (1440×810: 0.428 → 0.431, 0.500; 1280×720: 0.417, 0.499 → 0.500).
- Load: first load 513,709 bytes gzip and 1,710,111 raw against the
  ceilings, from 512,123 and 1,705,551.
- Checks in the cloud container, on the integrated head: `npm ci` was run
  by the stage and the lockfile is unchanged; typecheck (app and Playwright
  configs), lint, `npm test` 2,134 passed in 133 files, `validate:content`,
  build, `bundle:check`, `steering:check` and `git diff --check` pass. The CI
  browser set on a quiet software renderer passed 17 of 18 in 3.1 minutes:
  the Studies passage test timed out waiting for the first sigil's focus
  after a keyboard lock (its wait is 15 s and the frame rate here is a few
  per second); it passed in the stage's own run of the same set, and passed
  again alone with the three other Studies tests in 31 s. It is recorded as
  a timing sensitivity of the software renderer to watch on CI, not as a
  defect of the surface. The rest-frame spec passed at both viewports and
  the banding spec passed with the counts above. Performance reference
  (SwiftShader, same container, quiet, effective frames per second,
  evidence only per M0-005): mobile-potato idle 8.61 and focus 5.41, against
  M4-001's 6.45 and 4.57 the same day (potato has no dust); desktop-base
  2.65 idle, and the desktop focus profile misses the container's frame
  floor, as on main.
- For the screen session: does the void read as depth; is the dust air or
  noise; does a ring read as the bead's sound reaching the room; the dust's
  rest level under Attunement.
