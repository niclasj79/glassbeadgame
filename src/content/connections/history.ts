/**
 * Curated connections filed under history (lexicographically-first of each
 * pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const historyConnections: CuratedConnection[] = [
  // ── history × philosophy ────────────────────────────────────────────────
  {
    id: "hist.revolution+phil.dialectics",
    pair: ["hist.revolution", "phil.dialectics"],
    title: "History's Engine",
    insight:
      "Marx claimed to stand Hegel's dialectic on its feet: contradiction still drives development, but the contending terms are classes, not concepts. The Communist Manifesto appeared in February 1848, weeks before revolutions swept Europe — theory and upheaval arriving almost on the same mail coach.",
    tier: 2,
  },
  {
    id: "hist.human-rights+phil.ethics",
    pair: ["hist.human-rights", "phil.ethics"],
    title: "The Categorical Declaration",
    insight:
      "Kant's 1785 formula — treat humanity never merely as a means but always as an end — waited a century and a half for its treaty. The 1948 Universal Declaration opens with 'the inherent dignity of all members of the human family': a philosopher's imperative, countersigned by states still ash-stained from disregarding it.",
    tier: 2,
  },

  // ── history × mathematics ───────────────────────────────────────────────
  {
    id: "hist.democracy+math.statistics",
    pair: ["hist.democracy", "math.statistics"],
    title: "The Average Citizen",
    insight:
      "In 1835 Quetelet invented l'homme moyen — the average man — and taught states to see their peoples as distributions. Census, poll, and margin of error followed: modern democracy governs partly by arithmetic, a body politic that knows itself through its own statistics.",
    tier: 1,
  },

  // ── history × music ─────────────────────────────────────────────────────
  {
    id: "hist.enlightenment+music.musical-form",
    pair: ["hist.enlightenment", "music.musical-form"],
    title: "The Sonata of Reason",
    insight:
      "Sonata form crystallized in the same decades as the Encyclopédie, and it argues like the age that made it: themes exposed, sent through development's trials, and recapitulated in a higher agreement. Charles Rosen read Haydn's wit and Mozart's balance as Enlightenment rhetoric in sound — persuasion by form.",
    tier: 1,
  },
];
