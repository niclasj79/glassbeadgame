import { describe, expect, it } from "vitest";
import type { ConceptPair } from "../../domain/events";
import { toConceptId, toThreadId } from "../../domain/ids";
import {
  attendDraft,
  chooseDraftReading,
  createInterpretationDraft,
  deriveFocusView,
  lockDraftCandidate,
  type FocusViewInput,
  type InterpretationDraft,
} from ".";

const A = toConceptId("measure.fibonacci-sequence");
const B = toConceptId("sound.counterpoint");
const C = toConceptId("measure.prime-numbers");
const IDS = Object.freeze([A, B, C]);

const attending = attendDraft(createInterpretationDraft(), A, IDS);
const locked = lockDraftCandidate(attending, B, IDS);
const reading = chooseDraftReading(locked, "tension");

function input(
  draft: InterpretationDraft,
  overrides: Partial<FocusViewInput> = {}
): FocusViewInput {
  return {
    draft,
    sightedConceptId: null,
    dwellConceptId: null,
    previewIntention: null,
    reopened: null,
    holding: false,
    profile: { reducedMotion: false, qualityTier: "base" },
    ...overrides,
  };
}

describe("deriveFocusView", () => {
  it("roams with clear air; a dwelt-on bead takes the top of the column", () => {
    const view = deriveFocusView(input(createInterpretationDraft(), { dwellConceptId: C }));

    expect(view.mode).toBe("roaming");
    expect(view.fog).toEqual({ active: false, blur: false });
    expect(view.lensActive).toBe(false);
    expect(view.sharpConceptIds).toEqual([]);
    expect(view.column).toEqual({
      top: { kind: "bead", conceptId: C, role: "dwell" },
      second: { kind: "empty" },
    });
  });

  it("opens the gap on Attend and fills it with the sighted bead", () => {
    const waiting = deriveFocusView(input(attending));
    expect(waiting.mode).toBe("focus");
    expect(waiting.fog).toEqual({ active: true, blur: true });
    expect(waiting.lensActive).toBe(true);
    expect(waiting.sharpConceptIds).toEqual([A]);
    expect(waiting.column).toEqual({
      top: { kind: "bead", conceptId: A, role: "attended" },
      second: { kind: "gap" },
    });

    const sighted = deriveFocusView(input(attending, { sightedConceptId: C }));
    expect(sighted.sharpConceptIds).toEqual([A, C]);
    expect(sighted.secondConceptId).toBe(C);
    expect(sighted.column.second).toEqual({ kind: "bead", conceptId: C, role: "sighted" });
  });

  it("ignores a dwell card and a self-sighting while attending", () => {
    const view = deriveFocusView(
      input(attending, { dwellConceptId: C, sightedConceptId: A })
    );
    expect(view.column.top).toEqual({ kind: "bead", conceptId: A, role: "attended" });
    expect(view.column.second).toEqual({ kind: "gap" });
  });

  it("locks the pair, blooms the sigils and previews a hovered reading", () => {
    const view = deriveFocusView(input(locked, { previewIntention: "echo" }));

    expect(view.mode).toBe("locked");
    expect(view.lensActive).toBe(false);
    expect(view.sigilsVisible).toBe(true);
    expect(view.sharpConceptIds).toEqual([A, B]);
    expect(view.previewIntention).toBe("echo");
    expect(view.column).toEqual({
      top: { kind: "bead", conceptId: A, role: "attended" },
      second: { kind: "bead", conceptId: B, role: "candidate" },
    });
  });

  it("lets a chosen reading win over a hovered preview", () => {
    const view = deriveFocusView(input(reading, { previewIntention: "echo" }));
    expect(view.mode).toBe("locked");
    expect(view.previewIntention).toBe("tension");
  });

  it("holds a reopened thread only while nothing is being made", () => {
    const pair: ConceptPair = Object.freeze([A, C]);
    const reopened = { threadId: toThreadId("thread:1"), pair };

    const held = deriveFocusView(input(createInterpretationDraft(), { reopened }));
    expect(held.mode).toBe("held");
    expect(held.sharpConceptIds).toEqual([A, C]);
    expect(held.reopenedThreadId).toBe(reopened.threadId);
    expect(held.sigilsVisible).toBe(false);
    expect(held.column).toEqual({
      top: { kind: "bead", conceptId: A, role: "held" },
      second: { kind: "bead", conceptId: C, role: "held" },
    });

    const making = deriveFocusView(input(attending, { reopened }));
    expect(making.mode).toBe("focus");
    expect(making.reopenedThreadId).toBeNull();
  });

  it("drops the blur, never the fog, under reduced motion and on the low tier", () => {
    for (const profile of [
      { reducedMotion: true, qualityTier: "high" as const },
      { reducedMotion: false, qualityTier: "potato" as const },
    ]) {
      const view = deriveFocusView(input(attending, { profile }));
      expect(view.fog).toEqual({ active: true, blur: false });
    }
  });

  it("puts the lens down during a hold", () => {
    expect(deriveFocusView(input(attending, { holding: true })).lensActive).toBe(false);
  });

  it("is pure: equal input gives equal, frozen output", () => {
    const first = deriveFocusView(input(locked));
    const second = deriveFocusView(input(locked));
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.column)).toBe(true);
    expect(Object.isFrozen(first.sharpConceptIds)).toBe(true);
  });
});
