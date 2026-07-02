/**
 * Curated connections filed under physics (lexicographically-first of each
 * pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const physicsConnections: CuratedConnection[] = [
  // ── physics intra ───────────────────────────────────────────────────────
  {
    id: "phys.quantum-entanglement+phys.wave-particle-duality",
    pair: ["phys.quantum-entanglement", "phys.wave-particle-duality"],
    title: "The Two Mysteries Are One",
    insight:
      "Feynman called the double slit 'the only mystery' of quantum mechanics — a particle interfering with its own possibilities. Entanglement is that same superposition shared between two particles, so measuring one silences the other's alternatives: duality socialized, one mystery wearing two masks.",
    tier: 2,
  },
  {
    id: "phys.cosmology+phys.thermodynamics",
    pair: ["phys.cosmology", "phys.thermodynamics"],
    title: "Time's Arrow",
    insight:
      "Eddington coined 'time's arrow' in 1927 for what the second law alone supplies: the fundamental equations barely notice time's direction, and only rising entropy tells the film which way to run. The direction is cosmology's gift — the Big Bang delivered a universe in a staggeringly improbable low-entropy state, and every clock, memory, and living cell has been spending that inheritance since.",
    tier: 3,
  },
];
