import type { ConceptStructureLookup } from "../../domain/outcomes/lookup";
import {
  STUDY_MARK_WORDS,
  describeStudyLine,
  describeStudyStatus,
  magisterLine,
  type StudyDefinition,
  type StudyNames,
  type StudyStatus,
} from "../../domain/studies";
import type { StudyPlateModel } from "./types";

/**
 * THE SOLVED PLATE, IN WORDS (STUDIES-SPEC §6).
 *
 * Everything the plate says is rendered from structure: the evaluator's line
 * and the Magister's, described by the same function; the count the brief
 * named beside the number of threads the session wove, "stated plainly"; and
 * the marks as words. Nothing counts Studies, sums marks or ranks an answer,
 * and no numeral appears: every number is spelled.
 */

const UNITS = Object.freeze([
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
]);

const TENS = Object.freeze([
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
]);

/**
 * A count as the plate says it. A session over eight beads weaves a few dozen
 * threads at the most, but nothing stops a player repeating a pair, so words
 * run to ninety-nine and anything past them is said as what it is.
 */
export function plateNumber(value: number): string {
  const count = Math.max(0, Math.trunc(value));
  if (count < UNITS.length) return UNITS[count] as string;
  if (count < 100) {
    const tens = TENS[Math.floor(count / 10)] as string;
    const unit = count % 10;
    return unit === 0 ? tens : `${tens}-${UNITS[unit] as string}`;
  }
  return "more than ninety-nine";
}

/** The Magister's answer to a silence Study is the declaration itself. */
export const MAGISTER_SILENCE = "It cannot be done.";

export interface StudyPlateInput {
  readonly study: StudyDefinition;
  readonly status: StudyStatus;
  readonly brief: string;
  readonly names: StudyNames;
  /** Concept names, faculties and facets only (R1). */
  readonly lookup: ConceptStructureLookup;
  readonly hasNext: boolean;
}

/** The plate for a solved status, or null when the Study is not yet solved. */
export function studyPlate(input: StudyPlateInput): StudyPlateModel | null {
  const { study, status, names } = input;
  if (status.kind !== "solved") return null;

  const magister = magisterLine(study, input.lookup);
  const magisterWords =
    magister === null ? MAGISTER_SILENCE : describeStudyLine(magister, names);

  if (status.by === "silence") {
    return Object.freeze({
      studyId: String(study.id),
      brief: input.brief,
      by: "silence",
      // The silence stated structurally: why the brief cannot be met here.
      playerLine: describeStudyStatus(status, names),
      magisterLine: magisterWords,
      counts: null,
      marks: Object.freeze([]),
      hasNext: input.hasNext,
    });
  }

  const { used, count } = status.explanation;
  return Object.freeze({
    studyId: String(study.id),
    brief: input.brief,
    by: "threads",
    playerLine: describeStudyLine(status.explanation.steps, names),
    magisterLine: magisterWords,
    counts: `Solved in ${plateNumber(used)}; the brief asked for ${plateNumber(count)}.`,
    marks: Object.freeze(status.marks.map((mark) => STUDY_MARK_WORDS[mark])),
    hasNext: input.hasNext,
  });
}
