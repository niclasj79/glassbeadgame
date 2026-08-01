/**
 * A World Theme — one file fully describes a world's material, light, and
 * musical temperament. Adding thematic content to the game = adding one theme
 * file and registering it in themes/index.ts. Nothing else changes.
 *
 * The palette is deliberately named after *materials*, not after colour roles.
 * Castalia is not lit space; it is an instrument room at night — brass, glass,
 * vellum, ink, gold leaf, and a darkness that has a body. A theme that cannot
 * name its materials will drift back into neon soup within two commits.
 */

/**
 * The material vocabulary of a world. Every value is an opaque sRGB hex; the
 * scene mixes them, so translucency belongs to the shader rather than to the
 * data. No entry may be pure black — darkness here is a deep dyed pigment.
 */
export interface WorldPalette {
  /** The deepest dye in the world. Behind everything, never `#000`. */
  readonly ground: string;
  /** The body of the darkness — what the void is actually made of. */
  readonly depth: string;
  /** Atmosphere nearer the horizon, where the world has weight. */
  readonly horizon: string;
  /** Parchment. Labels, margin rules, and the lit face of the vault. */
  readonly vellum: string;
  /** Polished instrument metal. Ring bodies and bead settings. */
  readonly brass: string;
  /** Oxidised brass. Old metal, shadow side, the unlit half of a ring. */
  readonly patina: string;
  /** Gold leaf. Gilded figures, consecrated marks; used sparingly. */
  readonly gold: string;
  /** Engraved line work catching light. Graduations, ribs, tracery. */
  readonly engraving: string;
  /** Red ochre. The manuscript rubric: emphasis, never alarm. */
  readonly rubric: string;
  /** Star light. Cool, faint, and never the brightest thing on screen. */
  readonly starlight: string;
}

export interface WorldTheme {
  readonly id: string;
  /** Display name, e.g. "The Tide". */
  readonly name: string;
  /** One breath of flavour, shown when the world opens. */
  readonly tagline: string;

  // ── Material ─────────────────────────────────────────────────────────
  readonly palette: WorldPalette;
  /**
   * How strongly a bead's faculty ink survives inside the glass, 0–1. Low
   * values give near-colourless optical glass; the figure still reads because
   * it is drawn by *line*, not by hue.
   */
  readonly inkSaturation: number;
  /** Refractive index of the bead glass. 1.45 crown → 1.72 flint. */
  readonly refraction: number;
  readonly fog: { readonly color: string; readonly near: number; readonly far: number };

  // ── Light ────────────────────────────────────────────────────────────
  /** Multiplier on the tier's bloom intensity (0.85–1.15 tasteful). */
  readonly bloomBias: number;
  /** Direction of the world's key light, normalised by the scene. */
  readonly keyLight: readonly [number, number, number];

  // ── Music ────────────────────────────────────────────────────────────
  readonly music: {
    /** Scheduler slot length in seconds — the world's tempo (1.7–2.4). */
    readonly slotSeconds: number;
    /** Drone bed gain. */
    readonly droneGain: number;
    /** Multiplier on per-motif speak probability. */
    readonly motifBias: number;
    /** Breath-filter center frequency (Hz) — darker or brighter pads. */
    readonly padCutoff: number;
  };
}
