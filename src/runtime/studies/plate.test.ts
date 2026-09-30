import { describe, expect, it } from "vitest";
import { CONTENT_PACK_VERSION } from "../../content/castalia";
import { castaliaStudyById } from "../../content/castalia/studies";
import type { ConceptPair } from "../../domain/events";
import { evaluateStudy, renderStudyBrief, type StudyDefinition } from "../../domain/studies";
import { buildStudySession } from "../../domain/studies/testing/buildStudySession";
import { castaliaStudyLookup } from "./lookup";
import { studyNames } from "./names";
import { MAGISTER_SILENCE, plateNumber, studyPlate } from "./plate";

const studyNamed = (id: string): StudyDefinition => {
  const study = castaliaStudyById(id);
  if (study === undefined) throw new RangeError(`no Study ${id}`);
  return study;
};

function plateFor(
  id: string,
  pairs: readonly ConceptPair[],
  declaredSilence = false,
  hasNext = true
) {
  const study = studyNamed(id);
  const session = buildStudySession({
    studyId: String(study.id),
    conceptIds: study.conceptIds,
    contentPackVersion: String(CONTENT_PACK_VERSION),
    threads: pairs.map(([a, b]) => ({ a, b })),
  });
  return studyPlate({
    study,
    status: evaluateStudy(session.state, study, castaliaStudyLookup, declaredSilence),
    brief: renderStudyBrief(study.goal, studyNames),
    names: studyNames,
    lookup: castaliaStudyLookup,
    hasNext,
  });
}

const magisterPairs = (id: string): readonly ConceptPair[] => {
  const study = studyNamed(id);
  return study.answer.kind === "threads" ? study.answer.pairs : [];
};

describe("the plate's numbers", () => {
  it("are spelled, never written as numerals", () => {
    expect(plateNumber(1)).toBe("one");
    expect(plateNumber(3)).toBe("three");
    expect(plateNumber(12)).toBe("twelve");
    expect(plateNumber(13)).toBe("thirteen");
    expect(plateNumber(20)).toBe("twenty");
    expect(plateNumber(28)).toBe("twenty-eight");
    expect(plateNumber(99)).toBe("ninety-nine");
    expect(plateNumber(100)).toBe("more than ninety-nine");
    for (let value = 0; value < 150; value += 1) expect(plateNumber(value)).not.toMatch(/\d/);
  });
});

describe("the solved plate", () => {
  it("is not shown before the Study is solved", () => {
    expect(plateFor("study.eschholz-1", [])).toBeNull();
    // A declared silence on a Study that can be solved is a "not yet", never a plate.
    expect(plateFor("study.eschholz-1", [], true)).toBeNull();
  });

  it("sets the player's line beside the Magister's, with the counts and the marks as words", () => {
    expect(plateFor("study.vicus-lusorum-1", magisterPairs("study.vicus-lusorum-1"), false, true)).toEqual({
      studyId: "study.vicus-lusorum-1",
      brief: "From Coupled Pendulums to The Möbius Band in three threads",
      by: "threads",
      playerLine:
        "Coupled Pendulums to Diffraction carries Interference; Diffraction to Cantor's Diagonal Argument carries Threshold; Cantor's Diagonal Argument to The Möbius Band carries Self-Reference",
      magisterLine:
        "Coupled Pendulums to Diffraction carries Interference; Diffraction to Cantor's Diagonal Argument carries Threshold; Cantor's Diagonal Argument to The Möbius Band carries Self-Reference",
      counts: "Solved in three; the brief asked for three.",
      marks: ["Economical", "Varied"],
      hasNext: true,
    });
  });

  it("names Wide when the answer spans all four faculties", () => {
    const plate = plateFor("study.vicus-lusorum-4", magisterPairs("study.vicus-lusorum-4"), false, false);
    expect(plate?.marks).toEqual(["Economical", "Wide"]);
    expect(plate?.hasNext).toBe(false);
  });

  it.each([
    { id: "study.eschholz-4", why: "No Matter bead here carries Proportion." },
    {
      id: "study.waldzell-3",
      why: "No bead here carries a facet of both Just Intonation and Polyrhythm; the shortest way needs three.",
    },
    { id: "study.vicus-lusorum-3", why: "No Image bead here carries No Common Measure." },
  ])("gives a silence its reason, and the Magister's silence beside it: $id", ({ id, why }) => {
    expect(plateFor(id, [], true)).toMatchObject({
      by: "silence",
      playerLine: why,
      magisterLine: MAGISTER_SILENCE,
      counts: null,
      marks: [],
    });
  });
});
