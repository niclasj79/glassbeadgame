import type { WorldTheme } from "./types";

/**
 * THE FOUR WORLDS
 *
 * Each is the same room under a different lamp. They differ in what the metal
 * has oxidised toward, how saturated the ink is inside the glass, and how far
 * the darkness has been dyed — never in "theme colour". Nothing here is a hue
 * ramp; every value names a material the eye has seen before.
 */

/** The Order's own night — brass, indigo, vellum, gold leaf. */
export const castalia: WorldTheme = {
  id: "castalia",
  name: "Castalia",
  tagline: "the Order's night sky",
  palette: {
    ground: "#070912",
    depth: "#0d1226",
    horizon: "#1b2140",
    vellum: "#e6dcc2",
    brass: "#b08d4e",
    patina: "#5d6a58",
    gold: "#e7c069",
    engraving: "#9fadd0",
    rubric: "#a8492f",
    starlight: "#c9d6f2",
  },
  inkSaturation: 0.34,
  refraction: 1.52,
  fog: { color: "#070912", near: 16, far: 74 },
  bloomBias: 1,
  keyLight: [0.42, 0.78, 0.46],
  music: { slotSeconds: 2.0, droneGain: 0.14, motifBias: 1, padCutoff: 900 },
};

/** Beneath a sea of thought — verdigris, green glass, water-stained vellum. */
export const tide: WorldTheme = {
  id: "tide",
  name: "The Tide",
  tagline: "beneath a sea of thought",
  palette: {
    ground: "#04100f",
    depth: "#08201f",
    horizon: "#123334",
    vellum: "#dcdfc9",
    brass: "#8f9a6b",
    patina: "#416a62",
    gold: "#cfc072",
    engraving: "#8fbdb4",
    rubric: "#8a5236",
    starlight: "#bfe6de",
  },
  inkSaturation: 0.28,
  refraction: 1.47,
  fog: { color: "#04100f", near: 14, far: 66 },
  bloomBias: 1.05,
  keyLight: [-0.3, 0.86, 0.4],
  music: { slotSeconds: 2.4, droneGain: 0.15, motifBias: 0.85, padCutoff: 700 },
};

/** The forge of correspondences — hot metal, smoke-darkened parchment. */
export const ember: WorldTheme = {
  id: "ember",
  name: "The Forge",
  tagline: "where correspondences are hammered bright",
  palette: {
    ground: "#0d0806",
    depth: "#1a0f0a",
    horizon: "#33190f",
    vellum: "#e8d3ad",
    brass: "#c08540",
    patina: "#6b4a2c",
    gold: "#f0c063",
    engraving: "#c39272",
    rubric: "#b8452a",
    starlight: "#f0d5b4",
  },
  inkSaturation: 0.38,
  refraction: 1.66,
  fog: { color: "#0d0806", near: 15, far: 70 },
  bloomBias: 1.1,
  keyLight: [0.55, 0.6, 0.58],
  music: { slotSeconds: 1.8, droneGain: 0.16, motifBias: 1.15, padCutoff: 1050 },
};

/** Lights over the winter of knowledge — cold silver, frost on the glass. */
export const aurora: WorldTheme = {
  id: "aurora",
  name: "The Aurora",
  tagline: "lights over the winter of knowledge",
  palette: {
    ground: "#050b10",
    depth: "#0a1622",
    horizon: "#16283a",
    vellum: "#e2e7e4",
    brass: "#93a3a0",
    patina: "#4a6f6a",
    gold: "#d8d09a",
    engraving: "#a8c4cd",
    rubric: "#8c5a4a",
    starlight: "#dcefff",
  },
  inkSaturation: 0.3,
  refraction: 1.58,
  fog: { color: "#050b10", near: 16, far: 72 },
  bloomBias: 1.08,
  keyLight: [-0.42, 0.72, 0.55],
  music: { slotSeconds: 2.2, droneGain: 0.13, motifBias: 1, padCutoff: 980 },
};
