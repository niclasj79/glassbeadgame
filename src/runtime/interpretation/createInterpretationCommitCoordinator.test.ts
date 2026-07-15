import { describe, expect, it, vi } from "vitest";
import { createSessionEvent, type SessionEventV1 } from "../../domain/events";
import {
  eventIdFor,
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toThreadId,
  toWorldId,
  type ConceptId,
  type ThreadId,
} from "../../domain/ids";
import {
  createFullSessionEventSequenceV1,
  FULL_SESSION_FIXTURE_IDS,
} from "../../domain/reducer";
import {
  serializeSessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  SessionEventLogError,
} from "../../domain/replay";
import {
  createDomainSessionStore,
  type DomainSessionStore,
} from "../../state/domainSession";
import {
  createInterpretationDraftStore,
  type InterpretationDraftStore,
} from "../../state/interactionDraft";
import { InterpretationCommitCommandError } from "../commands/interpretationCommit";
import {
  GestureProfileBuildError,
  type BuildGestureProfileInput,
  type GestureProfileBuildErrorCode,
} from "../gestureProfile";
import type { InterpretationDraft } from "../interactionDraft";
import { createInterpretationCommitCoordinator } from ".";

const IDS = Object.freeze({
  session: toSessionId("session.interpretation-coordinator"),
  fibonacci: toConceptId("math.fibonacci-sequence"),
  counterpoint: toConceptId("music.counterpoint"),
  unknown: toConceptId("unknown.concept"),
  thread: toThreadId("thread.interpretation-coordinator.1"),
});

const SESSION_CONCEPT_IDS = Object.freeze([IDS.fibonacci, IDS.counterpoint]);

const START_EVENT = createSessionEvent({
  sessionId: IDS.session,
  sequence: 0,
  at: 100,
  type: "session.started",
  payload: {
    seed: "interpretation-coordinator-seed",
    contentPackVersion: toContentPackVersion("castalia.test.v1"),
    worldId: toWorldId("castalia"),
    conceptIds: SESSION_CONCEPT_IDS,
  },
});

const ATTEND_EVENT = createSessionEvent({
  sessionId: IDS.session,
  sequence: 1,
  at: 150,
  type: "bead.attended",
  payload: { conceptId: IDS.fibonacci },
});

const POINTER_GESTURE: BuildGestureProfileInput = Object.freeze({
  inputModality: "mouse",
  startedAtMs: 1_000,
  endedAtMs: 1_500,
  samples: Object.freeze([
    Object.freeze({ atMs: 1_000, xViewport: 0.1, yViewport: 0.2, pressure: 0.2 }),
    Object.freeze({ atMs: 1_250, xViewport: 0.4, yViewport: 0.2, pressure: 0.6 }),
    Object.freeze({ atMs: 1_500, xViewport: 0.4, yViewport: 0.6, pressure: 1 }),
  ]),
});

function loadEvents(
  store: DomainSessionStore,
  events: readonly SessionEventV1[]
): void {
  store.getState().loadEventLog({
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events,
  });
}

function advanceDraft(
  store: InterpretationDraftStore,
  stage: Exclude<InterpretationDraft["stage"], "inactive"> = "candidate-selected",
  conceptIds: readonly ConceptId[] = SESSION_CONCEPT_IDS,
  attended = IDS.fibonacci,
  candidate = IDS.counterpoint
): void {
  store.getState().attend(attended, conceptIds);
  if (stage === "attending") return;
  store.getState().armIntention("echo");
  if (stage === "armed") return;
  store.getState().selectCandidate(candidate, conceptIds);
}

