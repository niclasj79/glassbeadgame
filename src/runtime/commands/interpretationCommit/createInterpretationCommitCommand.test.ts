import { describe, expect, it, vi } from "vitest";
import {
  createSessionEvent,
  type GestureProfile,
  type SessionEventV1,
} from "../../../domain/events";
import {
  eventIdFor,
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toThreadId,
  toWorldId,
} from "../../../domain/ids";
import {
  createFullSessionEventSequenceV1,
  FULL_SESSION_FIXTURE_IDS,
} from "../../../domain/reducer";
import {
  serializeSessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  SessionEventLogError,
} from "../../../domain/replay";
import {
  createDomainSessionStore,
  type DomainSessionStore,
} from "../../../state/domainSession";
import {
  armDraftIntention,
  attendDraft,
  createInterpretationDraft,
  selectDraftCandidate,
} from "../../interactionDraft";
import {
  INTERPRETATION_COMMIT_COMMAND_ERROR_CODES,
  InterpretationCommitCommandError,
} from "./InterpretationCommitCommandError";
import {
  createInterpretationCommitCommand,
  type CommitInterpretationInput,
} from "./createInterpretationCommitCommand";

const IDS = Object.freeze({
  session: toSessionId("session.interpretation-commit"),
  fibonacci: toConceptId("math.fibonacci-sequence"),
  counterpoint: toConceptId("music.counterpoint"),
  unknown: toConceptId("unknown.concept"),
  thread: toThreadId("thread.interpretation-commit.1"),
});

const SESSION_CONCEPT_IDS = Object.freeze([IDS.fibonacci, IDS.counterpoint]);

