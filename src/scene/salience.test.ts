import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INVITATION_REACH,
  MID_FRACTION,
  NEAR_CAP,
  PROMOTE_ATTENDED,
  PROMOTE_NOTICED,
  PROMOTE_SECOND,
  SEPARATION_CLEARANCE,
  SEPARATION_LIMIT,
  TIER_FAR,
  TIER_MID,
  TIER_NEAR,
  assignSalience,
  invitationWeights,
  promotionFor,
  separateOnScreen,
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

/**
 * I-017 — THE FOCUS VIEW EXTENDS THE HIERARCHY; IT DOES NOT BUILD A SECOND ONE
 *
 * The attended bead and the second — sighted, locked, or the other end of a
 * reopened thread — are the subject of the frame, in that order, and a bead
 * under the lens is named. Promotion is therefore a level. And the hierarchy
 * still answers to attention and depth alone: the only thing in the focus view
 * that answers to the bands is the fog.
 */
describe("the focus view's order of attention", () => {
  const beadsSource = (): string =>
    readFileSync(new URL("./Beads.tsx", import.meta.url), "utf8");

  it("ranks the attended bead, then the second, then anything else looked at", () => {
    expect(promotionFor(true, true, true)).toBe(PROMOTE_ATTENDED);
    expect(promotionFor(false, true, true)).toBe(PROMOTE_SECOND);
    expect(promotionFor(false, false, true)).toBe(PROMOTE_NOTICED);
    expect(promotionFor(false, false, false)).toBe(0);
    expect(PROMOTE_ATTENDED).toBeGreaterThan(PROMOTE_SECOND);
    expect(PROMOTE_SECOND).toBeGreaterThan(PROMOTE_NOTICED);
    expect(PROMOTE_NOTICED).toBeGreaterThan(0);
  });

  it("gives the near tier's two places to the pair, however far they stand", () => {
    const depth = spread(COUNT);
    const promoted = new Array(COUNT).fill(0);
    // The two furthest beads are the pair; three nearer ones are under the lens.
    promoted[COUNT - 1] = PROMOTE_ATTENDED;
    promoted[COUNT - 2] = PROMOTE_SECOND;
    promoted[0] = PROMOTE_NOTICED;
    promoted[1] = PROMOTE_NOTICED;
    promoted[2] = PROMOTE_NOTICED;
    const out = tiers(depth, promoted);
    expect(out[COUNT - 1]).toBe(TIER_NEAR);
    expect(out[COUNT - 2]).toBe(TIER_NEAR);
    // The cap is still a cap: looked-at beads come next, not alongside.
    expect([...out].filter((t) => t === TIER_NEAR)).toHaveLength(NEAR_CAP);
    for (const i of [0, 1, 2]) expect(out[i]).toBe(TIER_MID);
  });

  it("keeps the attended bead first even when the second stands nearer", () => {
    const depth = spread(COUNT);
    const promoted = new Array(COUNT).fill(0);
    promoted[COUNT - 1] = PROMOTE_ATTENDED;
    promoted[0] = PROMOTE_SECOND;
    const order = new Int32Array(COUNT);
    const out = new Float32Array(COUNT);
    assignSalience(
      Float32Array.from(depth),
      Float32Array.from(promoted),
      COUNT,
      order,
      out
    );
    expect(order[0]).toBe(COUNT - 1);
    expect(order[1]).toBe(0);
  });

  it("promotes by attention alone in the arena, never by band", () => {
    const source = beadsSource();
    expect(source).toContain(
      "focal.promoted[i] = promotionFor(attended, second, lensed || hovered || focused);"
    );
    // The bands reach the glass's graduations and the fog — not the rank.
    expect(source).not.toMatch(/promotionFor\([^)]*resonance/);
  });

  it("draws the attended bead largest of all, with scale doing more when the camera may not travel", () => {
    // The constants are read from the source so this suite never loads a
    // renderer (see cameraHold.test.ts).
    const source = beadsSource();
    const constant = (name: string): number => {
      const found = new RegExp(`export const ${name} = ([\\d.]+);`).exec(source);
      expect(found).not.toBeNull();
      return Number(found![1]);
    };
    const attended = constant("ATTENDED_SCALE");
    const still = constant("ATTENDED_SCALE_STILL");
    const dominance = constant("ATTENDED_DOMINANCE");
    const second = constant("SECOND_SCALE");
    const hover = constant("HOVER_SCALE");
    expect(attended).toBeGreaterThan(second);
    expect(attended).toBeGreaterThan(hover);
    expect(still).toBeGreaterThan(attended);
    expect(dominance).toBeGreaterThan(1);
    // …and the floor is a dominance as well: from wherever the camera stands,
    // the attended bead out-draws every other bead on the screen.
    expect(source).toMatch(
      /let attendedScale = reducedMotion \? ATTENDED_SCALE_STILL : ATTENDED_SCALE;/
    );
    expect(source).toMatch(
      /ATTENDED_DOMINANCE \* rival \* focal\.depth\[attendedAt\]/
    );
    // Light follows the same order as size.
    expect(source).toMatch(/const emphasis = attended\s*\?\s*1/);
    expect(constant("SECOND_EMPHASIS")).toBeGreaterThan(constant("LENS_EMPHASIS"));
    expect(constant("SECOND_EMPHASIS")).toBeLessThan(1);
  });
});

