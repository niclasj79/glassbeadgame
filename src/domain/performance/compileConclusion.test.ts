import { describe, expect, it } from "vitest";
import type { GestureProfile } from "../events";
import { buildSessionFixture } from "../outcomes/testing/buildSessionFixture";
import { C, createFixtureLookup } from "../outcomes/testing/fixtureContent";
import type { RelationLookup } from "../outcomes/lookup";
import { toFacetId, type DocumentedRelation } from "@/content/castalia/schema";
import { compileConclusion, phrasingOf } from "./compileConclusion";
import type { PerformanceEntry, PerformanceVoice } from "./types";

const lookup = createFixtureLookup();

const voiceOf = (
  entry: PerformanceEntry | undefined,
  role: PerformanceVoice["role"]
): PerformanceVoice => {
  const voice = entry?.voices.find((candidate) => candidate.role === role);
  if (voice === undefined) throw new Error(`no ${role} voice`);
  return voice;
};

const KEYBOARD: GestureProfile = Object.freeze({ inputModality: "keyboard" });

describe("phrasingOf", () => {
  it("gives a modality that reports nothing a neutral profile, not a weak one", () => {
    const phrasing = phrasingOf(KEYBOARD);
    expect(phrasing).toEqual({
      modality: "keyboard",
      attack: 0.5,
      legato: 0.5,
      rubato: 0.5,
      weight: 0.5,
      breadth: 0.5,
    });
  });

  it("reads a full pointer gesture into phrasing", () => {
    const phrasing = phrasingOf({
      inputModality: "pen",
      averageSpeedViewportPerSecond: 1.5,
      curvature: 0.25,
      speedVariance: 0.5,
      pressure: 0.9,
      pathLengthViewport: 0.75,
    });
    expect(phrasing.attack).toBe(1);
    expect(phrasing.legato).toBe(0.25);
    expect(phrasing.rubato).toBe(1);
    expect(phrasing.weight).toBe(0.9);
    expect(phrasing.breadth).toBe(0.5);
  });
});

describe("compileConclusion — entries follow the event log", () => {
  const fixture = buildSessionFixture({
    conceptIds: [C.fourier, C.overtones, C.standingWave, C.just, C.equal],
    threads: [
      { a: C.fourier, b: C.overtones, intention: "echo" },
      { a: C.overtones, b: C.standingWave, intention: "ground" },
      { a: C.just, b: C.equal, intention: "tension" },
      { a: C.fourier, b: C.standingWave, intention: "passage" },
    ],
  });
  const performance = compileConclusion(fixture.state, lookup);

  it("enters every thread once, in creation order", () => {
    expect(performance.entries.map((entry) => entry.threadId)).toEqual([
      ...fixture.threadIds,
    ]);
    expect(performance.entries.map((entry) => entry.order)).toEqual([0, 1, 2, 3]);
  });

  it("lays entries out on a monotonic timeline in beats and in seconds", () => {
    let previousEnd = -1;
    for (const entry of performance.entries) {
      expect(entry.atBeat).toBeGreaterThanOrEqual(previousEnd);
      expect(entry.atSeconds).toBeCloseTo(
        entry.atBeat * performance.secondsPerBeat,
        5
      );
      previousEnd = entry.atBeat + entry.durationBeats;
    }
    expect(performance.totalBeats).toBeGreaterThan(previousEnd);
  });

  it("chooses a tempo from the web rather than a constant", () => {
    const sparse = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.standingWave, C.just, C.equal],
      threads: [{ a: C.fourier, b: C.overtones, intention: "echo" }],
    });
    expect(compileConclusion(sparse.state, lookup).tempoBpm).not.toBe(
      performance.tempoBpm
    );
  });
});

