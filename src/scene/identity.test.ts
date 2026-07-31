import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import { facultyById } from "@/content/castalia/faculties";
import { SIGIL_FAMILIES } from "@/content/castalia/schema";
import { concepts as legacyConcepts } from "@/content/concepts";
import { NEUTRAL_INK, armillaryOrder, resolveBeadIdentity } from "./identity";

describe("authored beads", () => {
  it("takes the figure, faculty, ink and setting straight from the pack", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      const identity = resolveBeadIdentity(concept.id);
      const faculty = facultyById.get(concept.faculty);
      expect(identity.authored).toBe(true);
      expect(identity.name).toBe(concept.name);
      expect(identity.faculty).toBe(concept.faculty);
      expect(identity.sigil).toEqual(concept.sigil);
      expect(identity.setting).toBe(faculty?.geometry);
      expect(identity.ink).toBe(faculty?.ink);
      expect(identity.bearing).toBe(faculty?.bearing);
    }
  });

  it("preserves gilding only where the pack authored it", () => {
    const gilded = CASTALIA_CONCEPTS.filter((c) => c.sigil.gilded);
    expect(gilded.length).toBeGreaterThan(0);
    for (const concept of gilded) {
      expect(resolveBeadIdentity(concept.id).sigil.gilded).toBe(true);
    }
  });
});

describe("beads from a pack that predates the sigil schema", () => {
  const mathematics = legacyConcepts.find((c) => c.discipline === "mathematics")!;
  const philosophy = legacyConcepts.find((c) => c.discipline === "philosophy")!;

  it("is marked underived so nothing downstream can mistake it for authored", () => {
    const identity = resolveBeadIdentity(mathematics.id);
    expect(identity.authored).toBe(false);
    expect(identity.name).toBe(mathematics.name);
  });

  it("never gilds a derived figure — gold leaf is reserved for authored content", () => {
    for (const concept of legacyConcepts) {
      expect(resolveBeadIdentity(concept.id).sigil.gilded).toBe(false);
    }
  });

  it("claims a faculty only where the discipline has an exact counterpart", () => {
    expect(resolveBeadIdentity(mathematics.id).faculty).toBe("measure");
    // Philosophy has no faculty in the Castalia pack. Inventing one would put
    // a claim on screen that no one authored.
    expect(resolveBeadIdentity(philosophy.id).faculty).toBeNull();
    expect(resolveBeadIdentity(philosophy.id).ink).toBe(NEUTRAL_INK);
    expect(resolveBeadIdentity(philosophy.id).setting).toBe("arc");
  });

  it("derives a valid, deterministic figure from the id alone", () => {
    for (const concept of legacyConcepts.slice(0, 24)) {
      const first = resolveBeadIdentity(concept.id);
      const second = resolveBeadIdentity(concept.id);
      expect(first.sigil).toEqual(second.sigil);
      expect(SIGIL_FAMILIES).toContain(first.sigil.family);
      expect(first.sigil.symmetry).toBeGreaterThanOrEqual(1);
      expect(first.sigil.symmetry).toBeLessThanOrEqual(12);
      expect(first.sigil.density).toBeGreaterThan(0);
      expect(first.sigil.density).toBeLessThanOrEqual(1);
      expect(first.sigil.turbulence).toBeGreaterThanOrEqual(0);
      expect(first.sigil.turbulence).toBeLessThanOrEqual(1);
    }
  });

  it("produces more than one family across a draw, so beads stay tellable apart", () => {
    const families = new Set(
      legacyConcepts.slice(0, 24).map((c) => resolveBeadIdentity(c.id).sigil.family)
    );
    expect(families.size).toBeGreaterThan(3);
  });

  it("still gives an unattributed bead a stable bearing in [0,1)", () => {
    const bearing = resolveBeadIdentity(philosophy.id).bearing;
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(1);
    expect(resolveBeadIdentity(philosophy.id).bearing).toBe(bearing);
  });
});

/**
 * The module's docblock used to state a rule the module has never implemented:
 * that "gold leaf and faculty attribution are reserved for authored content",
 * and that a derived identity "never claims a faculty". The legacy branch has
 * always attributed a faculty — with its ink and its collar — wherever a
 * discipline has an exact counterpart, and the test above has always asserted
 * exactly that. The comment was the version a reader would believe.
 *
 * These tests pin the rule the code actually implements, in both directions,
 * so the sentence and the behaviour cannot drift apart again.
 */
describe("the honesty rule, as implemented", () => {
  const source = readFileSync(new URL("./identity.ts", import.meta.url), "utf8");

  it("withholds gold leaf from every derived bead", () => {
    for (const concept of legacyConcepts) {
      const identity = resolveBeadIdentity(concept.id);
      expect(identity.authored).toBe(false);
      expect(identity.sigil.gilded).toBe(false);
    }
  });

  it("attributes a faculty only from the table, never by invention", () => {
    for (const concept of legacyConcepts) {
      const identity = resolveBeadIdentity(concept.id);
      if (identity.faculty === null) {
        expect(identity.ink).toBe(NEUTRAL_INK);
        expect(identity.setting).toBe("arc");
        continue;
      }
      // A faculty on a derived bead means the discipline had an exact
      // counterpart — and the ink and collar that come with it are the
      // faculty's own, not a guess.
      const faculty = facultyById.get(identity.faculty);
      expect(faculty).toBeDefined();
      expect(identity.ink).toBe(faculty?.ink);
      expect(identity.setting).toBe(faculty?.geometry);
    }
  });

  it("no longer documents a rule it does not implement", () => {
    expect(source).not.toContain("never claims a faculty");
    expect(source).not.toContain(
      "Gold leaf and faculty attribution are reserved"
    );
  });
});

describe("armillary order", () => {
  const ids = CASTALIA_CONCEPTS.map((c) => c.id);

  it("groups each faculty into one contiguous zone", () => {
    const ordered = armillaryOrder(ids);
    const seen: string[] = [];
    for (const id of ordered) {
      const faculty = String(resolveBeadIdentity(id).faculty);
      if (seen[seen.length - 1] !== faculty) seen.push(faculty);
    }
    expect(seen.length).toBe(new Set(seen).size);
  });

  it("orders faculties by their authored bearing", () => {
    const ordered = armillaryOrder(ids);
    const bearings = ordered.map((id) => resolveBeadIdentity(id).bearing);
    for (let i = 1; i < bearings.length; i++) {
      expect(bearings[i]).toBeGreaterThanOrEqual(bearings[i - 1]);
    }
  });

  it("is a permutation, never a filter", () => {
    const ordered = armillaryOrder(ids);
    expect(ordered.length).toBe(ids.length);
    expect([...ordered].sort()).toEqual([...ids].sort());
  });

  it("is deterministic for the same draw in any input order", () => {
    const forward = armillaryOrder(ids);
    const backward = armillaryOrder([...ids].reverse());
    expect(backward).toEqual(forward);
  });
});
