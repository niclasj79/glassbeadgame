/**
 * Curated connections filed under philosophy (lexicographically-first of
 * each pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const philosophyConnections: CuratedConnection[] = [
  // ── philosophy × physics ────────────────────────────────────────────────
  {
    id: "phil.dialectics+phys.wave-particle-duality",
    pair: ["phil.dialectics", "phys.wave-particle-duality"],
    title: "Contraria Sunt Complementa",
    insight:
      "When Niels Bohr was knighted he put the yin-yang on his coat of arms with the motto 'opposites are complementary.' His complementarity principle is dialectics made physical: wave and particle are thesis and antithesis, and the experiment itself is the synthesis that decides which face reality shows.",
    tier: 3,
    quote: { text: "Contraria sunt complementa.", source: "Niels Bohr's coat of arms, 1947" },
  },
  {
    id: "phil.epistemology+phys.quantum-entanglement",
    pair: ["phil.epistemology", "phys.quantum-entanglement"],
    title: "Spooky Knowledge",
    insight:
      "Einstein dismissed entanglement as 'spooky action at a distance' in 1935; in 1964 John Bell turned the dispute into an inequality an apparatus could test. Clauser, Aspect and Zeilinger ran the test and won the 2022 Nobel Prize — a question about the limits of knowledge, settled by counting photons.",
    tier: 3,
  },
  {
    id: "phil.phenomenology+phys.relativity",
    pair: ["phil.phenomenology", "phys.relativity"],
    title: "The View from Somewhere",
    insight:
      "Relativity abolished the view from nowhere: simultaneity itself depends on the observer's frame, and no measurement escapes a standpoint. Physics arrived by calculation where Husserl's phenomenology arrived by description — experience is always from somewhere, and the somewhere matters.",
    tier: 2,
  },
  {
    id: "phil.ontology+phys.dark-matter",
    pair: ["phil.ontology", "phys.dark-matter"],
    title: "The Being of the Unseen",
    insight:
      "Most of the universe's matter is known only as gravitational absence — galaxies spin too fast for what we can see. Like Neptune, posited from Uranus's wobble before any telescope found it, dark matter is ontology practiced with instruments: existence claimed to save the phenomena.",
    tier: 2,
  },
  {
    id: "phil.metaphysics+phys.string-theory",
    pair: ["phil.metaphysics", "phys.string-theory"],
    title: "Physics at the Edge of Testability",
    insight:
      "Popper drew the border between science and metaphysics at falsifiability in 1934; string theory, mathematically fertile and experimentally silent for half a century, camps directly on the line. In 2014 George Ellis and Joe Silk warned in Nature against drifting into post-empirical physics, while defenders reply that consistency with all we know is itself a stringent test. The demarcation problem is no longer philosophy's alone.",
    tier: 2,
  },
  {
    id: "phil.truth+phys.relativity",
    pair: ["phil.truth", "phys.relativity"],
    title: "Invariance, Not Relativism",
    insight:
      "Einstein came to dislike the name, musing in a 1921 letter that 'Invariantentheorie' might have been better: the theory's real content is what does not depend on the observer — the speed of light, the spacetime interval, the laws themselves. Relativity does not dissolve truth into viewpoints; it defines truth as what survives every change of viewpoint. Minkowski had built the geometry from exactly those invariants in 1908.",
    tier: 3,
  },
  {
    id: "phil.existence+phys.cosmology",
    pair: ["phil.existence", "phys.cosmology"],
    title: "Leibniz's Question at the Telescope",
    insight:
      "Leibniz posed it in 1714: why is there something rather than nothing? Cosmology has traced the something back 13.8 billion years to Lemaître's 'primeval atom' — proposed in 1931 by a priest reading the universe's expansion backwards — but a first moment is a history, not a reason. Even a universe born from the quantum vacuum starts from laws, and laws are not nothing.",
    tier: 3,
  },
  {
    id: "phil.knowledge+phys.thermodynamics",
    pair: ["phil.knowledge", "phys.thermodynamics"],
    title: "The Cost of Knowing",
    insight:
      "Maxwell imagined a demon in 1867 that sorts fast molecules from slow, beating entropy with pure attentiveness. It took a century to exorcise: Szilard tied the trick to information in 1929, and Landauer proved in 1961 that erasing one bit of memory costs an irreducible kT ln 2 of heat. The demon fails not at seeing but at forgetting — knowledge is a physical commodity with a thermodynamic price.",
    tier: 3,
    quote: {
      text: "Information is physical.",
      source: "Rolf Landauer",
    },
  },
  {
    id: "phil.ethics+phys.nuclear-forces",
    pair: ["phil.ethics", "phys.nuclear-forces"],
    title: "The Physicists Have Known Sin",
    insight:
      "Watching the Trinity fireball on July 16, 1945, Oppenheimer recalled a line from the Bhagavad Gita; by 1947 he was telling an MIT audience that 'the physicists have known sin.' Unbinding the nucleus turned an equation into a moral agent — and ethics, once the philosopher's province, became a working condition of physics, written into oaths, treaties, and the conscience of a discipline.",
    tier: 3,
    quote: {
      text: "Now I am become Death, the destroyer of worlds.",
      source: "J. Robert Oppenheimer, recalling the Bhagavad Gita at Trinity, 1945",
    },
  },
  {
    id: "phil.phenomenology+phys.optics",
    pair: ["phil.phenomenology", "phys.optics"],
    title: "Goethe's Quarrel with Newton",
    insight:
      "Goethe's Theory of Colours (1810) failed as physics — his lifelong campaign against Newton's prism convinced no one who measured. But its catalogue of afterimages, colored shadows, and edge phenomena is a masterwork about something optics does not address: how color is lived. A wavelength is not a seeing; phenomenology later made Goethe's side of the quarrel into a method.",
    tier: 2,
  },
  {
    id: "phil.ontology+phys.energy-conservation",
    pair: ["phil.ontology", "phys.energy-conservation"],
    title: "Nothing Comes from Nothing",
    insight:
      "Parmenides ruled that being cannot arise from non-being, and Lucretius versified it for Rome: nothing is ever created from nothing. The ancient instinct became measurable in the 1840s, when Joule's paddle wheel and Helmholtz's 1847 memoir established that energy is only ever transformed. Ontology's oldest principle survives as the first law of thermodynamics — a conservation ledger for being itself.",
    tier: 2,
  },

  // ── philosophy intra ────────────────────────────────────────────────────
  {
    id: "phil.beauty+phil.truth",
    pair: ["phil.beauty", "phil.truth"],
    title: "Keats's Equation",
    insight:
      "Keats closed his Grecian Urn with an equation philosophers still argue about — and physicists half-believe. Dirac insisted that beauty in an equation mattered more than fit with experiment, and the neutrino, antimatter, and gauge symmetry were all found by trusting elegance first.",
    tier: 3,
    quote: {
      text: "Beauty is truth, truth beauty, — that is all / Ye know on earth, and all ye need to know.",
      source: "John Keats, Ode on a Grecian Urn",
    },
  },
  {
    id: "phil.consciousness+phil.free-will",
    pair: ["phil.consciousness", "phil.free-will"],
    title: "The Brain's Head Start",
    insight:
      "In 1983 Benjamin Libet measured a readiness potential rising in motor cortex about a third of a second before subjects reported deciding to move — as if the act begins and consciousness countersigns. Libet himself preserved a veto for the will, and Aaron Schurger's 2012 model rereads the buildup as drifting neural noise rather than a decision already made. The data stand; what they prove about freedom is still an open verdict.",
    tier: 2,
  },
  {
    id: "phil.knowledge+phil.truth",
    pair: ["phil.knowledge", "phil.truth"],
    title: "Three Pages Against Plato",
    insight:
      "From Plato's Theaetetus onward, knowledge was analyzed as justified true belief. In 1963 Edmund Gettier published three pages in Analysis containing two counterexamples — justified true beliefs that are plainly not knowledge, truths held by luck — and the analysis of two millennia collapsed. Epistemology has been rebuilding on the rubble ever since, with no repair yet agreed.",
    tier: 2,
  },
  {
    id: "phil.justice+phil.knowledge",
    pair: ["phil.justice", "phil.knowledge"],
    title: "The Veil of Ignorance",
    insight:
      "Rawls's A Theory of Justice (1971) selects principles from behind a veil of ignorance: design society without knowing your talents, class, or conception of the good, and self-interest is conscripted into impartiality. It is engineered unknowing as moral method — the less you know about which life will be yours, the more fairly you must weigh them all.",
    tier: 2,
  },
];
