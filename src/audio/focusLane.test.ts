import { describe, expect, it } from "vitest";

import { COMFORT, tensionCeiling } from "./comfort";
import { admit, createFocusLane, type FocusVoice } from "./focusLane";
import { FOCUS_VOICING } from "./focusVoicing";
import { makeVoicePlan, type PlannedNote, type VoicePlan } from "./plan";
import { SCORE } from "./score";

const BED = SCORE.grammar.bedGain;

const note = (
  id: string,
  atSeconds: number,
  envelope: { attack: number; hold: number; release: number },
  extra: Partial<PlannedNote> = {}
): PlannedNote =>
  Object.freeze({
    id,
    conceptId: "c",
    role: "subject",
    timbre: "glass",
    articulation: "sustained",
    register: "mid",
    degree: 0,
    frequency: 220,
    detuneCents: 0,
    atSeconds,
    envelope: Object.freeze(envelope),
    gain: 0.1,
    floorGain: 0,
    openEnded: false,
    tense: false,
    ...extra,
  }) as PlannedNote;

const planOf = (id: string, notes: readonly PlannedNote[]): VoicePlan =>
  makeVoicePlan({
    id,
    kind: "relation",
    intention: null,
    notes,
    meta: {
      conceptIds: [],
      grammar: "fixture",
      resolves: false,
      interval: null,
      beatingHz: null,
      outcome: null,
    },
  });

/** A voice sounding for `attack + hold` and then releasing over `release`. */
const voice = (
  id: string,
  onsetSeconds: number,
  extra: { attack?: number; hold?: number; release?: number; tense?: boolean } = {}
): FocusVoice => ({
  id,
  kind: "reading",
  onsetSeconds,
  plan: planOf(id, [
    note(`${id}:0`, 0, {
      attack: extra.attack ?? 0.1,
      hold: extra.hold ?? 0.9,
      release: extra.release ?? 1,
    }, { tense: extra.tense ?? false }),
  ]),
});

const tenseVoice = (id: string, onsetSeconds: number, voices = 3, gain = 0.02): FocusVoice => ({
  id,
  kind: "reading",
  onsetSeconds,
  plan: planOf(
    id,
    Array.from({ length: voices }, (_, index) =>
      note(`${id}:${index}`, index * 0.1, { attack: 0.3, hold: 0.7, release: 0.5 }, {
        tense: true,
        gain,
      })
    )
  ),
});

describe("the focus lane's ledger", () => {
  it("holds a voice until it has stopped mattering, and no longer", () => {
    const lane = createFocusLane();
    lane.add(voice("a", 10)); // attack .1 + hold .9 + a third of a 1 s release
    expect(lane.live(10.5).map((v) => v.id)).toEqual(["a"]);
    // Through its attack and hold and a third of its release: 10 + 1 + 0.35.
    expect(lane.live(11.3).map((v) => v.id)).toEqual(["a"]);
    expect(lane.live(11.4)).toEqual([]);
  });

  it("counts a voice that has not begun yet as sounding — it is about to be", () => {
    const lane = createFocusLane();
    lane.add(voice("later", 12));
    expect(lane.soundingAt(10)).toBe(1);
    expect(lane.live(10).map((v) => v.id)).toEqual(["later"]);
  });

  it("counts every voice still sounding at a moment", () => {
    const lane = createFocusLane();
    lane.add(voice("a", 10));
    lane.add(voice("b", 10.5));
    expect(lane.soundingAt(10.6)).toBe(2);
    expect(lane.soundingAt(11.5)).toBe(1);
    expect(lane.soundingAt(12)).toBe(0);
  });

  it("lets a retirement finish a voice: still there before, gone once the fade is over", () => {
    const lane = createFocusLane();
    lane.add(voice("a", 10));
    lane.retire("a", 10.5, 0.06);
    expect(lane.soundingAt(10.55)).toBe(1);
    expect(lane.soundingAt(10.56)).toBe(0);
    expect(lane.soundingAt(10.6)).toBe(0);
  });

  it("never lets a voice that had not begun by its retirement sound at all", () => {
    const lane = createFocusLane();
    lane.add(voice("pending", 12));
    lane.retire("pending", 10, 0.06);
    expect(lane.soundingAt(10.06)).toBe(0);
    expect(lane.soundingAt(12.2)).toBe(0);
    expect(lane.live(10.01)).toEqual([]);
  });

  it("does not leave a sliver of a voice due a moment after its retirement", () => {
    // Retired at 10.00, due at 10.03 — inside the fade. The contract is that
    // what has not begun never does, so it is not counted, not even faintly.
    const lane = createFocusLane();
    lane.add(voice("sliver", 10.03));
    lane.retire("sliver", 10, 0.06);
    expect(lane.soundingAt(10.03)).toBe(0);
    expect(lane.soundingAt(10.04)).toBe(0);
  });

  it("does not count a tense voice that will never begin", () => {
    const lane = createFocusLane();
    lane.add(tenseVoice("t", 10.03));
    lane.retire("t", 10, 0.06);
    expect(lane.tenseAt(10.04)).toEqual({ voices: 0, gain: 0 });
  });

  it("can only be asked to stop sooner, never later", () => {
    const lane = createFocusLane();
    lane.add(voice("a", 10));
    lane.retire("a", 10.2, 0.06);
    lane.retire("a", 10.8, 0.06);
    expect(lane.soundingAt(10.27)).toBe(0);
    lane.retire("a", 10.1, 0.06);
    expect(lane.soundingAt(10.17)).toBe(0);
    expect(lane.soundingAt(10.15)).toBe(1);
  });

  it("retires the newest voice with an id, and leaves an older namesake alone", () => {
    const lane = createFocusLane();
    lane.add(voice("same", 10));
    lane.add(voice("same", 10.4));
    lane.retire("same", 10.5, 0.05);
    const live = lane.live(10.6);
    expect(live).toHaveLength(1);
    expect(live[0].onsetSeconds).toBe(10);
    expect(live[0].retiredAt).toBeNull();
  });

  it("reports whether a live voice has been asked to stop", () => {
    const lane = createFocusLane();
    lane.add(voice("a", 10));
    expect(lane.live(10.1)[0].retiredAt).toBeNull();
    lane.retire("a", 10.2, 0.06);
    expect(lane.live(10.1)[0].retiredAt).toBe(10.2);
  });

  it("ignores a retirement of a voice it never held", () => {
    const lane = createFocusLane();
    lane.add(voice("a", 10));
    lane.retire("nobody", 10.1, 0.06);
    expect(lane.soundingAt(10.5)).toBe(1);
  });

  it("counts tense notes until they have stopped altogether, and sums their level", () => {
    const lane = createFocusLane();
    lane.add(tenseVoice("t", 10, 3, 0.02));
    const during = lane.tenseAt(10.5);
    expect(during.voices).toBe(3);
    expect(during.gain).toBeCloseTo(0.06, 9);
    // The last tense note begins at .2 and lives 1.5 s: 11.7. A tail counts —
    // CAV-007 bounds sounding voices, and a voice in its release is sounding.
    expect(lane.tenseAt(11.6).voices).toBeGreaterThan(0);
    expect(lane.tenseAt(11.8).voices).toBe(0);
  });

  it("does not count ordinary notes as tense", () => {
    const lane = createFocusLane();
    lane.add(voice("plain", 10));
    expect(lane.tenseAt(10.5)).toEqual({ voices: 0, gain: 0 });
  });

  it("stops counting a retired tense voice once its fade has finished", () => {
    const lane = createFocusLane();
    lane.add(tenseVoice("t", 10));
    lane.retire("t", 10.4, 0.06);
    expect(lane.tenseAt(10.5).voices).toBe(0);
    expect(lane.tenseAt(10.45).voices).toBeGreaterThan(0);
  });

  it("forgets everything on clear", () => {
    const lane = createFocusLane();
    lane.add(voice("a", 10));
    lane.clear();
    expect(lane.soundingAt(10.5)).toBe(0);
    expect(lane.live(10.5)).toEqual([]);
  });

  it("cannot be grown without bound", () => {
    const lane = createFocusLane();
    for (let index = 0; index < 100; index += 1) lane.add(voice(`v${index}`, 10));
    expect(lane.live(10.5).length).toBeLessThanOrEqual(16);
  });
});

