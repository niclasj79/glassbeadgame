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
 *
 * ONE DESCRIPTION OF THE FIGURE, NOT TWO
 *
 * That contract used to be a promise. `glsl.ts` re-typed the radius, the line
 * width, the warp amplitude and the ten-way family switch as its own literals,
 * so the tests below measured a TypeScript description of the sigil while the
 * GPU drew a second, independent one. Either could be edited without the other
 * failing, which means the tests proved nothing about what appeared on screen.
 *
 * The shader now *derives* from this file: `GLSL_FIGURE_GEOMETRY` and
 * `GLSL_FIGURE_DISPATCH` are generated from the same constants and the same
 * `SIGIL_FAMILIES` array the exported functions use, and `sigil.test.ts` reads
 * the emitted GLSL back and checks it computes what the functions compute.
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
 * The figure's geometry, as shared numbers. Both the functions below and the
 * GLSL emitted at the end of this file read these, so there is exactly one
 * place where the size of a figure is decided.
 */
export const FIGURE_GEOMETRY = Object.freeze({
  /** Extent inside the unit bead at density 0 … */
  radiusMin: 0.34,
  /** … and how much further a fully dense figure reaches. */
  radiusSpan: 0.56,
  /** Line half-width at density 0 … */
  lineWidthMax: 0.055,
  /** … and how much finer a fully dense figure draws. */
  lineWidthSpan: 0.03,
  /** Warp amplitude at full turbulence. */
  warpMax: 0.19,
  /**
   * How far past its own radius a construction is still drawing. Every family
   * in `glsl.ts` fades out between |q| = 1 and |q| ≈ 1.3 in its own figure
   * space, and the ink is essentially spent by 1.18 — which is what makes a
   * bounding sphere for the figure meaningful rather than optimistic.
   */
  boundScale: 1.18,
});

/**
 * Figure extent inside the unit bead, 0.34–0.9. Even a sparse figure must be
 * large enough to be recognised in a bead 15 px across; even a dense one must
 * leave a glass margin, or the bead stops looking like a lens.
 */
export function figureRadius(density: number): number {
  return (
    FIGURE_GEOMETRY.radiusMin + FIGURE_GEOMETRY.radiusSpan * clamp(density, 0, 1)
  );
}

/**
 * Line half-width in figure space. Denser figures draw finer so that adding
 * material adds *information* rather than adding blackness.
 */
export function figureLineWidth(density: number): number {
  return (
    FIGURE_GEOMETRY.lineWidthMax -
    FIGURE_GEOMETRY.lineWidthSpan * clamp(density, 0, 1)
  );
}

/** Warp amplitude. Bounded so the figure never leaves the glass. */
export function figureWarp(turbulence: number): number {
  return FIGURE_GEOMETRY.warpMax * clamp(turbulence, 0, 1);
}

/**
 * Radius, in unit-bead space, of the sphere that contains everything a figure
 * draws — its own extent, the fade past it, and the wander turbulence is
 * allowed. Never more than the bead itself.
 *
 * The refraction march used to spread its samples evenly along the whole chord
 * the refracted ray makes through the glass, which for a sparse figure spent
 * most of them on empty glass and left three or four to describe the drawing.
 * Three samples of a plane, each at a different lateral offset because the ray
 * is bent, is exactly how you draw a figure twice and tear it. The march is now
 * clipped to this bound, so every sample lands where there is something to see.
 */
export function figureBound(density: number, turbulence: number): number {
  const reach =
    figureRadius(density) * FIGURE_GEOMETRY.boundScale + figureWarp(turbulence);
  return reach < 1 ? reach : 1;
}

/** A bead whose pack declares no faculty claims no hand either. */
const UNATTRIBUTED_INK_WEIGHT = 1;

/**
 * INKING BY CONSTRUCTION GEOMETRY
 *
 * A faculty's ink used to carry its identity by hue alone, and contrast by gold
 * leaf: a gilded figure was a third brighter than an ungilded one, which made
 * the four ungilded faculties the faint ones at bead size regardless of what
 * they were drawing. Value is now normalised (see `INK_VALUE` in `glass.ts`),
 * so gold cannot be the source of legibility, and the faculty's own
 * construction geometry decides how the figure is *drawn* instead:
 *
 *   lattice  ruled and fine — a straightedge line
 *   wave     a broad wet nib, the way a curve is laid down in one stroke
 *   orbit    an even compass line
 *   ray      a hard thin pencil, because a ray construction is mostly lines
 *
 * That is a channel a greyscale print keeps, which hue was never going to be.
 * Order is a shader ABI: the emitted GLSL switches on `settingCode`.
 */
export function settingInkWeight(family: SigilFamily): number {
  if (family === "lattice") return 0.94;
  if (family === "wave") return 1.22;
  if (family === "orbit") return 1.08;
  if (family === "ray") return 0.86;
  return UNATTRIBUTED_INK_WEIGHT;
}

/** GLSL literal: a shader rejects an integer where a float belongs. */
const glslFloat = (value: number): string => value.toFixed(6);

/**
 * The three figure-geometry mappings, as GLSL, generated from the constants
 * above. `glsl.ts` calls these instead of restating the arithmetic.
 */
export const GLSL_FIGURE_GEOMETRY = /* glsl */ `
float gbgFigureRadius(float density) {
  return ${glslFloat(FIGURE_GEOMETRY.radiusMin)} + ${glslFloat(
    FIGURE_GEOMETRY.radiusSpan
  )} * clamp(density, 0.0, 1.0);
}

float gbgFigureLineWidth(float density) {
  return ${glslFloat(FIGURE_GEOMETRY.lineWidthMax)} - ${glslFloat(
    FIGURE_GEOMETRY.lineWidthSpan
  )} * clamp(density, 0.0, 1.0);
}

float gbgFigureWarp(float turbulence) {
  return ${glslFloat(FIGURE_GEOMETRY.warpMax)} * clamp(turbulence, 0.0, 1.0);
}

float gbgFigureBound(float density, float turbulence) {
  return min(1.0, gbgFigureRadius(density) * ${glslFloat(
    FIGURE_GEOMETRY.boundScale
  )} + gbgFigureWarp(turbulence));
}
`;

/**
 * The per-faculty inking, as GLSL, switched on the same setting codes
 * `settingCode` produces and carrying the same weights `settingInkWeight`
 * returns. One description of how a faculty draws, not two.
 */
export const GLSL_SETTING_INK = /* glsl */ `
float gbgSettingInkWeight(float code) {
  int c = int(code + 0.5);
${SIGIL_FAMILIES.filter((family) => settingCode(family) !== 0)
  .map(
    (family) =>
      `  if (c == ${settingCode(family)}) return ${glslFloat(
        settingInkWeight(family)
      )};`
  )
  .join("\n")}
  return ${glslFloat(UNATTRIBUTED_INK_WEIGHT)};
}
`;

/** The GLSL construction function that draws one family. */
export function figureFunctionName(family: SigilFamily): string {
  return `gbgFigure${family.charAt(0).toUpperCase()}${family.slice(1)}`;
}

/**
 * The family switch, generated from `SIGIL_FAMILIES` itself. Reordering the
 * schema now reorders the shader's branches with it, instead of silently
 * drawing every bead as the wrong construction.
 */
export const GLSL_FIGURE_DISPATCH = SIGIL_FAMILIES.map(
  (family, index) =>
    `  if (fam == ${index}) return ${figureFunctionName(family)}(p, k, w);`
).join("\n");
