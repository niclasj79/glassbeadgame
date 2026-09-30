import type { StudyChapter } from "../../domain/studies";

/**
 * THE STUDIES, AS THE PRESENTATION ASKS FOR THEM (M9-001).
 *
 * Every surface reads a Study through this one API: the list, the brief, the
 * silence control and the solved plate. Words are rendered here from the
 * domain's structured answers (`renderStudyBrief`, `describeStudyLine`,
 * `describeStudyStatus`, `magisterLine`), so no component composes a rule or
 * a sentence of its own.
 */
export interface StudyListing {
  readonly id: string;
  readonly ordinal: number;
  /** The brief, rendered from the goal: identical wording for a silence Study. */
  readonly brief: string;
}

export interface StudyChapterListing {
  readonly chapter: StudyChapter;
  readonly name: string;
  /** In ordinal order. */
  readonly studies: readonly StudyListing[];
}

/** What the solved plate shows (STUDIES-SPEC §6). Words only; nothing counts or sums them. */
export interface StudyPlateModel {
  readonly studyId: string;
  readonly brief: string;
  readonly by: "threads" | "silence";
  /** The player's answer: the line with what each thread carried, or the silence stated structurally. */
  readonly playerLine: string;
  /** The Magister's answer, rendered the same way. */
  readonly magisterLine: string;
  /** "Solved in five; the brief asked for three." Null for a silence. */
  readonly counts: string | null;
  /** At most three words: economical, wide, varied. */
  readonly marks: readonly string[];
  /** Whether a Study follows this one in the list. */
  readonly hasNext: boolean;
}

export interface StudiesRuntime {
  /** The three chapters in order, each with its Studies in order. No results, no counts. */
  readonly chapters: () => readonly StudyChapterListing[];
  readonly briefOf: (studyId: string) => string;
  /** A Study session, built without the draw, opened straight into the arena. */
  readonly start: (studyId: string) => void;
  /** Leave the session and begin the same Study again: a new session, the same seed. */
  readonly restart: () => void;
  /** Begin the Study after this one, or return to the list after the last. */
  readonly next: () => void;
  /** Leave for the Studies list. The session is discarded; nothing is kept (§10). */
  readonly leave: () => void;
  /** "It cannot be done." Evaluated at once; solved or a "not yet" (§5). Ephemeral. */
  readonly declareSilence: () => void;
  /** The plate for the current solved status, or null when not solved. */
  readonly plate: () => StudyPlateModel | null;
}
