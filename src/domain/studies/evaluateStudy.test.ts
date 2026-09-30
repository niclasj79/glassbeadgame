import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { ConceptId } from "../ids";
import type { SessionStateV1 } from "../model/sessionState";
import type { ConceptStructureLookup } from "../outcomes/lookup";
import { reduceSession } from "../reducer/reduceSession";
import { decodeSessionEventLogV1, replaySessionEventLogV1 } from "../replay";
import { evaluateStudy } from "./evaluateStudy";
import {
  buildStudySession,
  type StudyThreadSpec,
} from "./testing/buildStudySession";
import { fixtureStudy, studyFixture, type StudyFixture } from "./testing/studyFixtures";
import type { StudyDefinition, StudyGoal, StudyStatus } from "./types";

/** The passage web of the solver tests: see `solveStudy.test.ts`. */
const web = studyFixture({
  ash: ["measure", ["ember", "stone"]],
  birch: ["measure", ["stone", "leaf"]],
  cedar: ["sound", ["leaf", "rain"]],
  dune: ["sound", ["ember", "tide"]],
  elm: ["matter", ["rain", "tide"]],
  fir: ["sound", ["ember", "rain"]],
  gorse: ["image", ["moss"]],
  heath: ["image", ["moss"]],
});

const passage = (from: string, to: string, threads: number): StudyDefinition =>
  fixtureStudy({
    conceptIds: web.ids,
    goal: { kind: "passage", from: web.id(from), to: web.id(to), threads },
  });

/** Weaves the given pairs, by fixture key, into a Study session. */
function weave(
  fixture: StudyFixture,
  study: StudyDefinition,
  pairs: readonly (readonly [string, string])[],
  outcome?: StudyThreadSpec["outcome"]
): SessionStateV1 {
  return buildStudySession({
    studyId: study.id,
    conceptIds: study.conceptIds,
    threads: pairs.map(([a, b]) => ({ a: fixture.id(a), b: fixture.id(b), outcome })),
  }).state;
}

function evaluate(
  fixture: StudyFixture,
  study: StudyDefinition,
  pairs: readonly (readonly [string, string])[],
  declaredSilence = false
): StudyStatus {
  return evaluateStudy(weave(fixture, study, pairs), study, fixture.lookup, declaredSilence);
}

function solvedByThreads(status: StudyStatus) {
  if (status.kind !== "solved" || status.by !== "threads") {
    throw new Error(`expected a Study solved by threads, found ${JSON.stringify(status)}`);
  }
  return status;
}

function solvedBySilence(status: StudyStatus) {
  if (status.kind !== "solved" || status.by !== "silence") {
    throw new Error(`expected a Study solved by silence, found ${JSON.stringify(status)}`);
  }
  return status;
}

const thread = (index: number) => `thread:${index}`;