describe("admission", () => {
  const plain = planOf("plain", [note("p", 0, { attack: 0.1, hold: 0.5, release: 0.4 })]);
  const tense = tenseVoice("tension", 0).plan;
  const ceiling = tensionCeiling(BED);
  const { overlapDuck, minScale } = FOCUS_VOICING.lane;

  const lane = (sounding: number, tenseVoices = 0, tenseGain = 0) => ({
    soundingAt: () => sounding,
    tenseAt: () => ({ voices: tenseVoices, gain: tenseGain }),
  });

  it("admits a voice whole when nothing is sounding under it", () => {
    expect(admit(plain, lane(0), 10, BED)).toEqual({ play: true, scale: 1 });
  });

  it("ducks a voice for each voice still sounding under it", () => {
    expect(admit(plain, lane(1), 10, BED).scale).toBeCloseTo(overlapDuck, 9);
    expect(admit(plain, lane(2), 10, BED).scale).toBeCloseTo(overlapDuck ** 2, 9);
  });

  it("declines a voice it would have to duck below the floor, rather than stack it", () => {
    expect(overlapDuck ** 2).toBeGreaterThanOrEqual(minScale);
    expect(overlapDuck ** 3).toBeLessThan(minScale);
    expect(admit(plain, lane(3), 10, BED)).toEqual({ play: false, scale: 0 });
  });

  it("admits a Tension when no tense voice is sounding", () => {
    expect(admit(tense, lane(0, 0, 0), 10, BED).play).toBe(true);
  });

  it("declines a Tension that would put more than three tense voices in the air", () => {
    expect(COMFORT.tension.maxConcurrentVoices).toBe(3);
    expect(admit(tense, lane(0, 1, 0.01), 10, BED).play).toBe(false);
    expect(admit(tense, lane(0, 3, 0.05), 10, BED).play).toBe(false);
  });

  it("declines a Tension whose level would push the tense pair past the ceiling", () => {
    // Two voices under, one more allowed — but the summed level says no.
    const oneVoice = tenseVoice("one", 0, 1, 0.01).plan;
    expect(admit(oneVoice, lane(0, 2, ceiling), 10, BED).play).toBe(false);
    expect(admit(oneVoice, lane(0, 2, 0), 10, BED).play).toBe(true);
  });

  it("does not let ordinary voices under a Tension count against its tense allowance", () => {
    expect(admit(tense, lane(1, 0, 0), 10, BED).play).toBe(true);
  });

  it("measures the tense ceiling against the bed as it sounds now", () => {
    const heavy = tenseVoice("heavy", 0, 3, ceiling / 3.5).plan;
    expect(admit(heavy, lane(0, 0, 0), 10, BED).play).toBe(true);
    // A thinner bed lowers the ceiling under a plan sized for the nominal one.
    expect(admit(heavy, lane(0, 0, 0), 10, BED * 0.3).play).toBe(false);
  });
});
