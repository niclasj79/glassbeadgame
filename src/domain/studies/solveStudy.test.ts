import { describe, expect, it } from "vitest";
import type { ConceptPair } from "../events";
import { answerKey, containsAnswer, solveStudy } from "./solveStudy";
import { fixtureStudy, studyFixture } from "./testing/studyFixtures";
import type { StudySolution } from "./types";

/**
 * A small web for passages. Carrying pairs: ash–birch (stone), ash–dune and
 * ash–fir and dune–fir (ember), birch–cedar (leaf), cedar–elm, cedar–fir and
 * fir–elm (rain), dune–elm (tide), gorse–heath (moss). Gorse and heath are
 * joined to each other and to nothing else.
 */
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

const lines = (solution: StudySolution): readonly string[] =>
  solution.answers.map((answer) =>
    [answer[0]?.[0], ...answer.map((pair) => pair[1])].join("-")
  );

const passage = (from: string, to: string, threads: number) =>
  fixtureStudy({
    conceptIds: web.ids,
    goal: { kind: "passage", from: web.id(from), to: web.id(to), threads },
  });

describe("solveStudy — passage", () => {
  it("finds every simple way within the count, shortest first, then by bead order", () => {
    const two = solveStudy(passage("ash", "elm", 2), web.lookup);
    expect(two.count).toBe(2);
    expect(two.shortest).toBe(2);
    expect(lines(two)).toEqual(["ash-dune-elm", "ash-fir-elm"]);

    const three = solveStudy(passage("ash", "elm", 3), web.lookup);
    expect(three.shortest).toBe(2);
    expect(lines(three)).toEqual([
      "ash-dune-elm",
      "ash-fir-elm",
      "ash-birch-cedar-elm",
      "ash-dune-fir-elm",
      "ash-fir-cedar-elm",
      "ash-fir-dune-elm",
    ]);
  });

  it("writes each answer bead to bead, from the passage's start", () => {
    const solution = solveStudy(passage("elm", "ash", 2), web.lookup);
    for (const answer of solution.answers) {
      expect(answer[0]?.[0]).toBe(web.id("elm"));
      expect(answer[answer.length - 1]?.[1]).toBe(web.id("ash"));
      answer.slice(1).forEach((pair, index) => expect(pair[0]).toBe(answer[index]?.[1]));
    }
  });

  it("reports the shortest way even when it is longer than the count", () => {
    const solution = solveStudy(passage("ash", "elm", 1), web.lookup);
    expect(solution.answers).toEqual([]);
    expect(solution.shortest).toBe(2);
  });

  it("reports no way at all as null", () => {
    const solution = solveStudy(passage("ash", "gorse", 4), web.lookup);
    expect(solution.answers).toEqual([]);
    expect(solution.shortest).toBeNull();
  });

  it("finds a single shared facet as a one-thread way", () => {
    const solution = solveStudy(passage("gorse", "heath", 1), web.lookup);
    expect(lines(solution)).toEqual(["gorse-heath"]);
    expect(solution.shortest).toBe(1);
  });

  it("only walks the Study's own beads", () => {
    const study = fixtureStudy({
      conceptIds: ["ash", "dune", "elm", "fir"].map(web.id),
      goal: { kind: "passage", from: web.id("ash"), to: web.id("elm"), threads: 3 },
    });
    expect(lines(solveStudy(study, web.lookup))).toEqual([
      "ash-dune-elm",
      "ash-fir-elm",
      "ash-dune-fir-elm",
      "ash-fir-dune-elm",
    ]);
  });

  it("has no answer for a passage that starts outside the beads or where it ends", () => {
    const outside = fixtureStudy({
      conceptIds: ["ash", "dune"].map(web.id),
      goal: { kind: "passage", from: web.id("ash"), to: web.id("elm"), threads: 2 },
    });
    expect(solveStudy(outside, web.lookup)).toEqual({ count: 2, shortest: null, answers: [] });

    const loop = passage("ash", "ash", 3);
    expect(solveStudy(loop, web.lookup)).toEqual({ count: 3, shortest: null, answers: [] });
  });
});

