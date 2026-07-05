import type { WorldTheme } from "./types";

/** The Order's own night — the founding look of the rebuilt Game. */
export const castalia: WorldTheme = {
  id: "castalia",
  name: "Castalia",
  tagline: "the Order's night sky",
  nebulae: [
    "rgba(96,60,190,0.13)",
    "rgba(38,70,190,0.11)",
    "rgba(24,132,150,0.07)",
  ],
  starPalette: ["#cdd6ff", "#ffffff", "#ffe9d2", "#9fb4ff"],
  sparkles: { color: "#8ea8ff", opacity: 0.35, speed: 0.22 },
  fog: { color: "#06090f", near: 18, far: 90 },
  latticeColor: "#4a4c80",
  bloomBias: 1,
  faintThread: "#565a7d",
  burst: { color: "#a78bfa", secondary: "#ffe9b0" },
  music: { slotSeconds: 2.0, droneGain: 0.14, motifBias: 1, padCutoff: 900 },
};

/** Beneath a sea of thought — slow, green-blue, weightless. */
export const tide: WorldTheme = {
  id: "tide",
  name: "The Tide",
  tagline: "beneath a sea of thought",
  nebulae: [
    "rgba(20,110,140,0.15)",
    "rgba(18,60,130,0.13)",
    "rgba(40,160,120,0.08)",
  ],
  starPalette: ["#bfeee8", "#dffcff", "#ffffff", "#8fd8c8"],
  sparkles: { color: "#7fd8c8", opacity: 0.45, speed: 0.14 },
  fog: { color: "#04100f", near: 15, far: 80 },
  latticeColor: "#3d6a72",
  bloomBias: 1.05,
  faintThread: "#4d6b74",
  burst: { color: "#5eead4", secondary: "#c7fff4" },
  music: { slotSeconds: 2.4, droneGain: 0.15, motifBias: 0.85, padCutoff: 700 },
};

/** The forge of correspondences — warm darks, rising embers. */
export const ember: WorldTheme = {
  id: "ember",
  name: "The Forge",
  tagline: "where correspondences are hammered bright",
  nebulae: [
    "rgba(200,90,40,0.11)",
    "rgba(150,40,70,0.12)",
    "rgba(220,160,40,0.06)",
  ],
  starPalette: ["#ffd9b0", "#fff3e0", "#ffb28a", "#ffffff"],
  sparkles: { color: "#ffb27a", opacity: 0.5, speed: 0.3 },
  fog: { color: "#0d0806", near: 16, far: 85 },
  latticeColor: "#7a5a48",
  bloomBias: 1.1,
  faintThread: "#6e5a50",
  burst: { color: "#fbbf24", secondary: "#ff8a5c" },
  music: { slotSeconds: 1.8, droneGain: 0.16, motifBias: 1.15, padCutoff: 1050 },
};

/** Lights over the winter of knowledge — polar green and violet. */
export const aurora: WorldTheme = {
  id: "aurora",
  name: "The Aurora",
  tagline: "lights over the winter of knowledge",
  nebulae: [
    "rgba(50,190,120,0.12)",
    "rgba(110,70,210,0.12)",
    "rgba(60,180,210,0.07)",
  ],
  starPalette: ["#eaf6ff", "#ffffff", "#cfe8ff", "#d8ffe9"],
  sparkles: { color: "#9df0c8", opacity: 0.4, speed: 0.18 },
  fog: { color: "#050b10", near: 17, far: 88 },
  latticeColor: "#4a7a72",
  bloomBias: 1.08,
  faintThread: "#52707d",
  burst: { color: "#6ee7b7", secondary: "#c4b5fd" },
  music: { slotSeconds: 2.2, droneGain: 0.13, motifBias: 1, padCutoff: 980 },
};
