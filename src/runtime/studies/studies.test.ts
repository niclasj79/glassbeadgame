import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { castaliaConceptById, facetById } from "../../content/castalia";
import { toFacetId } from "../../content/castalia/schema";
import { castaliaStudies, castaliaStudyById } from "../../content/castalia/studies";
import type { RelationIntention } from "../../domain/events";
import { toConceptId } from "../../domain/ids";
import type { StudyDefinition } from "../../domain/studies";
import { hashString } from "../../lib/utils";
import { domainSessionStore } from "../../state/domainSession";
import { interpretationDraftStore } from "../../state/interactionDraft";
import { isStudyMode, studyStore } from "../../state/studies";
import { useStore } from "../../state/store";
import { describeCue, type CaptionContext } from "../captions";
import { cueBus } from "../cues";
import { MOTIF_MOMENT_SECONDS } from "../cues/planCues";
import type { CuePlan, PresentationCue } from "../cues/types";
import {
  followCommits,
  productionInterpretation,
} from "../interpretation/productionInterpretation";
import { startSession } from "../session";
import { studies } from "./index";

/**
 * THE STUDIES, THROUGH THE LIVE LOOP.
 *
 * The production singletons, end to end: a Study is begun as the Studies
 * screen begins it, its beads are woven through `productionInterpretation` by
 * keyboard — attend, lock, choose a reading, hold and release — and the Free
 * Game's progression resolves each commit before the Study follows it. The
 * cue bus is the real one; the render loop's tick is played by the test.
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

/** One thread, by keyboard, exactly as the arena's controls weave it. */
function weave(a: string, b: string, intention: RelationIntention = "echo"): void {
  productionInterpretation.activateConcept(toConceptId(a));
  productionInterpretation.activateConcept(toConceptId(b));
  productionInterpretation.chooseReading(intention);
  productionInterpretation.beginHold("keyboard");
  productionInterpretation.commitHold();
}

/** The Magister's line, woven thread by thread. */
function weaveMagistersLine(study: StudyDefinition): void {
  if (study.answer.kind !== "threads") throw new Error(`${study.id} is a silence Study`);
  for (const [a, b] of study.answer.pairs) weave(String(a), String(b));
}

/** The render loop's tick, far enough ahead that every staged cue is due. */
const flush = (): void => cueBus.tick(Number.POSITIVE_INFINITY);

let delivered: { cue: PresentationCue; plan: CuePlan; channel: string }[] = [];
let captions: string[] = [];
let stops: (() => void)[] = [];

beforeEach(() => {
  // Whatever the last test left, the runtime leaves it first.
  studies.leave();
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
  domainSessionStore.setState(domainSessionStore.getInitialState(), true);
  studyStore.getState().reset();
  delivered = [];
  captions = [];
  stops = (["scene", "audio", "ui", "caption"] as const).map((channel) =>
    cueBus.subscribe(channel, (cue, plan) => {
      delivered.push({ cue, plan, channel });
      if (channel !== "caption") return;
      const caption = describeCue(cue, captionContext);
      if (caption !== null) captions.push(caption.text);
    })
  );
});

afterEach(() => {
  for (const stop of stops) stop();
  studies.leave();
});

const deliveredOf = (type: string, channel = "ui") =>
  delivered.filter((entry) => entry.cue.type === type && entry.channel === channel);

/** Every study.* cue that reached any director. */
const studyCues = () => delivered.filter((entry) => entry.cue.type.startsWith("study."));

describe("the commit seam the Studies follow", () => {
  it("runs a follower after the Free Game's progression has finished with the commit, in the same turn", () => {
    startSession(undefined, { seed: 4_242 });
    const seen: { threadId: string; woven: boolean; eventTypes: readonly string[] }[] = [];
    const stop = followCommits((threadId) => {
      seen.push({
        threadId: String(threadId),
        // The commit moment has already been staged…
        woven: deliveredOf("thread.woven").some(
          (entry) => entry.cue.type === "thread.woven" && entry.cue.payload.threadId === threadId
        ),
        // …and the log already holds whatever progression appended for it.
        eventTypes: domainSessionStore.getState().eventLog!.events.map((event) => event.type),
      });
    });

    weave("measure.fibonacci-sequence", "sound.counterpoint");
    const thread = domainSessionStore.getState().session!.threads[0];
    expect(seen).toHaveLength(1);
    expect(seen[0].threadId).toBe(String(thread.id));
    expect(seen[0].woven).toBe(true);
    // Fibonacci and Counterpoint are documented: the outcome was appended first.
    expect(seen[0].eventTypes.at(-1)).toBe("documented-relation.revealed");

    stop();
    weave("measure.prime-numbers", "sound.polyrhythm");
    expect(seen).toHaveLength(1);
  });
});

