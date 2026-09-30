import { describeStudyStatus, type StudyNames } from "@/domain/studies";
import { productionInterpretation } from "@/runtime/interpretation";
import { studies, type StudyChapterListing } from "@/runtime/studies";
import type { StudyNotYetAnswer, StudyNotYetKind } from "@/state/studies";

/**
 * THE ARENA IN STUDY MODE (STUDIES-SPEC §§5–7) — what it says, decided once.
 *
 * A Study adds three things to the arena and nothing else: the brief, pinned
 * as the first note of the column; *It cannot be done*, beneath the brief and
 * in the accessible mirror; and *not yet*, a line in the margin that never
 * interrupts. Everything a Study says is read through the one runtime API
 * (`@/runtime/studies`) or rendered by the domain; nothing on this page
 * composes a Study sentence of its own, counts a Study, or knows whether one
 * can be done.
 *
 * The arena is its own chunk (`App.tsx` loads it lazily), so this module may
 * reach the Studies statically; nothing in the first load may.
 */

/** The brief as the column writes it: which Study, in whose chapter, and what it asks. */
export interface StudyNoteModel {
  readonly studyId: string;
  /** The chapter's name, as the Studies list shows it. Never a place in an order. */
  readonly chapter: string | null;
  /** Rendered from the goal by the runtime: the same words for every kind of Study. */
  readonly brief: string;
  /** Whether the brief is open. It is pinned for the whole Study and re-openable. */
  readonly open: boolean;
  /** The last *not yet*, as a margin line; a new serial is a new answer. */
  readonly notYet: Readonly<{ serial: number; line: string }> | null;
}

/**
 * The *not yet* statement names nothing — it never names a bead and never
 * hints (§5) — so the domain's renderer is given no names to use.
 */
const unnamed = (id: string): string => id;
const NAMELESS: StudyNames = Object.freeze({
  conceptName: unnamed,
  facetName: unnamed,
  facultyName: unnamed,
});

/**
 * The words of a *not yet*, from the one function that says them
 * (`describeStudyStatus`): "Not yet — it can be done with these beads."
 */
export function notYetLine(kind: StudyNotYetKind): string {
  return describeStudyStatus(
    { kind: "not-yet", statement: { kind } },
    NAMELESS
  );
}

/** The name of the chapter a Study stands in, or null for an id no chapter holds. */
export function chapterNameOf(
  chapters: readonly StudyChapterListing[],
  studyId: string
): string | null {
  for (const chapter of chapters) {
    if (chapter.studies.some((study) => study.id === studyId)) return chapter.name;
  }
  return null;
}

/** The brief's note for the Study being played, read from the runtime. */
export function studyNote(
  studyId: string,
  notYet: StudyNotYetAnswer | null,
  open: boolean
): StudyNoteModel {
  return Object.freeze({
    studyId,
    chapter: chapterNameOf(studies.chapters(), studyId),
    brief: studies.briefOf(studyId),
    open,
    notYet:
      notYet === null
        ? null
        : Object.freeze({ serial: notYet.serial, line: notYetLine(notYet.kind) }),
  });
}

/**
 * *It cannot be done* — the answer every Study accepts (§5), from the margin
 * and from the mirror alike. A held weave is never interrupted by another
 * activation, exactly as reopening a thread waits for one
 * (`columnPlan.reopenWovenThread`).
 */
export function declareSilence(): void {
  if (productionInterpretation.isHolding()) return;
  studies.declareSilence();
}

/** Leave the Study for the Studies. The session is discarded; nothing is kept (§10). */
export function leaveStudy(): void {
  studies.leave();
}

/**
 * A NEW STUDY SESSION IS A NEW PAGE.
 *
 * *Again* and *Next Study* start a new session without leaving the arena, and
 * *Again* starts it with the same seed, so neither the phase nor the session
 * id changes. What does change is the presentation projection: every session
 * start writes a new one (`applySessionStart`), and nothing else replaces it
 * while a Study is played. So the column is keyed on that object, and a
 * restarted Study opens on a clean margin — no reading of the attempt before
 * can be reopened into the attempt after it. The number is a React key and
 * nothing else: it is never shown and never counted.
 */
const pages = new WeakMap<object, number>();
let lastPage = 0;

export function sessionPage(session: object | null): number {
  if (session === null) return 0;
  const known = pages.get(session);
  if (known !== undefined) return known;
  lastPage += 1;
  pages.set(session, lastPage);
  return lastPage;
}
