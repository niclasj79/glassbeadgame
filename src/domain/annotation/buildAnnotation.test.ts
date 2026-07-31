import { describe, expect, it } from "vitest";
import { buildSessionFixture } from "../outcomes/testing/buildSessionFixture";
import { C, createFixtureLookup } from "../outcomes/testing/fixtureContent";
import { buildAnnotation } from "./buildAnnotation";

const lookup = createFixtureLookup();

const CONCEPTS = [
  C.fibonacci,
  C.primes,
  C.fourier,
  C.counterpoint,
  C.overtones,
  C.polyrhythm,
  C.just,
  C.equal,
  C.standingWave,
  C.energy,
  C.perspective,
  C.girih,
];

/**
 * WEB A — an argument. A Tension is drawn and then a third concept takes hold
 * of it; a Canon recurs; everything hangs together in one figure.
 */
const argument = buildSessionFixture({
  conceptIds: CONCEPTS,
  threads: [
    { a: C.just, b: C.equal, intention: "tension" },
    { a: C.overtones, b: C.just, intention: "ground" },
    { a: C.overtones, b: C.equal, intention: "ground" },
    { a: C.fourier, b: C.overtones, intention: "echo" },
    { a: C.fourier, b: C.standingWave, intention: "echo" },
    { a: C.overtones, b: C.standingWave, intention: "ground" },
  ],
});

/**
 * WEB B — a survey. No Tension at all, two disconnected figures, an Open Thread
 * and an unresolved thread, and half the arena never touched.
 */
const survey = buildSessionFixture({
  conceptIds: CONCEPTS,
  threads: [
    { a: C.fibonacci, b: C.girih, intention: "echo" },
    { a: C.girih, b: C.perspective, intention: "echo" },
    { a: C.primes, b: C.polyrhythm, intention: "echo" },
    { a: C.polyrhythm, b: C.energy, intention: "passage" },
  ],
});

describe("buildAnnotation — shape", () => {
  it("produces three to five sentences for a developed web", () => {
    for (const fixture of [argument, survey]) {
      const annotation = buildAnnotation(fixture.state, lookup);
      expect(annotation.sentences.length).toBeGreaterThanOrEqual(3);
      expect(annotation.sentences.length).toBeLessThanOrEqual(5);
      expect(annotation.text).toBe(annotation.sentences.join(" "));
    }
  });

  it("anchors every annotation in concepts and threads that exist", () => {
    const annotation = buildAnnotation(argument.state, lookup);
    expect(annotation.references.conceptIds.length).toBeGreaterThan(0);
    expect(annotation.references.threadIds.length).toBeGreaterThan(0);
    for (const conceptId of annotation.references.conceptIds) {
      expect(argument.state.conceptIds).toContain(conceptId);
    }
    for (const threadId of annotation.references.threadIds) {
      expect(argument.threadIds).toContain(threadId);
    }
  });
});

describe("buildAnnotation — composed from real structure", () => {
  const annotation = buildAnnotation(argument.state, lookup);

  it("opens on the web's actual first thread", () => {
    expect(annotation.sentences[0]).toBe(
      "You opened with Just Intonation and Equal Temperament, read as Tension, and Castalia had a record to set beside it: One Comma, Deliberately Spent."
    );
  });

  it("names the concept the web turned on", () => {
    expect(annotation.text).toContain("The Overtone Series became the point everything turned on");
  });

  it("names the opposition and the concept that took hold of it", () => {
    expect(annotation.text).toContain("You set Just Intonation against Equal Temperament");
    expect(annotation.text).toContain("take hold of the argument");
  });

  it("names a facet that actually recurs", () => {
    expect(annotation.text).toMatch(/Superposition|Proportion|Decomposition/);
  });
});

describe("buildAnnotation — a different web reads differently", () => {
  const a = buildAnnotation(argument.state, lookup);
  const b = buildAnnotation(survey.state, lookup);

  it("produces materially different prose", () => {
    expect(a.text).not.toBe(b.text);
    for (const sentence of a.sentences) {
      expect(b.sentences).not.toContain(sentence);
    }
  });

  it("tells the fragmented web that it is fragmented and the joined web that it is not", () => {
    expect(b.text).toContain("separate figures");
    expect(a.text).not.toContain("separate figures");
  });

  it("mentions Tension only where Tension was declared", () => {
    expect(a.text).toContain("Tension");
    expect(b.text).not.toContain("set");
    expect(b.text.toLowerCase()).not.toContain("against");
  });

  it("quotes a real open question only where one is standing", () => {
    expect(b.text).toContain("One question is still standing where you left it:");
    expect(b.text).toContain("?");
  });

  it("reports the untouched part of the arena when there is little else to say", () => {
    const minimal = buildSessionFixture({
      conceptIds: CONCEPTS,
      threads: [{ a: C.fibonacci, b: C.counterpoint, intention: "echo" }],
    });
    const annotation = buildAnnotation(minimal.state, lookup);

    expect(annotation.text).toMatch(/stayed dark|never asked/);
    expect(annotation.sentences.length).toBeLessThanOrEqual(3);
  });

  it("shares no vocabulary of praise in either", () => {
    for (const text of [a.text, b.text]) {
      for (const forbidden of [
        "well done",
        "beautiful",
        "impressive",
        "everything is connected",
        "profound",
        "congratulations",
      ]) {
        expect(text.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});

describe("buildAnnotation — totality and determinism", () => {
  it("says something true and short about an empty web", () => {
    const empty = buildSessionFixture({ conceptIds: CONCEPTS });
    const annotation = buildAnnotation(empty.state, lookup);

    expect(annotation.sentences[0]).toBe("Nothing has been woven yet.");
    expect(annotation.text).toContain("no thread joins any of them");
    expect(annotation.references.conceptIds).toEqual([]);
  });

  it("does not pad a one-thread session up to a quota", () => {
    const single = buildSessionFixture({
      conceptIds: [C.fibonacci, C.counterpoint],
      threads: [{ a: C.fibonacci, b: C.counterpoint, intention: "echo" }],
    });
    const annotation = buildAnnotation(single.state, lookup);

    expect(annotation.sentences.length).toBeLessThanOrEqual(3);
    expect(annotation.sentences[0]).toContain("You opened with Fibonacci Sequence");
  });

  it("is identical after replaying the same events", () => {
    const replayed = buildSessionFixture({
      conceptIds: CONCEPTS,
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.fourier, b: C.standingWave, intention: "echo" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
      ],
    });

    expect(buildAnnotation(replayed.state, lookup)).toEqual(
      buildAnnotation(argument.state, lookup)
    );
  });

  it("is identical across repeated calls", () => {
    const first = buildAnnotation(survey.state, lookup).text;
    for (let run = 0; run < 5; run += 1) {
      expect(buildAnnotation(survey.state, lookup).text).toBe(first);
    }
  });
});
