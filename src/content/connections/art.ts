/**
 * Curated connections filed under art (lexicographically-first of each
 * pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const artConnections: CuratedConnection[] = [
  // ── art × mathematics ───────────────────────────────────────────────────
  {
    id: "art.composition+math.golden-ratio",
    pair: ["art.composition", "math.golden-ratio"],
    title: "The Sacrament of Proportion",
    insight:
      "Dalí painted The Sacrament of the Last Supper inside a golden rectangle, a great dodecahedron hovering over the table — deliberate geometry, worked out after his studies with the proportion theorist Matila Ghyka. Where most golden-ratio sightings in art are myth, here the mathematics is the composition.",
    tier: 2,
  },
  {
    id: "art.perspective+math.geometry",
    pair: ["art.perspective", "math.geometry"],
    title: "Brunelleschi's Window",
    insight:
      "Around 1420 Brunelleschi had viewers peer through a hole at a mirrored panel of the Florence Baptistery, proving painted space could obey optical law. Alberti then wrote the recipe: the canvas is a section cut through the pyramid of sight. Painting became applied geometry — and geometry gained a new laboratory.",
    tier: 3,
  },

  // ── art × music ─────────────────────────────────────────────────────────
  {
    id: "art.color-theory+music.timbre",
    pair: ["art.color-theory", "music.timbre"],
    title: "The Sound of Vermilion",
    insight:
      "Kandinsky heard his paintings: for him vermilion rang like a tuba, and light blue sounded like a flute. Timbre and color are the same phenomenon in different media — a spectrum of component frequencies fused by perception into a single, unmistakable quality.",
    tier: 2,
    quote: {
      text: "Color is the keyboard, the eyes are the hammers, the soul is the piano with many strings.",
      source: "Wassily Kandinsky, Concerning the Spiritual in Art",
    },
  },
  {
    id: "art.abstract-expression+music.musical-form",
    pair: ["art.abstract-expression", "music.musical-form"],
    title: "Painting Without Objects",
    insight:
      "When Kandinsky abandoned the depicted world he reached for music's vocabulary, titling his canvases Compositions and Improvisations. Music had always meant without picturing anything; abstraction was painting claiming that same right — form itself as the subject.",
    tier: 1,
  },

  // ── art × philosophy ────────────────────────────────────────────────────
  {
    id: "art.harmony+phil.beauty",
    pair: ["art.harmony", "phil.beauty"],
    title: "The Canon of Polykleitos",
    insight:
      "Polykleitos sculpted the Doryphoros as a demonstration of his written Canon: beauty as the commensurability of every part to every other. Galen preserved the doctrine — health and beauty alike as right proportion — making one statue the ancient world's most argued-with definition of the beautiful.",
    tier: 2,
  },
];