describe("evaluateStudy — passage", () => {
  it("is solved by a path within the count, read from the passage's start", () => {
    const status = solvedByThreads(
      evaluate(web, passage("ash", "elm", 2), [
        ["dune", "elm"],
        ["ash", "dune"],
      ])
    );
    expect(status.threadIds).toEqual([thread(1), thread(0)]);
    expect(status.explanation).toEqual({
      kind: "line",
      steps: [
        { from: web.id("ash"), to: web.id("dune"), facets: ["ember"] },
        { from: web.id("dune"), to: web.id("elm"), facets: ["tide"] },
      ],
      count: 2,
      used: 2,
    });
    expect(status.marks).toEqual(["economical", "varied"]);
  });

  it("is not yet while the only way woven is longer than the count", () => {
    const longWay: readonly (readonly [string, string])[] = [
      ["ash", "birch"],
      ["birch", "cedar"],
      ["cedar", "elm"],
    ];
    expect(evaluate(web, passage("ash", "elm", 2), longWay)).toEqual({
      kind: "not-yet",
      statement: { kind: "no-answer-yet" },
    });
    expect(solvedByThreads(evaluate(web, passage("ash", "elm", 3), longWay)).threadIds).toEqual(
      [thread(0), thread(1), thread(2)]
    );
  });

  it("does not count a thread that carries nothing, and reports it as used", () => {
    const status = solvedByThreads(
      evaluate(web, passage("ash", "elm", 2), [
        ["ash", "elm"],
        ["ash", "dune"],
        ["dune", "elm"],
      ])
    );
    expect(status.threadIds).toEqual([thread(1), thread(2)]);
    expect(status.explanation.used).toBe(3);
    expect(status.marks).not.toContain("economical");
  });

  it("takes the fewest threads, even when a longer way was complete first", () => {
    const status = solvedByThreads(
      evaluate(web, passage("ash", "elm", 3), [
        ["ash", "birch"],
        ["birch", "cedar"],
        ["cedar", "elm"],
        ["ash", "fir"],
        ["fir", "elm"],
      ])
    );
    expect(status.threadIds).toEqual([thread(3), thread(4)]);
  });

  it("breaks a tie between answers of one size by the one complete first", () => {
    const status = solvedByThreads(
      evaluate(web, passage("ash", "elm", 2), [
        ["ash", "fir"],
        ["ash", "dune"],
        ["dune", "elm"],
        ["fir", "elm"],
      ])
    );
    expect(status.threadIds).toEqual([thread(1), thread(2)]);
  });

  it("uses the earliest thread when a pair is woven twice", () => {
    const status = solvedByThreads(
      evaluate(web, passage("ash", "elm", 2), [
        ["ash", "dune"],
        ["dune", "ash"],
        ["dune", "elm"],
      ])
    );
    expect(status.threadIds).toEqual([thread(0), thread(2)]);
  });
});

describe("evaluateStudy — canon", () => {
  const line = studyFixture({
    m1: ["measure", ["wave"]],
    s1: ["sound", ["wave", "sand"]],
    s2: ["sound", ["wave"]],
    x1: ["matter", ["wave", "sand"]],
  });
  const canon = (facet: string, faculties: number): StudyDefinition =>
    fixtureStudy({
      conceptIds: line.ids,
      goal: { kind: "canon", facet: line.facet(facet), faculties },
    });

  it("is solved by a connected group carrying the facet through the faculties", () => {
    const status = solvedByThreads(
      evaluate(line, canon("wave", 3), [
        ["s1", "x1"],
        ["m1", "s1"],
      ])
    );
    expect(status.threadIds).toEqual([thread(1), thread(0)]);
    expect(status.explanation.steps).toEqual([
      { from: line.id("m1"), to: line.id("s1"), facets: ["wave"] },
      { from: line.id("s1"), to: line.id("x1"), facets: ["sand", "wave"] },
    ]);
  });

  it("accepts more threads than the count when the woven group needs them", () => {
    // m1–s1–s2–x1 reaches three faculties, and no two of its threads do.
    const status = solvedByThreads(
      evaluate(line, canon("wave", 3), [
        ["m1", "s1"],
        ["s1", "s2"],
        ["s2", "x1"],
      ])
    );
    expect(status.threadIds).toEqual([thread(0), thread(1), thread(2)]);
    expect(status.explanation.count).toBe(2);
    expect(status.marks).not.toContain("economical");
  });

  it("narrows to the fewest threads once a shorter group is woven", () => {
    const status = solvedByThreads(
      evaluate(line, canon("wave", 3), [
        ["m1", "s1"],
        ["s1", "s2"],
        ["s2", "x1"],
        ["s1", "x1"],
      ])
    );
    expect(status.threadIds).toEqual([thread(0), thread(3)]);
  });

  it("does not count a thread that carries a different facet", () => {
    expect(
      evaluate(line, canon("sand", 2), [
        ["m1", "s1"],
        ["s2", "x1"],
      ]).kind
    ).toBe("not-yet");
  });

  it("is never Varied, since every thread of a canon carries its facet", () => {
    const four = studyFixture({
      m: ["measure", ["wave"]],
      s: ["sound", ["wave"]],
      x: ["matter", ["wave"]],
      i: ["image", ["wave"]],
    });
    const study = fixtureStudy({
      conceptIds: four.ids,
      goal: { kind: "canon", facet: four.facet("wave"), faculties: 4 },
    });
    const status = solvedByThreads(
      evaluate(four, study, [
        ["m", "s"],
        ["s", "x"],
        ["x", "i"],
      ])
    );
    expect(status.marks).toEqual(["economical", "wide"]);
  });
});

