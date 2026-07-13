import { describe, expect, it, vi } from "vitest";
import { createSessionEvent, type SessionEventV1 } from "../../../domain/events";
import {
  eventIdFor,
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toWorldId,
} from "../../../domain/ids";
import {
  createFullSessionEventSequenceV1,
  FULL_SESSION_FIXTURE_IDS,
  SessionTransitionError,
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
import { AttendConceptCommandError } from "./AttendConceptCommandError";
import { createAttendConceptCommand } from "./createAttendConceptCommand";

const IDS = Object.freeze({
  sessionId: toSessionId("session.attend-command"),
  fibonacciId: toConceptId("math.fibonacci-sequence"),
  counterpointId: toConceptId("music.counterpoint"),
  unknownId: toConceptId("unknown.concept"),
});

const START_EVENT = createSessionEvent({
  sessionId: IDS.sessionId,
  sequence: 0,
  at: 100,
  type: "session.started",
  payload: {
    seed: "attend-command-seed",
    contentPackVersion: toContentPackVersion("castalia.test.v1"),
    worldId: toWorldId("castalia"),
    conceptIds: [IDS.fibonacciId, IDS.counterpointId],
  },
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

function createClock(...times: readonly number[]) {
  let index = 0;
  return vi.fn(() => {
    const value = times[index];
    if (value === undefined) throw new Error("test clock was read too many times");
    index += 1;
    return value;
  });
}

function expectReplayFailure(
  action: () => unknown,
  transitionCode: InstanceType<typeof SessionTransitionError>["code"]
): SessionEventLogError {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(SessionEventLogError);
  const eventLogError = thrown as SessionEventLogError;
  expect(eventLogError.code).toBe("replay-transition");
  expect(eventLogError.transitionCode).toBe(transitionCode);
  expect(eventLogError.cause).toBeInstanceOf(SessionTransitionError);
  return eventLogError;
}

describe("createAttendConceptCommand", () => {
  it("appends one canonical attended event and returns exact published references", () => {
    const domainStore = createDomainSessionStore();
    loadEvents(domainStore, [START_EVENT]);
    const before = domainStore.getState();
    const now = createClock(250);
    const attend = createAttendConceptCommand({ domainStore, now });
    let notifications = 0;
    domainStore.subscribe(() => {
      notifications += 1;
    });

    const result = attend(IDS.fibonacciId);
    const published = domainStore.getState();

    expect(now).toHaveBeenCalledOnce();
    expect(notifications).toBe(1);
    expect(result.event).toEqual({
      schemaVersion: 1,
      id: eventIdFor(IDS.sessionId, 1),
      sessionId: IDS.sessionId,
      sequence: 1,
      at: 250,
      type: "bead.attended",
      payload: { conceptId: IDS.fibonacciId },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.event)).toBe(true);
    expect(Object.isFrozen(result.event.payload)).toBe(true);
    expect(result.eventLog).toBe(published.eventLog);
    expect(result.session).toBe(published.session);
    expect(result.eventLog.events.at(-1)).toEqual(result.event);
    expect(result.session.attendedConceptId).toBe(IDS.fibonacciId);
    expect(result.session.lastSequence).toBe(1);
    expect(result.session.at).toBe(250);
    expect(published.loadEventLog).toBe(before.loadEventLog);
    expect(published.appendEvent).toBe(before.appendEvent);
    expect(published.clearSession).toBe(before.clearSession);
    expect(before.eventLog?.events).toHaveLength(1);
    expect(before.session?.attendedConceptId).toBeNull();
    expect(Object.isFrozen(before.eventLog)).toBe(true);
    expect(Object.isFrozen(before.session)).toBe(true);
  });

  it("is deterministic, ordered, and replaces only accepted attention state", () => {
    const run = () => {
      const domainStore = createDomainSessionStore();
      loadEvents(domainStore, [START_EVENT]);
      const now = createClock(250, 300);
      const attend = createAttendConceptCommand({ domainStore, now });

      const first = attend(IDS.fibonacciId);
      const second = attend(IDS.counterpointId);

      return {
        first,
        second,
        serialized: serializeSessionEventLogV1(second.eventLog),
        clockCalls: now.mock.calls.length,
      };
    };

    const firstRun = run();
    const secondRun = run();

    expect(secondRun.serialized).toBe(firstRun.serialized);
    expect(secondRun.second.session).toEqual(firstRun.second.session);
    expect(firstRun.clockCalls).toBe(2);
    expect(firstRun.first.event.id).toBe(eventIdFor(IDS.sessionId, 1));
    expect(firstRun.second.event.id).toBe(eventIdFor(IDS.sessionId, 2));
    expect(firstRun.second.eventLog.events.map((event) => event.sequence)).toEqual([0, 1, 2]);
    expect(firstRun.second.eventLog.events.map((event) => event.at)).toEqual([100, 250, 300]);
    expect(firstRun.second.session.attendedConceptId).toBe(IDS.counterpointId);
    expect(firstRun.second.session.selectedPair).toBeNull();
    expect(firstRun.second.session.hypothesis).toBeNull();
    expect(firstRun.second.session.threads).toEqual([]);
    expect(firstRun.second.session.outcomes).toEqual([]);
    expect(firstRun.second.session.completedMotifs).toEqual([]);
  });

  it("preserves provisional pair and hypothesis under accepted reducer semantics", () => {
    const domainStore = createDomainSessionStore();
    const fixture = createFullSessionEventSequenceV1();
    loadEvents(domainStore, fixture.slice(0, 4));
    const before = domainStore.getState().session!;
    const now = createClock(350);
    const attend = createAttendConceptCommand({ domainStore, now });

    const result = attend(FULL_SESSION_FIXTURE_IDS.primeNumbersId);

    expect(result.session.attendedConceptId).toBe(FULL_SESSION_FIXTURE_IDS.primeNumbersId);
    expect(result.session.selectedPair).toEqual(before.selectedPair);
    expect(result.session.hypothesis).toEqual(before.hypothesis);
    expect(result.session.threads).toEqual(before.threads);
    expect(result.session.outcomes).toEqual(before.outcomes);
    expect(result.session.completedMotifs).toEqual(before.completedMotifs);
    expect(result.session.attunementActive).toBe(before.attunementActive);
    expect(result.session.concluded).toBe(before.concluded);
  });

  it("preserves committed threads, outcomes, motifs, and their input values", () => {
    const domainStore = createDomainSessionStore();
    const fixture = createFullSessionEventSequenceV1();
    loadEvents(domainStore, fixture.slice(0, 11));
    const before = domainStore.getState();
    const beforeSession = before.session!;
    const fixtureSnapshot = structuredClone(fixture);
    const now = createClock(1_050);
    const attend = createAttendConceptCommand({ domainStore, now });

    const result = attend(FULL_SESSION_FIXTURE_IDS.counterpointId);

    expect(fixture).toEqual(fixtureSnapshot);
    expect(result.session.threads).toEqual(beforeSession.threads);
    expect(result.session.outcomes).toEqual(beforeSession.outcomes);
    expect(result.session.completedMotifs).toEqual(beforeSession.completedMotifs);
    expect(result.session.selectedPair).toEqual(beforeSession.selectedPair);
    expect(result.session.hypothesis).toEqual(beforeSession.hypothesis);
    expect(before.eventLog?.events).toHaveLength(11);
    expect(before.session).toBe(beforeSession);
  });

  it("rejects a missing canonical session before reading the clock or publishing", () => {
    const domainStore = createDomainSessionStore();
    const before = domainStore.getState();
    const now = createClock(250);
    const attend = createAttendConceptCommand({ domainStore, now });
    let notifications = 0;
    domainStore.subscribe(() => {
      notifications += 1;
    });
    let thrown: unknown;

    try {
      attend(IDS.fibonacciId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AttendConceptCommandError);
    expect((thrown as AttendConceptCommandError).code).toBe("no-active-session");
    expect(now).not.toHaveBeenCalled();
    expect(notifications).toBe(0);
    expect(domainStore.getState()).toBe(before);
    expect(domainStore.getState().eventLog).toBeNull();
    expect(domainStore.getState().session).toBeNull();
  });

  it("propagates unknown-concept rejection and leaves the adapter atomic", () => {
    const domainStore = createDomainSessionStore();
    loadEvents(domainStore, [START_EVENT]);
    const before = domainStore.getState();
    const now = createClock(250);
    const attend = createAttendConceptCommand({ domainStore, now });
    let notifications = 0;
    domainStore.subscribe(() => {
      notifications += 1;
    });

    expectReplayFailure(() => attend(IDS.unknownId), "unknown-concept");

    expect(now).toHaveBeenCalledOnce();
    expect(notifications).toBe(0);
    expect(domainStore.getState()).toBe(before);
    expect(domainStore.getState().eventLog).toBe(before.eventLog);
    expect(domainStore.getState().session).toBe(before.session);
    expect(domainStore.getState().appendEvent).toBe(before.appendEvent);
  });

  it("propagates concluded-session and clock-regression rejections unchanged", () => {
    const concludedStore = createDomainSessionStore();
    loadEvents(concludedStore, createFullSessionEventSequenceV1());
    const concludedBefore = concludedStore.getState();
    const concludedNow = createClock(1_400);
    const attendConcluded = createAttendConceptCommand({
      domainStore: concludedStore,
      now: concludedNow,
    });
    let concludedNotifications = 0;
    concludedStore.subscribe(() => {
      concludedNotifications += 1;
    });

    expectReplayFailure(
      () => attendConcluded(FULL_SESSION_FIXTURE_IDS.fibonacciId),
      "invalid-lifecycle"
    );
    expect(concludedNow).toHaveBeenCalledOnce();
    expect(concludedNotifications).toBe(0);
    expect(concludedStore.getState()).toBe(concludedBefore);

    const regressedStore = createDomainSessionStore();
    loadEvents(regressedStore, [START_EVENT]);
    const regressedBefore = regressedStore.getState();
    const regressedNow = createClock(99);
    const attendRegressed = createAttendConceptCommand({
      domainStore: regressedStore,
      now: regressedNow,
    });
    let regressedNotifications = 0;
    regressedStore.subscribe(() => {
      regressedNotifications += 1;
    });

    expectReplayFailure(() => attendRegressed(IDS.fibonacciId), "relative-time-regression");
    expect(regressedNow).toHaveBeenCalledOnce();
    expect(regressedNotifications).toBe(0);
    expect(regressedStore.getState()).toBe(regressedBefore);
  });

  it("propagates event-construction failures without touching the adapter", () => {
    const domainStore = createDomainSessionStore();
    loadEvents(domainStore, [START_EVENT]);
    const before = domainStore.getState();
    const now = createClock(Number.NaN);
    const attend = createAttendConceptCommand({ domainStore, now });
    let notifications = 0;
    domainStore.subscribe(() => {
      notifications += 1;
    });

    expect(() => attend(IDS.fibonacciId)).toThrow(RangeError);
    expect(now).toHaveBeenCalledOnce();
    expect(notifications).toBe(0);
    expect(domainStore.getState()).toBe(before);
  });
});
