import { describe, expect, it } from "vitest";
import { toConceptId, toThreadId, type ConceptId } from "../ids";
import {
  STUDY_MARK_WORDS,
  describeStudyLine,
  describeStudyStatus,
  renderStudyBrief,
} from "./describe";
import { magisterLine } from "./magisterLine";
import { fixtureStudy, studyFixture } from "./testing/studyFixtures";
import {
  STUDY_MARKS,
  type FacetId,
  type FacultyId,
  type StudyNames,
  type StudyStatus,
} from "./types";

/**
 * Names as the pack would supply them. The renderers receive names from their
 * caller; the evaluator never does.
 */
const NAMES: Readonly<Record<string, string>> = {
  mobius: "The Möbius Band",
  symmetry: "Continuous Symmetry",
  counterpoint: "Counterpoint",
  just: "Just Intonation",
  polyrhythm: "Polyrhythm",
  cantor: "Cantor's Diagonal Argument",
  diffraction: "Diffraction",
  continuity: "Continuity",
  invariance: "Invariance",
  superposition: "Superposition",
  threshold: "Threshold",
  proportion: "Proportion",
  periodicity: "Return",
  incommensurability: "No Common Measure",
};

const names: StudyNames = {
  conceptName: (id) => NAMES[String(id)] ?? String(id),
  facetName: (id) => NAMES[String(id)] ?? String(id),
  facultyName: (id) => `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
};

const bead = (key: string): ConceptId => toConceptId(key);
const facet = (key: string): FacetId => key as FacetId;
const faculty = (key: FacultyId): FacultyId => key;

describe("renderStudyBrief", () => {
  it("renders a passage in the Game's words, numbers as words", () => {
    expect(
      renderStudyBrief(
        { kind: "passage", from: bead("mobius"), to: bead("counterpoint"), threads: 2 },
        names
      )
    ).toBe("From The Möbius Band to Counterpoint in two threads");
    expect(
      renderStudyBrief(
        { kind: "passage", from: bead("mobius"), to: bead("counterpoint"), threads: 1 },
        names
      )
    ).toBe("From The Möbius Band to Counterpoint in one thread");
  });

  it("renders a canon, and 'all four' when it reaches every faculty", () => {
    expect(
      renderStudyBrief({ kind: "canon", facet: facet("superposition"), faculties: 3 }, names)
    ).toBe("Carry Superposition through three faculties");
    expect(
      renderStudyBrief({ kind: "canon", facet: facet("periodicity"), faculties: 4 }, names)
    ).toBe("Carry Return through all four faculties");
  });

  it("renders a carry", () => {
    expect(
      renderStudyBrief(
        { kind: "carry", facet: facet("threshold"), into: faculty("matter") },
        names
      )
    ).toBe("Carry Threshold into Matter");
  });
});

describe("describeStudyStatus", () => {
  it("says not yet, and nothing more", () => {
    expect(
      describeStudyStatus({ kind: "not-yet", statement: { kind: "no-answer-yet" } }, names)
    ).toBe("Not yet.");
    expect(
      describeStudyStatus({ kind: "not-yet", statement: { kind: "can-be-done" } }, names)
    ).toBe("Not yet — it can be done with these beads.");
  });

  const silence = (explanation: Extract<StudyStatus, { by: "silence" }>["explanation"]) =>
    describeStudyStatus(
      { kind: "solved", by: "silence", threadIds: [], marks: [], explanation },
      names
    );

  it("gives the specification's reason for a carry silence", () => {
    expect(
      silence({
        kind: "carry-silence",
        facet: facet("proportion"),
        into: faculty("matter"),
        lone: null,
      })
    ).toBe("No Matter bead here carries Proportion.");
    expect(
      silence({
        kind: "carry-silence",
        facet: facet("proportion"),
        into: faculty("sound"),
        lone: bead("just"),
      })
    ).toBe(
      "Only Just Intonation carries Proportion here, and a thread needs two beads that carry it."
    );
  });

  it("gives the specification's reason for a passage silence, and the way there is", () => {
    const passage = (threads: number, shortest: number | null) =>
      silence({
        kind: "passage-silence",
        from: bead("just"),
        to: bead("polyrhythm"),
        threads,
        shortest,
      });
    expect(passage(2, 3)).toBe(
      "No bead here carries a facet of both Just Intonation and Polyrhythm; the shortest way needs three."
    );
    expect(passage(1, 2)).toBe(
      "Just Intonation and Polyrhythm share no facet; the shortest way needs two."
    );
    expect(passage(3, 4)).toBe(
      "No way of three threads or fewer joins Just Intonation to Polyrhythm here; the shortest way needs four."
    );
    expect(passage(2, null)).toBe(
      "No way through these beads joins Just Intonation to Polyrhythm."
    );
  });

  it("gives the reason for a canon silence", () => {
    expect(
      silence({
        kind: "canon-silence",
        facet: facet("superposition"),
        faculties: 3,
        reached: [faculty("measure"), faculty("sound")],
      })
    ).toBe("Only Measure and Sound beads here carry Superposition.");
    expect(
      silence({ kind: "canon-silence", facet: facet("superposition"), faculties: 3, reached: [] })
    ).toBe("No bead here carries Superposition.");
  });

  it("states the player's line and the count plainly", () => {
    const status: StudyStatus = {
      kind: "solved",
      by: "threads",
      threadIds: [toThreadId("thread:0"), toThreadId("thread:1")],
      marks: ["varied"],
      explanation: {
        kind: "line",
        steps: [
          { from: bead("mobius"), to: bead("symmetry"), facets: [facet("continuity")] },
          { from: bead("symmetry"), to: bead("counterpoint"), facets: [facet("invariance")] },
        ],
        count: 2,
        used: 5,
      },
    };
    expect(describeStudyStatus(status, names)).toBe(
      "The Möbius Band to Continuous Symmetry carries Continuity; Continuous Symmetry to Counterpoint carries Invariance. Solved in five; the brief asked for two."
    );
  });

  it("never praises, ranks or counts Studies", () => {
    const sentences = [
      describeStudyStatus({ kind: "not-yet", statement: { kind: "no-answer-yet" } }, names),
      describeStudyStatus({ kind: "not-yet", statement: { kind: "can-be-done" } }, names),
      silence({
        kind: "carry-silence",
        facet: facet("proportion"),
        into: faculty("matter"),
        lone: null,
      }),
    ];
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(
        /score|points|rank|wrong|correct|well done|congratulations|great|perfect|%|\d/i
      );
    }
  });
});

describe("describeStudyLine", () => {
  it("names every facet a thread carried", () => {
    expect(
      describeStudyLine(
        [
          {
            from: bead("just"),
            to: bead("polyrhythm"),
            facets: [facet("incommensurability"), facet("periodicity")],
          },
        ],
        names
      )
    ).toBe("Just Intonation to Polyrhythm carries No Common Measure and Return");
  });
});

describe("STUDY_MARK_WORDS", () => {
  it("gives every mark a word and nothing else", () => {
    expect(Object.keys(STUDY_MARK_WORDS)).toEqual([...STUDY_MARKS]);
    expect(Object.values(STUDY_MARK_WORDS)).toEqual(["Economical", "Wide", "Varied"]);
  });
});

describe("magisterLine", () => {
  const web = studyFixture({
    a: ["measure", ["x", "y"]],
    b: ["sound", ["y", "z"]],
    c: ["matter", ["z"]],
  });

  it("reads the authored line with the facets each thread carries", () => {
    const study = fixtureStudy({
      conceptIds: web.ids,
      goal: { kind: "passage", from: web.id("a"), to: web.id("c"), threads: 2 },
      answer: {
        kind: "threads",
        pairs: [
          [web.id("a"), web.id("b")],
          [web.id("b"), web.id("c")],
        ],
      },
    });
    const steps = magisterLine(study, web.lookup);
    expect(steps).toEqual([
      { from: web.id("a"), to: web.id("b"), facets: ["y"] },
      { from: web.id("b"), to: web.id("c"), facets: ["z"] },
    ]);
    expect(Object.isFrozen(steps)).toBe(true);
    expect(describeStudyLine(steps ?? [], web.names)).toBe("A to B carries Y; B to C carries Z");
  });

  it("is null for a silence", () => {
    const study = fixtureStudy({
      conceptIds: web.ids,
      goal: { kind: "carry", facet: web.facet("x"), into: "image" },
    });
    expect(magisterLine(study, web.lookup)).toBeNull();
  });
});
