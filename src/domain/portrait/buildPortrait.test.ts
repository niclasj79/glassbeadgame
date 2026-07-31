import { describe, expect, it } from "vitest";
import { buildSessionFixture } from "../outcomes/testing/buildSessionFixture";
import { C, createFixtureLookup } from "../outcomes/testing/fixtureContent";
import { buildPortrait } from "./buildPortrait";
import { PORTRAIT_DIMENSION_IDS } from "./types";

const lookup = createFixtureLookup();

const WIDE_CONCEPTS = [
  C.fibonacci,
  C.primes,
  C.fourier,
  C.counterpoint,
  C.overtones,
  C.just,
  C.equal,
  C.standingWave,
  C.perspective,
  C.girih,
];

/** A wide, argumentative web that reaches every faculty. */
const wide = buildSessionFixture({
  conceptIds: WIDE_CONCEPTS,
  threads: [
    { a: C.fourier, b: C.overtones, intention: "echo" },
    { a: C.overtones, b: C.standingWave, intention: "ground" },
    { a: C.just, b: C.equal, intention: "tension" },
    { a: C.overtones, b: C.just, intention: "ground" },
    { a: C.overtones, b: C.equal, intention: "ground" },
    { a: C.fibonacci, b: C.girih, intention: "echo" },
    { a: C.girih, b: C.perspective, intention: "echo" },
    { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
  ],
});

/** A narrow, single-faculty web with one thread. */
const narrow = buildSessionFixture({
  conceptIds: WIDE_CONCEPTS,
  threads: [{ a: C.fibonacci, b: C.primes, intention: "echo" }],
});

describe("buildPortrait — shape", () => {
  it("always produces the six dimensions in canonical order", () => {
    const portrait = buildPortrait(wide.state, lookup);
    expect(portrait.dimensions.map((entry) => entry.id)).toEqual([
      ...PORTRAIT_DIMENSION_IDS,
    ]);
    for (const id of PORTRAIT_DIMENSION_IDS) {
      expect(portrait.byId[id].id).toBe(id);
    }
  });

  it("keeps every value inside 0–1", () => {
    for (const state of [wide.state, narrow.state]) {
      for (const entry of buildPortrait(state, lookup).dimensions) {
        expect(entry.value).toBeGreaterThanOrEqual(0);
        expect(entry.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("exposes no total, score, rank, or grade anywhere", () => {
    const portrait = buildPortrait(wide.state, lookup);
    const keys = Object.keys(portrait);
    for (const forbidden of ["total", "score", "rank", "grade", "overall", "level"]) {
      expect(keys).not.toContain(forbidden);
    }
    for (const entry of portrait.dimensions) {
      expect(Object.keys(entry)).toEqual([
        "id",
        "label",
        "value",
        "phrase",
        "evidence",
      ]);
    }
  });

  it("never ranks the player in any phrase", () => {
    const portraits = [wide, narrow].map((fixture) =>
      buildPortrait(fixture.state, lookup)
    );
    for (const portrait of portraits) {
      for (const entry of portrait.dimensions) {
        const phrase = entry.phrase.toLowerCase();
        for (const forbidden of [
          "excellent",
          "poor",
          "better",
          "worse",
          "impressive",
          "well done",
          "you should",
          "try to",
          "failed",
          "weak player",
        ]) {
          expect(phrase).not.toContain(forbidden);
        }
      }
    }
  });
});

describe("buildPortrait — dimensions read the actual session", () => {
  const portrait = buildPortrait(wide.state, lookup);

  it("names the faculties that answered and counts the crossings", () => {
    expect(portrait.byId.range.phrase).toBe(
      "Measure, Sound, Matter, and Image all answered. Four of your eight threads crossed between faculties."
    );
    expect([...portrait.byId.range.evidence]).toEqual([
      "Measure: 2 of 3 woven",
      "Sound: 4 of 4 woven",
      "Matter: 1 of 1 woven",
      "Image: 2 of 2 woven",
    ]);
  });

  it("names the faculties that stayed silent when some did", () => {
    const narrowRange = buildPortrait(narrow.state, lookup).byId.range.phrase;
    expect(narrowRange).toContain("Measure answered");
    expect(narrowRange).toContain("stayed silent");
    expect(narrowRange).toContain("Sound");
    expect(narrowRange).toContain("Image");
  });

  it("counts documented, open, and unresolved threads without preferring any", () => {
    expect(portrait.byId.depth.phrase).toContain("met documented material");
    expect(portrait.byId.depth.phrase).toContain("opened a question");
    expect(portrait.byId.depth.phrase).toContain("found nothing to stand on");
  });

  it("names the concept that was returned to", () => {
    expect(portrait.byId.depth.phrase).toContain("The Overtone Series");
  });

  it("names the opposition and who took hold of it", () => {
    expect(portrait.byId.tension.phrase).toContain("Just Intonation");
    expect(portrait.byId.tension.phrase).toContain("Equal Temperament");
    expect(portrait.byId.tension.phrase).toContain("The Overtone Series");
    expect(portrait.byId.tension.value).toBeGreaterThan(0);
  });

  it("says plainly when no Tension was declared", () => {
    const calm = buildPortrait(narrow.state, lookup);
    expect(calm.byId.tension.value).toBe(0);
    expect(calm.byId.tension.phrase).toContain("declared no Tension");
  });

  it("counts figures and loops for coherence", () => {
    expect(portrait.byId.coherence.phrase).toMatch(/figure|figures/);
    expect(portrait.byId.coherence.evidence.join(" ")).toContain("independent");
  });

  it("quotes a real Open Thread's facet in openness", () => {
    expect(portrait.byId.openness.phrase).toMatch(/Open Threads? (is|are) still standing/);
    expect(portrait.byId.openness.phrase).toContain("asks after");
    expect(portrait.byId.openness.phrase).toContain("never taken up");
  });

  it("measures return from threads that closed back into the web", () => {
    expect(portrait.byId.return.phrase).toContain("closed back into what you had");
    expect(portrait.byId.return.value).toBeGreaterThan(0);
  });
});

describe("buildPortrait — two different sessions read differently", () => {
  it("gives a wide web more Range than a single-faculty pair", () => {
    const wideRange = buildPortrait(wide.state, lookup).byId.range.value;
    const narrowRange = buildPortrait(narrow.state, lookup).byId.range.value;
    expect(wideRange).toBeGreaterThan(narrowRange);
  });

  it("produces different phrases for every dimension", () => {
    const a = buildPortrait(wide.state, lookup);
    const b = buildPortrait(narrow.state, lookup);
    for (const id of PORTRAIT_DIMENSION_IDS) {
      expect(a.byId[id].phrase).not.toBe(b.byId[id].phrase);
    }
  });
});

describe("buildPortrait — totality and replay stability", () => {
  it("never throws on a session with nothing woven", () => {
    const empty = buildSessionFixture({ conceptIds: WIDE_CONCEPTS });
    const portrait = buildPortrait(empty.state, lookup);

    expect(portrait.dimensions).toHaveLength(6);
    expect(portrait.dimensions.every((entry) => entry.value >= 0)).toBe(true);
    expect(portrait.byId.range.phrase).toBe("No faculty has been drawn on yet.");
    expect(portrait.byId.depth.value).toBe(0);
    expect(portrait.byId.return.value).toBe(0);
  });

  it("never throws on a session with no concepts at all", () => {
    const bare = buildSessionFixture({ conceptIds: [C.fibonacci] });
    expect(() => buildPortrait(bare.state, lookup)).not.toThrow();
  });

  it("is identical after replaying the same events", () => {
    const replayed = buildSessionFixture({
      conceptIds: WIDE_CONCEPTS,
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
        { a: C.fibonacci, b: C.girih, intention: "echo" },
        { a: C.girih, b: C.perspective, intention: "echo" },
        { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
      ],
    });

    expect(JSON.stringify(buildPortrait(replayed.state, lookup))).toBe(
      JSON.stringify(buildPortrait(wide.state, lookup))
    );
  });

  it("is identical across repeated calls on the same state", () => {
    const first = JSON.stringify(buildPortrait(wide.state, lookup));
    for (let run = 0; run < 5; run += 1) {
      expect(JSON.stringify(buildPortrait(wide.state, lookup))).toBe(first);
    }
  });
});
