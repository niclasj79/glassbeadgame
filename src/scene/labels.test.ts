import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { worldSafeArea } from "./framing";
import {
  LABEL_CLEARANCE,
  SUPPRESSED,
  createLabelScratch,
  placeLabels,
  sideOf,
} from "./labels";

/**
 * LBL-01 — A NAME THAT COLLIDES IS WORSE THAN NO NAME
 *
 * Measured on the shipped build, at every viewport: bead names ran through
 * beads, through threads, through each other and through the HUD. On 414x896,
 * "The Crystal Lattice" ran off the right edge with its final letter gone and
 * "Cantor's Diagonal Argument" crossed the page's inner ruling. Every one of
 * those is the same bug — a fixed offset below the bead, with no knowledge of
 * anything else on the screen.
 */

const beadsSource = (): string =>
  readFileSync(new URL("./Beads.tsx", import.meta.url), "utf8");

/** The isotropic screen space the solver works in: one unit is a half-height. */
function frame(aspect: number) {
  const safe = worldSafeArea(aspect);
  return {
    minX: safe.minX * aspect,
    maxX: safe.maxX * aspect,
    minY: safe.minY,
    maxY: safe.maxY,
  };
}

interface Chord {
  readonly a: number;
  readonly b: number;
}

interface Bead {
  readonly x: number;
  readonly y: number;
  readonly r?: number;
  readonly w?: number;
  readonly h?: number;
  readonly tier?: number;
  readonly hidden?: boolean;
}

function solve(
  beads: readonly Bead[],
  aspect = 1440 / 810,
  chords: readonly Chord[] = []
) {
  const count = beads.length;
  const anchor = new Float32Array(count * 2);
  const beadRadius = new Float32Array(count);
  const half = new Float32Array(count * 2);
  const tier = new Float32Array(count);
  const hidden = new Float32Array(count);
  beads.forEach((bead, i) => {
    anchor[i * 2] = bead.x;
    anchor[i * 2 + 1] = bead.y;
    beadRadius[i] = bead.r ?? 0.05;
    half[i * 2] = bead.w ?? 0.12;
    half[i * 2 + 1] = bead.h ?? 0.03;
    tier[i] = bead.tier ?? 0;
    hidden[i] = bead.hidden ? 1 : 0;
  });
  const thread = new Float32Array(Math.max(1, chords.length) * 4);
  chords.forEach((chord, t) => {
    thread[t * 4] = anchor[chord.a * 2];
    thread[t * 4 + 1] = anchor[chord.a * 2 + 1];
    thread[t * 4 + 2] = anchor[chord.b * 2];
    thread[t * 4 + 3] = anchor[chord.b * 2 + 1];
  });
  const code = new Int32Array(count);
  const offset = new Float32Array(count * 2);
  placeLabels(
    {
      anchor,
      beadRadius,
      half,
      tier,
      hidden,
      thread,
      threadCount: chords.length,
      count,
      area: frame(aspect),
    },
    createLabelScratch(count),
    code,
    offset
  );
  return {
    code,
    offset,
    box: (i: number) => ({
      cx: anchor[i * 2] + offset[i * 2],
      cy: anchor[i * 2 + 1] + offset[i * 2 + 1],
      hx: half[i * 2],
      hy: half[i * 2 + 1],
    }),
    anchor,
    beadRadius,
  };
}

