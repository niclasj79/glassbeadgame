import { describe, expect, it } from "vitest";
import {
  outcomeIsInterpretiveReading,
  outcomeSpeaksForTheRecord,
  resolveSessionOutcomes,
} from "../outcomes";
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
  it("always produces the seven dimensions in canonical order", () => {
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
    // The counts are unchanged; only the framing is. See "evidence lines are
    // counts, not progress toward a total" below for why "2 of 3" had to go.
    expect([...portrait.byId.range.evidence]).toEqual([
      "Measure: 2 woven, 1 left dark",
      "Sound: 4 woven, none left dark",
      "Matter: 1 woven, none left dark",
      "Image: 2 woven, none left dark",
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

    expect(portrait.dimensions).toHaveLength(7);
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

  it("never lets a pole take hold of its own opposition", () => {
    // Reported by adversarial review. Matching a Dialectic on threadIds meant a
    // Tension that merely acted as a *support* in someone else's Dialectic was
    // reported as held by that Dialectic's focus — so a concept could be named
    // as taking hold of the very opposition it is one half of.
    const fixture = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.just, b: C.overtones, intention: "ground" },
        { a: C.equal, b: C.overtones, intention: "tension" },
      ],
    });
    const phrase = buildPortrait(fixture.state, lookup).byId.tension.phrase;
    expect(phrase).not.toMatch(
      /Just Intonation set against Equal Temperament[^.]*Just Intonation took hold/
    );
    expect(phrase).not.toContain("Just Intonation took hold of it");
  });

  it("gives Return a zero case that resolves to a proposition", () => {
    // Regression: with no thread closing back, Return said "None of your three
    // threads closed back into what you had already made rather than reaching
    // outward" — under the negation the contrastive clause attaches to nothing,
    // and the sentence never states what the web did instead.
    const outwardOnly = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.energy, C.perspective, C.girih],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.overtones, b: C.energy, intention: "ground" },
        { a: C.perspective, b: C.girih, intention: "echo" },
      ],
    });
    const phrase = buildPortrait(outwardOnly.state, lookup).byId.return.phrase;

    expect(phrase).not.toMatch(/\bnone\b[^.?]*\brather than\b/i);
    expect(phrase).toContain(
      "Every one of your three threads reached outward, and none closed back into what you had already made."
    );
  });

  it("gives Return a one-thread case, which is always the zero case", () => {
    // The first thread cannot close back — nothing is woven when it is drawn —
    // so "none of your one thread" was the guaranteed reading of every
    // single-thread session.
    const single = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [{ a: C.just, b: C.equal, intention: "tension" }],
    });
    const phrase = buildPortrait(single.state, lookup).byId.return.phrase;

    expect(phrase).toBe(
      "Your one thread reached outward; there was nothing yet for it to close back into."
    );
  });

  it("keeps the contrast where some threads really did close back", () => {
    expect(buildPortrait(wide.state, lookup).byId.return.phrase).toContain(
      "closed back into what you had already made rather than reaching outward"
    );
  });

  it("never states a fraction whose denominator is one", () => {
    // The same class of defect as Return's zero case, in Range and Depth:
    // "One of your one thread met documented material".
    const single = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [{ a: C.just, b: C.equal, intention: "tension" }],
    });
    const portrait = buildPortrait(single.state, lookup);

    for (const entry of portrait.dimensions) {
      expect(entry.phrase).not.toMatch(/of your one thread\b/i);
    }
    expect(portrait.byId.depth.phrase).toBe("Your one thread met documented material.");
    expect(portrait.byId.range.phrase).toContain(
      "Your one thread stayed inside a single faculty."
    );
  });

  it("does not apply a plural quantifier to a single faculty", () => {
    // "Sound all answered." — `all` presumes several, and a one-faculty session
    // supplies one.
    const oneFaculty = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
      ],
    });
    const phrase = buildPortrait(oneFaculty.state, lookup).byId.range.phrase;

    expect(phrase).not.toContain("Sound all answered");
    expect(phrase).toContain("Sound answered, and it was the only faculty asked.");
  });

  it("does not call the sole Open Thread the first of several", () => {
    const oneOpen = buildSessionFixture({
      conceptIds: [C.fibonacci, C.girih, C.counterpoint],
      threads: [{ a: C.fibonacci, b: C.girih, intention: "echo" }],
    });
    const phrase = buildPortrait(oneOpen.state, lookup).byId.openness.phrase;

    expect(phrase).toContain("One Open Thread is still standing; it asks after");
    expect(phrase).not.toContain("the first asks");
  });

  it("reads correctly when a count is zero", () => {
    // "none found nothing to stand on" is a double negative that says the
    // opposite of what the web did, and zero is the common case early on.
    const fixture = buildSessionFixture({
      conceptIds: [C.fibonacci, C.counterpoint, C.primes, C.polyrhythm],
      threads: [
        { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
        { a: C.primes, b: C.polyrhythm, intention: "echo" },
      ],
    });
    for (const dimension of buildPortrait(fixture.state, lookup).dimensions) {
      expect(dimension.phrase).not.toMatch(/none found nothing/i);
      expect(dimension.phrase).not.toMatch(/\bnone \w+ nothing\b/i);
      expect(dimension.phrase).not.toMatch(/,\s*and\s*\./);
      expect(dimension.phrase.trim()).not.toBe("");
      expect(dimension.phrase.trim().endsWith(".")).toBe(true);
    }
  });
});