describe("evaluateStudy — carry", () => {
  const carryWeb = studyFixture({
    m1: ["measure", ["salt", "stone"]],
    x1: ["matter", ["salt"]],
    x2: ["matter", ["stone"]],
    i1: ["image", ["salt"]],
    s1: ["sound", ["stone"]],
    x3: ["matter", ["ore"]],
  });
  const carry = (facet: string, into: "measure" | "sound" | "matter" | "image") =>
    fixtureStudy({
      conceptIds: carryWeb.ids,
      goal: { kind: "carry", facet: carryWeb.facet(facet), into },
    });

  it("is solved by one thread carrying the facet into the faculty, read into it", () => {
    const status = solvedByThreads(
      evaluate(carryWeb, carry("salt", "matter"), [
        ["m1", "x2"],
        ["x1", "m1"],
      ])
    );
    expect(status.threadIds).toEqual([thread(1)]);
    expect(status.explanation.steps).toEqual([
      { from: carryWeb.id("m1"), to: carryWeb.id("x1"), facets: ["salt"] },
    ]);
    // One thread is never Varied and never Wide; two woven for a count of one is not Economical.
    expect(status.marks).toEqual([]);
  });

  it("is Economical when the one thread is all the session wove", () => {
    const status = solvedByThreads(evaluate(carryWeb, carry("salt", "matter"), [["i1", "x1"]]));
    expect(status.marks).toEqual(["economical"]);
  });

  it("does not count a thread into the faculty that carries something else", () => {
    expect(evaluate(carryWeb, carry("salt", "matter"), [["m1", "x2"]]).kind).toBe("not-yet");
  });
});

describe("evaluateStudy — silence", () => {
  it("solves a carry that no bead of the faculty can meet, and says so", () => {
    const study = fixtureStudy({
      conceptIds: ["ash", "birch", "cedar", "elm"].map(web.id),
      goal: { kind: "carry", facet: web.facet("leaf"), into: "matter" },
    });
    const status = solvedBySilence(evaluateStudy(weave(web, study, []), study, web.lookup, true));
    expect(status).toEqual({
      kind: "solved",
      by: "silence",
      threadIds: [],
      marks: [],
      explanation: { kind: "carry-silence", facet: "leaf", into: "matter", lone: null },
    });
  });

  it("names the one bead of the faculty that carries the facet alone", () => {
    const study = fixtureStudy({
      conceptIds: ["ash", "birch", "gorse"].map(web.id),
      goal: { kind: "carry", facet: web.facet("moss"), into: "image" },
    });
    const status = solvedBySilence(evaluateStudy(weave(web, study, []), study, web.lookup, true));
    expect(status.explanation).toEqual({
      kind: "carry-silence",
      facet: "moss",
      into: "image",
      lone: web.id("gorse"),
    });
  });

  it("solves a passage with no way of the count, and keeps the longer way", () => {
    const study = passage("ash", "elm", 1);
    const status = solvedBySilence(evaluateStudy(weave(web, study, []), study, web.lookup, true));
    expect(status.explanation).toEqual({
      kind: "passage-silence",
      from: web.id("ash"),
      to: web.id("elm"),
      threads: 1,
      shortest: 2,
    });
  });

  it("reports a passage with no way at all", () => {
    const study = passage("ash", "gorse", 3);
    const status = solvedBySilence(evaluateStudy(weave(web, study, []), study, web.lookup, true));
    expect(status.explanation).toMatchObject({ kind: "passage-silence", shortest: null });
  });

  it("solves a canon the facet cannot reach, naming the faculties it does reach", () => {
    const study = fixtureStudy({
      conceptIds: web.ids,
      goal: { kind: "canon", facet: web.facet("rain"), faculties: 3 },
    });
    const status = solvedBySilence(evaluateStudy(weave(web, study, []), study, web.lookup, true));
    expect(status.explanation).toEqual({
      kind: "canon-silence",
      facet: "rain",
      faculties: 3,
      reached: ["sound", "matter"],
    });
  });

  it("is not yet, and says only that it can be done, when an answer exists", () => {
    const study = passage("ash", "elm", 2);
    const status = evaluateStudy(weave(web, study, [["ash", "dune"]]), study, web.lookup, true);
    expect(status).toEqual({ kind: "not-yet", statement: { kind: "can-be-done" } });
    // Nothing in the status can name a bead, a path or a count.
    expect(JSON.stringify(status)).not.toMatch(/ash|dune|elm|fir|thread|\d/);
  });

  it("is not yet, with no answer yet, when nothing is declared", () => {
    const study = passage("ash", "elm", 1);
    expect(evaluateStudy(weave(web, study, []), study, web.lookup, false)).toEqual({
      kind: "not-yet",
      statement: { kind: "no-answer-yet" },
    });
  });

  it("lets threads that meet the brief stand over a declared silence", () => {
    const study = passage("ash", "elm", 2);
    const woven = weave(web, study, [
      ["ash", "dune"],
      ["dune", "elm"],
    ]);
    expect(evaluateStudy(woven, study, web.lookup, true)).toEqual(
      evaluateStudy(woven, study, web.lookup, false)
    );
  });
});