describe("beginning a Study", () => {
  it("opens its own session straight into the arena, without the draw and without the threshold", () => {
    const study = studyNamed("study.eschholz-1");
    studies.start(String(study.id));

    const legacy = useStore.getState();
    expect(legacy.phase).toBe("arena");
    expect(legacy.session).toMatchObject({
      seed: hashString("study:study.eschholz-1"),
      disciplines: [],
      beadIds: study.conceptIds.map(String),
      threads: [],
      discoveries: [],
      motifs: [],
      score: 0,
      insight: 0,
      illuminationsUsed: 0,
      curatedAvailable: 0,
      themeId: "castalia",
      interaction: { mode: "idle", fromId: null, sticky: false, reveal: null },
    });

    const domain = domainSessionStore.getState();
    expect(domain.eventLog?.events.map((event) => event.type)).toEqual(["session.started"]);
    expect(domain.session?.seed).toBe("study:study.eschholz-1");
    expect(String(domain.session?.sessionId)).toBe("session:castalia.v1:study:study.eschholz-1");
    expect(domain.session?.conceptIds).toEqual(study.conceptIds);

    expect(isStudyMode()).toBe(true);
    expect(studyStore.getState()).toMatchObject({
      studyId: "study.eschholz-1",
      status: { kind: "not-yet", statement: { kind: "no-answer-yet" } },
      notYet: null,
      plateOpen: false,
    });
    expect(studies.plate()).toBeNull();
  });

  it("refuses a Study the pack does not hold", () => {
    expect(() => studies.start("study.nowhere-9")).toThrow(/unknown Study/);
    expect(isStudyMode()).toBe(false);
  });
});

describe("solving through the live loop", () => {
  it.each([
    {
      kind: "passage",
      id: "study.eschholz-1",
      marks: ["Economical", "Varied"],
      line: "The Möbius Band to Continuous Symmetry carries Continuity; Continuous Symmetry to Counterpoint carries Invariance",
      counts: "Solved in two; the brief asked for two.",
      caption: "Solved: From The Möbius Band to Counterpoint in two threads.",
    },
    {
      kind: "canon",
      id: "study.eschholz-2",
      marks: ["Economical"],
      line: "The Fourier Series to Counterpoint carries Superposition; Counterpoint to The Standing Wave carries Superposition",
      counts: "Solved in two; the brief asked for two.",
      caption: "Solved: Carry Superposition through three faculties.",
    },
    {
      kind: "carry",
      id: "study.eschholz-3",
      marks: ["Economical"],
      line: "Cantor's Diagonal Argument to Diffraction carries Threshold",
      counts: "Solved in one; the brief asked for one.",
      caption: "Solved: Carry Threshold into Matter.",
    },
  ])("$kind: $id is solved by weaving the Magister's line, and the plate opens with the moment", (row) => {
    const study = studyNamed(row.id);
    studies.start(row.id);
    weaveMagistersLine(study);

    const session = domainSessionStore.getState().session!;
    const status = studyStore.getState().status;
    if (status?.kind !== "solved" || status.by !== "threads") throw new Error("not solved");
    expect(status.threadIds).toHaveLength(session.threads.length);

    // Staged, not yet shown: the plate waits for the moment.
    expect(studyStore.getState().plateOpen).toBe(false);
    expect(deliveredOf("study.solved")).toHaveLength(0);

    // The commit moment that completed the answer, as the bus delivered it.
    const lastWoven = deliveredOf("thread.woven").at(-1)!;
    const lastThread = session.threads.at(-1)!;
    const motifFollows = session.completedMotifs.some(
      (motif) => motif.sequence > lastThread.sequence
    );

    flush();
    const [solved] = deliveredOf("study.solved");
    expect(solved.cue.startAt).toBeCloseTo(
      lastWoven.plan.duration + (motifFollows ? MOTIF_MOMENT_SECONDS : 0),
      9
    );
    expect(solved.cue.sourceEventId).toBe(lastThread.eventId);
    expect(studyStore.getState().plateOpen).toBe(true);
    expect(captions).toContain(row.caption);
    // One coordinated moment: the same cue reached the world, the score, the page and the words.
    expect(
      delivered.filter((entry) => entry.cue.id === solved.cue.id).map((entry) => entry.channel)
    ).toEqual(["scene", "audio", "ui", "caption"]);

    expect(studies.plate()).toEqual({
      studyId: row.id,
      brief: studies.briefOf(row.id),
      by: "threads",
      playerLine: row.line,
      magisterLine: row.line,
      counts: row.counts,
      marks: row.marks,
      hasNext: true,
    });
  });

  it("states plainly what the session used against what the brief asked", () => {
    studies.start("study.waldzell-1");
    // Two threads the brief does not need, then the Magister's three.
    weave("measure.fourier-series", "matter.standing-wave");
    weave("image.chiaroscuro", "image.camera-obscura");
    weaveMagistersLine(studyNamed("study.waldzell-1"));
    flush();
    const plate = studies.plate()!;
    expect(plate.counts).toBe("Solved in five; the brief asked for three.");
    expect(plate.marks).not.toContain("Economical");
    expect(plate.playerLine).toBe(plate.magisterLine);
    expect(deliveredOf("study.solved")).toHaveLength(1);
  });
});

