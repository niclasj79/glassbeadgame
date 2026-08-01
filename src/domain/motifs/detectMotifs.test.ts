import { describe, expect, it } from "vitest";
import { buildSessionFixture } from "../outcomes/testing/buildSessionFixture";
import { C, createFixtureLookup } from "../outcomes/testing/fixtureContent";
import { detectMotifs, detectNewMotifs } from "./detectMotifs";
import type { MotifDetection, MotifKind } from "./types";

const lookup = createFixtureLookup();

const kinds = (detections: readonly MotifDetection[]): readonly MotifKind[] =>
  detections.map((detection) => detection.kind);

const only = (
  detections: readonly MotifDetection[],
  kind: MotifKind
): readonly MotifDetection[] => detections.filter((entry) => entry.kind === kind);

describe("Dialectic", () => {
  it("completes when a third concept grounds a declared Tension", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
      ],
    });

    const dialectics = only(detectMotifs(fixture.state, lookup), "dialectic");

    expect(dialectics).toHaveLength(1);
    const dialectic = dialectics[0] as MotifDetection;
    expect(dialectic.focusConceptId).toBe(C.overtones);
    expect([...dialectic.conceptIds]).toEqual([C.just, C.equal, C.overtones]);
    expect(dialectic.reason).toBe(
      "The Tension between Just Intonation and Equal Temperament is grounded by The Overtone Series, through your Ground thread from The Overtone Series to Just Intonation."
    );
    expect(dialectic.completedAtSequence).toBe(fixture.state.threads[2]?.sequence);
  });

  it("refuses a triangle whose third concept only echoes the poles", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.perspective],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.perspective, b: C.just, intention: "echo" },
        { a: C.perspective, b: C.equal, intention: "echo" },
      ],
    });

    expect(only(detectMotifs(fixture.state, lookup), "dialectic")).toEqual([]);
  });

  it("reads the content pack, not only the declared intention", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "echo" },
        { a: C.overtones, b: C.equal, intention: "echo" },
      ],
    });

    const dialectics = only(detectMotifs(fixture.state, lookup), "dialectic");

    expect(dialectics).toHaveLength(1);
    expect(dialectics[0]?.reason).toContain("the documented formal ground");
  });

  it("does not complete without a Tension, however connected the triad is", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "ground" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
      ],
    });

    expect(only(detectMotifs(fixture.state, lookup), "dialectic")).toEqual([]);
  });

  it("does not complete when the third concept only adds more opposition", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.perspective],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.perspective, b: C.just, intention: "tension" },
        { a: C.perspective, b: C.equal, intention: "tension" },
      ],
    });

    expect(only(detectMotifs(fixture.state, lookup), "dialectic")).toEqual([]);
  });
});

describe("Canon", () => {
  it("completes when a facet recurs through transformation", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.standingWave],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
        { a: C.fourier, b: C.standingWave, intention: "echo" },
      ],
    });

    const canons = only(detectMotifs(fixture.state, lookup), "canon");

    expect(canons).toHaveLength(1);
    const canon = canons[0] as MotifDetection;
    expect(canon.facetId).toBe("superposition");
    expect([...canon.conceptIds]).toEqual([C.fourier, C.overtones, C.standingWave]);
    expect(canon.threadIds).toHaveLength(3);
    expect(canon.reason).toBe(
      "Superposition recurs through The Fourier Series, The Overtone Series, and The Standing Wave, transformed rather than repeated — it crosses Matter, Measure, and Sound and you read it as Echo and Ground."
    );
  });

  it("refuses simple repetition inside one faculty read one way", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fibonacci, C.primes, C.cantor],
      threads: [
        { a: C.fibonacci, b: C.primes, intention: "echo" },
        { a: C.primes, b: C.cantor, intention: "echo" },
      ],
    });

    expect(only(detectMotifs(fixture.state, lookup), "canon")).toEqual([]);
  });

  it("completes the same three beads once one of them is read differently", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fibonacci, C.primes, C.cantor],
      threads: [
        { a: C.fibonacci, b: C.primes, intention: "echo" },
        { a: C.primes, b: C.cantor, intention: "ground" },
      ],
    });

    const canons = only(detectMotifs(fixture.state, lookup), "canon");

    expect(canons).toHaveLength(1);
    expect(canons[0]?.facetId).toBe("discreteness");
    expect(canons[0]?.reason).toContain("you read it as Echo and Ground");
    expect(canons[0]?.reason).not.toContain("it crosses");
  });

  it("refuses carriers the player never wove to one another", () => {
    const fixture = buildSessionFixture({
      conceptIds: [
        C.fourier,
        C.overtones,
        C.standingWave,
        C.primes,
        C.polyrhythm,
        C.energy,
      ],
      threads: [
        { a: C.fourier, b: C.primes, intention: "echo" },
        { a: C.overtones, b: C.polyrhythm, intention: "echo" },
        { a: C.standingWave, b: C.energy, intention: "ground" },
      ],
    });

    expect(only(detectMotifs(fixture.state, lookup), "canon")).toEqual([]);
  });
});

