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
];
