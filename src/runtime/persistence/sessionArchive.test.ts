import { describe, expect, it } from "vitest";
import { CONTENT_PACK_VERSION } from "@/content/castalia";
import { createSessionEvent, type SessionEventV1 } from "@/domain/events";
import { toSessionId, toWorldId } from "@/domain/ids";
import {
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  parseSessionEventLogV1,
  replaySessionEventLogV1,
} from "@/domain/replay";
import {
  createMemoryRepository,
  type ProgressRepository,
} from "@/platform/indexeddb/createIndexedDbRepository";
import { buildAnnotation } from "@/domain/annotation";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { GOLDEN_PATH_CONCEPTS } from "@/runtime/session/createCastaliaSessionStart";
import { createDomainSessionStore } from "@/state/domainSession";
import { archiveRecordFor, createSessionArchive } from "./sessionArchive";

const SESSION = toSessionId("session:castalia.v1:seed:archive-test");

function started() {
  return createSessionEvent({
    sessionId: SESSION,
    sequence: 0,
    at: 1_000,
    type: "session.started",
    payload: {
      seed: "seed:archive-test",
      contentPackVersion: CONTENT_PACK_VERSION,
      worldId: toWorldId("castalia"),
      conceptIds: GOLDEN_PATH_CONCEPTS,
    },
  });
}

function concluded(sequence: number) {
  return createSessionEvent({
    sessionId: SESSION,
    sequence,
    at: 2_000,
    type: "session.concluded",
    payload: {},
  });
}

const log = (events: readonly SessionEventV1[]) => ({
  format: SESSION_EVENT_LOG_FORMAT,
  schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
  events,
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The in-memory repository, reporting itself durable, as IndexedDB would. */
const durable = (): ProgressRepository => ({
  ...createMemoryRepository(),
  available: () => true,
});

function harness(repository: ProgressRepository = durable()) {
  const domainStore = createDomainSessionStore();
  let clock = 5_000;
  const archive = createSessionArchive({
    domainStore,
    repository,
    describe: (session) => buildAnnotation(session, castaliaLookup).text,
    now: () => clock,
  });
  return { domainStore, repository, archive, tick: (ms: number) => (clock += ms) };
}

/**
 * DESIGN-REVIEW-SCHELL §2. The repository had zero consumers; everything a
 * Game made was destroyed when the tab closed. These are the rules that keep
 * it: a Game is kept the moment it concludes live, it is kept as its log, and
 * a Game re-opened from the shelf is never written back.
 */
describe("the session archive", () => {
  it("keeps a Game as its log when it concludes, and says so", async () => {
    const { domainStore, repository, archive } = harness();
    domainStore.getState().loadEventLog(log([started()]));
    domainStore.getState().appendEvent(concluded(1));
    expect(archive.status.getState().status).toBe("keeping");
    await settle();

    const kept = await repository.listSessions();
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe(String(SESSION));
    expect(kept[0].concluded).toBe(true);
    expect(kept[0].endedAt).toBe(5_000);
    expect(kept[0].threadCount).toBe(0);
    expect(kept[0].annotation).toContain("Nothing has been woven yet");

    const replayed = replaySessionEventLogV1(parseSessionEventLogV1(kept[0].eventLog));
    expect(replayed.concluded).toBe(true);
    expect(String(replayed.sessionId)).toBe(String(SESSION));

    expect(archive.status.getState()).toEqual({
      sessionId: String(SESSION),
      status: "kept",
      keptAt: 5_000,
    });
    expect(await archive.listKept(1)).toHaveLength(1);
  });

  it("does not write a Game back when it is opened whole from the shelf", async () => {
    const { domainStore, repository, archive } = harness();
    domainStore.getState().loadEventLog(log([started(), concluded(1)]));
    await settle();
    expect(await repository.listSessions()).toHaveLength(0);
    expect(archive.status.getState().status).toBe("unkept");
  });

  it("ignores everything before the ending", async () => {
    const { domainStore, repository } = harness();
    domainStore.getState().loadEventLog(log([started()]));
    await settle();
    expect(await repository.listSessions()).toHaveLength(0);
  });

  it("says a Game is kept for this visit only when the browser keeps nothing between visits", async () => {
    // The memory repository is the honest fallback: it holds the Game for this
    // page and reports that it is not durable.
    const { domainStore, archive } = harness(createMemoryRepository());
    domainStore.getState().loadEventLog(log([started()]));
    domainStore.getState().appendEvent(concluded(1));
    await settle();
    expect(archive.status.getState().status).toBe("kept-for-now");
    expect(await archive.listKept()).toHaveLength(1);
  });

  it("says so when the write itself fails", async () => {
    const failing: ProgressRepository = {
      ...durable(),
      saveSession: async () => {
        throw new Error("quota");
      },
    };
    const { domainStore, archive } = harness(failing);
    domainStore.getState().loadEventLog(log([started()]));
    domainStore.getState().appendEvent(concluded(1));
    await settle();
    expect(archive.status.getState().status).toBe("unavailable");
    expect(archive.status.getState().keptAt).toBeNull();
  });

  it("stops watching when detached", async () => {
    const { domainStore, repository, archive } = harness();
    archive.detach();
    domainStore.getState().loadEventLog(log([started()]));
    domainStore.getState().appendEvent(concluded(1));
    await settle();
    expect(await repository.listSessions()).toHaveLength(0);
  });
});

describe("archiveRecordFor", () => {
  it("refuses a Game that has not concluded", () => {
    const domainStore = createDomainSessionStore();
    domainStore.getState().loadEventLog(log([started()]));
    const { session, eventLog } = domainStore.getState();
    expect(() =>
      archiveRecordFor({ session: session!, eventLog: eventLog!, annotation: "", endedAt: 1 })
    ).toThrow(RangeError);
  });

  it("is the same record every time, endedAt aside", () => {
    const domainStore = createDomainSessionStore();
    domainStore.getState().loadEventLog(log([started(), concluded(1)]));
    const { session, eventLog } = domainStore.getState();
    const first = archiveRecordFor({ session: session!, eventLog: eventLog!, annotation: "Nothing has been woven yet.", endedAt: 9 });
    const again = archiveRecordFor({ session: session!, eventLog: eventLog!, annotation: "Nothing has been woven yet.", endedAt: 9 });
    expect(again).toEqual(first);
    expect(first.motifKinds).toEqual([]);
    expect(first.worldId).toBe("castalia");
    expect(first.contentPackVersion).toBe(String(CONTENT_PACK_VERSION));
  });
});
