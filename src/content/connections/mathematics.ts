/**
 * Curated connections filed under mathematics (lexicographically-first of
 * each pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const mathematicsConnections: CuratedConnection[] = [
  // ── mathematics × music ─────────────────────────────────────────────────
  {
    id: "math.fibonacci-sequence+music.counterpoint",
    pair: ["math.fibonacci-sequence", "music.counterpoint"],
    title: "The Spiral Canon",
    insight:
      "Bartók shaped the first movement of his Music for Strings, Percussion and Celesta around Fibonacci proportions, placing its climax near the golden section of its 89 bars. A fugue grows the way a spiral does: each voice enters displaced by a fixed proportion of what came before, self-similar at every scale.",
    tier: 3,
  },
  {
    id: "math.golden-ratio+music.musical-form",
    pair: ["math.golden-ratio", "music.musical-form"],
    title: "The Hidden Architecture",
    insight:
      "Roy Howat's study Debussy in Proportion showed that the climaxes of La Mer fall at golden-section points of its length, bar counts dividing like a nautilus shell. Whether by instinct or design, large musical forms keep gravitating toward the same asymmetric balance the eye finds in a well-cut canvas.",
    tier: 2,
  },
  {
    id: "math.infinite-series+music.overtones",
    pair: ["math.infinite-series", "music.overtones"],
    title: "Nature's Own Chord",
    insight:
      "Every sustained tone carries an infinite ladder of overtones at 2, 3, 4 times its frequency, their strengths converging like the terms of a series. The single note is already a sum: what a cellist calls warmth is the audible tail of an infinite expansion.",
    tier: 2,
  },
  {
    id: "math.prime-numbers+music.polyrhythm",
    pair: ["math.prime-numbers", "music.polyrhythm"],
    title: "Indivisible Rhythms",
    insight:
      "In the Quartet for the End of Time, Messiaen runs a 17-value rhythm against a 29-chord cycle — both prime, so the pattern cannot realign for thousands of beats. Primes are how a composer buys eternity: no common divisor, no return, time opened rather than looped.",
    tier: 3,
  },
  {
    id: "math.abstract-algebra+music.modulation",
    pair: ["math.abstract-algebra", "music.modulation"],
    title: "The Group of Keys",
    insight:
      "Neo-Riemannian theory treats chord moves as operations in a group: the P, L and R transformations generate a structure of order 24, one element per major and minor triad. A modulation is not a leap into the void but a walk along a lattice whose symmetries algebra had already mapped.",
    tier: 2,
  },
  {
    id: "math.calculus+music.dynamics",
    pair: ["math.calculus", "music.dynamics"],
    title: "The Shape of a Swell",
    insight:
      "What the ear reads in a crescendo is not loudness but its rate of change — a derivative made audible. And by the Weber–Fechner law, sensation tracks the logarithm of intensity, so a crescendo that feels even must grow exponentially in energy: performers integrate without knowing it.",
    tier: 1,
  },

  // ── mathematics × philosophy ────────────────────────────────────────────
  {
    id: "math.set-theory+phil.existence",
    pair: ["math.set-theory", "phil.existence"],
    title: "Cantor's Paradise",
    insight:
      "Cantor proved some infinities outweigh others, then spent years defending the theology of it, corresponding with Vatican scholars about the Absolute Infinite beyond all sets. Mathematics had trespassed on metaphysics — and refused to retreat.",
    tier: 3,
    quote: {
      text: "No one shall expel us from the paradise that Cantor has created for us.",
      source: "David Hilbert, 1926",
    },
  },
  {
    id: "math.geometry+phil.knowledge",
    pair: ["math.geometry", "phil.knowledge"],
    title: "The Slave Boy's Square",
    insight:
      "In Plato's Meno, Socrates draws figures in the sand until an untaught boy doubles the area of a square by himself. Geometry became philosophy's first laboratory: proof that some knowledge seems to be in us already, waiting for the right question.",
    tier: 3,
  },
  {
    id: "math.probability+phil.free-will",
    pair: ["math.probability", "phil.free-will"],
    title: "The Swerve",
    insight:
      "Epicurus gave atoms a random swerve — the clinamen — precisely to make room for freedom in a mechanical world. Twenty-three centuries later the debate is unchanged in form: quantum dice may break determinism, but randomness is not yet agency, and the gap between chance and choice remains philosophy's to mind.",
    tier: 2,
  },
  {
    id: "math.chaos-theory+phil.reality",
    pair: ["math.chaos-theory", "phil.reality"],
    title: "Deterministic yet Unknowable",
    insight:
      "Studying the three-body problem in 1890, Poincaré found orbits that obey exact laws yet defy all prediction — sensitivity to initial conditions no measurement can outrun. Laplace's demon died there: reality can be fully determined and still permanently surprising.",
    tier: 2,
  },
  {
    id: "math.infinite-series+phil.metaphysics",
    pair: ["math.infinite-series", "phil.metaphysics"],
    title: "Zeno's Convergence",
    insight:
      "Achilles catches the tortoise because ½ + ¼ + ⅛ + … sums to one: the paradox dissolves in a convergent series. Yet the metaphysical sting remains — whether an infinity of acts can ever be completed is still argued under the name of supertasks, twenty-four centuries after Elea.",
    tier: 2,
  },

  // ── mathematics × physics ───────────────────────────────────────────────
  {
    id: "math.abstract-algebra+phys.energy-conservation",
    pair: ["math.abstract-algebra", "phys.energy-conservation"],
    title: "Noether's Mirror",
    insight:
      "Emmy Noether proved in 1918 that every continuous symmetry hides a conservation law: because physics is the same today as tomorrow, energy is conserved; because space has no preferred place, momentum is. The bookkeeping of the universe turns out to be the shadow of its symmetries.",
    tier: 3,
  },
  {
    id: "math.geometry+phys.gravity",
    pair: ["math.geometry", "phys.gravity"],
    title: "Gravity as Geometry",
    insight:
      "Einstein abolished the force of gravity and replaced it with curvature: planets fall along the straightest possible lines in a bent spacetime. What Euclid studied as ideal form became, in 1915, the physical substance of the cosmos.",
    tier: 3,
    quote: {
      text: "Spacetime tells matter how to move; matter tells spacetime how to curve.",
      source: "John Archibald Wheeler",
    },
  },
  {
    id: "math.statistics+phys.thermodynamics",
    pair: ["math.statistics", "phys.thermodynamics"],
    title: "Boltzmann's Wager",
    insight:
      "S = k log W is carved on Boltzmann's grave in Vienna: entropy is the count of microscopic arrangements behind one macroscopic fact. Heat became statistics — the second law is not a decree but the overwhelming arithmetic of the probable.",
    tier: 3,
  },
  {
    id: "math.topology+phys.string-theory",
    pair: ["math.topology", "phys.string-theory"],
    title: "The Shape of Hidden Dimensions",
    insight:
      "In string theory the six unseen dimensions curl into Calabi–Yau spaces, and their topology — literally the number and kind of holes — fixes which particle families can exist. Physics at its smallest becomes a question a topologist would ask: not how big, but how connected.",
    tier: 2,
  },

  // ── mathematics intra ───────────────────────────────────────────────────
  {
    id: "math.fibonacci-sequence+math.golden-ratio",
    pair: ["math.fibonacci-sequence", "math.golden-ratio"],
    title: "Asymptote of Growth",
    insight:
      "Divide each Fibonacci number by the one before — 3/2, 5/3, 8/5, 13/8 — and the ratios close in on φ forever without arriving; Kepler already saw it in 1611. Discrete growth chases continuous proportion: the sequence is arithmetic yearning toward an ideal it can only approximate.",
    tier: 2,
  },
];
