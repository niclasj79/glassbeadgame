import type { StudyChapter, StudyGoal, StudyId } from "./types";

/** Brands a non-empty string as a Study id. The format is the validator's to check. */
export function toStudyId(value: string): StudyId {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("StudyId must be a non-empty string");
  }
  return value as StudyId;
}

/**
 * The one spelling of a Study's id: `study.<chapter>-<ordinal>`. Authoring and
 * validation both use it, so an id can never drift from its place.
 */
export function studyIdFor(chapter: StudyChapter, ordinal: number): StudyId {
  return toStudyId(`study.${chapter}-${ordinal}`);
}

/**
 * The number of threads the brief names — the count the Economical mark and
 * the plate's "the brief asked for" read.
 *
 * A passage names it outright. A canon through K faculties needs K − 1 threads,
 * since K beads in K faculties are joined by no fewer, and never less than one:
 * a canon is carried by threads. A carry is one thread.
 */
export function studyCount(goal: StudyGoal): number {
  switch (goal.kind) {
    case "passage":
      return goal.threads;
    case "canon":
      return Math.max(1, goal.faculties - 1);
    case "carry":
      return 1;
    default: {
      const exhaustive: never = goal;
      return exhaustive;
    }
  }
}
