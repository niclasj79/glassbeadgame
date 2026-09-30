import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CaptionContext } from "@/runtime/captions";
import type { CueType, PresentationCue } from "@/runtime/cues";
import { CueCaptions, PoliteWords } from "./CueCaptions";
import {
  NEVER_ASSERTIVE,
  SAID_AGAIN,
  WORLD_VOICE_CUES,
  worldVoiceCaption,
} from "./worldVoice";

/**
 * A STUDY'S ANSWERS, IN THE WORLD'S VOICE (STUDIES-SPEC §5–§7).
 *
 * *Solved* and *not yet* reach the polite live region the world speaks
 * through, are never allowed to interrupt, and are said again when they are
 * given again. Their words are `describeCue`'s; here they are given as the
 * caption layer might at its most insistent — assertive — to show the region
 * holds them polite whatever it is told.
 */

const captions = vi.hoisted(() => ({
  "study.solved": {
    text: "Solved: Carry Proportion into Matter — it cannot be done with these beads.",
    urgency: "assertive" as const,
  },
  "study.not-yet": {
    text: "Not yet — it can be done with these beads.",
    urgency: "assertive" as const,
  },
}));

vi.mock("@/runtime/captions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/runtime/captions")>();
  return {
    ...actual,
    describeCue: (cue: PresentationCue, context: CaptionContext) =>
      (captions as Record<string, { text: string; urgency: "polite" | "assertive" }>)[cue.type] ??
      actual.describeCue(cue, context),
  };
});

const context: CaptionContext = {
  conceptName: (id) => String(id),
  facetName: (id) => String(id),
};

const SOLVED = "study.solved" as CueType;
const NOT_YET = "study.not-yet" as CueType;

/** A Study cue as the runtime stages it: ephemeral, and named by its kind. */
const studyCue = (type: CueType, payload: object): PresentationCue =>
  ({
    id: `cue:ephemeral:${type}:0`,
    type,
    sourceEventId: null,
    startAt: 0,
    duration: 0.6,
    channels: ["caption"],
    payload,
  }) as unknown as PresentationCue;

describe("a Study's answers in the world's voice", () => {
  it("carries solved and not yet to the region the world speaks through", () => {
    expect(WORLD_VOICE_CUES.has(SOLVED)).toBe(true);
    expect(WORLD_VOICE_CUES.has(NOT_YET)).toBe(true);

    const notYet = worldVoiceCaption(
      studyCue(NOT_YET, { studyId: "study.eschholz-1", statement: "can-be-done" }),
      context
    );
    expect(notYet).toEqual({ text: "Not yet — it can be done with these beads.", urgency: "polite" });

    const solved = worldVoiceCaption(
      studyCue(SOLVED, {
        studyId: "study.eschholz-4",
        by: "silence",
        threadIds: [],
        conceptIds: [],
        marks: [],
        brief: "Carry Proportion into Matter",
      }),
      context
    );
    expect(solved?.text).toBe(
      "Solved: Carry Proportion into Matter — it cannot be done with these beads."
    );
    expect(solved?.urgency).toBe("polite");
  });

  it("never lets either interrupt", () => {
    expect(NEVER_ASSERTIVE.has(SOLVED)).toBe(true);
    expect(NEVER_ASSERTIVE.has(NOT_YET)).toBe(true);
  });

  it("says a Study's answers again, and nothing of the Free Game's", () => {
    // Only the two answers: every Free Game caption is set exactly as before.
    expect([...SAID_AGAIN].sort()).toEqual([SOLVED, NOT_YET].sort());
  });

  it("writes an answer said again as a new element for every arrival", () => {
    const words = "Not yet — it can be done with these beads.";
    const first = PoliteWords({ text: words, arrival: 1 });
    const second = PoliteWords({ text: words, arrival: 2 });
    expect(isValidElement(first) && first.type).toBe("span");
    expect(isValidElement(first) && first.key).toBe("1");
    expect(isValidElement(second) && second.key).toBe("2");
    // The same words, so only a new element tells the region they were said again.
    expect(renderToStaticMarkup(first)).toBe(renderToStaticMarkup(second));
  });

  it("writes every other caption as the region's plain text, as it always was", () => {
    const region = (child: ReturnType<typeof createElement> | string): string =>
      renderToStaticMarkup(
        createElement("p", { role: "status", "aria-live": "polite", "aria-atomic": "true" }, child)
      );
    const words = "Fibonacci Sequence under the lens.";
    expect(region(createElement(PoliteWords, { text: words, arrival: null }))).toBe(region(words));
    // At rest the region is empty, as before.
    expect(renderToStaticMarkup(createElement(CueCaptions))).toMatch(
      /<p role="status" aria-live="polite" aria-atomic="true"><\/p>/
    );
  });
});
