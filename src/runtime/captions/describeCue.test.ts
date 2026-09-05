import { describe, expect, it } from "vitest";
import { toConceptId, toEventId, toThreadId } from "@/domain/ids";
import type { DocumentedRelation } from "@/content/castalia/schema";
import {
  planAttention,
  planCommitMoment,
  planIntentionArmed,
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
      planIntentionArmed({ conceptId: A, intention: "tension" }).cues[0],
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
        planIntentionArmed({ conceptId: A, intention }).cues[0],
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

  it("never interrupts: nothing in the ordinary flow is assertive", () => {
    const cues: PresentationCue[] = [
      planIntentionArmed({ conceptId: A, intention: "echo" }).cues[0],
      documentedCue("established", "confirmed"),
    ];
    for (const cue of cues) {
      expect(describeCue(cue, context)!.urgency).toBe("polite");
    }
  });
});