describe("Bridge", () => {
  it("never claims a crossing between regions that were never connected", () => {
    // Reported by adversarial review. Bridge detection considered every woven
    // concept in the session as candidate regions, so two pieces belonging to
    // *different* connected components could be picked as the two sides of a
    // crossing. Since the web is fragmented for most of a session, this was the
    // common case, and the Game stated as a structural finding that removing a
    // concept made faculties "fall away" from a region that had never been
    // attached to it. Product law 8: silence beats fabricated significance.
    const fixture = buildSessionFixture({
      conceptIds: [
        C.fourier,
        C.counterpoint,
        C.primes,
        C.cantor,
        C.perspective,
        C.girih,
      ],
      threads: [
        // One component: a Measure/Sound triangle with a leaf on Fourier.
        { a: C.fourier, b: C.counterpoint, intention: "echo" },
        { a: C.counterpoint, b: C.primes, intention: "echo" },
        { a: C.primes, b: C.fourier, intention: "echo" },
        { a: C.fourier, b: C.cantor, intention: "ground" },
        // A separate component, in Image, touching nothing above.
        { a: C.perspective, b: C.girih, intention: "echo" },
      ],
    });

    for (const bridge of only(detectMotifs(fixture.state, lookup), "bridge")) {
      // Whatever is detected must be a genuine cut inside one component, so it
      // may never name a concept from the unattached Image region.
      expect([...bridge.conceptIds]).not.toContain(C.perspective);
      expect([...bridge.conceptIds]).not.toContain(C.girih);
      expect(bridge.reason).not.toContain("Image");
    }
  });

  it("completes for the one thread joining two faculty regions", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fibonacci, C.primes, C.counterpoint, C.polyrhythm],
      threads: [
        { a: C.fibonacci, b: C.primes, intention: "echo" },
        { a: C.counterpoint, b: C.polyrhythm, intention: "ground" },
        { a: C.primes, b: C.counterpoint, intention: "passage" },
      ],
    });

    const bridges = only(detectMotifs(fixture.state, lookup), "bridge");
    const threadBridges = bridges.filter((entry) => entry.focusThreadId !== null);

    expect(threadBridges).toHaveLength(1);
    expect(threadBridges[0]?.focusThreadId).toBe(fixture.threadIds[2]);
    expect(threadBridges[0]?.reason).toBe(
      "The Passage between Prime Numbers and Counterpoint is the only thread holding Measure to Sound."
    );
  });

  it("does not call a leaf thread a bridge", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fibonacci, C.primes, C.counterpoint, C.polyrhythm],
      threads: [
        { a: C.fibonacci, b: C.primes, intention: "echo" },
        { a: C.counterpoint, b: C.polyrhythm, intention: "ground" },
        { a: C.primes, b: C.counterpoint, intention: "passage" },
      ],
    });

    const bridges = only(detectMotifs(fixture.state, lookup), "bridge");
    const bridgedThreads = bridges
      .filter((entry) => entry.focusThreadId !== null)
      .map((entry) => entry.focusThreadId);

    expect(bridgedThreads).not.toContain(fixture.threadIds[0]);
    expect(bridgedThreads).not.toContain(fixture.threadIds[1]);
  });

  it("completes for a concept that is the only crossing", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.standingWave],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
      ],
    });

    const conceptBridges = only(detectMotifs(fixture.state, lookup), "bridge").filter(
      (entry) => entry.focusConceptId !== null
    );

    expect(conceptBridges).toHaveLength(1);
    expect(conceptBridges[0]?.focusConceptId).toBe(C.overtones);
    expect(conceptBridges[0]?.reason).toBe(
      "The Overtone Series is the only crossing here: remove it and Measure falls away from Matter."
    );
  });

  it("refuses a cut vertex that separates nothing but its own faculty", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.counterpoint, C.polyrhythm, C.just],
      threads: [
        { a: C.counterpoint, b: C.polyrhythm, intention: "echo" },
        { a: C.polyrhythm, b: C.just, intention: "echo" },
      ],
    });

    expect(only(detectMotifs(fixture.state, lookup), "bridge")).toEqual([]);
  });

  it("does not fire on a web that has no separate regions at all", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.standingWave],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
        { a: C.fourier, b: C.standingWave, intention: "echo" },
      ],
    });

    expect(only(detectMotifs(fixture.state, lookup), "bridge")).toEqual([]);
  });
});

