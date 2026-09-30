import type { StudyPlateModel } from "@/runtime/studies";

/**
 * Study surfaces under test: plate models written the way the runtime renders
 * them (the lines in `describeStudyLine`'s words, the counts said plainly, the
 * silence stated in the structure of the beads), and the one rule every Study
 * surface is scanned against.
 */

/** Solved by threads, with two marks, and a Study after it. */
export const PLATE_THREADS: StudyPlateModel = Object.freeze({
  studyId: "study.eschholz-1",
  brief: "From The Möbius Band to Counterpoint in two threads",
  by: "threads",
  playerLine:
    "The Möbius Band to Continuous Symmetry carries Continuity; Continuous Symmetry to Counterpoint carries Invariance",
  magisterLine:
    "The Möbius Band to Continuous Symmetry carries Continuity; Continuous Symmetry to Counterpoint carries Invariance",
  counts: "Solved in five; the brief asked for two.",
  marks: Object.freeze(["Wide", "Varied"]),
  hasNext: true,
});

/**
 * Solved by declaring silence: the reason stated in the beads' structure, the
 * Magister's answer being the declaration itself, and no counts or marks.
 */
export const PLATE_SILENCE: StudyPlateModel = Object.freeze({
  studyId: "study.eschholz-4",
  brief: "Carry Proportion into Matter",
  by: "silence",
  playerLine: "No Matter bead here carries Proportion.",
  magisterLine: "It cannot be done.",
  counts: null,
  marks: Object.freeze([]),
  hasNext: true,
});

/** The last Study: every mark, and no Study after it. */
export const PLATE_LAST: StudyPlateModel = Object.freeze({
  ...PLATE_THREADS,
  studyId: "study.vicus-lusorum-4",
  brief: "Carry Discreteness through all four faculties",
  counts: "Solved in three; the brief asked for three.",
  marks: Object.freeze(["Economical", "Wide", "Varied"]),
  hasNext: false,
});

/**
 * What no Study surface may say (M9-001 constraints; STUDIES-SPEC §7): a
 * count, a total or a percentage — so no figure at all — nor score, points,
 * rank or wrong, nor a place in the list or a progress word.
 */
export const STUDY_FORBIDDEN =
  /\d|%|\bscore|\bpoints?\b|\brank|\bwrong\b|\bof (?:12|twelve)\b|\bprogress|\bcomplete[ds]?\b|\bunlock/i;

export const decode = (text: string): string =>
  text
    .split("&quot;")
    .join('"')
    .split("&#x27;")
    .join("'")
    .split("&lt;")
    .join("<")
    .split("&gt;")
    .join(">")
    .split("&amp;")
    .join("&");

/** Everything a reader can be told: the text, and every accessible name and gloss. */
export const spoken = (html: string): string =>
  decode(
    [
      html.replace(/<[^>]*>/g, " "),
      ...[...html.matchAll(/(?:aria-label|title)="([^"]*)"/g)].map((match) => match[1]),
    ].join(" ")
  );
