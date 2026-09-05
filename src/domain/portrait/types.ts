/**
 * THE QUALITATIVE PORTRAIT (VERTICAL-SLICE-SPEC §15).
 *
 * Six dimensions, no total, and no ordering among them. A web high in Openness
 * is not worse than a web high in Coherence; a session that declared no Tension
 * is not a session that failed to. There is deliberately no `score`, no `rank`,
 * no `grade`, and no aggregate field anywhere in these types — a sum would
 * immediately turn six readings into one number to beat, which is the exact
 * thing §15 exists to prevent.
 *
 * Every `value` is a normalised 0–1 reading of real session structure, and
 * every `phrase` is composed from named concepts, facets, faculties, and counts
 * that the player can go and check. A phrase that could have been written
 * before the session started is a bug.
 */
export const PORTRAIT_DIMENSION_IDS = Object.freeze([
  "range",
  "depth",
  "tension",
  "coherence",
  "openness",
  "return",
  // How the player read — the intention, carried to the ending without a
  // rank (DESIGN-REVIEW-SCHELL §3). Seventh and last, because it reads the
  // register the plate prints above it.
  "reading",
] as const);
export type PortraitDimensionId = (typeof PORTRAIT_DIMENSION_IDS)[number];

export interface PortraitDimension {
  readonly id: PortraitDimensionId;
  /** Player-facing name. */
  readonly label: string;
  /** 0–1. A reading, not a mark. */
  readonly value: number;
  /** One or two sentences derived from this session's actual structure. */
  readonly phrase: string;
  /** The concrete facts the value and phrase were computed from. */
  readonly evidence: readonly string[];
}

export interface Portrait {
  /** The six dimensions, always present, always in canonical order. */
  readonly dimensions: readonly PortraitDimension[];
  readonly byId: Readonly<Record<PortraitDimensionId, PortraitDimension>>;
}
