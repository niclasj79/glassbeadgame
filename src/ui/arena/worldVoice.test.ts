import { describe, expect, it } from "vitest";
import {
  planAttention,
  planPairLocked,
  planReadingPreviewed,
  planSighting,
  type PresentationCue,
} from "@/runtime/cues";
import { toConceptId, toEventId } from "@/domain/ids";
import { toFacetId } from "@/content/castalia/schema";
import { describeCue, type CaptionContext } from "@/runtime/captions";
import { NEVER_ASSERTIVE, WORLD_VOICE_CUES, worldVoiceCaption } from "./worldVoice";
import { reopenedCue } from "./testing/focusFixtures";
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

const FIBONACCI = toConceptId("measure.fibonacci-sequence");
const COUNTERPOINT = toConceptId("sound.counterpoint");

const sighting = (sighted: boolean): PresentationCue =>
  planSighting({
    attendedConceptId: FIBONACCI,
    sighted: sighted
      ? {
          conceptId: COUNTERPOINT,
          band: "high",
          sharedFacets: [toFacetId("proportion")],
        }
      : null,
  }).cues[0];

/**
 * The focus view's new moments (M2-012). A sighting is the world answering —
 * the bead under the lens and what it shares — and nothing else says it in
 * words, so it is spoken. Locking, choosing a reading and reopening are the
 * player's own acts, which the controls' region already announces in the same
 * tick, so they stay there.
 */
describe("the world's voice in the focus view", () => {
  it("says what the sighted bead shares, in words and never as a band", () => {
    const caption = worldVoiceCaption(sighting(true), context);
    expect(caption).not.toBeNull();
    expect(caption!.text).toContain("Counterpoint");
    expect(caption!.text).toContain("Proportion");
    expect(caption!.text).not.toMatch(/\d|strong|high|resonance|documented|record/i);
  });

  it("says nothing when the lens leaves every bead and the gap opens again", () => {
    expect(worldVoiceCaption(sighting(false), context)).toBeNull();
  });

  it("never lets a sweep of the lens reach the assertive region", () => {
    // `CueCaptions` routes a polite caption to its status region and only an
    // assertive one to its alert; a sighting is never the latter. The caption
    // rules say polite today, and `NEVER_ASSERTIVE` holds it there whatever
    // they come to say: a lens sweeps faster than a reader can be interrupted.
    expect(describeCue(sighting(true), context)?.urgency).toBe("polite");
    expect(NEVER_ASSERTIVE.has("attention.sighted")).toBe(true);
    expect(worldVoiceCaption(sighting(true), context)!.urgency).toBe("polite");
  });

  it("leaves the lock, the chosen reading and the reopening to the controls' region", () => {
    const locked = planPairLocked({
      pair: [FIBONACCI, COUNTERPOINT],
      sharedFacets: [toFacetId("proportion")],
    }).cues[0];
    const heard = planReadingPreviewed({
      pair: [FIBONACCI, COUNTERPOINT],
      intention: "tension",
      chosen: false,
    }).cues[0];
    for (const cue of [locked, heard, reopenedCue()]) {
      expect(worldVoiceCaption(cue, context)).toBeNull();
      // Each still has a caption of its own for any surface that wants it.
      expect(describeCue(cue, context)).not.toBeNull();
    }
    expect(WORLD_VOICE_CUES.has("pair.locked")).toBe(false);
    expect(WORLD_VOICE_CUES.has("reading.previewed")).toBe(false);
    expect(WORLD_VOICE_CUES.has("thread.reopened")).toBe(false);
  });
});
