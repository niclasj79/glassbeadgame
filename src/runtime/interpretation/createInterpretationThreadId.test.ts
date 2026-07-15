import { describe, expect, it, vi } from "vitest";
import {
  createSessionEvent,
  type SessionEventV1,
} from "../../domain/events";
import {
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toThreadId,
  toWorldId,
  type SessionId,
  type ThreadId,
} from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import {
  parseSessionEventLogV1,
  replaySessionEventLogV1,
  serializeSessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  type SessionEventLogV1,
} from "../../domain/replay";
import { createDomainSessionStore } from "../../state/domainSession";
import { createInterpretationCommitCommand } from "../commands/interpretationCommit";
import {
  armDraftIntention,
  attendDraft,
  createInterpretationDraft,
  selectDraftCandidate,
} from "../interactionDraft";
import * as interpretation from ".";
import { createInterpretationThreadId } from ".";

const IDS = Object.freeze({
  firstConcept: toConceptId("math.fibonacci-sequence"),
  secondConcept: toConceptId("music.counterpoint"),
  contentPackVersion: toContentPackVersion("castalia.test.v1"),
  worldId: toWorldId("castalia"),
});

function expectedThreadId(
  sessionId: SessionId,
  sequenceNumber: number
): ThreadId {
  return toThreadId(
    `thread:${sessionId.length}:${sessionId}:${sequenceNumber}`
  );
}

function createEventLog(
  sessionId: SessionId,
  threadIds: readonly ThreadId[] = [],
  concluded = false
): SessionEventLogV1 {
  const events: SessionEventV1[] = [
    createSessionEvent({
      sessionId,
      sequence: 0,
      at: 0,
      type: "session.started",
      payload: {
        seed: "thread-identity-test",
        contentPackVersion: IDS.contentPackVersion,
        worldId: IDS.worldId,
        conceptIds: [IDS.firstConcept, IDS.secondConcept],
      },
    }),
  ];

  for (const threadId of threadIds) {
    const firstSequence = events.length;
    const pair = Object.freeze([
      IDS.firstConcept,
      IDS.secondConcept,
    ] as const);
    events.push(
      createSessionEvent({
        sessionId,
        sequence: firstSequence,
        at: firstSequence * 100,
        type: "pair.selected",
        payload: { pair },
      }),
      createSessionEvent({
        sessionId,
        sequence: firstSequence + 1,
        at: (firstSequence + 1) * 100,
        type: "relation.hypothesized",
        payload: { pair, intention: "echo" },
      }),
      createSessionEvent({
        sessionId,
        sequence: firstSequence + 2,
        at: (firstSequence + 2) * 100,
        type: "thread.committed",
        payload: {
          threadId,
          pair,
          intention: "echo",
          gesture: { inputModality: "keyboard" },
        },
      })
    );
  }

  if (concluded) {
    events.push(
      createSessionEvent({
        sessionId,
        sequence: events.length,
        at: events.length * 100,
        type: "session.concluded",
        payload: {},
      })
    );
  }

  return Object.freeze({
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events: Object.freeze(events),
  });
}

function createSession(
  sessionId: SessionId,
  threadIds: readonly ThreadId[] = [],
  concluded = false
): SessionStateV1 {
  return replaySessionEventLogV1(
    createEventLog(sessionId, threadIds, concluded)
  );
}