describe("solveStudy — canon", () => {
  /** Wave is carried once in each faculty, and sand joins image to a second sound bead. */
  const canonWeb = studyFixture({
    m1: ["measure", ["wave"]],
    s1: ["sound", ["wave"]],
    x1: ["matter", ["wave"]],
    i1: ["image", ["wave", "sand"]],
    s2: ["sound", ["sand"]],
  });
  const canon = (facet: string, faculties: number) =>
    fixtureStudy({
      conceptIds: canonWeb.ids,
      goal: { kind: "canon", facet: canonWeb.facet(facet), faculties },
    });

  it("counts the spanning trees of every group of carriers in distinct faculties", () => {
    // Four groups of three faculties, three trees each.
    const three = solveStudy(canon("wave", 3), canonWeb.lookup);
    expect(three.count).toBe(2);
    expect(three.shortest).toBe(2);
    expect(three.answers).toHaveLength(12);

    // One group of four faculties: Cayley's 4^(4−2) = 16 trees.
    const four = solveStudy(canon("wave", 4), canonWeb.lookup);
    expect(four.count).toBe(3);
    expect(four.answers).toHaveLength(16);
    for (const answer of four.answers) expect(answer).toHaveLength(3);
  });

  it("never counts two carriers of one faculty as two faculties", () => {
    const twice = studyFixture({
      m1: ["measure", ["wave"]],
      m2: ["measure", ["wave"]],
      s1: ["sound", ["wave"]],
    });
    const study = fixtureStudy({
      conceptIds: twice.ids,
      goal: { kind: "canon", facet: twice.facet("wave"), faculties: 3 },
    });
    const solution = solveStudy(study, twice.lookup);
    expect(solution.answers).toEqual([]);
    expect(solution.shortest).toBeNull();
  });

  it("lists every answer's pairs by bead order", () => {
    const solution = solveStudy(canon("wave", 3), canonWeb.lookup);
    const rank = new Map(canonWeb.ids.map((id, index) => [id, index]));
    for (const answer of solution.answers) {
      for (const [a, b] of answer) expect(rank.get(a) ?? 0).toBeLessThan(rank.get(b) ?? 0);
    }
  });

  it("has no answer when the facet reaches too few faculties", () => {
    const solution = solveStudy(canon("sand", 3), canonWeb.lookup);
    expect(solution.answers).toEqual([]);
    expect(solution.shortest).toBeNull();
  });
});

describe("solveStudy — carry", () => {
  const carryWeb = studyFixture({
    m1: ["measure", ["salt", "stone"]],
    x1: ["matter", ["salt"]],
    x2: ["matter", ["stone"]],
    i1: ["image", ["salt"]],
    s1: ["sound", ["stone"]],
  });
  const carry = (facet: string, into: "measure" | "sound" | "matter" | "image") =>
    fixtureStudy({
      conceptIds: carryWeb.ids,
      goal: { kind: "carry", facet: carryWeb.facet(facet), into },
    });

  it("finds every thread carrying the facet with a bead in the faculty", () => {
    const solution = solveStudy(carry("salt", "matter"), carryWeb.lookup);
    expect(solution.count).toBe(1);
    expect(solution.shortest).toBe(1);
    expect(solution.answers.map(answerKey)).toEqual([
      answerKey([[carryWeb.id("m1"), carryWeb.id("x1")]]),
      answerKey([[carryWeb.id("x1"), carryWeb.id("i1")]]),
    ]);
  });

  it("has no answer when no bead of the faculty carries the facet", () => {
    const solution = solveStudy(carry("stone", "image"), carryWeb.lookup);
    expect(solution.answers).toEqual([]);
    expect(solution.shortest).toBeNull();
  });
});

describe("solveStudy — determinism and immutability", () => {
  it("returns a deeply frozen solution, equal on every call", () => {
    const study = passage("ash", "elm", 3);
    const first = solveStudy(study, web.lookup);
    const second = solveStudy(study, web.lookup);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.answers)).toBe(true);
    for (const answer of first.answers) {
      expect(Object.isFrozen(answer)).toBe(true);
      for (const pair of answer) expect(Object.isFrozen(pair)).toBe(true);
    }
  });

  it("does not depend on the order beads are listed in", () => {
    const shuffled = fixtureStudy({
      conceptIds: [...web.ids].reverse(),
      goal: { kind: "passage", from: web.id("ash"), to: web.id("elm"), threads: 3 },
    });
    const keys = (solution: StudySolution) => solution.answers.map(answerKey).sort();
    expect(keys(solveStudy(shuffled, web.lookup))).toEqual(
      keys(solveStudy(passage("ash", "elm", 3), web.lookup))
    );
  });

  it("does not mutate the Study", () => {
    const study = passage("ash", "elm", 3);
    const before = JSON.stringify(study);
    solveStudy(study, web.lookup);
    expect(JSON.stringify(study)).toBe(before);
  });
});

describe("answerKey and containsAnswer", () => {
  it("treat an answer as unordered pairs, whatever their direction or order", () => {
    const a = web.id("ash");
    const d = web.id("dune");
    const e = web.id("elm");
    const forward: readonly ConceptPair[] = [
      [a, d],
      [d, e],
    ];
    const backward: readonly ConceptPair[] = [
      [e, d],
      [d, a],
    ];
    expect(answerKey(backward)).toBe(answerKey(forward));

    const solution = solveStudy(passage("ash", "elm", 2), web.lookup);
    expect(containsAnswer(solution, backward)).toBe(true);
    expect(containsAnswer(solution, [[a, d]])).toBe(false);
    expect(containsAnswer(solution, [...forward, [a, d]])).toBe(false);
  });
});
