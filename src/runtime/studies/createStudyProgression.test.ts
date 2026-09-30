import { describe, expect, it } from "vitest";
import { castaliaConceptById, facetById } from "../../content/castalia";
import { toFacetId } from "../../content/castalia/schema";
import { castaliaStudyById } from "../../content/castalia/studies";
import { createSessionEvent, type RelationIntention } from "../../domain/events";
import { toConceptId, toThreadId, type ThreadId } from "../../domain/ids";
import { detectMotifs } from "../../domain/motifs";
import { resolveThreadOutcome } from "../../domain/outcomes";
import { compileConclusion } from "../../domain/performance";
import type { StudyDefinition } from "../../domain/studies";
import { createDomainSessionStore } from "../../state/domainSession";
import { createStudyStore } from "../../state/studies";
import { describeCue, type CaptionContext } from "../captions";
import { castaliaLookup } from "../content/castaliaLookup";
import { createCueBus, type CueBus } from "../cues/createCueBus";
import { MOTIF_MOMENT_SECONDS } from "../cues/planCues";
import type { CuePlan, PresentationCue } from "../cues/types";
import { isAttunementEligible } from "../progression/attunementEligibility";
import { createSessionProgression } from "../progression/createSessionProgression";
import { createStudyProgression } from "./createStudyProgression";
import { createStudySessionStart } from "./createStudySessionStart";
import { castaliaStudyLookup } from "./lookup";
import { studyNames } from "./names";

/**
 * THE STUDY PROGRESSION, COMPOSED AS PRODUCTION COMPOSES IT.
 *
 * The Free Game's own progression resolves every commit — outcome, motif,
 * invitation — against the real pack and a real cue bus whose clock the test
 * holds; then the Study follows, exactly as `productionInterpretation`'s
 * `onCommitted` runs it. So "after the commit moment settles" is asserted
 * against the commit moment the Free Game actually staged.
 */

const captionContext: CaptionContext = {
  conceptName: (id) => castaliaConceptById.get(id)?.name ?? "",
  facetName: (id) => facetById.get(toFacetId(id))?.name ?? "",
};

const studyNamed = (id: string): StudyDefinition => {
  const study = castaliaStudyById(id);
  if (study === undefined) throw new RangeError(`no Study ${id}`);
  return study;
};

const bead = (id: string) => toConceptId(id);

function harness(studyId: string) {
  const study = studyNamed(studyId);
  const domainStore = createDomainSessionStore();
  const studyStore = createStudyStore();
  let clock = 0;
  /** The game's clock, for every event either progression appends. */
  let gameTime = 0;
  const gameNow = () => (gameTime += 10);
  const inner = createCueBus({ now: () => clock });
  /** Every plan, as it is published — its timing is read before it is delivered. */
  const published: CuePlan[] = [];
  const bus: CueBus = Object.freeze({
    ...inner,
    publish: (plan: CuePlan) => {
      published.push(plan);
      inner.publish(plan);
    },
  });

  const freeGame = createSessionProgression({
    domainStore,
    cueBus: bus,
    lookup: castaliaLookup,
    now: gameNow,
    resolveOutcome: resolveThreadOutcome,
    detectMotifs: (session, lookup) =>
      detectMotifs(session, lookup).map((motif) => ({
        completionId: motif.key,
        motifKindId: motif.kind,
        conceptIds: motif.conceptIds.map(String),
        threadIds: motif.threadIds.map(String),
        reason: motif.reason,
      })),
    compileConclusion,
    attunementEligible: isAttunementEligible,
  });

  const followers = new Set<(threadId: ThreadId) => void>();
  const progression = createStudyProgression({
    domainStore,
    studyStore,
    cueBus: bus,
    lookup: castaliaStudyLookup,
    names: studyNames,
    followCommits: (follower) => {
      followers.add(follower);
      return () => {
        followers.delete(follower);
      };
    },
  });

  createStudySessionStart({ domainStore, now: () => 0 })(study);
  studyStore.getState().begin(String(study.id));
  progression.attach(study);

  const delivered: { cue: PresentationCue; plan: CuePlan }[] = [];
  bus.subscribe("ui", (cue, plan) => delivered.push({ cue, plan }));
  const captions: string[] = [];
  bus.subscribe("caption", (cue) => {
    const caption = describeCue(cue, captionContext);
    if (caption !== null) captions.push(caption.text);
  });

  /** One commit, followed exactly as `onCommitted` follows it. */
  const weave = (a: string, b: string, intention: RelationIntention = "echo"): ThreadId => {
    const session = domainStore.getState().session!;
    const threadId = toThreadId(`thread:study:${session.threads.length + 1}`);
    const pair = [bead(a), bead(b)] as const;
    const base = session.lastSequence;
    domainStore.getState().appendEvents([
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 1,
        at: gameNow(),
        type: "pair.selected",
        payload: { pair },
      }),
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 2,
        at: gameNow(),
        type: "relation.hypothesized",
        payload: { pair, intention },
      }),
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 3,
        at: gameNow(),
        type: "thread.committed",
        payload: {
          threadId,
          pair,
          intention,
          gesture: { inputModality: "keyboard" },
        },
      }),
    ]);
    freeGame.afterCommit(threadId);
    for (const follower of [...followers]) follower(threadId);
    return threadId;
  };

  const advanceTo = (seconds: number): void => {
    clock = seconds;
    inner.tick(seconds);
  };

  /** The plans one commit published, in order. */
  const plansSince = (count: number): readonly CuePlan[] => published.slice(count);

  const solvedPlans = (): readonly CuePlan[] =>
    published.filter((plan) => plan.cues.some((cue) => cue.type === "study.solved"));

  return {
    study,
    domainStore,
    studyStore,
    progression,
    published,
    delivered,
    captions,
    weave,
    advanceTo,
    plansSince,
    solvedPlans,
    followers,
  };
}

