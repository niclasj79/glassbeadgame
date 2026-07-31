import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import { FACULTIES } from "@/content/castalia/faculties";
import { SIGIL_FAMILIES } from "@/content/castalia/schema";
import { GLSL_FIGURE } from "./glsl";
import {
  GLSL_SETTING_INK,
  SIGIL_FAMILY_CODE,
  figureBound,
  figureFunctionName,
  figureLineWidth,
  figureRadius,
  figureWarp,
  isRadialFamily,
  settingCode,
  settingInkWeight,
  sigilFamilyCode,
  sigilUniform,
} from "./sigil";

describe("sigil family codes", () => {
  it("is a shader ABI: codes are the schema's declaration order", () => {
    SIGIL_FAMILIES.forEach((family, index) => {
      expect(sigilFamilyCode(family)).toBe(index);
    });
  });

  it("assigns every family a distinct code", () => {
    const codes = new Set(SIGIL_FAMILIES.map(sigilFamilyCode));
    expect(codes.size).toBe(SIGIL_FAMILIES.length);
  });

  it("covers every family the schema declares", () => {
    expect(Object.keys(SIGIL_FAMILY_CODE).sort()).toEqual([...SIGIL_FAMILIES].sort());
  });

  it("classifies each family as radial or cartesian exactly once", () => {
    for (const family of SIGIL_FAMILIES) {
      expect(typeof isRadialFamily(family)).toBe("boolean");
    }
    // `symmetry` folds the plane for radial families and multiplies frequency
    // for the rest; a family in neither camp would silently lose the channel.
    expect(SIGIL_FAMILIES.filter(isRadialFamily).length).toBeGreaterThan(0);
    expect(SIGIL_FAMILIES.filter((f) => !isRadialFamily(f)).length).toBeGreaterThan(0);
  });
});

describe("sigil uniforms", () => {
  it("clamps symmetry into the schema's 1–12 range and makes it integral", () => {
    const low = sigilUniform({
      family: "orbit",
      symmetry: 0,
      density: 0.5,
      turbulence: 0,
      gilded: false,
    });
    const high = sigilUniform({
      family: "orbit",
      symmetry: 99,
      density: 0.5,
      turbulence: 0,
      gilded: false,
    });
    expect(low.symmetry).toBe(1);
    expect(high.symmetry).toBe(12);
    expect(Number.isInteger(low.symmetry)).toBe(true);
  });

  it("clamps density and turbulence to 0–1", () => {
    const u = sigilUniform({
      family: "grid",
      symmetry: 3,
      density: 4,
      turbulence: -2,
      gilded: false,
    });
    expect(u.density).toBe(1);
    expect(u.turbulence).toBe(0);
  });

  it("passes every authored bead through without clamping", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      const u = sigilUniform(concept.sigil);
      expect(u.symmetry).toBe(concept.sigil.symmetry);
      expect(u.density).toBeCloseTo(concept.sigil.density, 6);
      expect(u.turbulence).toBeCloseTo(concept.sigil.turbulence, 6);
    }
  });
});

describe("figure geometry", () => {
  it("keeps every authored figure inside the glass with a margin", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      const radius = figureRadius(concept.sigil.density);
      const warp = figureWarp(concept.sigil.turbulence);
      expect(radius).toBeGreaterThanOrEqual(0.34);
      // Radius plus the warp the ink is allowed must stay inside the bead.
      expect(radius + warp).toBeLessThan(1);
    }
  });

  it("draws denser figures with a finer line, so density adds information", () => {
    expect(figureLineWidth(0.9)).toBeLessThan(figureLineWidth(0.4));
    expect(figureLineWidth(1)).toBeGreaterThan(0);
  });

  it("gives larger figures to denser sigils", () => {
    expect(figureRadius(0.9)).toBeGreaterThan(figureRadius(0.4));
  });
});

