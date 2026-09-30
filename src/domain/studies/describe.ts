import { countWord, formatList } from "../outcomes/prose";
import {
  FACULTY_COUNT,
  type StudyGoal,
  type StudyLineStep,
  type StudyMark,
  type StudyNames,
  type StudySilenceExplanation,
  type StudyStatus,
} from "./types";

/**
 * THE WORDS OF A STUDY.
 *
 * Every sentence a Study says is rendered here from structure — a goal, a
 * status, a line of steps — and the names the caller supplies. Nothing is
 * written per Study, so a thirteenth Study costs one definition (STUDIES-SPEC
 * §9), and nothing here can mention an outcome, because no outcome reaches it.
 *
 * Numbers are words, in the Game's register: "in two threads", "the shortest
 * way needs three". No sentence praises, counts Studies, or says "wrong".
 */

/** The marks as the plate shows them: words, never points. */
export const STUDY_MARK_WORDS: Readonly<Record<StudyMark, string>> = Object.freeze({
  economical: "Economical",
  wide: "Wide",
  varied: "Varied",
});

function threadsPhrase(count: number): string {
  return `${countWord(count)} ${count === 1 ? "thread" : "threads"}`;
}

function facultiesPhrase(count: number): string {
  if (count === FACULTY_COUNT) return `all ${countWord(count)} faculties`;
  return `${countWord(count)} ${count === 1 ? "faculty" : "faculties"}`;
}

/**
 * The brief, rendered from the goal and never authored per Study.
 *
 * "From The Möbius Band to Counterpoint in two threads"; "Carry Superposition
 * through three faculties"; "Carry Threshold into Matter". A silence Study's
 * brief is worded exactly as a solvable one's, because it is rendered by the
 * same function from the same kind of goal (STUDIES-SPEC §5).
 */
export function renderStudyBrief(goal: StudyGoal, names: StudyNames): string {
  switch (goal.kind) {
    case "passage":
      return `From ${names.conceptName(goal.from)} to ${names.conceptName(
        goal.to
      )} in ${threadsPhrase(goal.threads)}`;
    case "canon":
      return `Carry ${names.facetName(goal.facet)} through ${facultiesPhrase(
        goal.faculties
      )}`;
    case "carry":
      return `Carry ${names.facetName(goal.facet)} into ${names.facultyName(goal.into)}`;
    default: {
      const exhaustive: never = goal;
      return exhaustive;
    }
  }
}

/**
 * A line of threads and what each carried: "The Möbius Band to Continuous
 * Symmetry carries Continuity; Continuous Symmetry to Counterpoint carries
 * Invariance". Used for the player's answer and for the Magister's alike.
 */
export function describeStudyLine(
  steps: readonly StudyLineStep[],
  names: Pick<StudyNames, "conceptName" | "facetName">
): string {
  return steps
    .map((entry) => {
      const carried =
        entry.facets.length === 0
          ? "carries no facet"
          : `carries ${formatList(entry.facets.map((facet) => names.facetName(facet)))}`;
      return `${names.conceptName(entry.from)} to ${names.conceptName(entry.to)} ${carried}`;
    })
    .join("; ");
}

function describeSilence(
  explanation: StudySilenceExplanation,
  names: StudyNames
): string {
  switch (explanation.kind) {
    case "carry-silence": {
      const facet = names.facetName(explanation.facet);
      if (explanation.lone === null) {
        return `No ${names.facultyName(explanation.into)} bead here carries ${facet}.`;
      }
      return `Only ${names.conceptName(
        explanation.lone
      )} carries ${facet} here, and a thread needs two beads that carry it.`;
    }
    case "passage-silence": {
      const from = names.conceptName(explanation.from);
      const to = names.conceptName(explanation.to);
      if (explanation.shortest === null) {
        return `No way through these beads joins ${from} to ${to}.`;
      }
      const shortest = `the shortest way needs ${countWord(explanation.shortest)}`;
      if (explanation.threads === 1) {
        return `${from} and ${to} share no facet; ${shortest}.`;
      }
      if (explanation.threads === 2) {
        return `No bead here carries a facet of both ${from} and ${to}; ${shortest}.`;
      }
      return `No way of ${threadsPhrase(explanation.threads)} or fewer joins ${from} to ${to} here; ${shortest}.`;
    }
    case "canon-silence": {
      const facet = names.facetName(explanation.facet);
      if (explanation.reached.length === 0) return `No bead here carries ${facet}.`;
      return `Only ${formatList(
        explanation.reached.map((faculty) => names.facultyName(faculty))
      )} beads here carry ${facet}.`;
    }
    default: {
      const exhaustive: never = explanation;
      return exhaustive;
    }
  }
}

/**
 * The plain sentence for a status: the *not yet* statement, the reason a
 * silence holds, or the player's line and the count stated plainly — "solved
 * in five; the brief asked for three".
 *
 * *Not yet* never names a bead and never hints: it says either "Not yet." or,
 * after silence is declared on a Study that can be solved, "Not yet — it can
 * be done with these beads." and nothing more (STUDIES-SPEC §5).
 */
export function describeStudyStatus(status: StudyStatus, names: StudyNames): string {
  if (status.kind === "not-yet") {
    return status.statement.kind === "can-be-done"
      ? "Not yet — it can be done with these beads."
      : "Not yet.";
  }
  if (status.by === "silence") return describeSilence(status.explanation, names);
  const { steps, used, count } = status.explanation;
  return `${describeStudyLine(steps, names)}. Solved in ${countWord(
    used
  )}; the brief asked for ${countWord(count)}.`;
}