const START_EVENT = createSessionEvent({
  sessionId: IDS.session,
  sequence: 0,
  at: 100,
  type: "session.started",
  payload: {
    seed: "interpretation-commit-seed",
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

function selectedDraft() {
  const attending = attendDraft(
    createInterpretationDraft(),
    IDS.fibonacci,
    SESSION_CONCEPT_IDS
  );
  return selectDraftCandidate(
    armDraftIntention(attending, "echo"),
    IDS.counterpoint,
    SESSION_CONCEPT_IDS
  );
}

function createInput(
  gesture: GestureProfile = {
    inputModality: "mouse",
    durationMs: 800,
    pathLengthViewport: 0.45,
    curvature: 0.2,
  }
): CommitInterpretationInput {
  return {
    draft: selectedDraft(),
    threadId: IDS.thread,
    gesture,
  };
}

function createClock(...times: readonly number[]) {
  let index = 0;
  return vi.fn(() => {
    const value = times[index];
    if (value === undefined) throw new Error("test clock was read too many times");
    index += 1;
    return value;
  });
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function unsafeInput(value: unknown): CommitInterpretationInput {
  return value as CommitInterpretationInput;
}

describe("createInterpretationCommitCommand", () => {
  it("exports a closed frozen command-error vocabulary", () => {
    expect(INTERPRETATION_COMMIT_COMMAND_ERROR_CODES).toEqual([
      "no-active-session",
      "draft-not-ready",
    ]);
    expect(Object.isFrozen(INTERPRETATION_COMMIT_COMMAND_ERROR_CODES)).toBe(true);
  });

  it("publishes the exact ordered commit batch in one canonical update", () => {
    const store = createDomainSessionStore();
    loadEvents(store, [START_EVENT, ATTEND_EVENT]);
    const before = store.getState();
    const now = createClock(250);
    const commit = createInterpretationCommitCommand({ domainStore: store, now });
    const input = createInput();
    const inputSnapshot = structuredClone(input);
    const appendEvents = vi.spyOn(before, "appendEvents");
    const appendEvent = vi.spyOn(before, "appendEvent");
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    const result = commit(input);
    const published = store.getState();

    expect(now).toHaveBeenCalledOnce();
    expect(appendEvents).toHaveBeenCalledOnce();
    expect(appendEvents).toHaveBeenCalledWith(result.events);
    expect(appendEvent).not.toHaveBeenCalled();
    expect(notifications).toBe(1);
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
    expect(result.events[0].payload).toEqual({ pair: input.draft.pair });
    expect(result.events[1].payload).toEqual({
      pair: input.draft.pair,
      intention: "echo",
    });
    expect(result.events[2].payload).toEqual({
      threadId: IDS.thread,
      pair: input.draft.pair,
      intention: "echo",
      gesture: input.gesture,
    });
    expect(result.eventLog).toBe(published.eventLog);
    expect(result.session).toBe(published.session);
    expect(result.eventLog.events.slice(-3)).toEqual(result.events);
    expect(result.session.selectedPair).toBeNull();
    expect(result.session.hypothesis).toBeNull();
    expect(result.session.threads).toHaveLength(1);
    expect(result.session.threads[0]).toMatchObject({
      id: IDS.thread,
      pair: input.draft.pair,
      intention: "echo",
      gesture: input.gesture,
      sequence: 4,
      committedAt: 250,
    });
    expect(input).toEqual(inputSnapshot);
    expect(before.eventLog?.events).toHaveLength(2);
    expect(before.session?.threads).toEqual([]);
    expectDeeplyFrozen(result);
  });

  it("is deterministic and preserves ordered pair identity without sorting", () => {
    const run = () => {
      const store = createDomainSessionStore();
      loadEvents(store, [START_EVENT, ATTEND_EVENT]);
      const commit = createInterpretationCommitCommand({
        domainStore: store,
        now: createClock(250),
      });
      const result = commit(createInput({ inputModality: "keyboard", durationMs: 600 }));
      return {
        result,
        serialized: serializeSessionEventLogV1(result.eventLog),
      };
    };

    const first = run();
    const second = run();

    expect(second.serialized).toBe(first.serialized);
    expect(JSON.stringify(second.result.events)).toBe(
      JSON.stringify(first.result.events)
    );
    expect(first.result.events[0].payload.pair).toEqual([
      IDS.fibonacci,
      IDS.counterpoint,
    ]);
  });

  it("rejects a missing canonical session before reading the clock", () => {
    const store = createDomainSessionStore();
    const before = store.getState();
    const now = createClock(250);
    const commit = createInterpretationCommitCommand({ domainStore: store, now });
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    expect(() => commit(createInput())).toThrowError(
      expect.objectContaining({
        name: "InterpretationCommitCommandError",
        code: "no-active-session",
      })
    );
    expect(now).not.toHaveBeenCalled();
    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
  });

  it.each([
    { stage: "inactive" },
    { stage: "attending", attendedConceptId: IDS.fibonacci },
    { stage: "armed", attendedConceptId: IDS.fibonacci, intention: "echo" },
    { stage: "weaving" },
    null,
  ])("rejects a non-candidate draft %# before reading the clock", (draft) => {
    const store = createDomainSessionStore();
    loadEvents(store, [START_EVENT, ATTEND_EVENT]);
    const before = store.getState();
    const now = createClock(250);
    const commit = createInterpretationCommitCommand({ domainStore: store, now });
    const input = unsafeInput({ ...createInput(), draft });

    expect(() => commit(input)).toThrowError(
      expect.objectContaining({
        name: "InterpretationCommitCommandError",
        code: "draft-not-ready",
      })
    );
    expect(now).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });

  it("rejects invalid time and gesture data without publishing", () => {
    const cases = [
      { now: Number.NaN, input: createInput() },
      {
        now: 250,
        input: createInput({ inputModality: "mouse", pressure: 2 }),
      },
    ];

    for (const testCase of cases) {
      const store = createDomainSessionStore();
      loadEvents(store, [START_EVENT, ATTEND_EVENT]);
      const before = store.getState();
      const now = createClock(testCase.now);
      const commit = createInterpretationCommitCommand({ domainStore: store, now });
      let notifications = 0;
      store.subscribe(() => {
        notifications += 1;
      });

      expect(() => commit(testCase.input)).toThrow();
      expect(now).toHaveBeenCalledOnce();
      expect(notifications).toBe(0);
      expect(store.getState()).toBe(before);
      expect(store.getState().eventLog).toBe(before.eventLog);
      expect(store.getState().session).toBe(before.session);
    }
  });

  it.each([
    [
      "unsupported draft intention",
      unsafeInput({
        ...createInput(),
        draft: { ...selectedDraft(), intention: "analogy" },
      }),
    ],
    ["invalid thread identity", unsafeInput({ ...createInput(), threadId: "" })],
  ])("rejects %s through canonical decode without publishing", (_label, input) => {
    const store = createDomainSessionStore();
    loadEvents(store, [START_EVENT, ATTEND_EVENT]);
    const before = store.getState();
    const now = createClock(250);
    const commit = createInterpretationCommitCommand({ domainStore: store, now });
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    expect(() => commit(input)).toThrow(SessionEventLogError);
    expect(now).toHaveBeenCalledOnce();
    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
  });

  it("rejects an unknown draft pair through replay without partial publication", () => {
    const store = createDomainSessionStore();
    loadEvents(store, [START_EVENT, ATTEND_EVENT]);
    const before = store.getState();
    const now = createClock(250);
    const commit = createInterpretationCommitCommand({ domainStore: store, now });
    const pair = Object.freeze([IDS.unknown, IDS.counterpoint] as const);
    const input = unsafeInput({
      ...createInput(),
      draft: Object.freeze({
        stage: "candidate-selected",
        attendedConceptId: IDS.unknown,
        candidateConceptId: IDS.counterpoint,
        intention: "echo",
        pair,
      }),
    });
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    let thrown: unknown;
    try {
      commit(input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SessionEventLogError);
    expect((thrown as SessionEventLogError).code).toBe("replay-transition");
    expect((thrown as SessionEventLogError).transitionCode).toBe("unknown-concept");
    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
  });

  it("rejects a duplicate thread at the third transition without partial publication", () => {
    const store = createDomainSessionStore();
    const fixture = createFullSessionEventSequenceV1();
    loadEvents(store, fixture.slice(0, 6));
    const before = store.getState();
    const now = createClock(650);
    const commit = createInterpretationCommitCommand({ domainStore: store, now });
    const sessionConceptIds = [
      FULL_SESSION_FIXTURE_IDS.fibonacciId,
      FULL_SESSION_FIXTURE_IDS.counterpointId,
      FULL_SESSION_FIXTURE_IDS.primeNumbersId,
    ];
    const attending = attendDraft(
      createInterpretationDraft(),
      FULL_SESSION_FIXTURE_IDS.primeNumbersId,
      sessionConceptIds
    );
    const draft = selectDraftCandidate(
      armDraftIntention(attending, "ground"),
      FULL_SESSION_FIXTURE_IDS.counterpointId,
      sessionConceptIds
    );
    const input: CommitInterpretationInput = {
      draft,
      threadId: FULL_SESSION_FIXTURE_IDS.firstThreadId,
      gesture: { inputModality: "controller", durationMs: 700 },
    };
    const inputSnapshot = structuredClone(input);
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    let thrown: unknown;
    try {
      commit(input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SessionEventLogError);
    expect((thrown as SessionEventLogError).code).toBe("replay-transition");
    expect((thrown as SessionEventLogError).transitionCode).toBe(
      "duplicate-identity"
    );
    expect(input).toEqual(inputSnapshot);
    expect(now).toHaveBeenCalledOnce();
    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
    expect(store.getState().eventLog).toBe(before.eventLog);
    expect(store.getState().session).toBe(before.session);
  });

  it("uses the typed command error class for command preconditions", () => {
    const error = new InterpretationCommitCommandError(
      "draft-not-ready",
      "not ready"
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InterpretationCommitCommandError");
    expect(error.code).toBe("draft-not-ready");
  });
});