/**
 * These tests used to describe a figure the GPU never consulted. `glsl.ts` had
 * its own copy of the radius, the line width, the warp amplitude and the
 * ten-way family switch, so every assertion above could pass while the shader
 * drew something else entirely — the tested source was not the rendering one.
 *
 * The shader is now generated from this module. What follows reads the emitted
 * GLSL back and checks it computes what the exported functions compute, in the
 * spirit of `threadGrammar.test.ts`, which reads `ribbon.ts` to guard the
 * torsion bound.
 */
describe("the figure the shader actually draws", () => {
  const glslSource = readFileSync(
    new URL("./glsl.ts", import.meta.url),
    "utf8"
  );

  /** Pull `[a ±] b * clamp(x, 0.0, 1.0)` out of an emitted GLSL function. */
  const emittedMapping = (name: string): ((x: number) => number) => {
    const body = new RegExp(
      `float ${name}\\(float \\w+\\) \\{\\s*return (?:([\\d.]+) ([-+]) )?([\\d.]+) \\* clamp\\(\\w+, 0\\.0, 1\\.0\\);`
    ).exec(GLSL_FIGURE);
    expect(body, `${name} is not emitted into the shader`).not.toBeNull();
    const base = body![1] === undefined ? 0 : Number(body![1]);
    const sign = body![2] === "-" ? -1 : 1;
    const span = Number(body![3]);
    return (x: number) => base + sign * span * Math.min(1, Math.max(0, x));
  };

  it("sizes the figure with the same numbers the tested functions do", () => {
    const radius = emittedMapping("gbgFigureRadius");
    const lineWidth = emittedMapping("gbgFigureLineWidth");
    const warp = emittedMapping("gbgFigureWarp");
    for (let x = 0; x <= 1.0001; x += 0.05) {
      expect(radius(x)).toBeCloseTo(figureRadius(x), 6);
      expect(lineWidth(x)).toBeCloseTo(figureLineWidth(x), 6);
      expect(warp(x)).toBeCloseTo(figureWarp(x), 6);
    }
  });

  it("states those numbers once — glsl.ts no longer keeps its own copy", () => {
    expect(glslSource).toContain("float radius = gbgFigureRadius(density);");
    expect(glslSource).toContain("float warp = gbgFigureWarp(turbulence);");
    expect(glslSource).not.toMatch(/0\.34\s*\+\s*0\.56/);
    expect(glslSource).not.toMatch(/0\.055\s*-\s*0\.03/);
    expect(glslSource).not.toMatch(/0\.19\s*\*\s*turbulence/);
  });

  it("dispatches every family, in the schema's order, from the schema itself", () => {
    SIGIL_FAMILIES.forEach((family, index) => {
      // The branch the shader takes for a family is generated from the same
      // array `sigilFamilyCode` indexes, so a reordered schema can no longer
      // leave every bead drawn as the wrong construction.
      expect(GLSL_FIGURE).toContain(
        `if (fam == ${index}) return ${figureFunctionName(family)}(p, k, w);`
      );
      // …and that construction exists.
      expect(glslSource).toContain(`float ${figureFunctionName(family)}(`);
    });
    const branches = GLSL_FIGURE.match(/if \(fam == \d+\)/g) ?? [];
    expect(branches).toHaveLength(SIGIL_FAMILIES.length);
  });
});

describe("settings", () => {
  it("gives each faculty construction geometry its own collar", () => {
    const codes = FACULTIES.map((faculty) => settingCode(faculty.geometry));
    expect(new Set(codes).size).toBe(FACULTIES.length);
    expect(codes).not.toContain(0); // 0 is reserved for "unattributed"
  });

  it("falls back to the unattributed collar for any other geometry", () => {
    const facultyGeometries = new Set(FACULTIES.map((f) => f.geometry));
    for (const family of SIGIL_FAMILIES) {
      if (facultyGeometries.has(family)) continue;
      expect(settingCode(family)).toBe(0);
    }
  });
});

/**
 * MAT-02 — HOW FAR A FIGURE REACHES
 *
 * The refraction march used to spread its samples over the whole chord the
 * refracted ray makes through the glass. This is the number that lets it spend
 * them on the drawing instead, so it has to be honest in both directions: large
 * enough that no part of a construction is clipped away, small enough that it
 * is worth clipping to.
 */