describe("compileConclusion — intentions transform the motifs", () => {
  const fixture = buildSessionFixture({
    conceptIds: [C.fourier, C.overtones, C.standingWave, C.just, C.equal],
    threads: [
      { a: C.fourier, b: C.overtones, intention: "echo" },
      { a: C.overtones, b: C.standingWave, intention: "ground" },
      { a: C.just, b: C.equal, intention: "tension" },
      { a: C.fourier, b: C.standingWave, intention: "passage" },
    ],
  });
  const performance = compileConclusion(fixture.state, lookup);
  const [echo, ground, tension, passage] = performance.entries;

  it("names the transformation each intention performs", () => {
    expect(performance.entries.map((entry) => entry.transformation)).toEqual([
      "imitation",
      "foundation",
      "displacement",
      "translation",
    ]);
  });

  it("Echo answers with its own contour on the subject's rhythm, after a stagger", () => {
    const subject = voiceOf(echo, "subject");
    const answer = voiceOf(echo, "answer");
    expect([...answer.degrees]).toEqual([
      ...lookup.conceptMotif(C.overtones).degrees,
    ]);
    expect([...answer.rhythm]).toEqual([...subject.rhythm]);
    expect(answer.atBeat).toBeGreaterThan(subject.atBeat);
  });

  it("Ground puts one voice below the other as a sustained pedal", () => {
    const pedal = voiceOf(ground, "ground");
    expect(pedal.degrees).toHaveLength(1);
    expect(pedal.rhythm).toHaveLength(1);
    expect(pedal.articulation).toBe("sustained");
    expect(pedal.register).toBe("sub");
    expect(voiceOf(ground, "subject").register).toBe("low");
  });

  it("Tension displaces the answer in pitch and in phase, and does not resolve", () => {
    const subject = voiceOf(tension, "subject");
    const answer = voiceOf(tension, "answer");
    const authored = lookup.conceptMotif(C.equal);

    expect([...answer.degrees]).toEqual(authored.degrees.map((d) => d + 1));
    expect(answer.atBeat).toBeGreaterThan(subject.atBeat);
    expect(subject.openEnded).toBe(true);
    expect(answer.openEnded).toBe(true);
    expect(tension?.resolved).toBe(false);
  });

  it("displaces the internal accents of an uneven figure as well", () => {
    const uneven = buildSessionFixture({
      conceptIds: [C.overtones, C.fibonacci],
      threads: [{ a: C.overtones, b: C.fibonacci, intention: "tension" }],
    });
    const entry = compileConclusion(uneven.state, lookup).entries[0];
    const authored = lookup.conceptMotif(C.fibonacci);

    expect([...authored.rhythm]).toEqual([1, 1, 2, 3, 5]);
    expect([...voiceOf(entry, "answer").rhythm]).toEqual([1, 2, 3, 5, 1]);
  });

  it("Passage carries the source contour into the destination's body", () => {
    const answer = voiceOf(passage, "answer");
    const source = lookup.conceptMotif(C.fourier);
    const destination = lookup.conceptMotif(C.standingWave);
    const root = destination.degrees[0] ?? 0;
    expect([...answer.degrees]).toEqual(
      source.degrees.map((degree) => degree - (source.degrees[0] ?? 0) + root)
    );
    expect([...answer.rhythm]).toEqual([...destination.rhythm]);
    expect(answer.timbre).toBe(destination.timbre);
  });

  it("lets a documented direction override the order the player wove the pair", () => {
    const directed: DocumentedRelation = {
      id: "rel.test.directed",
      pair: [C.fourier, C.overtones] as const,
      title: "A directed test relation",
      relationType: "historical-transmission",
      evidence: "attested",
      fit: { passage: "primary", echo: "supported", ground: "partial", tension: "unsupported" },
      insight: "A fixture used only to prove that direction reverses source and destination.",
      sharedFacets: Object.freeze([toFacetId("superposition")]),
      direction: [C.overtones, C.fourier] as const,
      sources: Object.freeze(["rel.test.directed.source"]),
    };
    const directedLookup: RelationLookup = {
      ...lookup,
      findRelation: (a, b) =>
        (a === C.fourier && b === C.overtones) || (a === C.overtones && b === C.fourier)
          ? directed
          : lookup.findRelation(a, b),
    };

    const oneThread = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones],
      threads: [{ a: C.fourier, b: C.overtones, intention: "passage" }],
    });
    const entry = compileConclusion(oneThread.state, directedLookup).entries[0];

    expect(voiceOf(entry, "subject").conceptId).toBe(C.overtones);
    expect(voiceOf(entry, "answer").conceptId).toBe(C.fourier);
  });
});

describe("compileConclusion — outcomes differ in resolution, not in reward", () => {
  const fixture = buildSessionFixture({
    conceptIds: [C.fourier, C.overtones, C.fibonacci, C.girih, C.energy, C.equal],
    threads: [
      { a: C.fourier, b: C.overtones, intention: "echo" },
      { a: C.fibonacci, b: C.girih, intention: "echo" },
      { a: C.equal, b: C.energy, intention: "echo" },
    ],
  });
  const [documented, open, unresolved] = compileConclusion(
    fixture.state,
    lookup
  ).entries;

  it("gives a documented relation and an Open Thread the same weight of sound", () => {
    expect(documented?.outcomeKind).toBe("documented");
    expect(open?.outcomeKind).toBe("open-thread");
    expect(open?.durationBeats).toBe(documented?.durationBeats);
    expect(open?.voices.map((voice) => voice.gain)).toEqual(
      documented?.voices.map((voice) => voice.gain)
    );
  });

  it("closes the documented entry and leaves the Open Thread unclosed", () => {
    expect(documented?.resolved).toBe(true);
    expect(documented?.voices.some((voice) => voice.openEnded)).toBe(false);
    expect(open?.resolved).toBe(false);
    expect(open?.voices.some((voice) => voice.openEnded)).toBe(true);
  });

  it("makes an unresolved thread short and quiet rather than dim", () => {
    expect(unresolved?.outcomeKind).toBe("unresolved");
    expect(unresolved?.durationBeats).toBeLessThan(documented?.durationBeats ?? 0);
    expect(unresolved?.dynamic).toBeLessThan(documented?.dynamic ?? 0);
    expect(unresolved?.voices.length).toBe(2);
  });
});

