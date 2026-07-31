import { describe, expect, it } from "vitest";
import {
  MID_FRACTION,
  NEAR_CAP,
  TIER_FAR,
  TIER_MID,
  TIER_NEAR,
  assignSalience,
  tierCounts,
  tierWeights,
} from "./salience";

/**
 * A2 — THE FRAME HAS A FIRST READ, AND SOMEBODY CHOSE IT
 *
 * Measured on the shipped build: the three brightest objects in an arena frame
 * were whichever beads carried gold sigils, and across three seeds the
 * first-read target changed at random. Salience was an accident of the draw.
 */

const COUNT = 24;

function tiers(depth: number[], promoted: number[] = []): Float32Array {
  const out = new Float32Array(depth.length);
  assignSalience(
    Float32Array.from(depth),
    Float32Array.from(depth.map((_, i) => promoted[i] ?? 0)),
    depth.length,
    new Int32Array(depth.length),
    out
  );
  return out;
}

const spread = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => 6 + (i * 11) / n);

describe("the focal hierarchy", () => {
  it("never puts more than two beads at maximum salience", () => {
    expect(NEAR_CAP).toBeLessThanOrEqual(2);
    for (let n = 1; n <= 40; n++) {
      const out = tiers(spread(n));
      const near = [...out].filter((t) => t === TIER_NEAR).length;
      expect(near).toBeLessThanOrEqual(NEAR_CAP);
      expect(near).toBe(Math.min(NEAR_CAP, n));
    }
  });

  it("hands the near tier to the beads standing nearest the eye", () => {
    const depth = spread(COUNT);
    const out = tiers(depth);
    const nearest = depth
      .map((d, i) => [d, i] as const)
      .sort((a, b) => a[0] - b[0])
      .slice(0, NEAR_CAP)
      .map(([, i]) => i);
    for (const i of nearest) expect(out[i]).toBe(TIER_NEAR);
  });

  it("keeps the three tiers from collapsing into one", () => {
    const out = [...tiers(spread(COUNT))];
    expect(out).toContain(TIER_NEAR);
    expect(out).toContain(TIER_MID);
    expect(out).toContain(TIER_FAR);
    const counts = tierCounts(COUNT);
    expect(counts.near + counts.mid + counts.far).toBe(COUNT);
    expect(counts.mid).toBe(Math.round((COUNT - NEAR_CAP) * MID_FRACTION));
    // The body of the frame is the far tier: a hierarchy where most things are
    // loud is not a hierarchy.
    expect(counts.far).toBeGreaterThan(counts.near + counts.mid);
  });

  it("promotes the bead the player is working with, and only that", () => {
    const depth = spread(COUNT);
    const promoted = new Array(COUNT).fill(0);
    // The furthest bead in the draw, reached for by the player.
    promoted[COUNT - 1] = 1;
    const out = tiers(depth, promoted);
    expect(out[COUNT - 1]).toBe(TIER_NEAR);
    // And it still costs one of the two: the cap is a cap.
    expect([...out].filter((t) => t === TIER_NEAR)).toHaveLength(NEAR_CAP);
  });

  it("decides the tier from where a bead stands, not from what it is", () => {
    // There is no argument to this function that could carry a sigil, a
    // faculty, gold leaf, or how woven a bead is — which is the whole point.
    // Shuffle the draw and the tiers follow the depths, never the indices.
    expect(assignSalience.length).toBe(5);
    const depth = spread(COUNT);
    const straight = tiers(depth);
    const reversed = tiers([...depth].reverse());
    for (let i = 0; i < COUNT; i++) {
      expect(reversed[COUNT - 1 - i]).toBe(straight[i]);
    }
  });

  it("spends the tier on value and sharpness, never on hue", () => {
    const near = tierWeights(1);
    const far = tierWeights(0);
    // A far bead loses its specular outright — the single brightest thing on
    // the glass, and therefore the strongest first-read cue.
    expect(far.specular).toBe(0);
    expect(near.specular).toBe(1);
    // …gathers materially less at the rim…
    expect(near.rim / far.rim).toBeGreaterThan(1.6);
    // …stands behind more of the room's haze…
    expect(far.haze).toBeGreaterThan(0.2);
    expect(near.haze).toBe(0);
    // …sits less hard on its own shadow…
    expect(near.contact).toBeGreaterThan(far.contact * 4);
    // …and carries its name at less weight.
    expect(near.label).toBeGreaterThan(far.label * 1.5);
    // Every one of those survives a monochrome print. None of them is a colour.
  });

  it("eases between tiers instead of cutting", () => {
    // The frame loop crosses a bead from one tier to the next over time, so the
    // weights have to be continuous or a bead that changes rank pops.
    let previous = tierWeights(0);
    for (let t = 0.02; t <= 1; t += 0.02) {
      const now = tierWeights(t);
      expect(Math.abs(now.rim - previous.rim)).toBeLessThan(0.05);
      expect(Math.abs(now.specular - previous.specular)).toBeLessThan(0.05);
      expect(now.rim).toBeGreaterThanOrEqual(previous.rim);
      previous = now;
    }
  });

  it("does not trade the near tier back and forth between equal beads", () => {
    // An unstable ranking makes two equidistant beads swap the near tier every
    // frame, which is a flicker nobody can look away from.
    const depth = [7, 7, 7, 9, 9, 11];
    const first = [...tiers(depth)];
    for (let i = 0; i < 8; i++) expect([...tiers(depth)]).toEqual(first);
  });

  it("answers safely for an empty draw", () => {
    expect(() => tiers([])).not.toThrow();
    expect(tierCounts(0)).toEqual({ near: 0, mid: 0, far: 0 });
  });
});