/**
 * B1 — TWO BEADS RENDERED AS ONE OBJECT
 *
 * Measured on the running build at the composed home pose, seed
 * castalia-golden-001: Coupled Pendulums and Diffraction stood 19.7 px apart on
 * 1280x720 (17.8 at 1024x768, 18.5 at 768x900, 18.4 at 414x896, 24.6 at
 * 1600x900) with a drawn bead radius of about 19 px. One silhouette, two
 * concepts. The occluded one had no name and could not be pointed at, on the
 * first frame of every session, at every supported viewport.
 */
const geometry = (
  points: readonly (readonly [number, number])[],
  radius: number | readonly number[] = 0.05,
  hidden: readonly boolean[] = []
) => {
  const count = points.length;
  const anchor = new Float32Array(count * 2);
  const radii = new Float32Array(count);
  const hide = new Float32Array(count);
  points.forEach(([x, y], i) => {
    anchor[i * 2] = x;
    anchor[i * 2 + 1] = y;
    radii[i] = typeof radius === "number" ? radius : radius[i];
    hide[i] = hidden[i] ? 1 : 0;
  });
  const push = new Float32Array(count * 2);
  const overlapping = separateOnScreen(anchor, radii, hide, count, push);
  const at = (i: number): [number, number] => [
    anchor[i * 2] + push[i * 2],
    anchor[i * 2 + 1] + push[i * 2 + 1],
  ];
  const gap = (i: number, j: number): number =>
    Math.hypot(at(i)[0] - at(j)[0], at(i)[1] - at(j)[1]);
  return { push, overlapping, at, gap, radii };
};

describe("no two beads may read as one", () => {
  it("opens a pair that the layout drew inside one silhouette", () => {
    // The measured case: two beads a fifth of a diameter apart.
    const r = 0.05;
    const solved = geometry([
      [0, 0],
      [0.02, 0],
    ], r);
    expect(solved.overlapping).toBe(1);
    expect(solved.gap(0, 1)).toBeGreaterThanOrEqual(
      2 * r * (1 + SEPARATION_CLEARANCE) - 1e-6
    );
  });

  it("moves both of them by the same amount, because neither is the real one", () => {
    const solved = geometry([
      [0, 0],
      [0.03, 0],
    ]);
    const a = Math.hypot(solved.push[0], solved.push[1]);
    const b = Math.hypot(solved.push[2], solved.push[3]);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
    // …along the line between them, so the pair opens where the eye is looking.
    expect(solved.push[1]).toBeCloseTo(0, 6);
    expect(solved.push[3]).toBeCloseTo(0, 6);
    expect(solved.push[0]).toBeLessThan(0);
    expect(solved.push[2]).toBeGreaterThan(0);
  });

  it("separates exactly coincident beads deterministically", () => {
    // No line to push along. The answer has to exist, and it has to be the same
    // answer on the next frame, or the pair vibrates.
    const first = geometry([
      [0.2, -0.1],
      [0.2, -0.1],
    ]);
    const second = geometry([
      [0.2, -0.1],
      [0.2, -0.1],
    ]);
    expect(first.gap(0, 1)).toBeGreaterThan(0.09);
    expect([...first.push]).toEqual([...second.push]);
  });

  it("leaves a draw that is already legible completely alone", () => {
    const points: [number, number][] = [
      [-0.6, 0.4],
      [0, 0.2],
      [0.55, -0.3],
      [-0.2, -0.5],
    ];
    const solved = geometry(points);
    expect(solved.overlapping).toBe(0);
    expect([...solved.push].every((v) => v === 0)).toBe(true);
  });

  it("opens a cluster of three without leaving any pair overlapping", () => {
    const r = 0.05;
    const solved = geometry([
      [0, 0],
      [0.01, 0.01],
      [-0.01, 0.008],
    ], r);
    const wanted = 2 * r * (1 + SEPARATION_CLEARANCE);
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      // A pile of three cannot be solved exactly in a bounded number of sweeps,
      // but every pair must clear the glass it is drawn with.
      expect(solved.gap(i, j)).toBeGreaterThan(2 * r);
      expect(solved.gap(i, j)).toBeGreaterThan(wanted * 0.9);
    }
  });

  it("never carries a bead far enough to become a second layout", () => {
    // Twelve beads piled on one point: the cap is what keeps the armillary's
    // geography — which the eye learns — from being rewritten by a crowd.
    const r = 0.05;
    const solved = geometry(
      Array.from({ length: 12 }, (_, i) => [i * 0.001, 0] as [number, number]),
      r
    );
    for (let i = 0; i < 12; i++) {
      const moved = Math.hypot(solved.push[i * 2], solved.push[i * 2 + 1]);
      expect(moved).toBeLessThanOrEqual(r * SEPARATION_LIMIT + 1e-6);
    }
  });

  it("ignores beads that are not on the frame at all", () => {
    const solved = geometry(
      [
        [0, 0],
        [0.005, 0],
      ],
      0.05,
      [false, true]
    );
    expect(solved.overlapping).toBe(0);
    expect([...solved.push].every((v) => v === 0)).toBe(true);
  });

  it("is what the arena actually draws with", () => {
    const source = readFileSync(new URL("./Beads.tsx", import.meta.url), "utf8");
    expect(source).toContain("separateOnScreen(");
    // The displacement reaches the glass, the hit target and the name, because
    // all three read the same rendered position.
    expect(source).toContain("focal.pushEased");
    expect(source).toContain("rendered[index * 3] = x;");
  });
});

