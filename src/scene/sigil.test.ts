import { describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import { FACULTIES } from "@/content/castalia/faculties";
import { SIGIL_FAMILIES } from "@/content/castalia/schema";
import {
  SIGIL_FAMILY_CODE,
  figureLineWidth,
  figureRadius,
  figureWarp,
  isRadialFamily,
  settingCode,
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
