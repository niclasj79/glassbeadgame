import type { Faculty } from "./schema";

/**
 * The four faculties of thought. Each owns a construction geometry, so a bead's
 * faculty is readable from the *shape of the figure inside it* rather than from
 * its hue — the slice's colour-independence requirement starts here rather than
 * being retrofitted at the shader (VERTICAL-SLICE-SPEC §19).
 *
 * Bearings place the faculties around the armillary as four quadrants, so the
 * arena has an authored geography instead of a scatter.
 */
export const FACULTIES: readonly Faculty[] = Object.freeze([
  Object.freeze({
    id: "measure",
    name: "Measure",
    gloss: "Form counted, proved, and held still enough to be examined.",
    geometry: "lattice",
    ink: "#8fb6ff",
    bearing: 0,
  }),
  Object.freeze({
    id: "sound",
    name: "Sound",
    gloss: "Form laid out in time, where order is heard rather than seen.",
    geometry: "wave",
    ink: "#7fe0c0",
    bearing: 0.25,
  }),
  Object.freeze({
    id: "matter",
    name: "Matter",
    gloss: "Form as the world actually behaves when it is left to itself.",
    geometry: "orbit",
    ink: "#e8c97a",
    bearing: 0.5,
  }),
  Object.freeze({
    id: "image",
    name: "Image",
    gloss: "Form made visible, and the standpoint that makes it so.",
    geometry: "ray",
    ink: "#e79ab0",
    bearing: 0.75,
  }),
]);

export const facultyById = new Map(FACULTIES.map((f) => [f.id, f]));