describe("buildPortrait — Depth separates a record from a reading", () => {
  /**
   * Regression (GAP-1). Depth counted every documented outcome under "met
   * documented material", and `outcome.kind` is "documented" for an interpretive
   * relation too. So a session was told it had met documented material where the
   * Game had only offered a reading of its own.
   */
  const outcomes = resolveSessionOutcomes(wide.state, lookup);
  const records = outcomes.filter(outcomeSpeaksForTheRecord);
  const readings = outcomes.filter(outcomeIsInterpretiveReading);
  const portrait = buildPortrait(wide.state, lookup);

  it("builds a web that genuinely mixes records and readings", () => {
    expect(records.length).toBe(4);
    expect(readings.length).toBe(2);
    expect(outcomes.length).toBe(8);
  });

  it("counts only the records as documented material", () => {
    expect(portrait.byId.depth.phrase).toContain(
      "Four of your eight threads met documented material"
    );
  });

  it("gives the readings a clause of their own", () => {
    expect(portrait.byId.depth.phrase).toContain("two met a reading the Game offers");
  });

  it("says it in the singular too, where the whole web is one reading", () => {
    const one = buildSessionFixture({
      conceptIds: [C.fibonacci, C.counterpoint],
      threads: [{ a: C.fibonacci, b: C.counterpoint, intention: "echo" }],
    });
    expect(buildPortrait(one.state, lookup).byId.depth.phrase).toBe(
      "Your one thread met a reading the Game offers rather than a record."
    );
  });

  it("gives the readings a count of their own in the evidence line", () => {
    expect(portrait.byId.depth.evidence).toContain(
      "4 documented, 2 read by the Game, 1 open, 1 unresolved"
    );
  });

  it("does not make a reading count for less than a record", () => {
    /*
     * CAV-006: the two kinds differ in resolution, never in reward. Splitting
     * the *prose* must not quietly turn Depth into a preference for records.
     *
     * Both webs are two disjoint edges over four beads, so every topological
     * term in Depth is identical and the evidence class is the only difference
     * between them.
     */
    const twoRecords = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.primes, C.polyrhythm],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.primes, b: C.polyrhythm, intention: "echo" },
      ],
    });
    const aRecordAndAReading = buildSessionFixture({
      conceptIds: [C.fourier, C.overtones, C.fibonacci, C.counterpoint],
      threads: [
        { a: C.fourier, b: C.overtones, intention: "echo" },
        { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
      ],
    });

    expect(
      resolveSessionOutcomes(twoRecords.state, lookup).filter(outcomeSpeaksForTheRecord)
    ).toHaveLength(2);
    expect(
      resolveSessionOutcomes(aRecordAndAReading.state, lookup).filter(
        outcomeIsInterpretiveReading
      )
    ).toHaveLength(1);

    expect(buildPortrait(aRecordAndAReading.state, lookup).byId.depth.value).toBe(
      buildPortrait(twoRecords.state, lookup).byId.depth.value
    );
  });
});

