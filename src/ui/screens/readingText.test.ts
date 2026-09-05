import { describe, expect, it } from "vitest";
import type { Annotation } from "@/domain/annotation";
import type { Portrait, PortraitDimension } from "@/domain/portrait";
import { keptStatusLine, readingAsText } from "./readingText";
import type { ThreadReading } from "./threadRegister";

const dimension = (id: PortraitDimension["id"], label: string, phrase: string): PortraitDimension =>
  Object.freeze({ id, label, value: 0.5, phrase, evidence: Object.freeze([`${label} evidence`]) });

const PORTRAIT: Portrait = (() => {
  const dimensions = [
    dimension("range", "Range", "Measure and Sound answered."),
    dimension("depth", "Depth", "Your one thread met documented material."),
  ];
  return Object.freeze({
    dimensions: Object.freeze(dimensions),
    byId: Object.freeze({ range: dimensions[0], depth: dimensions[1] }) as Portrait["byId"],
  });
})();

const ANNOTATION: Annotation = Object.freeze({
  sentences: Object.freeze(["You opened with Fibonacci Sequence and Counterpoint, read as Echo."]),
  text: "You opened with Fibonacci Sequence and Counterpoint, read as Echo.",
  references: Object.freeze({ conceptIds: [], threadIds: [], facetIds: [] }),
});

const THREAD: ThreadReading = Object.freeze({
  threadId: "thread:1",
  reading: "Fibonacci Sequence · Echo · Counterpoint",
  kind: "documented",
  title: "Proportion Claimed in a Fugue",
  body: "Ernő Lendvai argued from the 1950s onward that Bartók placed climaxes at golden-section points.",
  aside: "Treat the Bartók attribution as disputed, not as evidence.",
  standing: "Documented · specialists disagree · Your reading runs with the record.",
  interpretive: false,
  sourceLine: "3 sources for this claim",
  citations: Object.freeze([
    { id: "src.lendvai-1971", citation: "Ernő Lendvai, Béla Bartók: An Analysis of His Music (London: Kahn & Averill, 1971)", locator: "chapters on the golden section" },
    { id: "src.howat-1983", citation: "Roy Howat, “Bartók, Lendvai and the Principles of Proportional Analysis”, Music Analysis 2/1 (March 1983), 69–95", locator: null },
  ]),
});

/**
 * DESIGN-REVIEW-SCHELL §2: the copy is the only route by which the Game's
 * sources ever leave the building. It must carry exactly what the plate shows
 * — the register in order, with its standing and its citations — and nothing
 * the plate refuses to show.
 */
describe("readingAsText", () => {
  it("carries the annotation, the register with its citations, and the portrait", () => {
    const text = readingAsText({ annotation: ANNOTATION, threads: [THREAD], portrait: PORTRAIT, endedAt: Date.UTC(2026, 8, 5) });
    expect(text).toContain("2026-09-05");
    expect(text).toContain(ANNOTATION.sentences[0]);
    expect(text).toContain("1. Fibonacci Sequence · Echo · Counterpoint");
    expect(text).toContain("Documented · specialists disagree");
    expect(text).toContain("Proportion Claimed in a Fugue");
    expect(text).toContain("— Treat the Bartók attribution as disputed");
    expect(text).toContain("Kahn & Averill, 1971) — chapters on the golden section");
    expect(text).toContain("Music Analysis 2/1 (March 1983), 69–95");
    expect(text).toContain("Range — Measure and Sound answered.");
    expect(text).toContain("One thread · 2 readings, no total");
  });

  it("adds no score, no rank, and no total", () => {
    const text = readingAsText({ annotation: ANNOTATION, threads: [THREAD], portrait: PORTRAIT });
    expect(text).not.toMatch(/\bscore\b/i);
    expect(text).not.toMatch(/\brank\b/i);
    expect(text).not.toMatch(/\btotal:/i);
  });

  it("says when nothing was woven rather than printing an empty register", () => {
    const text = readingAsText({ annotation: ANNOTATION, threads: [], portrait: PORTRAIT });
    expect(text).toContain("No thread was woven.");
    expect(text).toContain("0 threads · 2 readings, no total");
  });

  it("is the same text for the same reading", () => {
    const input = { annotation: ANNOTATION, threads: [THREAD], portrait: PORTRAIT, endedAt: 0 };
    expect(readingAsText(input)).toBe(readingAsText(input));
  });
});

describe("keptStatusLine", () => {
  it("says nothing before anything has been kept", () => {
    expect(keptStatusLine("unkept", false)).toBeNull();
  });

  it("tells a private window the truth instead of losing the Game quietly", () => {
    expect(keptStatusLine("kept-for-now", false)).toContain("not keeping anything between visits");
    expect(keptStatusLine("kept-for-now", false)).toContain("Copy the reading");
    expect(keptStatusLine("unavailable", false)).toContain("could not be kept");
    expect(keptStatusLine("unavailable", false)).toContain("Copy the reading");
  });

  it("names the shelf once the Game is kept, and never a count", () => {
    for (const line of [
      keptStatusLine("kept", false),
      keptStatusLine("kept", true),
      keptStatusLine("kept-for-now", false),
      keptStatusLine("keeping", false),
    ]) {
      expect(line).not.toBeNull();
      expect(line).not.toMatch(/\d/);
    }
    expect(keptStatusLine("kept", false)).toContain("shelf");
  });
});
