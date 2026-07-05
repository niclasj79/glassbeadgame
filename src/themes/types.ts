/**
 * A World Theme — the Tetris Effect idea, made data: one file fully
 * describes a world's sky, light, particles, and musical temperament.
 * Adding thematic content to the game = adding one theme file and
 * registering it in themes/index.ts. Nothing else changes.
 */
export interface WorldTheme {
  id: string;
  /** Display name, e.g. "The Tide". */
  name: string;
  /** One breath of flavor, shown when the world opens. */
  tagline: string;

  // ── Sky ──────────────────────────────────────────────────────────────
  /** rgba() centers for the three nebula planes, near → far. */
  nebulae: [string, string, string];
  /** Star temperature palette (4 tints, weighted evenly). */
  starPalette: [string, string, string, string];
  sparkles: { color: string; opacity: number; speed: number };
  fog: { color: string; near: number; far: number };
  latticeColor: string;

  // ── Light ────────────────────────────────────────────────────────────
  /** Multiplier on the tier's bloom intensity (0.85–1.15 tasteful). */
  bloomBias: number;
  /** Faint (uncurated) thread color. */
  faintThread: string;
  /** Burst particle tints: primary + secondary. */
  burst: { color: string; secondary: string };

  // ── Music ────────────────────────────────────────────────────────────
  music: {
    /** Scheduler slot length in seconds — the world's tempo (1.7–2.4). */
    slotSeconds: number;
    /** Drone bed gain. */
    droneGain: number;
    /** Multiplier on per-motif speak probability. */
    motifBias: number;
    /** Breath-filter center frequency (Hz) — darker or brighter pads. */
    padCutoff: number;
  };
}
