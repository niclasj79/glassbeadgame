import type { ConceptPair } from "../events";
import type { ConceptId, ThreadId } from "../ids";
import type { ConceptStructureLookup } from "../outcomes/lookup";

/**
 * STUDIES — THE DOMAIN'S OWN VOCABULARY (STUDIES-SPEC §3–§6).
 *
 * A Study is an authored problem over a fixed set of beads, solved with the
 * Free Game's own verbs. These types are owned here rather than by the content
 * pack because the rules that read them — the solver, the evaluator and the
 * renderers — must import nothing outside the domain; the pack schema
 * re-exports them, so a Study is still authored as pack data.
 *
 * Nothing in this vocabulary can name a documented relation, an evidence class
 * or an outcome (R1, R2): a Study is decided by concept identity, faculty and
 * facets alone.
 */

/**
 * A facet, as the structural lookup reports it.
 *
 * Derived from `ConceptStructureLookup` instead of imported from the pack, so
 * this module reads no content and still names exactly the pack's facet ids.
 */
export type FacetId = ReturnType<ConceptStructureLookup["conceptFacets"]>[number];

/** A faculty, derived the same way and for the same reason. */
export type FacultyId = ReturnType<ConceptStructureLookup["conceptFaculty"]>;

declare const studyIdBrand: unique symbol;

/** `study.<chapter>-<ordinal>`, e.g. `study.eschholz-1`. */
export type StudyId = string & { readonly [studyIdBrand]: "StudyId" };

/** The spike's three chapters, in the order they are shown. */
export const STUDY_CHAPTERS = Object.freeze([
  "eschholz",
  "waldzell",
  "vicus-lusorum",
] as const);
export type StudyChapter = (typeof STUDY_CHAPTERS)[number];

/**
 * How many faculties the Game has.
 *
 * The Wide mark and the brief's "all four faculties" read it. The domain cannot
 * import the pack's faculty list, so the number is stated once here and a
 * content test holds it equal to that list.
 */
export const FACULTY_COUNT = 4;

/** "From A to B in N threads": a path of carrying threads, at most N long. */
export interface StudyPassageGoal {
  readonly kind: "passage";
  readonly from: ConceptId;
  readonly to: ConceptId;
  readonly threads: number;
}

/**
 * "Carry F through K faculties": a connected group of threads that all carry F,
 * whose beads span at least K faculties.
 */
export interface StudyCanonGoal {
  readonly kind: "canon";
  readonly facet: FacetId;
  readonly faculties: number;
}

/** "Carry F into X": one thread carrying F with a bead in faculty X. */
export interface StudyCarryGoal {
  readonly kind: "carry";
  readonly facet: FacetId;
  readonly into: FacultyId;
}

export type StudyGoal = StudyPassageGoal | StudyCanonGoal | StudyCarryGoal;

/**
 * The Magister's answer: a line of threads, written bead to bead in the order
 * it is read, or silence — the declaration that the brief cannot be met here.
 */
export type StudyAnswer =
  | { readonly kind: "threads"; readonly pairs: readonly ConceptPair[] }
  | { readonly kind: "silence" };

export interface StudyDefinition {
  readonly id: StudyId;
  readonly chapter: StudyChapter;
  /** 1–4 within the chapter. */
  readonly ordinal: number;
  /** Exactly eight beads, in pack order. The session is started with these. */
  readonly conceptIds: readonly ConceptId[];
  readonly goal: StudyGoal;
  readonly answer: StudyAnswer;
}

/** Marks are words about form, never points (STUDIES-SPEC §6). Fixed order. */
export const STUDY_MARKS = Object.freeze(["economical", "wide", "varied"] as const);
export type StudyMark = (typeof STUDY_MARKS)[number];

/** One thread of a line, and the facets it carried (both beads hold them). */
export interface StudyLineStep {
  readonly from: ConceptId;
  readonly to: ConceptId;
  /** Sorted, never empty for a carrying thread. */
  readonly facets: readonly FacetId[];
}

