# The Glass Bead Game

A contemplative game of connections, after Hermann Hesse's *Das Glasperlenspiel*.

Concepts from six disciplines — mathematics, music, philosophy, physics, art,
history — float as glass beads in a dark cosmos. You weave luminous threads
between them. When a pairing touches one of the game's **curated connections**
(hand-written insights with real intellectual substance: Bartók's Fibonacci
climaxes, Noether's theorem, Bohr's coat of arms…), time slows, the camera
leans in, a chord sounds, and the insight is yours — permanently, in your
**Codex**. Uncurated pairings still shimmer as *faint resonances*; nothing you
try is ever a dead end. Conclude when you're ready and receive an
**Annotation**: a written commentary composed from what you actually wove.

No accounts, no backend, no timers. Fully static, fully offline-capable.
Progress (codex, rank, settings) lives in your browser's localStorage.

## Play

- **Weave** — press a bead and drag its thread to another; or tap a bead,
  then tap another (touch). Escape cancels.
- **Orbit** — drag the void. Scroll to zoom.
- **The Lens** — rearranges your beads along the transcendental axes
  (True / Good / Beautiful). Contemplation only; weaving pauses.
- **Conclude the Game** — ends the session with a cinematic, the Annotation,
  and your rank progress: Novice → Student → Scholar → Lector → **Magister Ludi**.
- Motifs earn bonuses: a closed triangle (*Triad*), three disciplines in one
  web (*Symposium*), a five-bead chain (*Fugue*).

## Develop

```sh
npm ci                    # install exactly from package-lock.json
npm run typecheck         # tsc strict
npm run lint
npm test                  # deterministic Node characterization suite
npm run validate:content  # content gate without producing dist
npm run build             # production build; also runs the content gate
npx playwright install chromium  # first browser-test setup
npm run test:browser      # deterministic Chromium smoke
npm run bundle:check      # portable production-bundle regression gate
npm run measure:performance  # renderer-labelled frame reference report

npm run dev               # local server: http://localhost:8080
```

`measure:performance` writes ignored reports under `artifacts/performance/`; its frame rates are reference evidence, not a hardware-independent CI gate.

Pull requests run the same install and validation sequence in GitHub Actions.
The required branch-protection check is `Quality Gates`.

Stack: Vite · React 18 · TypeScript (strict) · three.js + @react-three/fiber
+ drei + postprocessing (threshold bloom is the art direction) · zustand ·
framer-motion · Tailwind · hand-rolled Web Audio (one shared pentatonic gamut,
so every chord the game can produce is consonant).

## Where things live

```
src/
  content/     the game IS this data — 90 concepts, curated connections,
               annotation fragments; validate.ts gates every build
  game/        session draw, rules/scoring/motifs, ranks, layout math
  state/       zustand store (persisted codex under localStorage "gbg.v1")
  scene/       R3F cosmos: beads, threads, camera rig, backdrop, effects,
               and threading.ts — the one pointer state machine
  audio/       engine, pitch theory, six timbre voices, generative ambient
  ui/          DOM screens + arena HUD over the persistent canvas
legacy/        the archived v1 (Lovable-generated) app — reference only
```

### For composers

All musical taste lives in one file: `src/audio/score.ts` — reverb size and
wetness, per-note humanization, the harmonic phrase cycle, the motif
ensemble's voices, shimmer, chime levels. Change numbers, save, and the dev
server re-tunes live; nothing there can break the engine. The pitch space is
C-major pentatonic across four octaves (everything is consonant by
construction) and six synthesized timbres map onto the six disciplines. To
introduce recorded samples later, `playVoice()` in `src/audio/voices.ts` is
the single place every note is born — swap a timbre's branch for an
`AudioBufferSourceNode` and the whole game plays your recordings.

### Adding a world theme

Sessions open into rotating **worlds** (Tetris Effect-style): each world is
one data file describing sky, light, particles, and musical temperament.

1. Add a `WorldTheme` to `src/themes/worlds.ts` (see `tide` or `ember` for
   the shape: nebulae, star palette, sparkles, fog, lattice color, bloom
   bias, faint-thread color, burst tints, and `music` — slot tempo, drone
   gain, motif bias, pad cutoff).
2. Register it in the `THEMES` array in `src/themes/index.ts`.

That's all — it immediately joins the per-session rotation and the daily
cycle. Everything themed (backdrop, fog, lattice, bloom, faint threads,
bursts, ambient tempo and darkness) reads from the registry; no scene or
audio code changes needed.

### Adding a curated connection

1. Pick two concept ids from `src/content/concepts.ts`.
2. Add an entry to the connections file of the *lexicographically first*
   discipline prefix (`art. < hist. < math. < music. < phil. < phys.`) in
   `src/content/connections/`.
3. Rules the validator enforces: `id` = sorted pair ids joined `+`; insight
   120–480 chars; title ≤ 60; no duplicate pairs. House style: 2–3 sentences,
   at least one concrete *true* mechanism, person, work, or date. No mush.
4. `npm run build` must pass.

## Notes

- The scene layer (`src/scene/`) is written to transfer into the Aethel
  3D knowledge-graph visualization (see the `tp-vrg` project's design docs) —
  beads, threads, camera rig, bloom recipe, and layout-morph are the kit.
- v1 remains intact under `legacy/` and in git history.
