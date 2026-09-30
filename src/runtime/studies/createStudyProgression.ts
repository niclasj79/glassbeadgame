import type { ConceptId, EventId, ThreadId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import type { ConceptStructureLookup } from "../../domain/outcomes/lookup";
import {
  evaluateStudy,
  renderStudyBrief,
  type StudyDefinition,
  type StudyLineStep,
  type StudyNames,
  type StudyStatus,
} from "../../domain/studies";
import type { DomainSessionStore } from "../../state/domainSession";
import type { StudyStore } from "../../state/studies";
import type { CueBus } from "../cues/createCueBus";
import {
  MOTIF_MOMENT_SECONDS,
  planStudyNotYet,
  planStudySolved,
} from "../cues/planCues";
import type { CuePayloadMap, CuePlan, PresentationCue } from "../cues/types";
import { studySeedOf } from "./createStudySessionStart";

/**
 * STUDY PROGRESSION — the Free Game's progression, followed (STUDIES-SPEC §4–§8).
 *
 * It wraps the existing progression and never replaces it. Every commit is
 * resolved exactly as in the Free Game — outcome, card, motif — and only then
 * does a Study look at the web: the evaluator runs over the session, and its
 * word is published to the Study store. Nothing is written to the log, because
 * a Study's status is a pure function of the log and the Study (§8).
 *
 * ── When "solved" is staged ─────────────────────────────────────────────────
 * On the commit that first meets the brief, `study.solved` is staged after
 * everything that commit staged, the way a motif is staged after its outcome:
 *
 *  - the commit moment's span is the duration of the plan whose `thread.woven`
 *    cue the bus delivers, synchronously, while the progression runs — the
 *    same number `publishNewMotifs(settledAfter)` receives, read from the same
 *    plan, without changing the progression;
 *  - a motif completed by the same commit is staged at that span and holds the
 *    stage for `MOTIF_MOMENT_SECONDS`, and the log says whether one was: its
 *    `motif.completed` follows this thread's commit. The solved moment waits
 *    it out, so the canon a Canon Study asks for is heard as a motif and then
 *    as a solution, not as two ensembles over each other.
 *
 * The plate opens when the moment's `ui` cue is delivered, and not before.
 * A declared silence is evaluated at once: solved, it stages the moment now;
 * otherwise it is a "not yet" — a caption and a margin line, never a plate.
 */
export interface StudyProgressionDependencies {
  readonly domainStore: DomainSessionStore;
  readonly studyStore: StudyStore;
  readonly cueBus: CueBus;
  /** Concept names, faculties and facets only (R1). */
  readonly lookup: ConceptStructureLookup;
  readonly names: StudyNames;
  /**
   * Runs a follower after the Free Game's progression has finished with each
   * commit, in the same turn. Returns the way to stop following.
   */
  readonly followCommits: (follower: (threadId: ThreadId) => void) => () => void;
}

export interface StudyProgression {
  /** Follow this Study's session: evaluate it now, then after every commit. */
  readonly attach: (study: StudyDefinition) => void;
  /**
   * Stop following: no commit is evaluated and no plate opens afterwards.
   * What is already in the bus is the caller's to clear, as starting and
   * leaving a Study do.
   */
  readonly detach: () => void;
  /** "It cannot be done." Evaluated at once; never logged. */
  readonly declareSilence: () => void;
}

interface SettledMoment {
  readonly threadId: string;
  readonly seconds: number;
}

/** The answer's beads in the order its line reads them, each once. */
function beadsOf(steps: readonly StudyLineStep[]): readonly ConceptId[] {
  const beads: ConceptId[] = [];
  for (const step of steps) {
    if (!beads.includes(step.from)) beads.push(step.from);
    if (!beads.includes(step.to)) beads.push(step.to);
  }
  return Object.freeze(beads);
}

function solvedPayload(
  studyId: string,
  brief: string,
  status: Extract<StudyStatus, { kind: "solved" }>
): CuePayloadMap["study.solved"] {
  return Object.freeze({
    studyId,
    by: status.by,
    threadIds: Object.freeze([...status.threadIds]),
    conceptIds: status.by === "threads" ? beadsOf(status.explanation.steps) : Object.freeze([]),
    marks: Object.freeze([...status.marks]),
    brief,
  });
}

export function createStudyProgression(
  dependencies: StudyProgressionDependencies
): StudyProgression {
  const { domainStore, studyStore, cueBus, lookup, names } = dependencies;

  let study: StudyDefinition | null = null;
  let brief = "";
  let detachers: (() => void)[] = [];
  /** The last commit moment the bus delivered, and how long it takes to settle. */
  let lastMoment: SettledMoment | null = null;
  /** A solved moment staged and not yet delivered. */
  let solvedPending = false;
  /**
   * A silence that solved this session's Study. Never logged (§8), but it is
   * the player's answer for as long as the session lasts, so every later
   * evaluation hears it: weaving on after it cannot unsay it.
   */
  let silenceDeclared = false;

  /** The canonical session, only while it is this Study's own (R4). */
  const studySession = (): SessionStateV1 | null => {
    const session = domainStore.getState().session;
    if (study === null || session === null) return null;
    return session.seed === studySeedOf(String(study.id)) ? session : null;
  };

  const publish = (status: StudyStatus): void => {
    studyStore.getState().publishStatus(status);
  };

  const stageSolved = (
    status: Extract<StudyStatus, { kind: "solved" }>,
    sourceEventId: EventId | null,
    afterSeconds: number
  ): void => {
    if (study === null) return;
    solvedPending = true;
    // Published after the flag: a moment staged at once is delivered inside
    // this call, and its delivery is what clears the flag and opens the plate.
    cueBus.publish(
      planStudySolved(solvedPayload(String(study.id), brief, status), sourceEventId, afterSeconds)
    );
  };

  /** How long the commit that wove this thread holds the stage. */
  const settledAfter = (session: SessionStateV1, threadId: ThreadId): number => {
    const moment =
      lastMoment !== null && lastMoment.threadId === String(threadId) ? lastMoment.seconds : 0;
    const thread = session.threads.find((entry) => entry.id === threadId);
    const motifFollows =
      thread !== undefined &&
      session.completedMotifs.some((motif) => motif.sequence > thread.sequence);
    return moment + (motifFollows ? MOTIF_MOMENT_SECONDS : 0);
  };

  const afterCommit = (threadId: ThreadId): void => {
    const current = study;
    const session = studySession();
    if (current === null || session === null) return;
    const before = studyStore.getState().status;
    const status = evaluateStudy(session, current, lookup, silenceDeclared);
    publish(status);
    if (status.kind !== "solved" || before?.kind === "solved") return;
    const thread = session.threads.find((entry) => entry.id === threadId);
    stageSolved(status, thread?.eventId ?? null, settledAfter(session, threadId));
  };

  /**
   * The `ui` channel: where the commit moment says how long it takes, and
   * where the solved moment reaches the page.
   */
  const onUi = (cue: PresentationCue, plan: CuePlan): void => {
    if (cue.type === "thread.woven") {
      lastMoment = { threadId: String(cue.payload.threadId), seconds: plan.duration };
      return;
    }
    if (cue.type !== "study.solved" || study === null) return;
    if (cue.payload.studyId !== String(study.id)) return;
    solvedPending = false;
    studyStore.getState().openPlate();
  };

  const detach = (): void => {
    for (const stop of detachers) stop();
    detachers = [];
    study = null;
    brief = "";
    lastMoment = null;
    solvedPending = false;
    silenceDeclared = false;
  };

  const attach = (next: StudyDefinition): void => {
    detach();
    study = next;
    brief = renderStudyBrief(next.goal, names);
    detachers = [
      dependencies.followCommits(afterCommit),
      cueBus.subscribe("ui", onUi),
    ];
    // The Study's first word, before anything is woven: not yet.
    const session = studySession();
    if (session !== null) publish(evaluateStudy(session, next, lookup, false));
  };

  const declareSilence = (): void => {
    const current = study;
    const session = studySession();
    if (current === null || session === null) return;
    const before = studyStore.getState().status;
    const status = evaluateStudy(session, current, lookup, true);

    if (status.kind === "solved") {
      if (status.by === "silence") silenceDeclared = true;
      publish(status);
      if (before?.kind !== "solved") {
        stageSolved(status, null, 0);
      } else if (!solvedPending) {
        // Already solved, and its moment has passed: the answer stands, and the
        // plate is where it is read.
        studyStore.getState().openPlate();
      }
      return;
    }

    // An answer exists within these beads. Say so, and nothing more (§5).
    studyStore.getState().answerNotYet("can-be-done");
    cueBus.publish(
      planStudyNotYet({ studyId: String(current.id), statement: "can-be-done" })
    );
  };

  return Object.freeze({ attach, detach, declareSilence });
}
