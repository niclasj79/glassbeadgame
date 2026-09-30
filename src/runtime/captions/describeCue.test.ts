import { describe, expect, it } from "vitest";
import { toConceptId, toEventId, toThreadId } from "@/domain/ids";
import type { DocumentedRelation } from "@/content/castalia/schema";
import { describeStudyStatus } from "@/domain/studies";
import { planStudyNotYet, planStudySolved } from "../cues/planCues";
import {
  planAttention,
  planCommitMoment,
  planPairLocked,
  planReadingPreviewed,
  planSighting,
  planThreadReopened,
  type PresentationCue,
} from "../cues";
import { describeCue, type CaptionContext } from "./describeCue";

const A = toConceptId("measure.fibonacci-sequence");
const B = toConceptId("sound.counterpoint");
const PAIR = Object.freeze([A, B]) as readonly [typeof A, typeof B];
const THREAD = toThreadId("thread:1:s:1");
const EVENT = toEventId("event:1");

const context: CaptionContext = {
  conceptName: (id) =>
    ({
      "measure.fibonacci-sequence": "Fibonacci Sequence",
      "sound.counterpoint": "Counterpoint",
    })[id] ?? "",
  facetName: (id) => (id === "recursion" ? "Recursion" : ""),
};

const relation = (
  overrides: Partial<DocumentedRelation> = {}
): DocumentedRelation =>
  ({
    id: "measure.fibonacci-sequence~sound.counterpoint",
    pair: [String(A), String(B)],
    title: "A rule that restates itself",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { echo: "primary", passage: "partial", tension: "unsupported", ground: "supported" },
    insight: "Both regenerate structure by reapplying a rule to its own result.",
    sharedFacets: [],
    sources: [],
    ...overrides,
  }) as DocumentedRelation;

const commitCue = (
  outcome: Parameters<typeof planCommitMoment>[0]["outcome"]
): PresentationCue =>
  planCommitMoment({
    woven: {
      threadId: THREAD,
      pair: PAIR,
      intention: "echo",
      gesture: { inputModality: "mouse", durationMs: 500 },
    },
    wovenEventId: EVENT,
    outcome,
  }).cues[1];

const documentedCue = (evidence: DocumentedRelation["evidence"], reception: "confirmed" | "refined" | "complicated") =>
  commitCue({
    kind: "documented",
    eventId: EVENT,
    payload: {
      threadId: THREAD,
      pair: PAIR,
      intention: "echo",
      relation: relation({ evidence }),
      evidence,
      reception,
    },
  });

/** Copy that would break the product's promises, in any caption. */
const FORBIDDEN =
  /\b(well done|excellent|great|congratulations|correct|incorrect|wrong|amazing|perfect|everything is connected|you have discovered)\b/i;