describe("the figure's bound", () => {
  it("contains every authored figure and everything its turbulence adds", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      const bound = figureBound(concept.sigil.density, concept.sigil.turbulence);
      expect(bound).toBeGreaterThanOrEqual(
        figureRadius(concept.sigil.density) + figureWarp(concept.sigil.turbulence)
      );
      expect(bound).toBeLessThanOrEqual(1);
    }
  });

  it("is worth clipping to at the densities the pack actually authors", () => {
    // If the bound were the whole bead for every figure the march would be
    // unchanged, and MAT-02's fix would be a comment.
    const bounds = CASTALIA_CONCEPTS.map((concept) =>
      figureBound(concept.sigil.density, concept.sigil.turbulence)
    );
    expect(Math.min(...bounds)).toBeLessThan(0.75);
    expect(bounds.filter((bound) => bound < 0.95).length).toBeGreaterThan(
      bounds.length / 2
    );
  });

  it("grows with density and never leaves the glass", () => {
    expect(figureBound(0.9, 0)).toBeGreaterThan(figureBound(0.4, 0));
    expect(figureBound(1, 1)).toBe(1);
    expect(figureBound(0, 0)).toBeGreaterThan(0);
  });

  it("is the same number in the shader as it is here", () => {
    // The emitted form, read back and evaluated: min(1, radius * s + warp).
    const emitted =
      /float gbgFigureBound\(float density, float turbulence\) \{\s*return min\(1\.0, gbgFigureRadius\(density\) \* ([\d.]+) \+ gbgFigureWarp\(turbulence\)\);/.exec(
        GLSL_FIGURE
      );
    expect(emitted, "gbgFigureBound is not emitted into the shader").not.toBeNull();
    const scale = Number(emitted![1]);
    for (let density = 0; density <= 1.0001; density += 0.1) {
      for (let turbulence = 0; turbulence <= 1.0001; turbulence += 0.25) {
        expect(
          Math.min(1, figureRadius(density) * scale + figureWarp(turbulence))
        ).toBeCloseTo(figureBound(density, turbulence), 6);
      }
    }
  });
});

/**
 * m9 — A FACULTY IS DRAWN, NOT TINTED
 *
 * Contrast used to come from gold leaf, which only four concepts have. Value is
 * normalised now (see `INK_VALUE` in `scene/glass.ts`), so what is left to tell
 * one faculty's hand from another is the hand: the weight of the line, chosen
 * by the faculty's own construction geometry. That is a channel a greyscale
 * print keeps and a colour-blind player keeps, which hue never was.
 */
describe("inking by construction geometry", () => {
  const facultyGeometries = FACULTIES.map((faculty) => faculty.geometry);

  it("gives every faculty geometry a weight of its own", () => {
    const weights = facultyGeometries.map(settingInkWeight);
    expect(new Set(weights).size).toBe(FACULTIES.length);
  });

  it("keeps every weight a hand rather than a handicap", () => {
    for (const family of SIGIL_FAMILIES) {
      // Wide enough to tell apart, narrow enough that no faculty's figures are
      // drawn so fine they fall under a pixel at bead size.
      expect(settingInkWeight(family)).toBeGreaterThanOrEqual(0.8);
      expect(settingInkWeight(family)).toBeLessThanOrEqual(1.3);
    }
  });

  it("says nothing about a bead whose pack declares no faculty", () => {
    for (const family of SIGIL_FAMILIES) {
      if (facultyGeometries.includes(family)) continue;
      expect(settingCode(family)).toBe(0);
      expect(settingInkWeight(family)).toBe(1);
    }
  });

  it("emits one branch per faculty, switched on the same setting codes", () => {
    for (const family of facultyGeometries) {
      expect(GLSL_SETTING_INK).toContain(
        `if (c == ${settingCode(family)}) return ${settingInkWeight(
          family
        ).toFixed(6)};`
      );
    }
    const branches = GLSL_SETTING_INK.match(/if \(c == \d+\)/g) ?? [];
    expect(branches).toHaveLength(FACULTIES.length);
    expect(GLSL_SETTING_INK).toContain("return 1.000000;");
  });
});
