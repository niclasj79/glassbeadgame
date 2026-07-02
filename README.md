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
npm install
npm run dev        # http://localhost:8080
npm run build      # production build — also runs the content validator
npm run typecheck  # tsc strict
npm run lint
```

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
