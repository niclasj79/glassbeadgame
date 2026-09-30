import {
  STUDY_CHAPTER_NAMES,
  castaliaStudies,
  castaliaStudyById,
} from "../../content/castalia/studies";
import {
  STUDY_CHAPTERS,
  describeStudyStatus,
  renderStudyBrief,
  type StudyDefinition,
  type StudyStatus,
} from "../../domain/studies";
import { hashString } from "../../lib/utils";
import { domainSessionStore } from "../../state/domainSession";
import { studyStore } from "../../state/studies";
import { useStore } from "../../state/store";
import { cueBus } from "../cues";
import {
  followCommits,
  productionInterpretation,
} from "../interpretation/productionInterpretation";
import { gameNow } from "../testMode";
import { createStudyProgression } from "./createStudyProgression";
import { createStudySessionStart, studySeedOf } from "./createStudySessionStart";
import { castaliaStudyLookup } from "./lookup";
import { studyNames } from "./names";
import { studyPlate } from "./plate";
import type { StudiesRuntime, StudyChapterListing, StudyPlateModel } from "./types";

export type {
  StudiesRuntime,
  StudyChapterListing,
  StudyListing,
  StudyPlateModel,
} from "./types";

/**
 * THE STUDIES, AT RUNTIME (M9-001).
 *
 * The composition root for the second way to play. Everything here loads with
 * the Studies: the title reaches it only through a dynamic import, so nothing
 * of a Study is in what a stranger downloads before the title appears
 * (`scripts/bundle-budgets.json`), and a Free Game never pays for one.
 *
 * A Study session is an ordinary session built without the draw, played with
 * the Free Game's own loop, progression and cues. The Study adds a follower to
 * that progression, which evaluates after every commit, and a store that says
 * which Study is being played. Nothing is written to the log and nothing is
 * kept: leaving discards the session (STUDIES-SPEC §10).
 */

const startStudySession = createStudySessionStart({
  domainStore: domainSessionStore,
  now: gameNow,
});

const progression = createStudyProgression({
  domainStore: domainSessionStore,
  studyStore,
  cueBus,
  lookup: castaliaStudyLookup,
  names: studyNames,
  followCommits,
});

function requireStudy(studyId: string): StudyDefinition {
  const study = castaliaStudyById(studyId);
  if (!study) throw new Error(`unknown Study ${studyId}`);
  return study;
}

const briefOf = (studyId: string): string =>
  renderStudyBrief(requireStudy(studyId).goal, studyNames);

const hasNext = (studyId: string): boolean => {
  const list = castaliaStudies();
  const index = list.findIndex((study) => String(study.id) === studyId);
  return index >= 0 && index < list.length - 1;
};

// ─── Leaving by any door (R4) ───────────────────────────────────────────────

/**
 * NOTHING OF A STUDY REACHES A FREE GAME.
 *
 * The plate's ways out are not the only ones: the title can be reached from
 * anywhere, and a Free Game can be begun without passing the Studies at all.
 * So while a Study is played, two watches end it the moment play leaves it —
 * the title or the threshold opening, or the canonical session becoming one
 * that is not this Study's — and the Study store is emptied, so no brief, mark
 * or silence control can survive into the next Game.
 */
let unwatch: (() => void) | null = null;

const stopFollowing = (): void => {
  unwatch?.();
  unwatch = null;
  progression.detach();
};

const endStudy = (): void => {
  stopFollowing();
  studyStore.getState().reset();
};

const watch = (study: StudyDefinition): void => {
  const seed = studySeedOf(String(study.id));
  const stops = [
    useStore.subscribe(
      (state) => state.phase,
      (phase) => {
        if (phase === "title" || phase === "threshold") endStudy();
      }
    ),
    domainSessionStore.subscribe((state) => {
      if (state.session?.seed !== seed) endStudy();
    }),
  ];
  unwatch = () => {
    for (const stop of stops) stop();
  };
};

// ─── The verbs ──────────────────────────────────────────────────────────────

const start = (studyId: string): void => {
  const study = requireStudy(studyId);
  stopFollowing();

  // Presentation state starts clean, as for a Free Game: no cue from the last
  // session may resolve into this one, and no draft or look survives it.
  cueBus.reset();
  productionInterpretation.reset();

  const result = startStudySession(study);
  const seedText = studySeedOf(String(study.id));

  // The legacy projection the scene still reads, published exactly as a Free
  // Game publishes it. The Study opens straight into the arena: no threshold.
  useStore.getState().applySessionStart({
    seed: hashString(seedText),
    disciplines: Object.freeze([]),
    beadIds: Object.freeze(result.session.conceptIds.map(String)),
    threads: Object.freeze([]),
    discoveries: Object.freeze([]),
    motifs: Object.freeze([]),
    score: 0,
    startedAt: gameNow(),
    interaction: Object.freeze({
      mode: "idle",
      fromId: null,
      sticky: false,
      reveal: null,
    }),
    curatedAvailable: 0,
    insight: 0,
    illuminationsUsed: 0,
    themeId: "castalia",
  });

  studyStore.getState().begin(String(study.id));
  progression.attach(study);
  watch(study);
};

const leave = (): void => {
  endStudy();
  productionInterpretation.reset();
  cueBus.reset();
  // A Study session never concludes and is never kept: leaving discards it (§10).
  domainSessionStore.getState().clearSession();
  useStore.getState().openStudies();
};

const restart = (): void => {
  const current = studyStore.getState().studyId;
  if (current !== null) start(current);
};

const next = (): void => {
  const list = castaliaStudies();
  const index = list.findIndex(
    (study) => String(study.id) === studyStore.getState().studyId
  );
  const following = index < 0 ? undefined : list[index + 1];
  if (following === undefined) leave();
  else start(String(following.id));
};

// ─── What the screens read ──────────────────────────────────────────────────

let listing: readonly StudyChapterListing[] | null = null;

/** Built once: the Studies are frozen, so every call can return the same list. */
const chapters = (): readonly StudyChapterListing[] => {
  listing ??= Object.freeze(
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
  );
  return listing;
};

let plateCache: {
  readonly studyId: string;
  readonly status: StudyStatus;
  readonly plate: StudyPlateModel | null;
} | null = null;

/**
 * The plate for the evaluator's latest word. The same object until that word
 * changes, so a screen may read it from a store selector.
 */
const plate = (): StudyPlateModel | null => {
  const { studyId, status } = studyStore.getState();
  if (studyId === null || status === null || status.kind !== "solved") return null;
  if (plateCache !== null && plateCache.studyId === studyId && plateCache.status === status) {
    return plateCache.plate;
  }
  const study = requireStudy(studyId);
  const model = studyPlate({
    study,
    status,
    brief: briefOf(studyId),
    names: studyNames,
    lookup: castaliaStudyLookup,
    hasNext: hasNext(studyId),
  });
  plateCache = { studyId, status, plate: model };
  return model;
};

/**
 * A *not yet* names nothing and hints nothing (§5): the renderer is handed the
 * pack's names only because its signature asks for them.
 */
const notYetLine = (kind: "no-answer-yet" | "can-be-done"): string =>
  describeStudyStatus({ kind: "not-yet", statement: { kind } }, studyNames);

export const studies: StudiesRuntime = Object.freeze({
  chapters,
  briefOf,
  start,
  restart,
  next,
  leave,
  declareSilence: () => progression.declareSilence(),
  plate,
  notYetLine,
});
