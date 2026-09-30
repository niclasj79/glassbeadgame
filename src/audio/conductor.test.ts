import { describe, expect, it } from "vitest";
import { AUDIO_VOICE_ROLES } from "./plan";
import {
  ANSWER_DIVISION,
  BREATH_SLOTS,
  CHOIR_LIGHT_WEIGHT,
  FIRST_SLOT_LEAD_SECONDS,
  GRID_LEAD_SECONDS,
  HAND_DIVISION,
  HAND_LIGHT_WEIGHT,
  LIGHT_DECAY_MAX_SECONDS,
  LIGHT_DECAY_MIN_SECONDS,
  LIGHT_MERGE_SECONDS,
  LIGHT_RISE_SECONDS,
  LIGHT_WEIGHT_BY_ROLE,
  ONSET_CAPACITY,
  UNARMED_LEAD_SECONDS,
  createConductor,
  gridAhead,
  lightEnvelope,
} from "./conductor";

/** A clock the test moves by hand, in seconds. */
function clockAt(start = 100): { now: () => number; set: (t: number) => void } {
  let t = start;
  return { now: () => t, set: (next) => { t = next; } };
}

const SLOT = 2;

describe("the conductor's grid", () => {
  it("answers soon, and off any grid, while unarmed", () => {
    const clock = clockAt(100);
    const c = createConductor(clock);
    expect(c.armed()).toBe(false);
    expect(c.slotSeconds()).toBe(0);
    expect(c.next(HAND_DIVISION)).toBeCloseTo(100 + UNARMED_LEAD_SECONDS, 9);
    expect(c.next(ANSWER_DIVISION)).toBeCloseTo(100 + UNARMED_LEAD_SECONDS, 9);
    expect(c.slotPhase()).toBe(0);
    expect(c.breathPhase()).toBe(0);
  });

  it("finds the next point on the eighth and the sixteenth, at least the lead ahead", () => {
    const clock = clockAt(100);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    // Eighths of a 2 s slot fall every 0.25 s from the origin: 100.15, 100.4, …
    expect(c.next(ANSWER_DIVISION)).toBeCloseTo(100.15, 9);
    // Sixteenths every 0.125 s.
    expect(c.next(HAND_DIVISION)).toBeCloseTo(100.15, 9);
    clock.set(100.2);
    expect(c.next(HAND_DIVISION)).toBeCloseTo(100.275, 9);
    expect(c.next(ANSWER_DIVISION)).toBeCloseTo(100.4, 9);
    // A point closer than the lead is missed for the next one.
    clock.set(100.275 - GRID_LEAD_SECONDS / 2);
    expect(c.next(HAND_DIVISION)).toBeCloseTo(100.4, 9);
    // And a longer lead can be asked for.
    clock.set(100.2);
    expect(c.next(HAND_DIVISION, 0.1)).toBeCloseTo(100.4, 9);
    // The slot itself is a division too.
    expect(c.next(1)).toBeCloseTo(102.15, 9);
  });

  it("honours a lead longer than one grid step: the first point at or after it", () => {
    const clock = clockAt(100.2);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    // Sixteenths fall at 100.275, 100.4, 100.525, 100.65 … A lead of 0.3 s reaches
    // 100.5, so the answer is 100.525 — not 100.4, one step short of the lead.
    expect(c.next(HAND_DIVISION, 0.3)).toBeCloseTo(100.525, 9);
    // Exactly on a point is on it (binary-exact times, so no rounding decides it).
    const exact = createConductor(clockAt(0.25));
    exact.arm({ slotSeconds: SLOT, origin: 0 });
    expect(exact.next(HAND_DIVISION, 0.375)).toBe(0.625);
    // Several slots ahead, on the eighth.
    expect(c.next(ANSWER_DIVISION, 4.3)).toBeCloseTo(104.65, 9);
    for (const lead of [0.01, 0.12, 0.2, 0.37, 1.01, 2.5]) {
      const at = c.next(HAND_DIVISION, lead);
      expect(at).toBeGreaterThanOrEqual(100.2 + lead - 1e-9);
      expect(at).toBeLessThan(100.2 + lead + SLOT / HAND_DIVISION);
      const steps = (at - 100.15) / (SLOT / HAND_DIVISION);
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    }
  });

  it("places a starting bed's grid a first slot ahead, the same rule test mode arms", () => {
    expect(gridAhead(2.4, 10)).toEqual({
      slotSeconds: 2.4,
      origin: 10 + FIRST_SLOT_LEAD_SECONDS,
    });
    expect(FIRST_SLOT_LEAD_SECONDS).toBe(0.15);
  });

  it("keeps the grid from before the origin as well as after it", () => {
    const clock = clockAt(99);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    expect(c.next(ANSWER_DIVISION)).toBeCloseTo(99.15, 9);
    expect(c.slotPhase()).toBeCloseTo(((99 - 100.15) / SLOT + 2) % 1, 9);
  });

  it("phases the slot and the breath from the origin, cresting on the group boundary", () => {
    const clock = clockAt(100.15);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    expect(c.slotPhase()).toBeCloseTo(0, 9);
    expect(Math.sin(c.breathPhase())).toBeCloseTo(1, 9);
    clock.set(100.15 + SLOT / 2);
    expect(c.slotPhase()).toBeCloseTo(0.5, 9);
    // Half a breath later the sine is at its trough; a whole breath later, the crest again.
    clock.set(100.15 + (BREATH_SLOTS * SLOT) / 2);
    expect(Math.sin(c.breathPhase())).toBeCloseTo(-1, 9);
    clock.set(100.15 + BREATH_SLOTS * SLOT);
    expect(Math.sin(c.breathPhase())).toBeCloseTo(1, 9);
    expect(c.slotPhase()).toBeCloseTo(0, 9);
    // Monotonic: a consumer may integrate nothing and difference it freely.
    const before = c.breathPhase();
    clock.set(100.15 + BREATH_SLOTS * SLOT + 1);
    expect(c.breathPhase()).toBeGreaterThan(before);
  });

  it("disarms into the unarmed answers and forgets its onsets", () => {
    const clock = clockAt(100);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    c.sound({ conceptId: "a", at: 100, duration: 0.5, weight: 1 });
    clock.set(100.1);
    expect(c.light("a")).toBeGreaterThan(0);
    c.disarm();
    expect(c.armed()).toBe(false);
    expect(c.light("a")).toBe(0);
    expect(c.next(HAND_DIVISION)).toBeCloseTo(100.1 + UNARMED_LEAD_SECONDS, 9);
    // A zero slot cannot arm.
    c.arm({ slotSeconds: 0, origin: 100 });
    expect(c.armed()).toBe(false);
  });

  it("reports what the test adapter shows", () => {
    const clock = clockAt(100.2);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    expect(c.report()).toEqual({
      armed: true,
      slotSeconds: SLOT,
      slotPhase: expect.closeTo(0.025, 9) as number,
      breathPhase: expect.any(Number) as number,
      nextHandAt: expect.closeTo(100.275, 9) as number,
      nextAnswerAt: expect.closeTo(100.4, 9) as number,
    });
  });
});