describe("createInterpretationThreadId", () => {
  it("exports the callable boundary and starts an empty session at one", () => {
    const sessionId = toSessionId("session.castalia");
    const session = createSession(sessionId);

    expect(typeof createInterpretationThreadId).toBe("function");
    expect(interpretation).not.toHaveProperty(
      "threadIdForSequenceNumber"
    );
    expect(createInterpretationThreadId(session)).toBe(
      toThreadId("thread:16:session.castalia:1")
    );
  });

  it("advances past a contiguous generated identity sequence", () => {
    const sessionId = toSessionId("session.contiguous");
    const session = createSession(sessionId, [
      expectedThreadId(sessionId, 1),
      expectedThreadId(sessionId, 2),
    ]);

    expect(createInterpretationThreadId(session)).toBe(
      expectedThreadId(sessionId, 3)
    );
  });

  it("fills the first gap in the generated identity sequence", () => {
    const sessionId = toSessionId("session.gapped");
    const session = createSession(sessionId, [
      expectedThreadId(sessionId, 1),
      expectedThreadId(sessionId, 3),
    ]);

    expect(createInterpretationThreadId(session)).toBe(
      expectedThreadId(sessionId, 2)
    );
  });

  it("ignores arbitrary identities unless they exactly occupy a candidate", () => {
    const sessionId = toSessionId("session.imported");
    const session = createSession(sessionId, [
      toThreadId("math.fibonacci-sequence+music.counterpoint"),
      expectedThreadId(sessionId, 1),
      expectedThreadId(toSessionId("other-session"), 2),
      expectedThreadId(sessionId, 3),
    ]);

    expect(createInterpretationThreadId(session)).toBe(
      expectedThreadId(sessionId, 2)
    );
  });

  it("uses exact separator-safe UTF-16 session namespaces", () => {
    const separatorId = toSessionId("a:b");
    const shorterId = toSessionId("a");
    const unicodeId = toSessionId("a😀:1");

    const results = [
      createInterpretationThreadId(createSession(separatorId)),
      createInterpretationThreadId(createSession(shorterId)),
      createInterpretationThreadId(createSession(unicodeId)),
    ];

    expect(results).toEqual([
      toThreadId("thread:3:a:b:1"),
      toThreadId("thread:1:a:1"),
      toThreadId("thread:5:a😀:1:1"),
    ]);
    expect(new Set(results).size).toBe(results.length);
  });

  it("is byte-deterministic across canonical serialization and replay", () => {
    const sessionId = toSessionId("session.replay");
    const log = createEventLog(sessionId, [
      expectedThreadId(sessionId, 1),
      toThreadId("legacy.thread"),
    ]);
    const directSession = replaySessionEventLogV1(log);
    const replayedSession = replaySessionEventLogV1(
      parseSessionEventLogV1(serializeSessionEventLogV1(log))
    );

    const first = createInterpretationThreadId(directSession);
    const second = createInterpretationThreadId(directSession);
    const replayed = createInterpretationThreadId(replayedSession);

    expect(first).toBe(expectedThreadId(sessionId, 2));
    expect(second).toBe(first);
    expect(replayed).toBe(first);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(first));
  });

  it("advances after the accepted commit is serialized and replayed", () => {
    const sessionId = toSessionId("session.commit");
    const domainStore = createDomainSessionStore();
    domainStore.getState().loadEventLog(createEventLog(sessionId));
    const initialSession = domainStore.getState().session!;
    const threadId = createInterpretationThreadId(initialSession);
    const attending = attendDraft(
      createInterpretationDraft(),
      IDS.firstConcept,
      initialSession.conceptIds
    );
    const armed = armDraftIntention(attending, "echo");
    const draft = selectDraftCandidate(
      armed,
      IDS.secondConcept,
      initialSession.conceptIds
    );
    const commit = createInterpretationCommitCommand({
      domainStore,
      now: () => 100,
    });

    const result = commit({
      draft,
      threadId,
      gesture: { inputModality: "keyboard", durationMs: 500 },
    });
    const replayed = replaySessionEventLogV1(
      parseSessionEventLogV1(serializeSessionEventLogV1(result.eventLog))
    );

    expect(threadId).toBe(expectedThreadId(sessionId, 1));
    expect(replayed.threads.map((thread) => thread.id)).toEqual([threadId]);
    expect(createInterpretationThreadId(replayed)).toBe(
      expectedThreadId(sessionId, 2)
    );
  });

  it("derives identity for a concluded canonical session without commit validation", () => {
    const sessionId = toSessionId("session.concluded");
    const session = createSession(sessionId, [], true);

    expect(session.concluded).toBe(true);
    expect(createInterpretationThreadId(session)).toBe(
      expectedThreadId(sessionId, 1)
    );
  });

  it("does not mutate or retain caller-owned session and thread values", () => {
    const sessionId = toSessionId("session.mutable-view");
    const canonical = createSession(sessionId, [
      expectedThreadId(sessionId, 1),
    ]);
    const threads = [...canonical.threads];
    const session: SessionStateV1 = { ...canonical, threads };
    const snapshot = JSON.stringify(session);

    const first = createInterpretationThreadId(session);

    expect(JSON.stringify(session)).toBe(snapshot);
    expect(first).toBe(expectedThreadId(sessionId, 2));
    threads.push(
      Object.freeze({
        ...threads[0],
        id: expectedThreadId(sessionId, 2),
      })
    );
    expect(first).toBe(expectedThreadId(sessionId, 2));
    expect(createInterpretationThreadId(session)).toBe(
      expectedThreadId(sessionId, 3)
    );
  });

  it("imports and calls without clock, random, or UUID access", async () => {
    const sessionId = toSessionId("session.isolated");
    const session = createSession(sessionId);
    const dateNow = vi
      .spyOn(Date, "now")
      .mockImplementation(() => {
        throw new Error("Date.now must not be called");
      });
    const random = vi
      .spyOn(Math, "random")
      .mockImplementation(() => {
        throw new Error("Math.random must not be called");
      });
    const randomUuid = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockImplementation(() => {
        throw new Error("crypto.randomUUID must not be called");
      });

    try {
      vi.resetModules();
      const imported = await import("./createInterpretationThreadId");

      expect(imported.createInterpretationThreadId(session)).toBe(
        expectedThreadId(sessionId, 1)
      );
      expect(dateNow).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
      expect(randomUuid).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
      random.mockRestore();
      randomUuid.mockRestore();
    }
  });
});