describe("declaring silence", () => {
  it("solves a silence Study at once: the plate opens with the moment, and says why", () => {
    studies.start("study.eschholz-4");
    studies.declareSilence();

    const status = studyStore.getState().status;
    expect(status?.kind === "solved" && status.by === "silence").toBe(true);
    expect(studyStore.getState().plateOpen).toBe(true);
    const [solved] = deliveredOf("study.solved");
    expect(solved.cue.startAt).toBe(0);
    expect(captions).toEqual([
      "Solved: Carry Proportion into Matter — it cannot be done with these beads.",
    ]);
    expect(studies.plate()).toEqual({
      studyId: "study.eschholz-4",
      brief: "Carry Proportion into Matter",
      by: "silence",
      playerLine: "No Matter bead here carries Proportion.",
      magisterLine: "It cannot be done.",
      counts: null,
      marks: [],
      hasNext: true,
    });
    // Nothing is logged: the declaration is ephemeral (§8).
    expect(domainSessionStore.getState().eventLog?.events).toHaveLength(1);
  });

  it("answers a Study that can be solved with not yet: a caption, no plate, nothing logged", () => {
    studies.start("study.eschholz-1");
    studies.declareSilence();

    expect(studyStore.getState().notYet).toEqual({ kind: "can-be-done", serial: 1 });
    expect(studyStore.getState().status?.kind).toBe("not-yet");
    expect(studyStore.getState().plateOpen).toBe(false);
    expect(studies.plate()).toBeNull();
    expect(captions).toEqual(["Not yet — it can be done with these beads."]);
    // A caption and nothing else: the world, the score and the page are not moved.
    expect(studyCues().map((entry) => entry.channel)).toEqual(["caption"]);
    expect(domainSessionStore.getState().eventLog?.events).toHaveLength(1);
  });
});

describe("again, next, and back to the Studies", () => {
  it("again begins a fresh session from the same seed", () => {
    studies.start("study.eschholz-3");
    weaveMagistersLine(studyNamed("study.eschholz-3"));
    flush();
    expect(studyStore.getState().plateOpen).toBe(true);
    const before = domainSessionStore.getState().session!;

    studies.restart();
    const after = domainSessionStore.getState();
    expect(after.session?.seed).toBe(before.seed);
    expect(after.session?.sessionId).toBe(before.sessionId);
    expect(after.session?.threads).toHaveLength(0);
    expect(after.eventLog?.events).toHaveLength(1);
    expect(studyStore.getState()).toMatchObject({
      studyId: "study.eschholz-3",
      status: { kind: "not-yet" },
      notYet: null,
      plateOpen: false,
    });
    expect(interpretationDraftStore.getState().draft.stage).toBe("inactive");
    expect(cueBus.pending()).toBe(0);

    // And it can be solved again, with its own moment.
    weaveMagistersLine(studyNamed("study.eschholz-3"));
    flush();
    expect(studyStore.getState().plateOpen).toBe(true);
    expect(deliveredOf("study.solved")).toHaveLength(2);
  });

  it("next begins the Study after this one in list order, and returns to the list after the last", () => {
    const order = castaliaStudies().map((study) => String(study.id));
    studies.start("study.eschholz-4");
    studies.next();
    expect(studyStore.getState().studyId).toBe(order[order.indexOf("study.eschholz-4") + 1]);
    expect(studyStore.getState().studyId).toBe("study.waldzell-1");
    expect(domainSessionStore.getState().session?.seed).toBe("study:study.waldzell-1");

    studies.start(order.at(-1)!);
    weaveMagistersLine(studyNamed(order.at(-1)!));
    flush();
    expect(studies.plate()?.hasNext).toBe(false);
    studies.next();
    expect(useStore.getState().phase).toBe("studies");
    expect(isStudyMode()).toBe(false);
  });

  it("back to the Studies discards the session and forgets the Study", () => {
    studies.start("study.eschholz-3");
    weave("measure.cantor-diagonal", "matter.diffraction");
    expect(cueBus.pending()).toBeGreaterThan(0);

    studies.leave();
    expect(useStore.getState().phase).toBe("studies");
    expect(useStore.getState().session).toBeNull();
    expect(domainSessionStore.getState().session).toBeNull();
    expect(cueBus.pending()).toBe(0);
    expect(studyStore.getState()).toMatchObject({
      studyId: null,
      status: null,
      notYet: null,
      plateOpen: false,
    });
  });
});