/**
 * THE EXPLANATIONS ARE DATA, NOT PROSE.
 *
 * The evaluator is typed over `ConceptStructureLookup`, which knows concept
 * names but no facet or faculty names, and widening it would breach R1 by
 * type. So the evaluator states *what* is true as a closed union of ids and
 * counts, and `describeStudyStatus` renders the sentence from names supplied
 * by the caller. Every sentence the Game says about a Study is therefore a
 * pure function of this structure.
 */

/** Solved by threads: the player's answer, thread by thread, in line order. */
export interface StudyLineExplanation {
  readonly kind: "line";
  /** Aligned with the status's `threadIds`. */
  readonly steps: readonly StudyLineStep[];
  /** The number of threads the brief names. */
  readonly count: number;
  /** The number of threads the session wove, carrying or not. */
  readonly used: number;
}

/** No way from A to B within the count; `shortest` is the way there is. */
export interface StudyPassageSilence {
  readonly kind: "passage-silence";
  readonly from: ConceptId;
  readonly to: ConceptId;
  readonly threads: number;
  /** The fewest threads any carrying way between them needs here; null if none. */
  readonly shortest: number | null;
}

/** The facet is carried here in fewer faculties than the brief asks for. */
export interface StudyCanonSilence {
  readonly kind: "canon-silence";
  readonly facet: FacetId;
  readonly faculties: number;
  /** Faculties whose beads here carry the facet, in bead order. */
  readonly reached: readonly FacultyId[];
}

/** No thread here can carry the facet into the faculty. */
export interface StudyCarrySilence {
  readonly kind: "carry-silence";
  readonly facet: FacetId;
  readonly into: FacultyId;
  /**
   * Null when no bead of the faculty carries the facet. Otherwise the one bead
   * that does, which no other bead here shares it with.
   */
  readonly lone: ConceptId | null;
}

export type StudySilenceExplanation =
  | StudyPassageSilence
  | StudyCanonSilence
  | StudyCarrySilence;

export type StudyExplanation = StudyLineExplanation | StudySilenceExplanation;

/**
 * What *not yet* may say: that there is no answer yet, or — only after silence
 * is declared on a Study that can be solved — that it can be done with these
 * beads. Neither names a bead, and neither hints.
 */
export type StudyNotYetStatement =
  | { readonly kind: "no-answer-yet" }
  | { readonly kind: "can-be-done" };

export interface StudyNotYet {
  readonly kind: "not-yet";
  readonly statement: StudyNotYetStatement;
}

export interface StudySolvedByThreads {
  readonly kind: "solved";
  readonly by: "threads";
  /** The player's answer: the fewest of the session's threads that meet the brief. */
  readonly threadIds: readonly ThreadId[];
  readonly marks: readonly StudyMark[];
  readonly explanation: StudyLineExplanation;
}

export interface StudySolvedBySilence {
  readonly kind: "solved";
  readonly by: "silence";
  readonly threadIds: readonly [];
  readonly marks: readonly [];
  readonly explanation: StudySilenceExplanation;
}

/** Two states a player can see, and no third (STUDIES-SPEC §6). */
export type StudyStatus = StudyNotYet | StudySolvedByThreads | StudySolvedBySilence;

/**
 * Every minimal answer of a brief within a Study's beads, over facets and
 * faculties alone.
 */
export interface StudySolution {
  /** The number of threads the brief names. */
  readonly count: number;
  /**
   * The fewest threads an answer needs here, or null when there is none. For a
   * passage this is the shortest carrying way between the two beads even when
   * it is longer than the count, so a passage silence can show its longer way.
   */
  readonly shortest: number | null;
  /**
   * Every answer of the brief. A passage answer is its path, bead to bead; a
   * canon or carry answer lists its pairs by bead order.
   */
  readonly answers: readonly (readonly ConceptPair[])[];
}

/** Names the renderers need; supplied by the caller, never by the evaluator. */
export interface StudyNames {
  readonly conceptName: (id: ConceptId) => string;
  readonly facetName: (id: FacetId) => string;
  readonly facultyName: (id: FacultyId) => string;
}