describe("compileConclusion — gesture phrases, it does not judge", () => {
  const build = (gesture: GestureProfile) =>
    compileConclusion(
      buildSessionFixture({
        conceptIds: [C.fourier, C.overtones],
        threads: [{ a: C.fourier, b: C.overtones, intention: "echo", gesture }],
      }).state,
      lookup
    ).entries[0];

  const broad = build({
    inputModality: "pen",
    pathLengthViewport: 1.5,
    pressure: 1,
    speedVariance: 0.5,
  });
  const narrow = build(KEYBOARD);

  it("lets a broader gesture take more time and more body", () => {
    expect(broad?.durationBeats).toBeGreaterThan(narrow?.durationBeats ?? 0);
    expect(broad?.voices[0]?.gain).toBeGreaterThan(narrow?.voices[0]?.gain ?? 0);
  });

  it("does not let gesture change the intellectual outcome or the notes", () => {
    expect(broad?.outcomeKind).toBe(narrow?.outcomeKind);
    expect(broad?.resolved).toBe(narrow?.resolved);
    expect(broad?.voices.map((voice) => [...voice.degrees])).toEqual(
      narrow?.voices.map((voice) => [...voice.degrees])
    );
  });
});

describe("compileConclusion — motifs, tensions, and the climax", () => {
  const argument = buildSessionFixture({
    conceptIds: [C.fourier, C.overtones, C.standingWave, C.just, C.equal],
    threads: [
      { a: C.just, b: C.equal, intention: "tension" },
      { a: C.overtones, b: C.just, intention: "ground" },
      { a: C.overtones, b: C.equal, intention: "ground" },
      { a: C.fourier, b: C.overtones, intention: "echo" },
      { a: C.fourier, b: C.standingWave, intention: "echo" },
      { a: C.overtones, b: C.standingWave, intention: "ground" },
    ],
  });
  const performance = compileConclusion(argument.state, lookup);

  it("enters completed motifs as ensemble structures after their last thread", () => {
    expect(performance.ensembles.length).toBeGreaterThan(0);
    for (const ensemble of performance.ensembles) {
      const contributing = performance.entries.filter((entry) =>
        ensemble.threadIds.includes(entry.threadId)
      );
      const latestEnd = contributing.reduce(
        (max, entry) => Math.max(max, entry.atBeat + entry.durationBeats),
        0
      );
      expect(ensemble.atBeat).toBeGreaterThanOrEqual(latestEnd);
      expect(ensemble.voices.length).toBe(ensemble.conceptIds.length);
    }
    expect(performance.ensembles.map((entry) => entry.structure)).toContain("triad");
    expect(performance.ensembles.map((entry) => entry.structure)).toContain("stagger");
  });

  it("lets a Tension that a third concept took hold of stop ringing", () => {
    expect(performance.unresolved).toEqual([]);
  });

  it("keeps an unheld Tension ringing to the end, inside the comfort bound", () => {
    const unheld = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [{ a: C.just, b: C.equal, intention: "tension" }],
    });
    const residue = compileConclusion(unheld.state, lookup).unresolved;

    expect(residue).toHaveLength(1);
    expect(residue[0]?.decayToFloorSeconds).toBe(12);
    expect(residue[0]?.floorGain).toBeLessThan(residue[0]?.gain ?? 1);
    expect(residue[0]?.reason).toContain("never taken hold of");
  });

  it("locates the climax where the web actually gathers", () => {
    const heaviest = [...performance.entries].sort((a, b) => b.weight - a.weight)[0];
    expect(performance.climax?.threadId).toBe(heaviest?.threadId);
    expect(performance.climax?.reason).toContain("where the web gathers");
    expect(performance.climax?.reason).toContain("completed");
  });

  it("does not push the climax to the end when the web peaks early", () => {
    const frontLoaded = buildSessionFixture({
      conceptIds: [
        C.fourier,
        C.overtones,
        C.fibonacci,
        C.primes,
        C.perspective,
        C.girih,
      ],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.fibonacci, b: C.primes, intention: "echo" },
        { a: C.perspective, b: C.girih, intention: "echo" },
      ],
    });
    const climax = compileConclusion(frontLoaded.state, lookup).climax;

    expect(climax?.order).toBe(0);
    expect(climax?.threadId).toBe(frontLoaded.threadIds[0]);
  });

  it("emits camera hints in time order, with a kind for every intention", () => {
    const beats = performance.camera.map((hint) => hint.atBeat);
    expect(beats).toEqual([...beats].sort((a, b) => a - b));
    const kinds = new Set(performance.camera.map((hint) => hint.kind));
    expect(kinds.has("hold")).toBe(true);
    expect(kinds.has("settle")).toBe(true);
    expect(kinds.has("gather")).toBe(true);
    expect(kinds.has("widen")).toBe(true);
    expect(kinds.has("rest")).toBe(true);
  });
});

