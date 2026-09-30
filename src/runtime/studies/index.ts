import { renderStudyBrief } from "../../domain/studies";
import { STUDY_CHAPTERS } from "../../domain/studies";
import {
  STUDY_CHAPTER_NAMES,
  castaliaStudies,
  castaliaStudyById,
} from "../../content/castalia/studies";
import { studyNames } from "./names";
import type { StudiesRuntime, StudyChapterListing } from "./types";

export type {
  StudiesRuntime,
  StudyChapterListing,
  StudyListing,
  StudyPlateModel,
} from "./types";

/**
 * STAGE-2 CONTRACT. `chapters` and `briefOf` are real; the session verbs are
 * stubs the runtime workstream replaces behind this exact interface.
 */
const notYetBuilt = (verb: string): never => {
  throw new Error(`studies.${verb}: not implemented yet (M9-001 stage 2)`);
};

const briefOf = (studyId: string): string => {
  const study = castaliaStudyById(studyId);
  if (!study) throw new Error(`unknown Study ${studyId}`);
  return renderStudyBrief(study.goal, studyNames);
};

export const studies: StudiesRuntime = Object.freeze({
  chapters: (): readonly StudyChapterListing[] =>
    Object.freeze(
      STUDY_CHAPTERS.map((chapter) =>
        Object.freeze({
          chapter,
          name: STUDY_CHAPTER_NAMES[chapter],
          studies: Object.freeze(
            castaliaStudies()
              .filter((study) => study.chapter === chapter)
              .map((study) =>
                Object.freeze({
                  id: String(study.id),
                  ordinal: study.ordinal,
                  brief: renderStudyBrief(study.goal, studyNames),
                })
              )
          ),
        })
      )
    ),
  briefOf,
  start: () => notYetBuilt("start"),
  restart: () => notYetBuilt("restart"),
  next: () => notYetBuilt("next"),
  leave: () => notYetBuilt("leave"),
  declareSilence: () => notYetBuilt("declareSilence"),
  plate: () => null,
});