describe("the Free Game is untouched (R4)", () => {
  it("a Free Game begun after a Study has no Study in it", () => {
    studies.start("study.eschholz-1");
    weave("measure.mobius-band", "measure.continuous-symmetry");
    studies.leave();
    useStore.getState().returnToTitle();
    useStore.getState().crossToThreshold();
    startSession();
    delivered = [];

    weave("measure.fibonacci-sequence", "sound.counterpoint");
    studies.declareSilence();
    flush();
    expect(isStudyMode()).toBe(false);
    expect(studyStore.getState()).toMatchObject({ studyId: null, status: null, notYet: null });
    expect(studyCues()).toHaveLength(0);
    expect(deliveredOf("thread.woven")).toHaveLength(1);
  });

  it.each([
    { door: "the title", leave: () => useStore.getState().returnToTitle() },
    { door: "the threshold", leave: () => useStore.getState().crossToThreshold() },
    { door: "a Free Game begun directly", leave: () => startSession() },
  ])("ends Study mode when play leaves by $door", ({ leave }) => {
    studies.start("study.eschholz-3");
    leave();
    expect(isStudyMode()).toBe(false);
    expect(studyStore.getState().status).toBeNull();

    // And nothing follows commits any more.
    if (domainSessionStore.getState().session !== null && useStore.getState().phase === "arena") {
      weave("measure.fibonacci-sequence", "sound.counterpoint");
      flush();
      expect(studyStore.getState().status).toBeNull();
      expect(studyCues()).toHaveLength(0);
    }
  });
});

describe("what the screens read", () => {
  it("lists three chapters of briefs in order, with no results, the same list every time", () => {
    const chapters = studies.chapters();
    expect(chapters.map((chapter) => chapter.name)).toEqual([
      "Eschholz",
      "Waldzell",
      "Vicus Lusorum",
    ]);
    expect(chapters.flatMap((chapter) => chapter.studies.map((entry) => entry.id))).toEqual(
      castaliaStudies().map((study) => String(study.id))
    );
    for (const entry of chapters.flatMap((chapter) => chapter.studies)) {
      expect(Object.keys(entry).sort()).toEqual(["brief", "id", "ordinal"]);
      expect(entry.brief).toBe(studies.briefOf(entry.id));
    }
    expect(studies.chapters()).toBe(chapters);
  });

  it("gives the same plate until the evaluator's word changes", () => {
    studies.start("study.eschholz-3");
    weaveMagistersLine(studyNamed("study.eschholz-3"));
    const plate = studies.plate();
    expect(plate).not.toBeNull();
    expect(studies.plate()).toBe(plate);
    weave("measure.fourier-series", "matter.standing-wave");
    expect(studies.plate()).not.toBe(plate);
    expect(studies.plate()?.counts).toBe("Solved in two; the brief asked for one.");
  });

  it("says no count of Studies, no total, no percentage, and none of the forbidden words", () => {
    const said: string[] = [];
    for (const study of castaliaStudies()) {
      const id = String(study.id);
      studies.start(id);
      if (study.answer.kind === "threads") {
        studies.declareSilence();
        weaveMagistersLine(study);
      } else {
        studies.declareSilence();
      }
      flush();
      const plate = studies.plate()!;
      said.push(
        plate.brief,
        plate.playerLine,
        plate.magisterLine,
        plate.counts ?? "",
        ...plate.marks
      );
    }
    // The Study's own captions: the Free Game's loop captions are not Study copy.
    const studyCaptions = studyCues()
      .filter((entry) => entry.channel === "caption")
      .map((entry) => describeCue(entry.cue, captionContext)?.text ?? "");
    expect(studyCaptions.length).toBeGreaterThanOrEqual(castaliaStudies().length);
    said.push(
      ...studyCaptions,
      ...studies.chapters().flatMap((chapter) => [
        chapter.name,
        ...chapter.studies.map((entry) => entry.brief),
      ])
    );
    expect(said.length).toBeGreaterThan(60);
    for (const text of said) {
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/%|percent/i);
      expect(text).not.toMatch(/\b(score|scores|points?|rank|ranks|ranked|wrong|total)\b/i);
      expect(text).not.toMatch(/\b\w+ of (?:twelve|eleven|ten|nine|eight|seven|six|five|four|three|two)\b/i);
    }
  });
});