describe("evaluateStudy — marks", () => {
  const across = studyFixture({
    p1: ["measure", ["a"]],
    p2: ["sound", ["a", "b"]],
    p3: ["matter", ["b", "c"]],
    p4: ["image", ["c"]],
    q1: ["measure", ["d"]],
    q2: ["sound", ["d"]],
    q3: ["matter", ["d"]],
  });
  const study = (from: string, to: string, threads: number) =>
    fixtureStudy({
      conceptIds: across.ids,
      goal: { kind: "passage", from: across.id(from), to: across.id(to), threads },
    });

  it("awards all three for an exact, four-faculty line with nothing repeated", () => {
    const status = solvedByThreads(
      evaluate(across, study("p1", "p4", 3), [
        ["p1", "p2"],
        ["p2", "p3"],
        ["p3", "p4"],
      ])
    );
    expect(status.marks).toEqual(["economical", "wide", "varied"]);
  });

  it("withholds Varied when consecutive threads carry a facet in common", () => {
    const status = solvedByThreads(
      evaluate(across, study("q1", "q3", 2), [
        ["q1", "q2"],
        ["q2", "q3"],
      ])
    );
    expect(status.marks).toEqual(["economical"]);
  });

  it("withholds Economical from a session that wove more than the count", () => {
    const status = solvedByThreads(
      evaluate(across, study("p1", "p4", 3), [
        ["q1", "q2"],
        ["p1", "p2"],
        ["p2", "p3"],
        ["p3", "p4"],
      ])
    );
    expect(status.marks).toEqual(["wide", "varied"]);
    expect(status.explanation.used).toBe(4);
  });

  it("orders marks the one fixed way and never repeats one", () => {
    const status = solvedByThreads(
      evaluate(across, study("p1", "p4", 3), [
        ["p3", "p4"],
        ["p2", "p3"],
        ["p1", "p2"],
      ])
    );
    expect(status.marks).toEqual(["economical", "wide", "varied"]);
  });
});

