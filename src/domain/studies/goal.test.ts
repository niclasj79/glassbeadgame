import { describe, expect, it } from "vitest";
import { toConceptId } from "../ids";
import { studyCount, studyIdFor, toStudyId } from "./goal";
import type { FacetId } from "./types";

describe("studyIdFor", () => {
  it("spells a Study's id from its chapter and ordinal", () => {
    expect(studyIdFor("eschholz", 1)).toBe("study.eschholz-1");
    expect(studyIdFor("vicus-lusorum", 3)).toBe("study.vicus-lusorum-3");
  });
});

describe("toStudyId", () => {
  it("refuses an empty id", () => {
    expect(() => toStudyId(" ")).toThrow(TypeError);
    expect(toStudyId("study.waldzell-2")).toBe("study.waldzell-2");
  });
});

describe("studyCount", () => {
  const wave = "wave" as FacetId;

  it("is the passage's own count", () => {
    expect(
      studyCount({
        kind: "passage",
        from: toConceptId("a"),
        to: toConceptId("b"),
        threads: 3,
      })
    ).toBe(3);
  });

  it("is one fewer than a canon's faculties, and never less than one thread", () => {
    expect(studyCount({ kind: "canon", facet: wave, faculties: 3 })).toBe(2);
    expect(studyCount({ kind: "canon", facet: wave, faculties: 4 })).toBe(3);
    expect(studyCount({ kind: "canon", facet: wave, faculties: 1 })).toBe(1);
  });

  it("is one thread for a carry", () => {
    expect(studyCount({ kind: "carry", facet: wave, into: "matter" })).toBe(1);
  });
});