describe("the light on a concept", () => {
  it("rises at the onset, decays over the duration, and is dark before and after", () => {
    expect(lightEnvelope(-0.01, 0.5, 1)).toBe(0);
    expect(lightEnvelope(0, 0.5, 1)).toBe(0);
    expect(lightEnvelope(LIGHT_RISE_SECONDS / 2, 0.5, 1)).toBeCloseTo(0.5, 9);
    expect(lightEnvelope(LIGHT_RISE_SECONDS, 0.5, 1)).toBeCloseTo(1, 9);
    expect(lightEnvelope(LIGHT_RISE_SECONDS + 0.25, 0.5, 1)).toBeCloseTo(0.25, 9);
    expect(lightEnvelope(LIGHT_RISE_SECONDS + 0.5, 0.5, 1)).toBe(0);
    expect(lightEnvelope(LIGHT_RISE_SECONDS + 1, 0.5, 1)).toBe(0);
    // The crest is the weight.
    expect(lightEnvelope(LIGHT_RISE_SECONDS, 0.5, 0.35)).toBeCloseTo(0.35, 9);
  });

  it("bounds the decay to a legible range whatever the voice's length", () => {
    // A very short voice still glows for the minimum.
    expect(lightEnvelope(LIGHT_RISE_SECONDS + LIGHT_DECAY_MIN_SECONDS / 2, 0.01, 1)).toBeCloseTo(0.25, 9);
    expect(lightEnvelope(LIGHT_RISE_SECONDS + LIGHT_DECAY_MIN_SECONDS, 0.01, 1)).toBe(0);
    // A very long one does not glow for ever.
    expect(lightEnvelope(LIGHT_RISE_SECONDS + LIGHT_DECAY_MAX_SECONDS, 30, 1)).toBe(0);
    expect(lightEnvelope(LIGHT_RISE_SECONDS + LIGHT_DECAY_MAX_SECONDS / 2, 30, 1)).toBeCloseTo(0.25, 9);
  });

  it("lights only the concept that sounds, from its scheduled onset", () => {
    const clock = clockAt(100);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    c.sound({ conceptId: "a", at: 100.4, duration: 0.6, weight: 1 });
    expect(c.light("a")).toBe(0);
    expect(c.light("b")).toBe(0);
    clock.set(100.4 + LIGHT_RISE_SECONDS);
    expect(c.light("a")).toBeCloseTo(1, 9);
    expect(c.light("b")).toBe(0);
    clock.set(100.4 + LIGHT_RISE_SECONDS + 0.6);
    expect(c.light("a")).toBeCloseTo(0, 9);
  });

  it("merges two onsets on one concept inside the flicker window, keeping the stronger", () => {
    const clock = clockAt(100);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    c.sound({ conceptId: "a", at: 100.4, duration: 0.5, weight: 0.35 });
    c.sound({ conceptId: "a", at: 100.4 + LIGHT_MERGE_SECONDS / 2, duration: 0.5, weight: 1 });
    // The stronger, later onset replaced the weaker: dark at the first time…
    clock.set(100.4 + LIGHT_RISE_SECONDS);
    expect(c.light("a")).toBe(0);
    // …and full at the second.
    clock.set(100.4 + LIGHT_MERGE_SECONDS / 2 + LIGHT_RISE_SECONDS);
    expect(c.light("a")).toBeCloseTo(1, 9);
    // A weaker onset inside the window of a stronger one is dropped.
    c.sound({ conceptId: "a", at: 100.4 + LIGHT_MERGE_SECONDS / 2 + 0.1, duration: 0.5, weight: 0.35 });
    clock.set(100.4 + LIGHT_MERGE_SECONDS / 2 + 0.1 + LIGHT_RISE_SECONDS);
    expect(c.light("a")).toBeCloseTo(1 * (1 - 0.1 / 0.5) ** 2, 6);
    // Outside the window, both stand.
    c.sound({ conceptId: "a", at: 101.4, duration: 0.5, weight: 0.35 });
    clock.set(101.4 + LIGHT_RISE_SECONDS);
    expect(c.light("a")).toBeCloseTo(0.35, 9);
  });

  it("holds a bounded ring, letting forgotten onsets go before the oldest", () => {
    const clock = clockAt(100);
    const c = createConductor(clock);
    c.arm({ slotSeconds: SLOT, origin: 100.15 });
    for (let i = 0; i < ONSET_CAPACITY; i += 1) {
      c.sound({ conceptId: `c${i}`, at: 100 + i, duration: 0.5, weight: 1 });
    }
    // Full: the next write evicts the oldest (c0), not the newest.
    c.sound({ conceptId: "late", at: 200, duration: 0.5, weight: 1 });
    clock.set(100 + LIGHT_RISE_SECONDS);
    expect(c.light("c0")).toBe(0);
    clock.set(101 + LIGHT_RISE_SECONDS);
    expect(c.light("c1")).toBeCloseTo(1, 9);
    // Once an onset is long past, its lane is reused first.
    clock.set(150);
    c.sound({ conceptId: "reuse", at: 150.2, duration: 0.5, weight: 1 });
    clock.set(150.2 + LIGHT_RISE_SECONDS);
    expect(c.light("reuse")).toBeCloseTo(1, 9);
    clock.set(200 + LIGHT_RISE_SECONDS);
    expect(c.light("late")).toBeCloseTo(1, 9);
  });

  it("ignores a weightless onset and clamps the weight", () => {
    const clock = clockAt(100);
    const c = createConductor(clock);
    c.sound({ conceptId: "a", at: 100, duration: 0.5, weight: 0 });
    c.sound({ conceptId: "b", at: 100, duration: 0.5, weight: 5 });
    clock.set(100 + LIGHT_RISE_SECONDS);
    expect(c.light("a")).toBe(0);
    expect(c.light("b")).toBeCloseTo(1, 9);
  });

  it("weights by role, and by nothing else", () => {
    // Every role has a weight; none reads an outcome.
    for (const role of AUDIO_VOICE_ROLES) {
      expect(LIGHT_WEIGHT_BY_ROLE[role]).toBeGreaterThan(0);
      expect(LIGHT_WEIGHT_BY_ROLE[role]).toBeLessThanOrEqual(1);
    }
    expect(LIGHT_WEIGHT_BY_ROLE.subject).toBe(1);
    expect(LIGHT_WEIGHT_BY_ROLE.answer).toBe(1);
    expect(CHOIR_LIGHT_WEIGHT).toBeLessThan(1);
    expect(HAND_LIGHT_WEIGHT).toBeLessThan(CHOIR_LIGHT_WEIGHT);
    expect(Object.keys(LIGHT_WEIGHT_BY_ROLE).sort()).toEqual([...AUDIO_VOICE_ROLES].sort());
  });
});

describe("one sound of a kind per grid point", () => {
  it("grants the first claim and refuses a second at the same time", () => {
    const c = createConductor(clockAt(100));
    expect(c.claim("hover", 100.25)).toBe(true);
    expect(c.claim("hover", 100.25)).toBe(false);
    expect(c.claim("hover", 100.2500004)).toBe(false);
    expect(c.claim("select", 100.25)).toBe(true);
    expect(c.claim("hover", 100.375)).toBe(true);
    c.reset();
    expect(c.claim("hover", 100.375)).toBe(true);
  });
});