describe("buildPortrait — evidence lines are counts, not progress toward a total", () => {
  /**
   * Regression (GAP-14). Five evidence lines read "X of Y", which is the shape
   * of a completion meter: it names a maximum and how far short of it you fell.
   * ADR-010 removed the number precisely so the next Game is not an attempt to
   * beat this one. The facts are worth keeping; the framing is not, so each line
   * now states both parts of the partition instead of a part over a whole.
   */
  const portrait = buildPortrait(wide.state, lookup);

  it("states no evidence line as a fraction of a maximum", () => {
    for (const entry of portrait.dimensions) {
      for (const line of entry.evidence) {
        expect(line, `${entry.id}: ${line}`).not.toMatch(/\b\d+ of \d+\b/);
      }
    }
  });

  it("keeps the facts those lines carried", () => {
    const all = portrait.dimensions.flatMap((entry) => [...entry.evidence]).join(" | ");
    expect(all).toContain("woven");
    expect(all).toContain("Tension");
    expect(all).toContain("cycle");
  });
});

/**
 * DESIGN-REVIEW-SCHELL §3. The intention reached the sentence, the material
 * and the motifs, and nothing at the end. The seventh reading carries it to
 * the portrait as a characterisation, never as a rank.
 */
describe("buildPortrait — reading", () => {
  it("says which verbs the player reached for, and how often Castalia read with them", () => {
    const reading = buildPortrait(wide.state, lookup).byId.reading;
    expect(reading.phrase).toMatch(/^You read mostly for Echo\./);
    expect(reading.phrase).toContain("Where Castalia answered, it ");
    expect(reading.evidence[0]).toBe("Echo 4 · Passage 0 · Tension 1 · Ground 3");
    expect(reading.evidence[1]).toMatch(/^\d+ read with you · \d+ narrowed · \d+ across · \d+ not authored$/);
    expect(reading.value).toBeGreaterThan(0);
    expect(reading.value).toBeLessThan(1);
  });

  it("names the one verb a narrow session used, and is even at zero", () => {
    const reading = buildPortrait(narrow.state, lookup).byId.reading;
    expect(reading.phrase).toMatch(/^You read for Echo and for nothing else\./);
    expect(reading.value).toBe(0);
  });

  it("ranks nothing: no verdict words, and the value ignores whether the record agreed", () => {
    for (const state of [wide.state, narrow.state]) {
      const reading = buildPortrait(state, lookup).byId.reading;
      expect(reading.phrase).not.toMatch(/\b(right|wrong|correct|score|better|worse)\b/i);
    }
    // Two sessions with the same verbs in the same proportions have the same
    // value whatever the record said about them.
    const agreed = buildSessionFixture({
      conceptIds: WIDE_CONCEPTS,
      threads: [{ a: C.fibonacci, b: C.counterpoint, intention: "echo" }],
    });
    const crossed = buildSessionFixture({
      conceptIds: WIDE_CONCEPTS,
      threads: [{ a: C.fibonacci, b: C.counterpoint, intention: "tension" }],
    });
    expect(buildPortrait(agreed.state, lookup).byId.reading.value).toBe(
      buildPortrait(crossed.state, lookup).byId.reading.value
    );
  });

  it("says where Castalia ran across a reading, and what it read for instead", () => {
    const crossed = buildSessionFixture({
      conceptIds: WIDE_CONCEPTS,
      threads: [{ a: C.fibonacci, b: C.counterpoint, intention: "tension" }],
    });
    const outcomes = resolveSessionOutcomes(crossed.state, lookup);
    const reading = buildPortrait(crossed.state, lookup).byId.reading;
    if (outcomes[0]?.kind === "documented" && outcomes[0].stance === "complicated") {
      expect(reading.phrase).toContain("ran across you once");
      expect(reading.phrase).toMatch(/it read for \w+ where you read for Tension\./);
    } else {
      expect(reading.phrase).not.toContain("ran across you");
    }
  });

  it("has a sentence for a session with nothing woven", () => {
    const empty = buildSessionFixture({ conceptIds: WIDE_CONCEPTS });
    const reading = buildPortrait(empty.state, lookup).byId.reading;
    expect(reading.phrase).toBe("No reading has been declared yet.");
    expect(reading.value).toBe(0);
  });

  it("is stable under replay", () => {
    const a = buildPortrait(wide.state, lookup).byId.reading;
    const b = buildPortrait(wide.state, lookup).byId.reading;
    expect(b).toEqual(a);
  });
});
