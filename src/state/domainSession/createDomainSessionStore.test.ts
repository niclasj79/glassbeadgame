import { describe, expect, it } from "vitest";
import type { SessionEventV1 } from "../../domain/events";
import {
  createFullSessionEventSequenceV1,
} from "../../domain/reducer";
import {
  decodeSessionEventLogV1,
  replaySessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  SessionEventLogError,
} from "../../domain/replay";
import { createDomainSessionStore } from "./createDomainSessionStore";

const fixtureEvents = createFullSessionEventSequenceV1();

function createFixtureInput(): {
  format: typeof SESSION_EVENT_LOG_FORMAT;
  schemaVersion: typeof SESSION_EVENT_LOG_SCHEMA_VERSION;
  events: SessionEventV1[];
} {
  return {
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events: fixtureEvents.map((event) => structuredClone(event)),
  };
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;

  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("createDomainSessionStore", () => {
  it("creates isolated empty stores with stable actions", () => {
    const first = createDomainSessionStore();
    const second = createDomainSessionStore();
    const initial = first.getState();

    expect(first).not.toBe(second);
    expect(initial.eventLog).toBeNull();
    expect(initial.session).toBeNull();
    expect(second.getState().eventLog).toBeNull();
    expect(second.getState().session).toBeNull();

    first.getState().appendEvent(fixtureEvents[0]);

    expect(first.getState().loadEventLog).toBe(initial.loadEventLog);
    expect(first.getState().appendEvent).toBe(initial.appendEvent);
    expect(first.getState().clearSession).toBe(initial.clearSession);
    expect(second.getState().eventLog).toBeNull();
    expect(second.getState().session).toBeNull();
  });

  it("loads one rebuilt immutable log and matching state in one update", () => {
    const store = createDomainSessionStore();
    const input = createFixtureInput();
    const inputSnapshot = structuredClone(input);
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.getState().loadEventLog(input);

    const { eventLog, session } = store.getState();
    expect(notifications).toBe(1);
    expect(eventLog).not.toBeNull();
    expect(session).not.toBeNull();
    expect(eventLog).not.toBe(input);
    expect(eventLog?.events).not.toBe(input.events);
    expect(eventLog?.events[0]).not.toBe(input.events[0]);
    expect(input).toEqual(inputSnapshot);
    expect(session).toEqual(replaySessionEventLogV1(decodeSessionEventLogV1(input)));
    expectDeeplyFrozen(eventLog);
    expectDeeplyFrozen(session);
  });

  it("appends the full fixture with one immutable update per event", () => {
    const appendedStore = createDomainSessionStore();
    const loadedStore = createDomainSessionStore();
    const actions = appendedStore.getState();
    const priorPairs: Array<{
      eventLog: ReturnType<typeof appendedStore.getState>["eventLog"];
      session: ReturnType<typeof appendedStore.getState>["session"];
    }> = [];
    let notifications = 0;
    appendedStore.subscribe(() => {
      notifications += 1;
    });

    for (const event of fixtureEvents) {
      const eventSnapshot = structuredClone(event);
      const before = appendedStore.getState();
      priorPairs.push({ eventLog: before.eventLog, session: before.session });

      appendedStore.getState().appendEvent(event);

      expect(event).toEqual(eventSnapshot);
      expect(appendedStore.getState().eventLog?.events.at(-1)).toEqual(event);
      expect(appendedStore.getState().eventLog).not.toBe(before.eventLog);
      expect(appendedStore.getState().session).not.toBe(before.session);
    }
    loadedStore.getState().loadEventLog(createFixtureInput());

    expect(notifications).toBe(fixtureEvents.length);
    expect(appendedStore.getState().eventLog).toEqual(loadedStore.getState().eventLog);
    expect(appendedStore.getState().session).toEqual(loadedStore.getState().session);
    expect(appendedStore.getState().eventLog?.events).toEqual(fixtureEvents);
    expect(appendedStore.getState().loadEventLog).toBe(actions.loadEventLog);
    expect(appendedStore.getState().appendEvent).toBe(actions.appendEvent);
    expect(appendedStore.getState().clearSession).toBe(actions.clearSession);
    for (const pair of priorPairs) {
      expectDeeplyFrozen(pair.eventLog);
      expectDeeplyFrozen(pair.session);
    }
  });

  it("leaves existing state and actions untouched when a load fails", () => {
    const store = createDomainSessionStore();
    store.getState().loadEventLog(createFixtureInput());
    const before = store.getState();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });
    let thrown: unknown;

    try {
      store.getState().loadEventLog({
        format: SESSION_EVENT_LOG_FORMAT,
        schemaVersion: 999,
        events: fixtureEvents,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SessionEventLogError);
    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
    expect(store.getState().eventLog).toBe(before.eventLog);
    expect(store.getState().session).toBe(before.session);
    expect(store.getState().loadEventLog).toBe(before.loadEventLog);
    expect(store.getState().appendEvent).toBe(before.appendEvent);
    expect(store.getState().clearSession).toBe(before.clearSession);
  });

  it("rejects invalid first and forged appended events without publishing", () => {
    const emptyStore = createDomainSessionStore();
    const invalidFirst = fixtureEvents[1];
    let emptyNotifications = 0;
    emptyStore.subscribe(() => {
      emptyNotifications += 1;
    });

    expect(() => emptyStore.getState().appendEvent(invalidFirst)).toThrow(SessionEventLogError);
    expect(emptyNotifications).toBe(0);
    expect(emptyStore.getState().eventLog).toBeNull();
    expect(emptyStore.getState().session).toBeNull();

    const populatedStore = createDomainSessionStore();
    populatedStore.getState().appendEvent(fixtureEvents[0]);
    const before = populatedStore.getState();
    const forged = { ...fixtureEvents[1], id: "not-an-event-id" } as SessionEventV1;
    const forgedSnapshot = structuredClone(forged);
    let populatedNotifications = 0;
    populatedStore.subscribe(() => {
      populatedNotifications += 1;
    });

    expect(() => populatedStore.getState().appendEvent(forged)).toThrow(SessionEventLogError);
    expect(forged).toEqual(forgedSnapshot);
    expect(populatedNotifications).toBe(0);
    expect(populatedStore.getState()).toBe(before);
    expect(populatedStore.getState().eventLog).toBe(before.eventLog);
    expect(populatedStore.getState().session).toBe(before.session);
  });

  it("clears atomically while preserving old values and no-ops when empty", () => {
    const store = createDomainSessionStore();
    store.getState().loadEventLog(createFixtureInput());
    const before = store.getState();
    const oldEventLog = before.eventLog;
    const oldSession = before.session;
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.getState().clearSession();

    expect(notifications).toBe(1);
    expect(store.getState().eventLog).toBeNull();
    expect(store.getState().session).toBeNull();
    expectDeeplyFrozen(oldEventLog);
    expectDeeplyFrozen(oldSession);
    expect(store.getState().clearSession).toBe(before.clearSession);

    const cleared = store.getState();
    store.getState().clearSession();
    expect(notifications).toBe(1);
    expect(store.getState()).toBe(cleared);
  });
});