describe("detectMotifs — ordering, totality, determinism", () => {
  const rich = buildSessionFixture({
    conceptIds: [
      C.fourier,
      C.overtones,
      C.standingWave,
      C.just,
      C.equal,
      C.perspective,
    ],
    threads: [
      { a: C.fourier, b: C.overtones, intention: "echo" },
      { a: C.overtones, b: C.standingWave, intention: "ground" },
      { a: C.fourier, b: C.standingWave, intention: "echo" },
      { a: C.just, b: C.equal, intention: "tension" },
      { a: C.overtones, b: C.just, intention: "ground" },
      { a: C.overtones, b: C.equal, intention: "ground" },
    ],
  });

  it("returns motifs in the order they became true", () => {
    const detections = detectMotifs(rich.state, lookup);
    const sequences = detections.map((entry) => entry.completedAtSequence);

    expect(detections.length).toBeGreaterThan(1);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(kinds(detections)).toContain("canon");
    expect(kinds(detections)).toContain("dialectic");
  });

  it("never throws on an empty web", () => {
    const empty = buildSessionFixture({ conceptIds: [C.fourier, C.overtones] });
    expect(detectMotifs(empty.state, lookup)).toEqual([]);
  });

  it("never throws on a single thread", () => {
    const single = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones],
      threads: [{ a: C.fourier, b: C.overtones, intention: "echo" }],
    });
    expect(detectMotifs(single.state, lookup)).toEqual([]);
  });

  it("produces byte-identical detections on replay", () => {
    const replayed = buildSessionFixture({
      conceptIds: [
        C.fourier,
        C.overtones,
        C.standingWave,
        C.just,
        C.equal,
        C.perspective,
      ],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
        { a: C.fourier, b: C.standingWave, intention: "echo" },
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
      ],
    });

    expect(detectMotifs(replayed.state, lookup)).toEqual(detectMotifs(rich.state, lookup));
    expect(JSON.stringify(detectMotifs(replayed.state, lookup))).toBe(
      JSON.stringify(detectMotifs(rich.state, lookup))
    );
  });

  it("carries no score, tier, or reward on any detection", () => {
    for (const detection of detectMotifs(rich.state, lookup)) {
      const keys = Object.keys(detection);
      expect(keys).not.toContain("score");
      expect(keys).not.toContain("points");
      expect(keys).not.toContain("tier");
      expect(keys).not.toContain("rarity");
    }
  });
});

describe("detectNewMotifs", () => {
  it("omits motifs the session already recorded as completed", () => {
    const before = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
      ],
    });
    const detected = detectMotifs(before.state, lookup);
    expect(detected).toHaveLength(1);

    const after = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
      ],
      motifs: [
        {
          kind: "dialectic",
          conceptIds: detected[0]?.conceptIds ?? [],
          threadIndices: [0, 1, 2],
        },
      ],
    });

    expect(detectMotifs(after.state, lookup)).toHaveLength(1);
    expect(detectNewMotifs(after.state, lookup)).toEqual([]);
  });
});