describe("cue captions", () => {
  it("never praises the player and never calls a reading wrong", () => {
    const cues: PresentationCue[] = [
      planAttention(
        { conceptId: A, candidates: [{ conceptId: B, band: "high" }] },
        null
      ).cues[0],
      planReadingPreviewed({ pair: PAIR, intention: "tension", chosen: true }).cues[0],
      planSighting({
        attendedConceptId: A,
        sighted: { conceptId: B, band: "high", sharedFacets: ["recursion" as never] },
      }).cues[0],
      planPairLocked({ pair: PAIR, sharedFacets: [] }).cues[0],
      planThreadReopened({ threadId: THREAD, pair: PAIR, intention: "ground" }).cues[0],
      documentedCue("established", "confirmed"),
      documentedCue("contested", "complicated"),
      commitCue({
        kind: "open-thread",
        eventId: EVENT,
        payload: {
          threadId: THREAD,
          pair: PAIR,
          intention: "echo",
          question: "Does the proportion appear in the construction, or only in the count?",
          sharedFacet: "recursion" as never,
        },
      }),
      commitCue({
        kind: "unresolved",
        payload: {
          threadId: THREAD,
          pair: PAIR,
          intention: "echo",
          statement: "The Game has no grounded relation here yet.",
        },
      }),
    ];
    for (const cue of cues) {
      const caption = describeCue(cue, context);
      expect(caption).not.toBeNull();
      expect(caption!.text).not.toMatch(FORBIDDEN);
    }
  });

  it("states epistemic status plainly, because sound conveys it least well", () => {
    expect(describeCue(documentedCue("established", "confirmed"), context)!.text).toContain(
      "standard in the field"
    );
    expect(describeCue(documentedCue("contested", "confirmed"), context)!.text).toContain(
      "specialists disagree"
    );
    expect(describeCue(documentedCue("interpretive", "confirmed"), context)!.text).toContain(
      "not a claim about influence"
    );
  });

  it("distinguishes all three receptions without ranking the player", () => {
    const said = new Set(
      (["confirmed", "refined", "complicated"] as const).map(
        (reception) => describeCue(documentedCue("established", reception), context)!.text
      )
    );
    expect(said.size).toBe(3);
    const complicated = describeCue(
      documentedCue("established", "complicated"),
      context
    )!.text;
    expect(complicated).toContain("still stands");
  });

  it("discloses before it asks, so an open question is never mistaken for a fact", () => {
    const caption = describeCue(
      commitCue({
        kind: "open-thread",
        eventId: EVENT,
        payload: {
          threadId: THREAD,
          pair: PAIR,
          intention: "echo",
          question: "Does the proportion appear in the construction?",
          sharedFacet: "recursion" as never,
        },
      }),
      context
    )!;
    expect(caption.text.indexOf("Nothing written settles")).toBeLessThan(
      caption.text.indexOf("Does the proportion")
    );
    expect(caption.text).toContain("Recursion");
  });

  it("carries relation meaning in words, so nothing depends on colour", () => {
    for (const intention of ["echo", "passage", "tension", "ground"] as const) {
      const caption = describeCue(
        planReadingPreviewed({ pair: PAIR, intention, chosen: false }).cues[0],
        context
      )!;
      expect(caption.text.toLowerCase()).toContain(intention);
    }
  });

  it("reports resonance in words rather than as a score", () => {
    const caption = describeCue(
      planAttention(
        {
          conceptId: A,
          candidates: [
            { conceptId: B, band: "high" },
            { conceptId: toConceptId("x"), band: "weak" },
          ],
        },
        null
      ).cues[0],
      context
    )!;
    expect(caption.text).toContain("strong resonance");
    expect(caption.text).not.toMatch(/\d+%|score|points/i);
  });

  it("says so honestly when nothing answers", () => {
    const caption = describeCue(
      planAttention(
        { conceptId: A, candidates: [{ conceptId: B, band: "weak" }] },
        null
      ).cues[0],
      context
    )!;
    expect(caption.text).toContain("Nothing in the arena answers strongly yet");
  });

  it("falls back to an id rather than to silence when a name is missing", () => {
    const caption = describeCue(
      planAttention(
        { conceptId: toConceptId("unknown.bead"), candidates: [] },
        null
      ).cues[0],
      context
    )!;
    expect(caption.text).toContain("unknown.bead");
  });

  it("says what a sighted bead shares, or that it shares nothing, and stays quiet when the gap reopens", () => {
    const shared = describeCue(
      planSighting({
        attendedConceptId: A,
        sighted: { conceptId: B, band: "weak", sharedFacets: ["recursion" as never] },
      }).cues[0],
      context
    )!;
    expect(shared.text).toMatch(/shares/i);
    expect(shared.text).not.toMatch(/documented|record|weak|strong/i);

    const none = describeCue(
      planSighting({
        attendedConceptId: A,
        sighted: { conceptId: B, band: "high", sharedFacets: [] },
      }).cues[0],
      context
    )!;
    expect(none.text).toMatch(/shares no facet/i);

    expect(
      describeCue(planSighting({ attendedConceptId: A, sighted: null }).cues[0], context)
    ).toBeNull();
  });

  it("names the pair on lock and asks for a reading without ranking the four", () => {
    const caption = describeCue(planPairLocked({ pair: PAIR, sharedFacets: [] }).cues[0], context)!;
    expect(caption.text).toMatch(/Echo, Passage, Tension or Ground/);
  });

  it("never interrupts: nothing in the ordinary flow is assertive", () => {
    const cues: PresentationCue[] = [
      planReadingPreviewed({ pair: PAIR, intention: "echo", chosen: true }).cues[0],
      planPairLocked({ pair: PAIR, sharedFacets: [] }).cues[0],
      documentedCue("established", "confirmed"),
    ];
    for (const cue of cues) {
      expect(describeCue(cue, context)!.urgency).toBe("polite");
    }
  });
});

describe("Study captions (M9-001)", () => {
  const solved = (by: "threads" | "silence"): PresentationCue =>
    planStudySolved(
      by === "threads"
        ? {
            studyId: "study.eschholz-1",
            by,
            threadIds: [THREAD],
            conceptIds: [A, B],
            marks: ["economical", "varied"],
            brief: "From The Möbius Band to Counterpoint in two threads",
          }
        : {
            studyId: "study.eschholz-4",
            by,
            threadIds: [],
            conceptIds: [],
            marks: [],
            brief: "Carry Proportion into Matter",
          },
      by === "threads" ? EVENT : null,
      by === "threads" ? 2.4 : 0
    ).cues[0];

  const notYet = (): PresentationCue =>
    planStudyNotYet({ studyId: "study.eschholz-1", statement: "can-be-done" }).cues[0];

  /** STUDIES-SPEC §7 and the packet's constraints: no counter of any kind on a Study surface. */
  const UNCOUNTED = /\d|%|percent|\b(score|scores|points?|rank|ranks|ranked|wrong|total)\b/i;

  it("says a Study is solved in the brief's own words", () => {
    expect(describeCue(solved("threads"), context)).toEqual({
      text: "Solved: From The Möbius Band to Counterpoint in two threads.",
      urgency: "polite",
    });
    expect(describeCue(solved("silence"), context)).toEqual({
      text: "Solved: Carry Proportion into Matter — it cannot be done with these beads.",
      urgency: "polite",
    });
  });

  it("says not yet in the evaluator's own words, and nothing more: no bead, no hint", () => {
    const words = describeStudyStatus(
      { kind: "not-yet", statement: { kind: "can-be-done" } },
      { conceptName: () => "", facetName: () => "", facultyName: () => "" }
    );
    expect(describeCue(notYet(), context)).toEqual({ text: words, urgency: "polite" });
    expect(words).toBe("Not yet — it can be done with these beads.");
  });

  it("passes the copy rules: no praise, no count, no total, no percentage, no score", () => {
    for (const cue of [solved("threads"), solved("silence"), notYet()]) {
      const caption = describeCue(cue, context)!;
      expect(caption.text).not.toMatch(FORBIDDEN);
      expect(caption.text).not.toMatch(UNCOUNTED);
      // The marks stay on the plate; the caption never grades the answer.
      expect(caption.text).not.toMatch(/economical|wide|varied/i);
      expect(caption.urgency).toBe("polite");
    }
  });
});