describe("evaluateStudy — R1: public information only", () => {
  it("is typed over the structural lookup and nothing wider", () => {
    expectTypeOf(evaluateStudy).parameter(2).toEqualTypeOf<ConceptStructureLookup>();
  });

  it("reads nothing but facets and faculties from its lookup", () => {
    const accessed = new Set<string>();
    const forbidden = (name: string) => () => {
      throw new Error(`the evaluator read ${name}`);
    };
    const wide = {
      ...web.lookup,
      facetName: forbidden("facetName"),
      conceptMotif: forbidden("conceptMotif"),
      findRelation: forbidden("findRelation"),
      openThreadPrompt: forbidden("openThreadPrompt"),
    };
    const watched = new Proxy(wide, {
      get(target, property, receiver) {
        accessed.add(String(property));
        return Reflect.get(target, property, receiver);
      },
    });

    const goals: readonly StudyGoal[] = [
      { kind: "passage", from: web.id("ash"), to: web.id("elm"), threads: 2 },
      { kind: "passage", from: web.id("ash"), to: web.id("gorse"), threads: 2 },
      { kind: "canon", facet: web.facet("ember"), faculties: 2 },
      { kind: "canon", facet: web.facet("rain"), faculties: 3 },
      { kind: "carry", facet: web.facet("tide"), into: "matter" },
      { kind: "carry", facet: web.facet("moss"), into: "sound" },
    ];
    for (const goal of goals) {
      const study = fixtureStudy({ conceptIds: web.ids, goal });
      const woven = weave(web, study, [
        ["ash", "dune"],
        ["dune", "elm"],
        ["ash", "gorse"],
      ]);
      for (const declared of [false, true]) {
        evaluateStudy(woven, study, watched, declared);
      }
    }

    expect([...accessed].sort()).toEqual(["conceptFacets", "conceptFaculty"]);
  });
});

describe("evaluateStudy — R2: marks of form, never marks of truth", () => {
  const pairs: readonly (readonly [string, string])[] = [
    ["ash", "gorse"],
    ["ash", "dune"],
    ["birch", "cedar"],
    ["dune", "elm"],
  ];

  it("gives byte-identical status whatever outcome each thread drew", () => {
    for (const study of [passage("ash", "elm", 2), passage("ash", "elm", 1)]) {
      for (const declared of [false, true]) {
        const statuses = (["documented", "open-thread", undefined] as const).map((outcome) =>
          JSON.stringify(
            evaluateStudy(weave(web, study, pairs, outcome), study, web.lookup, declared)
          )
        );
        expect(new Set(statuses).size).toBe(1);
      }
    }
  });

  it("reads outcomes nowhere: the woven sessions do differ, the statuses do not", () => {
    const study = passage("ash", "elm", 2);
    const documented = weave(web, study, pairs, "documented");
    const unresolved = weave(web, study, pairs);
    expect(documented.outcomes).toHaveLength(pairs.length);
    expect(unresolved.outcomes).toHaveLength(0);
    expect(JSON.stringify(evaluateStudy(documented, study, web.lookup, false))).toBe(
      JSON.stringify(evaluateStudy(unresolved, study, web.lookup, false))
    );
  });
});

describe("evaluateStudy — purity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const isDeeplyFrozen = (value: unknown): boolean => {
    if (value === null || typeof value !== "object") return true;
    if (!Object.isFrozen(value)) return false;
    return Object.values(value).every(isDeeplyFrozen);
  };

  const cases: readonly (readonly [StudyDefinition, boolean])[] = [
    [passage("ash", "elm", 2), false],
    [passage("ash", "elm", 1), true],
    [passage("ash", "elm", 3), true],
    [passage("ash", "gorse", 2), false],
  ];

  it("returns deeply frozen status, equal on every call", () => {
    for (const [study, declared] of cases) {
      const woven = weave(web, study, [
        ["ash", "dune"],
        ["dune", "elm"],
      ]);
      const first = evaluateStudy(woven, study, web.lookup, declared);
      const second = evaluateStudy(woven, study, web.lookup, declared);
      expect(isDeeplyFrozen(first)).toBe(true);
      expect(second).toEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });

  it("mutates neither the session nor the Study", () => {
    const study = passage("ash", "elm", 2);
    const woven = weave(web, study, [
      ["ash", "dune"],
      ["dune", "elm"],
    ]);
    const before = JSON.stringify([woven, study]);
    evaluateStudy(woven, study, web.lookup, true);
    expect(JSON.stringify([woven, study])).toBe(before);
  });

  it("reads no clock and no random source", () => {
    const refuse = () => {
      throw new Error("a Study read the clock or a random source");
    };
    vi.spyOn(Math, "random").mockImplementation(refuse);
    vi.spyOn(Date, "now").mockImplementation(refuse);
    vi.spyOn(performance, "now").mockImplementation(refuse);
    for (const [study, declared] of cases) {
      const woven = weave(web, study, [["ash", "dune"]]);
      expect(() => evaluateStudy(woven, study, web.lookup, declared)).not.toThrow();
    }
  });
});

