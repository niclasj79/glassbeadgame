import {
  SIGIL_FAMILIES,
  type ConceptSigil,
  type SigilFamily,
} from "@/content/castalia/schema";

/**
 * THE FIGURE INSIDE THE GLASS — PARAMETER SIDE
 *
 * `src/content/castalia/concepts.ts` authors a `ConceptSigil` per bead. This
 * module is the only place those authored values become numbers a shader can
 * read, and it is pure so the mapping can be tested without a GPU.
 *
 * The contract the shader relies on:
 *  - `family` becomes a stable integer index; the GLSL switch is written
 *    against `SIGIL_FAMILIES` order and a family may never be reordered.
 *  - `symmetry` is clamped to 1–12 (the schema's stated range) because a
 *    zero or negative fold count would divide by zero in polar folding.
 *  - `density` becomes both a figure radius and a line width, so a dense
 *    figure fills more of the interior *and* draws finer — which is how a
 *    real illuminated diagram gets denser without turning into a blot.
 *  - `turbulence` becomes a bounded warp amplitude. Ink misbehaves; it does
 *    not leave the bead.
 */

/** GLSL switch index for a sigil family. Order is a shader ABI — never resort. */
export const SIGIL_FAMILY_CODE: Readonly<Record<SigilFamily, number>> =
  Object.freeze(
    Object.fromEntries(SIGIL_FAMILIES.map((family, index) => [family, index])) as Record<
      SigilFamily,
      number
    >
  );

export function sigilFamilyCode(family: SigilFamily): number {
  return SIGIL_FAMILY_CODE[family];
}

/**
 * Families whose rotational order is expressed by *folding the plane* rather
 * than by multiplying a frequency. A twelve-fold grid is a fine grid; a
 * twelve-fold orbit is a rosette. The distinction is what keeps `symmetry`
 * from meaning two different things in two different beads.
 */
const RADIAL_FAMILIES: ReadonlySet<SigilFamily> = new Set<SigilFamily>([
  "spiral",
  "orbit",
  "fold",
  "ray",
  "branch",
  "vessel",
  "arc",
]);

export function isRadialFamily(family: SigilFamily): boolean {
  return RADIAL_FAMILIES.has(family);
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** The four floats the shader reads per bead. */
export interface SigilUniform {
  /** Index into `SIGIL_FAMILIES`. */
  readonly family: number;
  /** Rotational order, 1–12, integral. */
  readonly symmetry: number;
  /** 0–1. Interior fill. */
  readonly density: number;
  /** 0–1. Departure from ideal construction. */
  readonly turbulence: number;
}

export function sigilUniform(sigil: ConceptSigil): SigilUniform {
  return {
    family: sigilFamilyCode(sigil.family),
    symmetry: Math.round(clamp(sigil.symmetry, 1, 12)),
    density: clamp(sigil.density, 0, 1),
    turbulence: clamp(sigil.turbulence, 0, 1),
  };
}

/**
 * The engraved collar the glass is mounted in. Only the four faculty
 * construction geometries have a cut of their own; anything else gets the
 * plain graduated collar, code 0, which says "a bead" and claims no faculty.
 * Order is a shader ABI — see `gbgSetting` in `scene/glsl.ts`.
 */
export function settingCode(family: SigilFamily): number {
  if (family === "lattice") return 1;
  if (family === "wave") return 2;
  if (family === "orbit") return 3;
  if (family === "ray") return 4;
  return 0;
}

/**
 * Figure extent inside the unit bead, 0.34–0.9. Even a sparse figure must be
 * large enough to be recognised in a bead 15 px across; even a dense one must
 * leave a glass margin, or the bead stops looking like a lens.
 */
export function figureRadius(density: number): number {
  return 0.34 + 0.56 * clamp(density, 0, 1);
}

/**
 * Line half-width in figure space. Denser figures draw finer so that adding
 * material adds *information* rather than adding blackness.
 */
export function figureLineWidth(density: number): number {
  return 0.055 - 0.03 * clamp(density, 0, 1);
}

/** Warp amplitude. Bounded so the figure never leaves the glass. */
export function figureWarp(turbulence: number): number {
  return 0.19 * clamp(turbulence, 0, 1);
}
