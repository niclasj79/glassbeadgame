import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { worldSafeArea } from "./framing";
import {
  ATTENDED_NAME_BLUR,
  ATTENDED_NAME_MAX_WIDTH,
  ATTENDED_NAME_OUTLINE,
  ATTENDED_NAME_OUTLINE_OPACITY,
  ATTENDED_NAME_SCALE,
  LABEL_CLEARANCE,
  NAME_MAX_WIDTH,
  NAME_OUTLINE,
  NAME_OUTLINE_OPACITY,
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
  /** What every *other* name must keep clear of. */
  readonly r?: number;
  /** What this bead's *own* name is offset by. Defaults to `r`. */
  readonly own?: number;
  /** How far the drawn form reaches between the cardinals. Defaults to `own`. */
  readonly between?: number;
  /** Whether this bead's name hangs on a drawn instrument rather than beside it. */
  readonly anchored?: boolean;
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
  const ownRadius = new Float32Array(count);
  const ownBetween = new Float32Array(count);
  const anchored = new Float32Array(count);
  const half = new Float32Array(count * 2);
  const tier = new Float32Array(count);
  const hidden = new Float32Array(count);
  beads.forEach((bead, i) => {
    anchor[i * 2] = bead.x;
    anchor[i * 2 + 1] = bead.y;
    beadRadius[i] = bead.r ?? 0.05;
    ownRadius[i] = bead.own ?? bead.r ?? 0.05;
    ownBetween[i] = bead.between ?? ownRadius[i];
    anchored[i] = bead.anchored ? 1 : 0;
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
      ownRadius,
      ownRadiusBetween: ownBetween,
      anchored,
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

  it("never places a name nearer another bead than the one it names", () => {
    // GAP-8, measured on a 1280x720 frame with Fibonacci Sequence attended: its
    // own name was hung 166 px below it — the attended bead reserves the
    // intention plate's radius, not its glass — and landed 73 px from
    // Anamorphosis. Better than twice as close to a bead that is not its own,
    // with no leader and nothing else in the drawing to say otherwise. The
    // frame's one definite subject was mislabelled and a neighbour was given a
    // name it does not have.
    const beads = [
      { x: 0, y: 0.3, r: 0.36, w: 0.16, h: 0.03 },
      { x: 0.02, y: -0.25, w: 0.16, h: 0.03 },
    ];
    const solved = solve(beads);
    for (let i = 0; i < beads.length; i++) {
      if (solved.code[i] === SUPPRESSED) continue;
      const box = solved.box(i);
      const own = Math.hypot(
        box.cx - solved.anchor[i * 2],
        box.cy - solved.anchor[i * 2 + 1]
      );
      for (let k = 0; k < beads.length; k++) {
        if (k === i) continue;
        const other = Math.hypot(
          box.cx - solved.anchor[k * 2],
          box.cy - solved.anchor[k * 2 + 1]
        );
        expect(other).toBeGreaterThanOrEqual(own - 1e-9);
      }
    }
    // …and it is the neighbour doing the work: alone, the same name hangs
    // below exactly where it now refuses to go.
    const alone = solve([beads[0]]);
    expect(sideOf(alone.code[0])).toBe("below");
  });

  it("offsets a name by its own bead, not by what other names must avoid", () => {
    // The two radii are different things and were one number. A bead is not
    // further from its own name because there is an instrument drawn around it.
    const solved = solve([{ x: 0, y: 0.3, r: 0.36, own: 0.05 }]);
    expect(solved.code[0]).not.toBe(SUPPRESSED);
    const drop = Math.hypot(solved.offset[0], solved.offset[1]);
    expect(drop).toBeLessThan(0.12);
    // And with no own radius given, the reserved one still governs — the
    // default is the old behaviour, so no caller changes meaning by accident.
    const reserved = solve([{ x: 0, y: 0.3, r: 0.36 }]);
    expect(
      Math.hypot(reserved.offset[0], reserved.offset[1])
    ).toBeGreaterThan(0.36);
  });

  it("places nothing for a bead that is not on the screen", () => {
    const solved = solve([{ x: 0, y: 0, hidden: true }]);
    expect(solved.code[0]).toBe(SUPPRESSED);
  });

  /**
   * B2, the half of it nobody could see. Ground truth on the running build:
   * after attending, `snapshot()` reported draftStage "attending" while the
   * attended bead carried "no ring, no reticle, no glow and no label". The name
   * was the solver doing exactly what it was told — the arena handed it the
   * intention plate's radius as the offset for the bead's *own* name, so the
   * name was thrown 148 px clear of the glass, landed nearer some neighbour,
   * and was refused by the misattribution law above. The two radii have been
   * separable here since that law was written; nothing passed the second one.
   */
  /**
   * MAJ-1, and it is the other half of the same mistake. Offsetting the
   * attended name by the plate lost it to the proximity law above; offsetting
   * it by the glass kept it and put it *under the dial* — measured at 1.5:1
   * against the ring on a real frame, the least legible caption on a page where
   * every other name ran 3.3:1 or better. Neither radius was ever the answer on
   * its own: the attended name is the dial's caption, so it takes the dial's
   * radius *and* says so.
   */
  it("hands the solver the bead's own radius as well as the reserved one", () => {
    const source = beadsSource();
    expect(source).toContain("ownRadius: focal.ownRadius");
    // A bead that draws nothing but its own glass is not further from its own
    // name for it — that half of the separation is exactly as it was.
    expect(source).toMatch(
      /focal\.ownRadius\[i\] = attended[\s\S]{0,80}focal\.glassRadius\[i\] \+ 0\.02/
    );
    // …and the attended bead takes the plate for both questions, because the
    // dial is drawn over the canvas and a name hung off the glass is a name
    // underneath the instrument.
    expect(source).toMatch(/focal\.ownRadius\[i\] = attended\s*\?\s*plateRadius/);
    expect(source).toContain("anchored: focal.anchored");
    expect(source).toMatch(/focal\.anchored\[i\] = attended \? 1 : 0/);

    // And the reservation is the circle that contains the *whole* plate, asked
    // of the plate's own geometry. Reserving the vertical drop alone put the
    // name out to the side, where the plate is 33 px wider because a verb's
    // engraved caption stands there: on the running build "Fibonacci Sequence"
    // was struck straight through the word PASSAGE.
    expect(source).toContain("plateGeometry(three.size.width");
    expect(source).toMatch(
      /Math\.max\(\s*geometry\.extentUp,\s*geometry\.extentDown,\s*geometry\.extentSide\s*\)/
    );
    // Solved from the geometry, never a second copy of the number.
    expect(source).not.toContain("ATTENDED_LABEL_DROP_PX");
    // …and not re-solved per bead per frame: the frame loop allocates nothing.
    expect(source).toMatch(/plate\.current\.width !== three\.size\.width/);
  });

  it("hangs the attended name on the dial's rim instead of under it", () => {
    // A crowded 1280x720 frame with one bead attended: the dial is 148 px —
    // 0.41 of a half-height — and there is another bead nearer than that to
    // every one of the four rims the name could hang on, which is the ordinary
    // case on an armillary of a dozen beads and the case the reservation was
    // written for.
    const plate = 0.41;
    const attended = {
      x: 0,
      y: 0.1,
      r: plate,
      w: 0.16,
      h: 0.03,
      tier: 1,
    };
    const crowd = [
      { x: 0.3, y: -0.352, w: 0.16, h: 0.03 },
      { x: 0.3, y: 0.552, w: 0.16, h: 0.03 },
      { x: 0.582, y: 0.45, w: 0.16, h: 0.03 },
      { x: -0.582, y: 0.45, w: 0.16, h: 0.03 },
    ];

    const solved = solve([{ ...attended, anchored: true }, ...crowd]);
    expect(solved.code[0]).not.toBe(SUPPRESSED);
    // Clear of the whole instrument, not of the glass inside it.
    expect(Math.hypot(solved.offset[0], solved.offset[1])).toBeGreaterThan(plate);

    // …and it is the anchoring doing the work and not the geometry: the
    // identical frame with a floating name loses every side to the proximity
    // law, which is the state this was found in and the reason the arena had
    // backed the attended name onto its own glass and under its own dial.
    const floating = solve([attended, ...crowd]);
    expect(floating.code[0]).toBe(SUPPRESSED);
  });

  /**
   * Every placement the solver will consider for a bead of radius `r` whose
   * name measures `w` by `h`, computed the way the solver computes them, so a
   * change to the bearings cannot leave these tests behind.
   */
  const candidates = (
    x: number,
    y: number,
    r: number,
    w: number,
    h: number,
    between = r
  ) =>
    [
      [0, -1],
      [0, 1],
      [1, 0],
      [-1, 0],
      [Math.SQRT1_2, -Math.SQRT1_2],
      [-Math.SQRT1_2, -Math.SQRT1_2],
    ].map(([ux, uy], s) => {
      const reach =
        (s < 4 ? r : between) +
        LABEL_CLEARANCE +
        w * Math.abs(ux) +
        h * Math.abs(uy);
      return { x: x + ux * reach, y: y + uy * reach };
    });

  it("waives proximity for an anchored name and nothing else", () => {
    // The exemption is narrow on purpose. A bead sitting on the caption still
    // refuses it — SILENCE BEATS FABRICATED SIGNIFICANCE, and a name written
    // through a bead is a claim about that bead.
    const plate = 0.41;
    const blocked = solve([
      { x: 0, y: 0.3, r: plate, anchored: true, w: 0.16, h: 0.03 },
      // Directly on every placement the dial allows, diagonals included.
      ...candidates(0, 0.3, plate, 0.16, 0.03).map((at) => ({
        x: at.x,
        y: at.y,
        w: 0.16,
        h: 0.03,
      })),
    ]);
    expect(blocked.code[0]).toBe(SUPPRESSED);

    // And it is still held inside the page: an anchored name with a dial wider
    // than the frame has nowhere legible to go and is suppressed, not clipped.
    const offPage = solve([{ x: 0, y: 0, r: 4, anchored: true }]);
    expect(offPage.code[0]).toBe(SUPPRESSED);
  });

  it("gives the dial's rim two more places to hang a caption", () => {
    // Four cardinal placements is what a *point* has. A dial is a circle whose
    // rim is continuous, and between its stations it is a third narrower —
    // there is nothing out there but the graduated circle, because the verbs
    // and their engraved captions are on the cardinals and the two utility
    // controls on the upper diagonals. Measured on a 414x896 phone the plate is
    // 350 px of a 414 px page: reserving the widest reach in every direction
    // leaves an attended bead with nowhere at all to put its name.
    const plate = 0.41;
    const between = 0.24;
    const w = 0.16;
    const h = 0.03;
    const attended = { x: 0, y: 0.1, r: plate, between, w, h, tier: 1 };
    // A bead standing on each of the four cardinal placements, and none on the
    // diagonals.
    const crowd = candidates(0, 0.1, plate, w, h, between)
      .slice(0, 4)
      .map((at) => ({ x: at.x, y: at.y, w, h }));

    const anchored = solve([{ ...attended, anchored: true }, ...crowd]);
    expect(anchored.code[0]).not.toBe(SUPPRESSED);
    expect(sideOf(anchored.code[0])).toMatch(/^below-(right|left)$/);
    // Still outside the graduated circle, and inside the page.
    expect(
      Math.hypot(anchored.offset[0], anchored.offset[1])
    ).toBeGreaterThan(between);
    const box = anchored.box(0);
    const area = frame(1440 / 810);
    expect(box.cx - box.hx).toBeGreaterThanOrEqual(area.minX - 1e-9);
    expect(box.cx + box.hx).toBeLessThanOrEqual(area.maxX + 1e-9);

    // …and the diagonals belong to the dial alone. A bare bead is a point, and
    // a caption hung off a point on the diagonal reads as unattached to it.
    const floating = solve([attended, ...crowd]);
    expect(floating.code[0]).toBe(SUPPRESSED);
  });

  it("sets the attended name as the most legible in the frame", () => {
    // Measured over each name's own box on a 1280x720 frame with Fibonacci
    // Sequence attended: peak 86 on a ground of 29 — 3.0:1 — against 149–210
    // and 8.1–12.2:1 for the four names beside it. The lowest peak and the
    // lowest contrast in the frame belonged to the thing the player had just
    // chosen. The promotion is spent in three registers, none of them colour.
    expect(ATTENDED_NAME_SCALE).toBeGreaterThan(1);
    // A ground, not a hairline: the outline has to be wide enough to *be* the
    // background, which is the whole of why the horizon streak used to win.
    expect(ATTENDED_NAME_OUTLINE).toBeGreaterThanOrEqual(NAME_OUTLINE * 3);
    expect(ATTENDED_NAME_BLUR).toBeGreaterThan(0);
    // …and opaque, where an ordinary name's is deliberately not.
    expect(ATTENDED_NAME_OUTLINE_OPACITY).toBe(1);
    expect(NAME_OUTLINE_OPACITY).toBeLessThan(1);
    // And it sets *narrower*, which is the opposite of what a promotion sounds
    // like and is the reason it can be promoted at all: a 200 px single line
    // has nowhere to go around a 350 px dial on a 414 px page, and the promoted
    // name — larger again — was suppressed outright there.
    expect(ATTENDED_NAME_MAX_WIDTH).toBeLessThan(NAME_MAX_WIDTH * 0.6);

    const source = beadsSource();
    // Every one of the three reaches the label, and the size does it through
    // the group scale the solver already measures against — so the placement
    // knows how big the promoted name actually is.
    expect(source).toMatch(/attended \? ATTENDED_NAME_SCALE : 1/);
    expect(source).toMatch(
      /id === attendedId \? ATTENDED_NAME_OUTLINE : NAME_OUTLINE/
    );
    expect(source).toMatch(/id === attendedId \? ATTENDED_NAME_BLUR : 0/);
    expect(source).toMatch(
      /id === attendedId \? ATTENDED_NAME_MAX_WIDTH : NAME_MAX_WIDTH/
    );
    expect(source).toMatch(
      /attended \? ATTENDED_NAME_OUTLINE_OPACITY : NAME_OUTLINE_OPACITY/
    );
  });

  it("puts the dial's caption where it is least likely to be misread", () => {
    // Proximity is waived for an anchored name, so proximity is what it should
    // spend the free choice on: of the placements that are legal, the emptiest.
    // Below is tried first and is legal here — but a bead sits just outside it,
    // and above is wide open.
    const plate = 0.3;
    const w = 0.14;
    const h = 0.03;
    const [below] = candidates(0, 0, plate, w, h);
    const neighbour = { x: below.x + w + 0.09, y: below.y, w, h };
    const solved = solve([
      { x: 0, y: 0, r: plate, w, h, tier: 1, anchored: true },
      neighbour,
    ]);
    expect(solved.code[0]).not.toBe(SUPPRESSED);
    expect(sideOf(solved.code[0])).not.toBe("below");
    const chosen = solved.box(0);
    // Every legal placement is compared, and the winner is the one standing
    // furthest from the only other bead in the frame.
    const gap = (x: number, y: number) =>
      Math.hypot(x - neighbour.x, y - neighbour.y);
    const best = Math.max(
      ...candidates(0, 0, plate, w, h).map((at) => gap(at.x, at.y))
    );
    expect(gap(chosen.cx, chosen.cy)).toBeCloseTo(best, 6);
    expect(gap(chosen.cx, chosen.cy)).toBeGreaterThan(gap(below.x, below.y));

    // …and with the crowd gone it is a caption again: below, as every name is.
    const alone = solve([
      { x: 0, y: 0, r: plate, w, h, tier: 1, anchored: true },
    ]);
    expect(sideOf(alone.code[0])).toBe("below");
  });

  it("still refuses a floating name that would land on a neighbour", () => {
    // The proximity law is untouched for every bead that is not attended, which
    // is every bead but one. Two beads a hair apart: the lower one is exactly
    // where the upper one's name wants to be.
    const solved = solve([
      { x: 0, y: 0.2, w: 0.16, h: 0.03 },
      { x: 0, y: 0.06, w: 0.16, h: 0.03 },
    ]);
    for (let i = 0; i < 2; i++) {
      if (solved.code[i] === SUPPRESSED) continue;
      const box = solved.box(i);
      const own = Math.hypot(
        box.cx - solved.anchor[i * 2],
        box.cy - solved.anchor[i * 2 + 1]
      );
      const k = 1 - i;
      const other = Math.hypot(
        box.cx - solved.anchor[k * 2],
        box.cy - solved.anchor[k * 2 + 1]
      );
      expect(other).toBeGreaterThanOrEqual(own - 1e-9);
    }
  });

  it("keeps the attended bead's own name, which is the frame's subject", () => {
    // The measured frame: Fibonacci attended at the top of a 1280x720 page with
    // Anamorphosis below it. With one radius for both questions the name was
    // suppressed outright; with the bead's own radius it hangs on its bead.
    const plate = 0.41;
    const glass = 0.05;
    const beads = [
      { x: 0, y: 0.3, r: plate, own: glass, w: 0.16, h: 0.03 },
      { x: 0.02, y: -0.25, w: 0.16, h: 0.03 },
    ];
    const solved = solve(beads);
    expect(solved.code[0]).not.toBe(SUPPRESSED);
    expect(Math.hypot(solved.offset[0], solved.offset[1])).toBeLessThan(0.12);
    // And the neighbour still keeps clear of the whole plate, which is what the
    // reserved radius is for.
    if (solved.code[1] !== SUPPRESSED) {
      const box = solved.box(1);
      const clear =
        Math.abs(box.cx - solved.anchor[0]) >= box.hx + plate ||
        Math.abs(box.cy - solved.anchor[1]) >= box.hy + plate;
      expect(clear).toBe(true);
    }
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
