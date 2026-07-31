import { describe, expect, it } from "vitest";
import { buildTopology } from "../graph/buildTopology";
import { detectMotifs } from "../motifs/detectMotifs";
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
  it("gives these developed webs three to five sentences", () => {
    // Five is the budget's floor, not a universal ceiling — see "length is
    // earned, not fixed" below, where a nine-thread web is allowed more.
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

describe("buildAnnotation — the coda does not contradict itself", () => {
  /**
   * A web in two pieces, where one of those pieces has an internal crossing.
   * The Bridge detector confines itself to a single component, so this shape is
   * both fragmented *and* bridged at the same time — which is exactly the shape
   * the coda used to describe twice, in opposite terms.
   */
  const fragmentedWithBridge = buildSessionFixture({
    conceptIds: [C.fourier, C.overtones, C.energy, C.perspective, C.girih, C.cantor],
    threads: [
      { a: C.fourier, b: C.overtones, intention: "echo" },
      { a: C.overtones, b: C.energy, intention: "ground" },
      { a: C.perspective, b: C.girih, intention: "echo" },
    ],
  });

  it("builds a web that is genuinely fragmented and genuinely bridged", () => {
    // If this stops holding, the contradiction test below proves nothing.
    const topology = buildTopology(fragmentedWithBridge.state, lookup);
    const motifs = detectMotifs(fragmentedWithBridge.state, lookup);
    expect(topology.componentCount).toBeGreaterThan(1);
    expect(motifs.some((motif) => motif.kind === "bridge")).toBe(true);
  });

  it("never states a crossing it has already said does not exist", () => {
    // Regression: crossingFragment returned early on componentCount > 1, and
    // bridgeFragment was an independent later candidate deduped only by exact
    // string equality — so one coda said "nothing you wove crosses between
    // them" and then named the single thread holding "those two regions"
    // together.
    const { text } = buildAnnotation(fragmentedWithBridge.state, lookup);

    expect(text).toContain("nothing you wove crosses between them");
    expect(text).not.toContain("is all that holds those two regions together");
    expect(text).not.toContain("the only doorway between the regions you opened");
  });

  it("still relocates the crossing rather than silently dropping it", () => {
    // Suppression would also be non-contradictory, but it would throw away a
    // true structural fact. The fragmented sentence absorbs it instead.
    const { text } = buildAnnotation(fragmentedWithBridge.state, lookup);
    expect(text).toMatch(/holds one of those figures together on its own|only doorway inside one of them/);
  });

  it("does not call a concept the point everything turned on in a web of pieces", () => {
    const { text } = buildAnnotation(fragmentedWithBridge.state, lookup);
    expect(text).toContain("separate figures");
    expect(text).not.toContain("became the point everything turned on");
    expect(text).toContain("became the point its own figure turned on");
  });

  it("keeps the unqualified claim where the web really is one figure", () => {
    expect(buildAnnotation(argument.state, lookup).text).toContain(
      "became the point everything turned on"
    );
  });
});

describe("buildAnnotation — length is earned, not fixed", () => {
  const ALL_SIXTEEN = [...CONCEPTS, C.symmetry, C.cantor, C.divisionism, C.pendulums];

  const large = buildSessionFixture({
    conceptIds: ALL_SIXTEEN,
    threads: [
      { a: C.just, b: C.equal, intention: "tension" },
      { a: C.overtones, b: C.just, intention: "ground" },
      { a: C.overtones, b: C.equal, intention: "ground" },
      { a: C.fourier, b: C.overtones, intention: "echo" },
      { a: C.fourier, b: C.standingWave, intention: "echo" },
      { a: C.overtones, b: C.standingWave, intention: "ground" },
      { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
      { a: C.primes, b: C.polyrhythm, intention: "echo" },
      { a: C.perspective, b: C.girih, intention: "echo" },
    ],
  });

  const small = buildSessionFixture({
    conceptIds: ALL_SIXTEEN,
    threads: [
      { a: C.just, b: C.equal, intention: "tension" },
      { a: C.overtones, b: C.just, intention: "ground" },
    ],
  });

  it("lets a nine-thread web say more than a two-thread web", () => {
    // Regression: a flat cap of five meant a large, fragmented, motif-bearing
    // web was cut off at exactly the same length as a two-thread pair, so true
    // sentences it had already composed were discarded.
    const many = buildAnnotation(large.state, lookup).sentences;
    const few = buildAnnotation(small.state, lookup).sentences;

    expect(many.length).toBeGreaterThan(5);
    expect(many.length).toBeGreaterThan(few.length);
    expect(few.length).toBeGreaterThanOrEqual(3);
  });

  it("does not pad: the extra sentences are extra facts, all distinct", () => {
    const sentences = buildAnnotation(large.state, lookup).sentences;
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it("never shortens a web that the old flat cap already fitted", () => {
    // The budget's floor is the cap it replaced, so raising the ceiling for
    // large webs cannot cost a small or middling one a sentence it used to be
    // given. The four-thread session photographed in
    // artifacts/capture/desktop--12-conclusion-late.png uses all five of them.
    const captured = buildSessionFixture({
      conceptIds: CONCEPTS,
      threads: [
        { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
        { a: C.fibonacci, b: C.polyrhythm, intention: "tension" },
        { a: C.primes, b: C.polyrhythm, intention: "echo" },
        { a: C.fibonacci, b: C.primes, intention: "echo" },
      ],
    });
    expect(buildAnnotation(captured.state, lookup).sentences).toHaveLength(5);
    // Six threads, still five: the budget's floor carries it, not its slope.
    expect(buildAnnotation(argument.state, lookup).sentences).toHaveLength(5);
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

  it("names a single dark bead instead of sampling a one-item list", () => {
    // "One bead stayed dark, including X" offers the whole of a one-item list
    // as an example drawn from it.
    const single = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [{ a: C.just, b: C.equal, intention: "tension" }],
    });
    const { text } = buildAnnotation(single.state, lookup);

    expect(text).toContain("One bead stayed dark: The Overtone Series.");
    expect(text).not.toContain("stayed dark, including");
  });

  it("does not tell a single-bead arena that no thread joins any of them", () => {
    const lonely = buildSessionFixture({ conceptIds: [C.fibonacci] });
    const { text } = buildAnnotation(lonely.state, lookup);

    expect(text).toContain("One bead is in the arena and no thread joins it,");
    expect(text).not.toContain("any of them");
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
