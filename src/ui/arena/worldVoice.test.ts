import { describe, expect, it } from "vitest";
import { planAttention, planReadingPreviewed } from "@/runtime/cues";
import { toConceptId, toEventId } from "@/domain/ids";
import type { CaptionContext } from "@/runtime/captions";
import { WORLD_VOICE_CUES, worldVoiceCaption } from "./worldVoice";
import {
  documentedCue,
  motifCue,
  openThreadCue,
  unresolvedCue,
  wovenCue,
} from "./testing/cueFixtures";

const context: CaptionContext = {
  conceptName: (id) =>
    ({
      "measure.fibonacci-sequence": "Fibonacci Sequence",
      "sound.counterpoint": "Counterpoint",
    })[id] ?? "",
  facetName: (id) => (id === "proportion" ? "Proportion" : ""),
};

/**
 * The live region a screen-reader player hears the world through. Before it
 * existed, `describeCue` had no production consumer at all and the only thing
 * announced was the mechanics of the player's own input.
 */
describe("the world's voice", () => {
  it("announces every outcome shape with its evidence phrase (B4)", () => {
    const documented = worldVoiceCaption(documentedCue("contested"), context);
    expect(documented).not.toBeNull();
    expect(documented!.text).toContain("specialists disagree");

    const open = worldVoiceCaption(openThreadCue(), context);
    expect(open).not.toBeNull();
    expect(open!.text).toContain("Nothing written settles this");
    expect(open!.text).toContain("Proportion");

    const unresolved = worldVoiceCaption(unresolvedCue(), context);
    expect(unresolved).not.toBeNull();
    expect(unresolved!.text).toContain("no grounded relation here yet");

    expect(worldVoiceCaption(motifCue(), context)).not.toBeNull();
  });

  it("never speaks of a record when the relation is a reading (B5)", () => {
    for (const reception of ["confirmed", "refined", "complicated"] as const) {
      const caption = worldVoiceCaption(
        documentedCue("interpretive", reception),
        context
      );
      expect(caption).not.toBeNull();
      expect(caption!.text).toContain("not a claim about influence");
      expect(caption!.text).not.toMatch(/record/i);
      // The correction replaces the clause; it does not delete it, so the
      // player is still told how their reading stood.
      expect(caption!.text).toMatch(/The Game reads it/);
    }
  });

  it("still lets a documented relation speak in the record's voice", () => {
    const caption = worldVoiceCaption(
      documentedCue("established", "complicated"),
      context
    );
    expect(caption!.text).toContain("standard in the field");
    expect(caption!.text).toContain("The record runs across your reading");
  });

  it("leaves the player's own mechanics to the controls' region", () => {
    // Both are already announced by `InterpretationControls`; two polite regions
    // changing in the same tick is how one of them gets dropped.
    const attention = planAttention(
      {
        conceptId: toConceptId("measure.fibonacci-sequence"),
        candidates: [
          { conceptId: toConceptId("sound.counterpoint"), band: "high" },
        ],
      },
      toEventId("event:1")
    ).cues[0];
    const armed = planReadingPreviewed({
      pair: [
        toConceptId("measure.fibonacci-sequence"),
        toConceptId("sound.counterpoint"),
      ],
      intention: "echo",
      chosen: true,
    }).cues[0];

    expect(worldVoiceCaption(attention, context)).toBeNull();
    expect(worldVoiceCaption(armed, context)).toBeNull();
    expect(worldVoiceCaption(wovenCue(), context)).toBeNull();
    expect(WORLD_VOICE_CUES.has("thread.woven")).toBe(false);
    expect(WORLD_VOICE_CUES.has("attention.enter")).toBe(false);
  });

  it("carries the three outcome shapes and does not quietly drop one", () => {
    expect(WORLD_VOICE_CUES.has("outcome.documented")).toBe(true);
    expect(WORLD_VOICE_CUES.has("outcome.open-thread")).toBe(true);
    expect(WORLD_VOICE_CUES.has("outcome.unresolved")).toBe(true);
  });
});