describe("compileConclusion — totality and determinism", () => {
  it("never throws on a session with nothing woven", () => {
    const empty = buildSessionFixture({ conceptIds: [C.fourier, C.overtones] });
    const performance = compileConclusion(empty.state, lookup);

    expect(performance.entries).toEqual([]);
    expect(performance.ensembles).toEqual([]);
    expect(performance.unresolved).toEqual([]);
    expect(performance.climax).toBeNull();
    expect(performance.totalBeats).toBeGreaterThan(0);
    expect(performance.camera).toHaveLength(1);
    expect(performance.camera[0]?.kind).toBe("rest");
  });

  it("is byte-identical after replaying the same events", () => {
    const spec = {
      conceptIds: [C.fourier, C.overtones, C.standingWave, C.just, C.equal],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" as const },
        { a: C.overtones, b: C.just, intention: "ground" as const },
        { a: C.fourier, b: C.overtones, intention: "echo" as const },
      ],
    };
    const first = buildSessionFixture(spec);
    const second = buildSessionFixture(spec);

    expect(JSON.stringify(compileConclusion(second.state, lookup))).toBe(
      JSON.stringify(compileConclusion(first.state, lookup))
    );
  });

  it("is identical across repeated calls on the same state", () => {
    const fixture = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.standingWave],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
      ],
    });
    const first = JSON.stringify(compileConclusion(fixture.state, lookup));
    for (let run = 0; run < 5; run += 1) {
      expect(JSON.stringify(compileConclusion(fixture.state, lookup))).toBe(first);
    }
  });
});

describe("compileConclusion — a reading does not close on a record", () => {
  /**
   * Regression (GAP-1). `resolved` was `outcome.kind === "documented"`, and
   * `kind` is "documented" for an interpretive relation too — a reading the Game
   * offers, asserting nothing beyond the two structures compared. The score
   * therefore closed a reading exactly as it closes a record, and the audio
   * caption built from `resolved` said "The Game has a record for this pair".
   *
   * Each web is a single thread so that density, phrasing and gain are identical
   * across the two, and the evidence class is the only difference between them.
   */
  const alone = (a: (typeof C)[keyof typeof C], b: (typeof C)[keyof typeof C]) =>
    compileConclusion(
      buildSessionFixture({
        conceptIds: [a, b],
        threads: [{ a, b, intention: "echo", gesture: KEYBOARD }],
      }).state,
      lookup
    ).entries[0];

  const record = alone(C.fourier, C.overtones);
  const reading = alone(C.fibonacci, C.counterpoint);

  it("treats both as documented outcomes", () => {
    expect(record?.outcomeKind).toBe("documented");
    expect(reading?.outcomeKind).toBe("documented");
  });

  it("says on the entry itself which of the two it is", () => {
    expect(record?.speaksForRecord).toBe(true);
    expect(reading?.speaksForRecord).toBe(false);
  });

  it("closes the record and does not close the reading", () => {
    expect(record?.resolved).toBe(true);
    expect(reading?.resolved).toBe(false);
  });

  it("leaves the reading's answering line unclosed, in the notes as well as the flag", () => {
    expect(record?.voices.some((voice) => voice.openEnded)).toBe(false);
    expect(reading?.voices.some((voice) => voice.openEnded)).toBe(true);
  });

  it("gives them exactly the same weight of sound (CAV-006)", () => {
    expect(reading?.durationBeats).toBe(record?.durationBeats);
    expect(reading?.dynamic).toBe(record?.dynamic);
    expect(reading?.voices.map((voice) => voice.gain)).toEqual(
      record?.voices.map((voice) => voice.gain)
    );
  });
});