type Harness = ReturnType<typeof harness>;

/** Weave the last thread of an answer and read what that one commit staged. */
function solvingCommit(h: Harness, a: string, b: string) {
  const before = h.published.length;
  const threadId = h.weave(a, b);
  const plans = h.plansSince(before);
  const commit = plans.find((plan) =>
    plan.cues.some((cue) => cue.type === "thread.woven" && cue.payload.threadId === threadId)
  );
  const motif = plans.find((plan) => plan.cues.some((cue) => cue.type === "motif.completed"));
  const solved = plans.find((plan) => plan.cues.some((cue) => cue.type === "study.solved"));
  if (commit === undefined) throw new Error("the Free Game staged no commit moment");
  return { threadId, commit, motif, solved };
}

describe("the Study progression follows the Free Game's", () => {
  it("says not yet before anything is woven, and after every commit that does not meet the brief", () => {
    const h = harness("study.eschholz-1");
    expect(h.studyStore.getState().status).toEqual({
      kind: "not-yet",
      statement: { kind: "no-answer-yet" },
    });
    h.weave("measure.mobius-band", "measure.continuous-symmetry");
    expect(h.studyStore.getState().status?.kind).toBe("not-yet");
    expect(h.solvedPlans()).toHaveLength(0);
    expect(h.followers.size).toBe(1);
  });

  it("passage: solved when the line is woven, staged after the commit moment, the plate with it", () => {
    const h = harness("study.eschholz-1");
    h.weave("measure.mobius-band", "measure.continuous-symmetry");
    const { threadId, commit, motif, solved } = solvingCommit(
      h,
      "measure.continuous-symmetry",
      "sound.counterpoint"
    );

    const status = h.studyStore.getState().status;
    if (status?.kind !== "solved" || status.by !== "threads") throw new Error("not solved");
    expect(status.marks).toEqual(["economical", "varied"]);
    expect(status.threadIds).toHaveLength(2);

    expect(solved).toBeDefined();
    const [cue] = solved!.cues;
    if (cue.type !== "study.solved") throw new Error("not a solved cue");
    // After the commit moment; after the motif too, if this commit completed one.
    const settles = commit.duration + (motif === undefined ? 0 : MOTIF_MOMENT_SECONDS);
    expect(cue.startAt).toBeCloseTo(settles, 9);
    expect(cue.startAt).toBeGreaterThan(0);
    expect(cue.channels).toEqual(["scene", "audio", "ui", "caption"]);
    // Staged from the commit that completed the answer.
    const thread = h.domainStore.getState().session!.threads.find((t) => t.id === threadId)!;
    expect(cue.sourceEventId).toBe(thread.eventId);
    expect(cue.payload).toEqual({
      studyId: "study.eschholz-1",
      by: "threads",
      threadIds: status.threadIds,
      conceptIds: [
        bead("measure.mobius-band"),
        bead("measure.continuous-symmetry"),
        bead("sound.counterpoint"),
      ],
      marks: ["economical", "varied"],
      brief: "From The Möbius Band to Counterpoint in two threads",
    });

    // The plate opens with the moment, not before.
    expect(h.studyStore.getState().plateOpen).toBe(false);
    h.advanceTo(cue.startAt - 0.001);
    expect(h.studyStore.getState().plateOpen).toBe(false);
    h.advanceTo(cue.startAt);
    expect(h.studyStore.getState().plateOpen).toBe(true);
    expect(h.captions).toContain("Solved: From The Möbius Band to Counterpoint in two threads.");
  });

  it("canon: waits out the Canon the same commit completed, so the two are two moments", () => {
    const h = harness("study.eschholz-2");
    h.weave("measure.fourier-series", "sound.counterpoint");
    const { commit, motif, solved } = solvingCommit(h, "sound.counterpoint", "matter.standing-wave");

    const status = h.studyStore.getState().status;
    expect(status?.kind === "solved" && status.by === "threads").toBe(true);
    // Superposition recurs through three beads in three faculties: a Canon forms
    // on the very commit that solves the Study.
    expect(motif).toBeDefined();
    const motifCue = motif!.cues[0];
    expect(motifCue.startAt).toBeCloseTo(commit.duration, 9);
    const solvedCue = solved!.cues[0];
    expect(solvedCue.startAt).toBeCloseTo(commit.duration + MOTIF_MOMENT_SECONDS, 9);
    expect(solvedCue.startAt).toBeCloseTo(motif!.duration, 9);

    h.advanceTo(motifCue.startAt);
    expect(h.studyStore.getState().plateOpen).toBe(false);
    h.advanceTo(solvedCue.startAt);
    expect(h.studyStore.getState().plateOpen).toBe(true);
    expect(h.captions.at(-1)).toBe("Solved: Carry Superposition through three faculties.");
  });

  it("carry: one thread carrying the facet into the faculty solves it, after its moment", () => {
    const h = harness("study.eschholz-3");
    const { commit, motif, solved } = solvingCommit(h, "measure.cantor-diagonal", "matter.diffraction");
    const status = h.studyStore.getState().status;
    if (status?.kind !== "solved" || status.by !== "threads") throw new Error("not solved");
    expect(status.marks).toEqual(["economical"]);
    expect(motif).toBeUndefined();
    expect(solved!.cues[0].startAt).toBeCloseTo(commit.duration, 9);
    h.advanceTo(solved!.cues[0].startAt);
    expect(h.studyStore.getState().plateOpen).toBe(true);
    expect(h.captions.at(-1)).toBe("Solved: Carry Threshold into Matter.");
  });

  it("stages the solved moment once: weaving on is reported in the status, never restaged", () => {
    const h = harness("study.eschholz-3");
    h.weave("measure.cantor-diagonal", "matter.diffraction");
    h.weave("measure.fourier-series", "matter.standing-wave");
    const status = h.studyStore.getState().status;
    if (status?.kind !== "solved" || status.by !== "threads") throw new Error("not solved");
    expect(status.explanation.used).toBe(2);
    expect(status.marks).not.toContain("economical");
    expect(h.solvedPlans()).toHaveLength(1);
  });
});

