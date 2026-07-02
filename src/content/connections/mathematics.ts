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
  {
    id: "math.graph-theory+music.consonance",
    pair: ["math.graph-theory", "music.consonance"],
    title: "Euler's Net of Tones",
    insight:
      "Three years after the Königsberg bridges founded graph theory, Euler drew the Tonnetz in his Tentamen novae theoriae musicae (1739): pitches as nodes, consonant fifths and thirds as edges. Consonance became a position in a network — near means restful, far means strange — and neo-Riemannian theorists still navigate by his map.",
    tier: 2,
  },
  {
    id: "math.prime-numbers+music.modulation",
    pair: ["math.prime-numbers", "music.modulation"],
    title: "The Comma and the Compromise",
    insight:
      "Stack twelve pure fifths and you overshoot seven octaves — the Pythagorean comma — because no power of 3 can ever equal a power of 2: unique prime factorization forbids the circle from closing. Equal temperament is the negotiated peace, slicing the octave into twelve equal irrationals of 2^(1/12), first computed by Zhu Zaiyu in 1584, so that music may modulate anywhere.",
    tier: 3,
  },
  {
    id: "math.number-theory+music.harmonic-resonance",
    pair: ["math.number-theory", "music.harmonic-resonance"],
    title: "Counting Without Knowing",
    insight:
      "Leibniz confided it to Goldbach — the same Goldbach whose conjecture still haunts number theory: consonance is unconscious arithmetic, the soul comparing vibration counts it never sees. Psychoacoustics has largely sided with him — the ear resolves frequency ratios before awareness arrives, and simple ratios are what effortless counting feels like.",
    tier: 2,
    quote: {
      text: "Music is a hidden arithmetic exercise of the soul, which does not know that it is counting.",
      source: "Gottfried Leibniz, letter to Christian Goldbach, 1712",
    },
  },
  {
    id: "math.abstract-algebra+music.rhythm-patterns",
    pair: ["math.abstract-algebra", "music.rhythm-patterns"],
    title: "Group Theory in the Belfry",
    insight:
      "English bellringers set themselves the task of ringing every ordering of their bells exactly once — 5,040 changes on seven bells — under rules Fabian Stedman codified in Campanalogia (1677). They were composing with permutation groups two centuries before algebra named them; mathematicians later recognized a full extent as a Hamiltonian path through a Cayley graph.",
    tier: 2,
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
  {
    id: "math.number-theory+phil.truth",
    pair: ["math.number-theory", "phil.truth"],
    title: "Truth Outruns Proof",
    insight:
      "Gödel's 1931 construction taught arithmetic to talk about itself: statements coded as numbers, until one sentence says, in effect, 'I am unprovable.' If the system is consistent, that sentence is true precisely because it cannot be proved — so no consistent formal system rich enough for arithmetic can prove every truth of arithmetic. Hilbert's dream of completeness ended in a theorem.",
    tier: 3,
  },
  {
    id: "math.probability+phil.knowledge",
    pair: ["math.probability", "phil.knowledge"],
    title: "Betting Where Proof Ends",
    insight:
      "In 1654 Pascal and Fermat invented probability to settle a gambling dispute; in the Pensées, Pascal aimed the new instrument at the largest unknown of all. The wager concedes that reason cannot decide whether God exists and computes expected outcomes instead — the founding move of decision theory: where knowledge gives out, weigh the uncertainty and act anyway.",
    tier: 2,
  },
  {
    id: "math.set-theory+phil.ontology",
    pair: ["math.set-theory", "phil.ontology"],
    title: "The Set That Cannot Exist",
    insight:
      "In 1902 Russell wrote to Frege about the set of all sets that are not members of themselves: if it contains itself it must not, and if it does not it must. Frege, whose life's work on the foundations was in press, appended a devastated postscript. Ontology learned its sharpest modern lesson from mathematics: not every description you can write down names a thing that can be.",
    tier: 3,
  },
  {
    id: "math.calculus+phil.metaphysics",
    pair: ["math.calculus", "phil.metaphysics"],
    title: "Ghosts of Departed Quantities",
    insight:
      "Bishop Berkeley's The Analyst (1734) charged that infinitesimals — quantities neither finite nor zero — were worse metaphysics than the theology mathematicians mocked. The taunt stood for more than a century until epsilon and delta banished the infinitely small; then Abraham Robinson's nonstandard analysis (1966) resurrected the ghosts as rigorous citizens after all.",
    tier: 2,
    quote: {
      text: "May we not call them the ghosts of departed quantities?",
      source: "George Berkeley, The Analyst, 1734",
    },
  },
  {
    id: "math.probability+phil.meaning",
    pair: ["math.probability", "phil.meaning"],
    title: "The Library of Babel",
    insight:
      "Borges's 1941 library shelves every possible 410-page book — all truths, all refutations, and oceans of gibberish, since almost every random string says nothing. Shannon made the moral precise in 1948: information is improbability. A library of everything is a library of nothing; meaning is not generated by possibility but selected from it, one improbable book at a time.",
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
  {
    id: "math.calculus+phys.momentum",
    pair: ["math.calculus", "phys.momentum"],
    title: "Motion's Native Tongue",
    insight:
      "Calculus was not applied to mechanics; it was forged for it. Newton worked out fluxions in the plague years 1665–66 to handle continuously changing motion, and the Principia's second law makes force the rate of change of the 'quantity of motion' — momentum's derivative. Physics has spoken that language ever since: nature legislates in rates of change.",
    tier: 3,
  },
  {
    id: "math.infinite-series+phys.optics",
    pair: ["math.infinite-series", "phys.optics"],
    title: "The Spectrum as a Sum",
    insight:
      "Fourier's 1822 heat treatise claimed any waveform is a sum of pure sine waves — an infinite series with physical standing. Optics ratified him: a prism performs the decomposition on sunlight, a spectroscope reads off the terms, and in the far field a diffraction pattern is literally the Fourier transform of the aperture that cast it. Analysis became visible.",
    tier: 2,
  },
  {
    id: "math.statistics+phys.particle-physics",
    pair: ["math.statistics", "phys.particle-physics"],
    title: "Five Sigma",
    insight:
      "CERN announced the Higgs boson on July 4, 2012 only when ATLAS and CMS each crossed five sigma — roughly one chance in 3.5 million that background alone would fake so strong a signal. At the smallest scales, existence itself is a statistical verdict: a particle counts as discovered when the null hypothesis becomes untenable. Discovery has a p-value.",
    tier: 2,
  },
  {
    id: "math.geometry+phys.cosmology",
    pair: ["math.geometry", "phys.cosmology"],
    title: "Euclid's Postulate, Measured",
    insight:
      "Whether the universe's triangles hold 180 degrees is not an axiom but a measurement. The cosmic microwave background supplies a yardstick of known size — the sound horizon frozen at recombination — and its apparent angular width told the Planck mission that space is flat to within about half a percent. Euclid's geometry, optional in principle, happens to be the one the cosmos chose.",
    tier: 2,
  },
  {
    id: "math.probability+phys.wave-particle-duality",
    pair: ["math.probability", "phys.wave-particle-duality"],
    title: "Born's Footnote",
    insight:
      "In 1926 Max Born proposed that Schrödinger's wave carries no substance at all — it is a wave of probability, and where the particle lands is drawn from its square. The decisive squaring entered as a footnote added in proof, and earned a Nobel Prize twenty-eight years later. Chance stopped being ignorance of hidden detail and moved into the foundations of matter.",
    tier: 3,
  },
  {
    id: "math.fractals+phys.fluid-dynamics",
    pair: ["math.fractals", "phys.fluid-dynamics"],
    title: "Whirls upon Whirls",
    insight:
      "Lewis Fry Richardson caught turbulence in rhyme in 1922 — big whirls feed little whirls, 'and so on to viscosity.' Kolmogorov made the verse quantitative in 1941: energy cascades down a hierarchy of eddies with a universal spectrum, self-similar across scales. Turbulence is a fractal in motion, which is why no close-up of churning water betrays its true size.",
    tier: 2,
  },
  {
    id: "math.prime-numbers+phys.nuclear-forces",
    pair: ["math.prime-numbers", "phys.nuclear-forces"],
    title: "The Nuclear Rhythm of the Primes",
    insight:
      "Over tea at the Institute for Advanced Study in 1972, Freeman Dyson recognized Hugh Montgomery's formula for the spacing of the Riemann zeta zeros — the hidden metronome of the primes — as the eigenvalue statistics of random matrices, which Wigner had introduced to model energy levels of heavy nuclei. Why the primes should vibrate like a uranium nucleus, no one has yet explained.",
    tier: 3,
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
  {
    id: "math.calculus+math.infinite-series",
    pair: ["math.calculus", "math.infinite-series"],
    title: "The Series Beneath the Calculus",
    insight:
      "A derivative is a limit and an integral is a sum: calculus is infinite series wearing working clothes. Madhava of Kerala summed series for sine and π around 1400, centuries before Newton computed with power series as fluently as with numbers, and Brook Taylor's 1715 theorem turned every smooth function into its own series. To calculate is to truncate wisely.",
    tier: 1,
  },
];
