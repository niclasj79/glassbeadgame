import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMFORT } from "@/audio/comfort";
import { SEPARATION_CLEARANCE } from "./salience";
import {
  createContactTracker,
  detectContacts,
  pairIndex,
  resizeContactTracker,
  type ContactInputs,
} from "./contact";

const RADIUS = 0.06;
/** The centre distance at which two beads of RADIUS are exactly touching. */
const TOUCH = RADIUS * 2 * (1 + SEPARATION_CLEARANCE);

/** Two beads on a line, `gap` apart beyond touching. */
function frame(gap: number, overrides: Partial<ContactInputs> = {}): ContactInputs {
  return {
    anchor: new Float32Array([0, 0, TOUCH + gap, 0]),
    radius: new Float32Array([RADIUS, RADIUS]),
    hidden: new Float32Array([0, 0]),
    count: 2,
    dt: 1 / 60,
    nowMs: 0,
    ...overrides,
  };
}

describe("bead contact", () => {
  it("indexes every pair exactly once", () => {
    const count = 12;
    const seen = new Set<number>();
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) seen.add(pairIndex(i, j, count));
    }
    expect(seen.size).toBe((count * (count - 1)) / 2);
    expect(Math.max(...seen)).toBe(seen.size - 1);
  });

  it("says nothing while two beads are merely close", () => {
    const tracker = createContactTracker(2);
    detectContacts(tracker, frame(0.05, { nowMs: 0 }));
    expect(detectContacts(tracker, frame(0.04, { nowMs: 16 }))).toHaveLength(0);
  });

  it("sounds once as the gap closes, and not again while it stays closed", () => {
    const tracker = createContactTracker(2);
    detectContacts(tracker, frame(0.02, { nowMs: 0 }));
    // Crossing: 0.02 -> -0.005 in one frame is a real closing speed.
    const hit = detectContacts(tracker, frame(-0.005, { nowMs: 16 }));
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ a: 0, b: 1 });

    // Held together. A pair being pushed apart is not being struck.
    expect(detectContacts(tracker, frame(-0.01, { nowMs: 32 }))).toHaveLength(0);
    expect(detectContacts(tracker, frame(-0.02, { nowMs: 48 }))).toHaveLength(0);
  });

  it("is silent for a graze and loud for a snap", () => {
    const soft = createContactTracker(2);
    detectContacts(soft, frame(0.0005, { nowMs: 0 }));
    // Barely moving: below minClosingSpeed, so nothing.
    expect(detectContacts(soft, frame(-0.0001, { nowMs: 16 }))).toHaveLength(0);

    const hard = createContactTracker(2);
    detectContacts(hard, frame(0.06, { nowMs: 0 }));
    const hit = detectContacts(hard, frame(-0.02, { nowMs: 16 }));
    expect(hit).toHaveLength(1);
    expect(hit[0].strength).toBeGreaterThan(0.8);
  });

  it("judges hard and soft on the pair's own scale, not on its size", () => {
    // The same closing speed relative to size must give the same strength,
    // otherwise a bead near the camera would always sound like a harder hit.
    const small = createContactTracker(2);
    const bigR = RADIUS * 3;
    const bigTouch = bigR * 2 * (1 + SEPARATION_CLEARANCE);
    const big = createContactTracker(2);

    detectContacts(small, frame(TOUCH * 0.4, { nowMs: 0 }));
    const a = detectContacts(small, frame(-TOUCH * 0.1, { nowMs: 16 }));

    const bigFrame = (gap: number, nowMs: number): ContactInputs => ({
      anchor: new Float32Array([0, 0, bigTouch + gap, 0]),
      radius: new Float32Array([bigR, bigR]),
      hidden: new Float32Array([0, 0]),
      count: 2,
      dt: 1 / 60,
      nowMs,
    });
    detectContacts(big, bigFrame(bigTouch * 0.4, 0));
    const b = detectContacts(big, bigFrame(-bigTouch * 0.1, 16));

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].strength).toBeCloseTo(b[0].strength, 5);
    // Size still travels, because it is what sets the pitch.
    expect(b[0].size).toBeGreaterThan(a[0].size);
  });

  it("will not let one pair buzz", () => {
    const tracker = createContactTracker(2);
    const cooldown = COMFORT.contact.pairCooldownMs;
    detectContacts(tracker, frame(0.03, { nowMs: 0 }));
    expect(detectContacts(tracker, frame(-0.01, { nowMs: 16 }))).toHaveLength(1);

    // Apart again, and straight back together well inside the cooldown.
    detectContacts(tracker, frame(0.03, { nowMs: 32 }));
    expect(detectContacts(tracker, frame(-0.01, { nowMs: 48 }))).toHaveLength(0);

    // And allowed once the cooldown has passed.
    detectContacts(tracker, frame(0.03, { nowMs: cooldown + 60 }));
    expect(
      detectContacts(tracker, frame(-0.01, { nowMs: cooldown + 76 }))
    ).toHaveLength(1);
  });

  it("never voices more than the comfort envelope allows in one frame", () => {
    // Eight beads driven into a single point on the same frame: without the
    // cap this is eight simultaneous clinks, which is the machine-gun the
    // bounds exist to prevent.
    const count = 8;
    const tracker = createContactTracker(count);
    const apart = new Float32Array(count * 2);
    const together = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      apart[i * 2] = i * TOUCH * 1.4;
      together[i * 2] = i * 0.001;
    }
    const common = {
      radius: new Float32Array(count).fill(RADIUS),
      hidden: new Float32Array(count),
      count,
      dt: 1 / 60,
    };
    detectContacts(tracker, { ...common, anchor: apart, nowMs: 0 });
    const hits = detectContacts(tracker, { ...common, anchor: together, nowMs: 16 });
    expect(hits.length).toBeLessThanOrEqual(COMFORT.contact.maxPerFrame);
    expect(hits.length).toBeGreaterThan(0);
    // The loudest survive the cull, not whichever the loops reached first.
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].strength).toBeGreaterThanOrEqual(hits[i].strength);
    }
  });

  it("does not invent a collision when a bead comes back on screen", () => {
    const tracker = createContactTracker(2);
    // Overlapping, but one of them is off screen, so there is no gap to know.
    detectContacts(
      tracker,
      frame(-0.02, { nowMs: 0, hidden: new Float32Array([0, 1]) })
    );
    // It returns already overlapping. That is not a strike.
    expect(detectContacts(tracker, frame(-0.02, { nowMs: 16 }))).toHaveLength(0);
  });

  it("forgets everything when the draw changes", () => {
    const tracker = createContactTracker(2);
    detectContacts(tracker, frame(0.03, { nowMs: 0 }));
    const resized = resizeContactTracker(tracker, 12);
    expect(resized).not.toBe(tracker);
    expect(resized.count).toBe(12);
    expect(resizeContactTracker(resized, 12)).toBe(resized);
  });

  it("places a contact where it happened", () => {
    const tracker = createContactTracker(2);
    const at = (x: number, gap: number, nowMs: number): ContactInputs => ({
      anchor: new Float32Array([x, 0, x + TOUCH + gap, 0]),
      radius: new Float32Array([RADIUS, RADIUS]),
      hidden: new Float32Array([0, 0]),
      count: 2,
      dt: 1 / 60,
      nowMs,
    });
    detectContacts(tracker, at(0.7, 0.03, 0));
    const hit = detectContacts(tracker, at(0.7, -0.01, 16));
    expect(hit[0].pan).toBeGreaterThan(0);
    expect(hit[0].pan).toBeLessThanOrEqual(1);
  });

  it("returns nothing on a frame with no elapsed time", () => {
    const tracker = createContactTracker(2);
    expect(detectContacts(tracker, frame(-0.01, { dt: 0 }))).toHaveLength(0);
  });

  it("is measured before the separation that answers it, and is voiced", () => {
    /*
     * The one property no unit test of this module can prove on its own: that
     * the frame loop actually calls it, and calls it in the right order. A
     * contact detected after `separateOnScreen` has run would be measured
     * against positions from which the overlap had already been removed, so
     * every hard strike would report as a soft one — silently, with every test
     * in this file still green.
     *
     * There is no renderer in this suite, so it is asserted against the source.
     */
    const beads = readFileSync(
      join(process.cwd(), "src", "scene", "Beads.tsx"),
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    const detect = beads.indexOf("detectContacts(");
    const separate = beads.indexOf("separateOnScreen(");
    expect(detect).toBeGreaterThan(-1);
    expect(separate).toBeGreaterThan(-1);
    expect(detect).toBeLessThan(separate);
    // And something is done with what it finds.
    expect(beads).toContain("beadClink(");
    // Sized to the draw, or a new session would compare against stale gaps.
    expect(beads).toContain("resizeContactTracker(");
  });
});