describe("declaring silence", () => {
  it("solves a silence Study at once: the moment, the caption and the plate together", () => {
    const h = harness("study.eschholz-4");
    const events = h.domainStore.getState().eventLog!.events.length;
    h.progression.declareSilence();

    const status = h.studyStore.getState().status;
    if (status?.kind !== "solved" || status.by !== "silence") throw new Error("not solved");
    const [plan] = h.solvedPlans();
    expect(plan.cues[0].startAt).toBe(0);
    expect(plan.cues[0].sourceEventId).toBeNull();
    expect(plan.cues[0].payload).toEqual({
      studyId: "study.eschholz-4",
      by: "silence",
      threadIds: [],
      conceptIds: [],
      marks: [],
      brief: "Carry Proportion into Matter",
    });
    expect(h.studyStore.getState().plateOpen).toBe(true);
    expect(h.captions).toEqual([
      "Solved: Carry Proportion into Matter — it cannot be done with these beads.",
    ]);
    // Ephemeral: the declaration is never logged (§8).
    expect(h.domainStore.getState().eventLog!.events).toHaveLength(events);
  });

  it("stands for the rest of the session: weaving on after a silence cannot unsay it", () => {
    const h = harness("study.eschholz-4");
    h.progression.declareSilence();
    const declared = h.studyStore.getState().status;
    h.weave("measure.fibonacci-sequence", "measure.cantor-diagonal");
    h.weave("sound.equal-temperament", "matter.crystal-lattice");
    const status = h.studyStore.getState().status;
    expect(status?.kind === "solved" && status.by === "silence").toBe(true);
    expect(JSON.stringify(status)).toBe(JSON.stringify(declared));
    expect(h.solvedPlans()).toHaveLength(1);

    // A new session of the same Study starts unanswered: the silence was never logged.
    h.progression.attach(h.study);
    expect(h.studyStore.getState().status?.kind).toBe("not-yet");
  });

  it("answers a Study that can be solved with not yet — a caption, and no plate", () => {
    const h = harness("study.eschholz-1");
    const events = h.domainStore.getState().eventLog!.events.length;
    const before = h.studyStore.getState().status;
    h.progression.declareSilence();

    expect(h.studyStore.getState().notYet).toEqual({ kind: "can-be-done", serial: 1 });
    // The status is the evaluator's word on the session, which has not changed.
    expect(h.studyStore.getState().status).toBe(before);
    expect(h.studyStore.getState().plateOpen).toBe(false);
    expect(h.solvedPlans()).toHaveLength(0);

    const [plan] = h.published;
    expect(plan.cues).toHaveLength(1);
    expect(plan.cues[0]).toMatchObject({
      type: "study.not-yet",
      sourceEventId: null,
      startAt: 0,
      channels: ["caption"],
      payload: { studyId: "study.eschholz-1", statement: "can-be-done" },
    });
    expect(h.captions).toEqual(["Not yet — it can be done with these beads."]);
    // Nothing reached the page's channel: the margin line is the store's.
    expect(h.delivered).toHaveLength(0);
    expect(h.domainStore.getState().eventLog!.events).toHaveLength(events);

    // Said twice, it still arrives twice.
    h.progression.declareSilence();
    expect(h.studyStore.getState().notYet?.serial).toBe(2);
    expect(h.captions).toHaveLength(2);
  });

  it("on a Study already solved, reopens the plate once its moment has passed, and stages nothing", () => {
    const h = harness("study.eschholz-3");
    h.weave("measure.cantor-diagonal", "matter.diffraction");
    // While the moment is still on its way, the declaration waits for it.
    h.progression.declareSilence();
    expect(h.studyStore.getState().plateOpen).toBe(false);
    h.advanceTo(60);
    expect(h.studyStore.getState().plateOpen).toBe(true);
    h.studyStore.getState().closePlate();

    h.progression.declareSilence();
    expect(h.studyStore.getState().plateOpen).toBe(true);
    expect(h.solvedPlans()).toHaveLength(1);
    expect(h.studyStore.getState().notYet).toBeNull();
  });
});