describe("evaluateStudy — replay", () => {
  const study = passage("ash", "elm", 2);
  const session = buildStudySession({
    studyId: study.id,
    conceptIds: study.conceptIds,
    contentPackVersion: "castalia.v1",
    threads: [
      { a: web.id("ash"), b: web.id("gorse"), intention: "tension" },
      { a: web.id("ash"), b: web.id("dune"), intention: "echo", outcome: "open-thread" },
      { a: web.id("dune"), b: web.id("elm"), intention: "ground", outcome: "documented" },
    ],
  });

  it("starts as a Study session: its seed, its identity and its beads in order", () => {
    const started = session.log.events[0];
    expect(started?.type).toBe("session.started");
    expect(started?.sessionId).toBe(`session:castalia.v1:study:${study.id}`);
    expect(started?.payload).toEqual({
      seed: `study:${study.id}`,
      contentPackVersion: "castalia.v1",
      worldId: "castalia",
      conceptIds: study.conceptIds,
    });
  });

  it("reproduces the live status from a decoded and replayed log", () => {
    const decoded = decodeSessionEventLogV1(JSON.parse(JSON.stringify(session.log)));
    const replayed = replaySessionEventLogV1(decoded);
    for (const declared of [false, true]) {
      expect(JSON.stringify(evaluateStudy(replayed, study, web.lookup, declared))).toBe(
        JSON.stringify(evaluateStudy(session.state, study, web.lookup, declared))
      );
    }
    expect(evaluateStudy(replayed, study, web.lookup, false).kind).toBe("solved");
  });

  it("reproduces every status along the way, event by event", () => {
    let live: SessionStateV1 | null = null;
    session.log.events.forEach((event, index) => {
      live = reduceSession(live, event);
      const prefix = decodeSessionEventLogV1(
        JSON.parse(
          JSON.stringify({ ...session.log, events: session.log.events.slice(0, index + 1) })
        )
      );
      const replayed = replaySessionEventLogV1(prefix);
      expect(JSON.stringify(evaluateStudy(replayed, study, web.lookup, false))).toBe(
        JSON.stringify(evaluateStudy(live as SessionStateV1, study, web.lookup, false))
      );
    });
  });
});

describe("evaluateStudy — only the Study's beads count", () => {
  it("ignores a thread between beads the Study does not hold", () => {
    const narrow = fixtureStudy({
      conceptIds: ["ash", "dune", "elm"].map(web.id),
      goal: { kind: "passage", from: web.id("ash"), to: web.id("elm"), threads: 2 },
    });
    // A session over the whole web, as a caller might mistakenly pass.
    const wide = buildStudySession({
      studyId: narrow.id,
      conceptIds: web.ids,
      threads: [
        { a: web.id("ash"), b: web.id("fir") },
        { a: web.id("fir"), b: web.id("elm") },
      ],
    }).state;
    const status: StudyStatus = evaluateStudy(wide, narrow, web.lookup, false);
    expect(status.kind).toBe("not-yet");
    const ids: readonly ConceptId[] = narrow.conceptIds;
    expect(ids).not.toContain(web.id("fir"));
  });
});