/**
 * VC-02 — THE WORLD NEVER SAID WHAT TO DO
 *
 * Sampled on a fresh profile at 5, 10, 15, 25 and 40 s: the only text on screen
 * was "The Lens" and "Conclude"; every instruction the build owns was placed at
 * x = -1 for assistive technology; and hovering a 56 px bead grew it about
 * eight per cent. The invitation has to be made by the instrument itself.
 */
describe("the invitation", () => {
  it("makes one bead reach, unmissably, while the rest settle back", () => {
    const offered = invitationWeights(1, 1);
    expect(offered.reach - 1).toBeGreaterThanOrEqual(0.2);
    expect(offered.reach - 1).toBe(INVITATION_REACH);
    // The others recede, but a long way less: this is one bead coming forward,
    // not the draw being dimmed.
    expect(offered.recede).toBeLessThan(1);
    expect(1 - offered.recede).toBeLessThan(INVITATION_REACH / 3);
    expect(offered.light).toBe(1);
  });

  it("ends for good on first contact, and is silent between kindlings", () => {
    // Accepted: the world stops offering, completely.
    expect(invitationWeights(1, 0)).toEqual({ reach: 1, recede: 1, light: 0 });
    // Between the idle score's events there is nothing to see either — a world
    // that is always reaching is decorated, not inhabited.
    expect(invitationWeights(0, 1)).toEqual({ reach: 1, recede: 1, light: 0 });
  });

  it("lets go continuously, so acceptance is not a pop", () => {
    let previous = invitationWeights(1, 1).reach;
    for (let step = 24; step >= 0; step--) {
      const now = invitationWeights(1, step / 25).reach;
      expect(previous - now).toBeLessThan(0.02);
      expect(now).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
    expect(previous).toBe(1);
  });

  it("is carried by the instrument, and answers a hover past the noise", () => {
    const source = readFileSync(new URL("./Beads.tsx", import.meta.url), "utf8");
    expect(source).toContain("invitationWeights(");
    // A hover measured at eight per cent is inside the noise of a bead that is
    // already bobbing and breathing.
    const hover = /HOVER_SCALE = ([\d.]+)/.exec(source);
    expect(hover).not.toBeNull();
    expect(Number(hover![1]) - 1).toBeGreaterThanOrEqual(0.2);
    // …and it is not size alone: the glass takes light, and the name arrives.
    const emphasis = /HOVER_EMPHASIS = ([\d.]+)/.exec(source);
    expect(emphasis).not.toBeNull();
    expect(Number(emphasis![1])).toBeGreaterThan(0.5);
  });
});