describe("the label placement solver", () => {
  it("hangs a name below its bead when there is room", () => {
    const solved = solve([{ x: 0, y: 0 }]);
    expect(sideOf(solved.code[0])).toBe("below");
    expect(solved.offset[1]).toBeLessThan(0);
  });

  it("never lets a name cross the page's ruling", () => {
    const aspect = 414 / 896;
    const area = frame(aspect);
    // A wide name on a bead pressed hard into the bottom right of a phone —
    // exactly the case that put "The Crystal Lattice" off the edge.
    const solved = solve(
      [{ x: area.maxX - 0.05, y: area.minY + 0.05, w: 0.34, h: 0.05 }],
      aspect
    );
    if (solved.code[0] !== SUPPRESSED) {
      const box = solved.box(0);
      expect(box.cx - box.hx).toBeGreaterThanOrEqual(area.minX - 1e-9);
      expect(box.cx + box.hx).toBeLessThanOrEqual(area.maxX + 1e-9);
      expect(box.cy - box.hy).toBeGreaterThanOrEqual(area.minY - 1e-9);
      expect(box.cy + box.hy).toBeLessThanOrEqual(area.maxY + 1e-9);
    }
  });

  it("never lets a name cross another name", () => {
    // Six beads in a tight column: the old fixed drop stacked every name on
    // the one below it. This is the "Isorhythm" over "Fibonacci Sequence" case.
    const beads = Array.from({ length: 6 }, (_, i) => ({
      x: 0,
      y: 0.5 - i * 0.09,
      w: 0.22,
      h: 0.035,
    }));
    const solved = solve(beads);
    const placed: { cx: number; cy: number; hx: number; hy: number }[] = [];
    for (let i = 0; i < beads.length; i++) {
      if (solved.code[i] === SUPPRESSED) continue;
      const box = solved.box(i);
      for (const other of placed) {
        const apart =
          Math.abs(box.cx - other.cx) >= box.hx + other.hx + LABEL_CLEARANCE ||
          Math.abs(box.cy - other.cy) >= box.hy + other.hy + LABEL_CLEARANCE;
        expect(apart).toBe(true);
      }
      placed.push(box);
    }
    // …and it does not simply give up on all of them.
    expect(placed.length).toBeGreaterThanOrEqual(3);
  });

  it("never lets a name cross a bead", () => {
    // A bead directly below another is where the name would land by default.
    const beads = [
      { x: 0, y: 0.2 },
      { x: 0, y: 0.1 },
      { x: 0.05, y: 0 },
      { x: -0.04, y: -0.1 },
    ];
    const solved = solve(beads);
    for (let i = 0; i < beads.length; i++) {
      if (solved.code[i] === SUPPRESSED) continue;
      const box = solved.box(i);
      for (let k = 0; k < beads.length; k++) {
        if (k === i) continue;
        const clear =
          Math.abs(box.cx - solved.anchor[k * 2]) >=
            box.hx + solved.beadRadius[k] ||
          Math.abs(box.cy - solved.anchor[k * 2 + 1]) >=
            box.hy + solved.beadRadius[k];
        expect(clear).toBe(true);
      }
    }
  });

  it("never lays a name across the player's own thread", () => {
    // The worst of the collisions: the thread is the thing the player made, and
    // a name written over it reads as the world having lost track of it.
    const beads = [
      { x: -0.5, y: 0.3 },
      { x: 0.5, y: -0.3 },
      // A bead whose name would land right on the chord between the other two.
      { x: -0.1, y: 0.16, w: 0.2, h: 0.035 },
    ];
    const solved = solve(beads, 1440 / 810, [{ a: 0, b: 1 }]);
    if (solved.code[2] !== SUPPRESSED) {
      const box = solved.box(2);
      // The chord runs from (-0.5, 0.3) to (0.5, -0.3): y = -0.6x. The name's
      // box must not meet it.
      const meets = (() => {
        for (let t = 0; t <= 1; t += 0.001) {
          const x = -0.5 + t;
          const y = 0.3 - 0.6 * t;
          if (
            Math.abs(x - box.cx) < box.hx &&
            Math.abs(y - box.cy) < box.hy
          ) {
            return true;
          }
        }
        return false;
      })();
      expect(meets).toBe(false);
    }
    // …and without the thread, the same name is happily placed where it now
    // refuses to go, so this is the thread doing the work and not the box.
    const free = solve(beads);
    expect(free.code[2]).not.toBe(SUPPRESSED);
    expect(solved.offset[4] !== free.offset[4] || solved.offset[5] !== free.offset[5]).toBe(true);
  });

  it("suppresses a name it cannot place rather than clipping it", () => {
    // A name wider than the page. There is no legible placement, and half a
    // name running off the edge tells the player the world is broken.
    const solved = solve([{ x: 0, y: 0, w: 4, h: 0.04 }]);
    expect(solved.code[0]).toBe(SUPPRESSED);
    expect(sideOf(solved.code[0])).toBeNull();
    expect(solved.offset[0]).toBe(0);
    expect(solved.offset[1]).toBe(0);
  });

  it("keeps the salient names when the frame runs out of room", () => {
    // Two beads on top of one another, only one name can be placed. The one
    // that survives must be the one the frame is about, not the one the draw
    // happened to list first.
    const solved = solve([
      { x: 0, y: 0, w: 0.3, h: 0.06, tier: 0 },
      { x: 0.02, y: -0.02, w: 0.3, h: 0.06, tier: 1 },
    ]);
    expect(solved.code[1]).not.toBe(SUPPRESSED);
  });

  it("steps a name clear of the intention plate, not just of the glass", () => {
    // The attended bead is handed the plate's radius, because the plate is what
    // a name would actually collide with. A quarter of the frame's height is a
    // plate-sized radius on a 810px viewport.
    const plate = 0.36;
    const solved = solve([{ x: 0, y: 0.4, r: plate }]);
    expect(solved.code[0]).not.toBe(SUPPRESSED);
    expect(Math.hypot(solved.offset[0], solved.offset[1])).toBeGreaterThan(plate);
  });

  it("places nothing for a bead that is not on the screen", () => {
    const solved = solve([{ x: 0, y: 0, hidden: true }]);
    expect(solved.code[0]).toBe(SUPPRESSED);
  });

  it("is what the arena actually uses", () => {
    const source = beadsSource();
    expect(source).toContain("placeLabels(");
    expect(source).toContain("assignSalience(");
    // The fixed drop that caused every collision is gone: a name's offset now
    // comes from the solver and from nowhere else.
    expect(source).not.toContain("BEAD_RADIUS * GLASS_SCALE + 0.16");
    expect(source).toContain("focal.offset[i * 2]");
  });
});