function createHarness(nowValue = 250) {
  const domainStore = createDomainSessionStore();
  const draftStore = createInterpretationDraftStore();
  loadEvents(domainStore, [START_EVENT, ATTEND_EVENT]);
  advanceDraft(draftStore);
  const now = vi.fn(() => nowValue);
  const commit = createInterpretationCommitCoordinator({
    domainStore,
    draftStore,
    now,
  });
  return { commit, domainStore, draftStore, now };
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function unsafeGesture(value: unknown): BuildGestureProfileInput {
  return value as BuildGestureProfileInput;
}

describe("createInterpretationCommitCoordinator", () => {
  it("creates an isolated coordinator without reading dependencies or publishing", () => {
    const domainStore = createDomainSessionStore();
    const draftStore = createInterpretationDraftStore();
    const domainGetState = vi.spyOn(domainStore, "getState");
    const draftGetState = vi.spyOn(draftStore, "getState");
    const now = vi.fn(() => 250);

    const commit = createInterpretationCommitCoordinator({
      domainStore,
      draftStore,
      now,
    });

    expect(typeof commit).toBe("function");
    expect(domainGetState).not.toHaveBeenCalled();
    expect(draftGetState).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it("publishes the complete commit before one accepted draft reset", () => {
    const { commit, domainStore, draftStore, now } = createHarness();
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const committedDraft = draftBefore.draft;
    const appendEvents = vi.spyOn(domainBefore, "appendEvents");
    const reset = vi.spyOn(draftBefore, "reset");
    const publicationOrder: string[] = [];
    domainStore.subscribe(() => {
      publicationOrder.push("domain");
      expect(draftStore.getState().draft).toBe(committedDraft);
    });
    draftStore.subscribe(() => publicationOrder.push("draft"));

    const result = commit({ threadId: IDS.thread, gesture: POINTER_GESTURE });
    const domainPublished = domainStore.getState();
    const draftPublished = draftStore.getState();

    expect(publicationOrder).toEqual(["domain", "draft"]);
    expect(now).toHaveBeenCalledOnce();
    expect(appendEvents).toHaveBeenCalledOnce();
    expect(appendEvents).toHaveBeenCalledWith(result.events);
    expect(reset).toHaveBeenCalledOnce();
    expect(result.committedDraft).toBe(committedDraft);
    expect(result.gesture).toEqual({
      inputModality: "mouse",
      durationMs: 500,
      pathLengthViewport: 0.7,
      curvature: 0.5,
      averageSpeedViewportPerSecond: 1.4,
      speedVariance: 0.03999999999999994,
      pressure: 0.6,
    });
    expect(result.events.map((event) => event.type)).toEqual([
      "pair.selected",
      "relation.hypothesized",
      "thread.committed",
    ]);
    expect(result.events.map((event) => event.sequence)).toEqual([2, 3, 4]);
    expect(result.events.map((event) => event.id)).toEqual([
      eventIdFor(IDS.session, 2),
      eventIdFor(IDS.session, 3),
      eventIdFor(IDS.session, 4),
    ]);
    expect(result.events.map((event) => event.at)).toEqual([250, 250, 250]);
    expect(result.events[2].payload).toEqual({
      threadId: IDS.thread,
      pair: result.committedDraft.pair,
      intention: "echo",
      gesture: result.gesture,
    });
    expect(result.eventLog).toBe(domainPublished.eventLog);
    expect(result.session).toBe(domainPublished.session);
    expect(result.draft).toBe(draftPublished.draft);
    expect(result.draft).toEqual({ stage: "inactive" });
    expect(domainPublished.appendEvents).toBe(domainBefore.appendEvents);
    expect(draftPublished.reset).toBe(draftBefore.reset);
    expectDeeplyFrozen(result);
  });

  it.each(["keyboard", "controller"] as const)(
    "keeps a %s hold-only gesture honest and geometry-free",
    (inputModality) => {
      const { commit } = createHarness();
      const result = commit({
        threadId: IDS.thread,
        gesture: { inputModality, startedAtMs: 400, endedAtMs: 1_000 },
      });

      expect(result.gesture).toEqual({ inputModality, durationMs: 600 });
      expect(result.events[2].payload.gesture).toEqual(result.gesture);
    }
  );

  it.each(["inactive", "attending", "armed"] as const)(
    "preserves both stores when the draft is %s",
    (stage) => {
      const domainStore = createDomainSessionStore();
      const draftStore = createInterpretationDraftStore();
      loadEvents(domainStore, [START_EVENT, ATTEND_EVENT]);
      if (stage !== "inactive") advanceDraft(draftStore, stage);
      const domainBefore = domainStore.getState();
      const draftBefore = draftStore.getState();
      const reset = vi.spyOn(draftBefore, "reset");
      const now = vi.fn(() => 250);
      const commit = createInterpretationCommitCoordinator({
        domainStore,
        draftStore,
        now,
      });
      let domainNotifications = 0;
      let draftNotifications = 0;
      domainStore.subscribe(() => {
        domainNotifications += 1;
      });
      draftStore.subscribe(() => {
        draftNotifications += 1;
      });

      expect(() =>
        commit({ threadId: IDS.thread, gesture: POINTER_GESTURE })
      ).toThrow(InterpretationCommitCommandError);
      expect(now).not.toHaveBeenCalled();
      expect(reset).not.toHaveBeenCalled();
      expect(domainNotifications).toBe(0);
      expect(draftNotifications).toBe(0);
      expect(domainStore.getState()).toBe(domainBefore);
      expect(draftStore.getState()).toBe(draftBefore);
    }
  );

  it("preserves a candidate draft when no canonical session is active", () => {
    const domainStore = createDomainSessionStore();
    const draftStore = createInterpretationDraftStore();
    advanceDraft(draftStore);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const reset = vi.spyOn(draftBefore, "reset");
    const now = vi.fn(() => 250);
    const commit = createInterpretationCommitCoordinator({
      domainStore,
      draftStore,
      now,
    });

    expect(() =>
      commit({ threadId: IDS.thread, gesture: POINTER_GESTURE })
    ).toThrowError(expect.objectContaining({ code: "no-active-session" }));
    expect(now).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it.each([
    {
      code: "unsupported-input-modality",
      gesture: { inputModality: "voice", startedAtMs: 0, endedAtMs: 1 },
    },
    {
      code: "invalid-time-range",
      gesture: { inputModality: "mouse", startedAtMs: 2, endedAtMs: 1 },
    },
    {
      code: "invalid-samples",
      gesture: { inputModality: "mouse", startedAtMs: 0, endedAtMs: 1, samples: {} },
    },
    {
      code: "invalid-sample-time",
      gesture: {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: [{ atMs: 2 }],
      },
    },
    {
      code: "non-monotonic-samples",
      gesture: {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 2,
        samples: [{ atMs: 1 }, { atMs: 1 }],
      },
    },
    {
      code: "invalid-sample-coordinates",
      gesture: {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: [{ atMs: 0, xViewport: 0.5 }],
      },
    },
    {
      code: "mixed-coordinate-availability",
      gesture: {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: [{ atMs: 0, xViewport: 0, yViewport: 0 }, { atMs: 1 }],
      },
    },
    {
      code: "invalid-pressure",
      gesture: {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: [{ atMs: 0, pressure: 2 }],
      },
    },
  ] as const)(
    "propagates $code before clock, publication, or reset",
    ({ code, gesture }) => {
      const { commit, domainStore, draftStore, now } = createHarness();
      const domainBefore = domainStore.getState();
      const draftBefore = draftStore.getState();
      const reset = vi.spyOn(draftBefore, "reset");
      let domainNotifications = 0;
      let draftNotifications = 0;
      domainStore.subscribe(() => {
        domainNotifications += 1;
      });
      draftStore.subscribe(() => {
        draftNotifications += 1;
      });
      let thrown: unknown;

      try {
        commit({ threadId: IDS.thread, gesture: unsafeGesture(gesture) });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(GestureProfileBuildError);
      expect((thrown as GestureProfileBuildError).code).toBe(
        code as GestureProfileBuildErrorCode
      );
      expect(now).not.toHaveBeenCalled();
      expect(reset).not.toHaveBeenCalled();
      expect(domainNotifications).toBe(0);
      expect(draftNotifications).toBe(0);
      expect(domainStore.getState()).toBe(domainBefore);
      expect(draftStore.getState()).toBe(draftBefore);
    }
  );

  it.each([
    { label: "invalid clock", threadId: IDS.thread, nowValue: Number.NaN },
    { label: "invalid thread", threadId: "" as ThreadId, nowValue: 250 },
  ])("does not reset after $label rejection", ({ threadId, nowValue }) => {
    const { commit, domainStore, draftStore, now } = createHarness(nowValue);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const reset = vi.spyOn(draftBefore, "reset");

    expect(() => commit({ threadId, gesture: POINTER_GESTURE })).toThrow();
    expect(now).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it("preserves both stores after unknown-concept replay rejection", () => {
    const domainStore = createDomainSessionStore();
    const draftStore = createInterpretationDraftStore();
    loadEvents(domainStore, [START_EVENT, ATTEND_EVENT]);
    advanceDraft(
      draftStore,
      "candidate-selected",
      [IDS.unknown, IDS.counterpoint],
      IDS.unknown,
      IDS.counterpoint
    );
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const reset = vi.spyOn(draftBefore, "reset");
    const commit = createInterpretationCommitCoordinator({
      domainStore,
      draftStore,
      now: vi.fn(() => 250),
    });
    let thrown: unknown;

    try {
      commit({ threadId: IDS.thread, gesture: POINTER_GESTURE });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SessionEventLogError);
    expect(thrown).toMatchObject({
      code: "replay-transition",
      transitionCode: "unknown-concept",
    });
    expect(reset).not.toHaveBeenCalled();
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it("preserves both stores after duplicate-thread replay rejection", () => {
    const domainStore = createDomainSessionStore();
    const draftStore = createInterpretationDraftStore();
    loadEvents(domainStore, createFullSessionEventSequenceV1().slice(0, 6));
    const conceptIds = [
      FULL_SESSION_FIXTURE_IDS.fibonacciId,
      FULL_SESSION_FIXTURE_IDS.counterpointId,
      FULL_SESSION_FIXTURE_IDS.primeNumbersId,
    ];
    draftStore.getState().attend(FULL_SESSION_FIXTURE_IDS.primeNumbersId, conceptIds);
    draftStore.getState().armIntention("ground");
    draftStore
      .getState()
      .selectCandidate(FULL_SESSION_FIXTURE_IDS.counterpointId, conceptIds);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const reset = vi.spyOn(draftBefore, "reset");
    const commit = createInterpretationCommitCoordinator({
      domainStore,
      draftStore,
      now: vi.fn(() => 650),
    });

    expect(() =>
      commit({
        threadId: FULL_SESSION_FIXTURE_IDS.firstThreadId,
        gesture: {
          inputModality: "controller",
          startedAtMs: 0,
          endedAtMs: 700,
        },
      })
    ).toThrow(SessionEventLogError);
    expect(reset).not.toHaveBeenCalled();
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it("does not mutate or retain gesture input and is byte deterministic", () => {
    const run = () => {
      const samples = [
        { atMs: 0, xViewport: 0, yViewport: 0 },
        { atMs: 500, xViewport: 0.3, yViewport: 0.4 },
      ];
      const gesture: BuildGestureProfileInput = {
        inputModality: "touch",
        startedAtMs: 0,
        endedAtMs: 500,
        samples,
      };
      const snapshot = structuredClone(gesture);
      const { commit } = createHarness();
      const result = commit({ threadId: IDS.thread, gesture });
      expect(gesture).toEqual(snapshot);
      samples[1].xViewport = 1;
      return { gesture, result, snapshot };
    };

    const first = run();
    const second = run();

    expect(first.gesture).not.toEqual(first.snapshot);
    expect(first.result.gesture).toEqual({
      inputModality: "touch",
      durationMs: 500,
      pathLengthViewport: 0.5,
      curvature: 0,
      averageSpeedViewportPerSecond: 1,
      speedVariance: 0,
    });
    expect(second.result).toEqual(first.result);
    expect(JSON.stringify(second.result)).toBe(JSON.stringify(first.result));
    expect(serializeSessionEventLogV1(second.result.eventLog)).toBe(
      serializeSessionEventLogV1(first.result.eventLog)
    );
    expectDeeplyFrozen(first.result);
    expectDeeplyFrozen(second.result);
  });
});
