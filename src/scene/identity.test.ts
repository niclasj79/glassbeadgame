import { describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import { facultyById } from "@/content/castalia/faculties";
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

/**
 * The scene calls this every frame, so an id the pack does not know — a stale
 * one out of a persisted session, say — must not throw. It must also not be
 * papered over: the bead that comes back claims nothing.
 */
describe("an id the pack does not know", () => {
  const unknown = "measure.no-such-concept";

  it("resolves to a neutral, unattributed bead rather than throwing", () => {
    const identity = resolveBeadIdentity(unknown);
    expect(identity.authored).toBe(false);
    expect(identity.name).toBe(unknown);
    expect(identity.faculty).toBeNull();
    expect(identity.ink).toBe(NEUTRAL_INK);
    expect(identity.setting).toBe("arc");
  });

  it("never wears gold leaf, which is reserved for authored content", () => {
    expect(resolveBeadIdentity(unknown).sigil.gilded).toBe(false);
  });

  it("gives the same neutral figure to every unknown id — nothing is invented", () => {
    const a = resolveBeadIdentity(unknown);
    const b = resolveBeadIdentity("sound.also-not-in-the-pack");
    expect(a.sigil).toEqual(b.sigil);
    expect(a.bearing).toBe(b.bearing);
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