describe("detaching", () => {
  it("stops following commits, and a moment still in the bus opens no plate", () => {
    const h = harness("study.eschholz-3");
    h.weave("measure.cantor-diagonal", "matter.diffraction");
    const status = h.studyStore.getState().status;
    h.progression.detach();
    expect(h.followers.size).toBe(0);
    h.advanceTo(60);
    expect(h.studyStore.getState().plateOpen).toBe(false);
    h.weave("measure.fourier-series", "matter.standing-wave");
    expect(h.studyStore.getState().status).toBe(status);
    h.progression.declareSilence();
    expect(h.studyStore.getState().notYet).toBeNull();
  });

  it("never follows a session that is not this Study's (R4)", () => {
    const h = harness("study.eschholz-3");
    const status = h.studyStore.getState().status;
    const other = createDomainSessionStore();
    createStudySessionStart({ domainStore: other, now: () => 0 })(studyNamed("study.eschholz-2"));
    h.domainStore.getState().loadEventLog(other.getState().eventLog);
    h.weave("measure.fourier-series", "matter.standing-wave");
    h.progression.declareSilence();
    expect(h.studyStore.getState().status).toBe(status);
    expect(h.studyStore.getState().notYet).toBeNull();
    expect(h.published.some((plan) => plan.cues.some((cue) => cue.type.startsWith("study.")))).toBe(
      false
    );
  });
});
