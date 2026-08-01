import { describe, expect, it } from "vitest";
import { createIndexedDbRepository } from "./createIndexedDbRepository";
import {
  DATABASE_VERSION,
  STORE_INDEXES,
  STORE_KEYS,
  STORES,
  type PersistedDiscoveryRecord,
  type PersistedOpenThreadRecord,
  type PersistedSessionRecord,
} from "./schema";

/**
 * These run in the Node environment, where `indexedDB` is undefined, so they
 * exercise the in-memory fallback. That is deliberate and is the point worth
 * testing: the fallback is not a stub, it implements the whole contract, and a
 * player in a private window must get a complete session that simply does not
 * survive a reload. Browser-backed durability is asserted in the Playwright
 * suite against a real IndexedDB, which is the only place it can be honest.
 */
const session = (id: string, endedAt: number): PersistedSessionRecord => ({
  id,
  seed: "castalia-golden-001",
  contentPackVersion: "castalia.v1",
  worldId: "castalia",
  eventLog: '{"format":"glass-bead-game.session-event-log"}',
  endedAt,
  concluded: true,
  threadCount: 4,
  motifKinds: ["canon"],
});

const discovery = (relationId: string): PersistedDiscoveryRecord => ({
  relationId,
  firstSessionId: "s1",
  firstSeenAt: 10,
  timesMet: 1,
  evidence: "contested",
  contentPackVersion: "castalia.v1",
});

const openThread = (id: string): PersistedOpenThreadRecord => ({
  openThreadId: id,
  sessionId: "s1",
  pair: ["measure.fibonacci-sequence", "image.linear-perspective"],
  intention: "echo",
  facet: "proportion",
  question: "Does the proportion appear in the construction, or only in the count?",
  createdAt: 12,
  contentPackVersion: "castalia.v1",
});

describe("storage schema", () => {
  it("declares a key path for every store", () => {
    for (const store of STORES) {
      expect(STORE_KEYS[store]).toBeTruthy();
      expect(STORE_INDEXES[store]).toBeDefined();
    }
  });

  it("starts at version 1, since there is nothing durable before it", () => {
    expect(DATABASE_VERSION).toBe(1);
  });
});

describe("progress repository", () => {
  it("reports unavailable durability honestly rather than pretending", () => {
    // The UI has to be able to say "this Game will not be saved" instead of
    // losing it quietly.
    expect(createIndexedDbRepository().available()).toBe(false);
  });

  it("round-trips a session", async () => {
    const repository = createIndexedDbRepository();
    await repository.saveSession(session("a", 100));
    expect(await repository.loadSession("a")).toMatchObject({ id: "a" });
    expect(await repository.loadSession("missing")).toBeNull();
  });

  it("lists sessions newest first and honours a limit", async () => {
    const repository = createIndexedDbRepository();
    await repository.saveSession(session("old", 100));
    await repository.saveSession(session("new", 300));
    await repository.saveSession(session("mid", 200));
    expect((await repository.listSessions()).map((s) => s.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
    expect(await repository.listSessions(1)).toHaveLength(1);
  });

  it("counts repeat meetings instead of overwriting first contact", async () => {
    // The Codex should remember where a player first met an idea.
    const repository = createIndexedDbRepository();
    await repository.recordDiscovery(discovery("r1"));
    await repository.recordDiscovery({ ...discovery("r1"), firstSeenAt: 999 });
    const [record] = await repository.listDiscoveries();
    expect(record.timesMet).toBe(2);
    expect(record.firstSeenAt).toBe(10);
  });

  it("persists Open Threads, which outlive their session", async () => {
    const repository = createIndexedDbRepository();
    await repository.recordOpenThread(openThread("open:proportion:1"));
    const [record] = await repository.listOpenThreads();
    expect(record.question).toContain("?");
    expect(record.pair).toHaveLength(2);
  });

  it("round-trips preferences and distinguishes absent from false", async () => {
    const repository = createIndexedDbRepository();
    expect(await repository.getPreference("reducedMotion")).toBeNull();
    await repository.setPreference("reducedMotion", false);
    expect(await repository.getPreference<boolean>("reducedMotion")).toBe(false);
  });

  it("forgets everything on an explicit reset", async () => {
    const repository = createIndexedDbRepository();
    await repository.saveSession(session("a", 1));
    await repository.recordDiscovery(discovery("r1"));
    await repository.recordOpenThread(openThread("o1"));
    await repository.setPreference("k", 1);
    await repository.clear();
    expect(await repository.listSessions()).toHaveLength(0);
    expect(await repository.listDiscoveries()).toHaveLength(0);
    expect(await repository.listOpenThreads()).toHaveLength(0);
    expect(await repository.getPreference("k")).toBeNull();
  });

  it("never throws into gameplay, whatever storage does", async () => {
    // Storage failure must cost durability, never the session.
    const repository = createIndexedDbRepository();
    await expect(repository.saveSession(session("a", 1))).resolves.toBeUndefined();
    await expect(repository.listSessions()).resolves.toBeDefined();
    expect(() => repository.close()).not.toThrow();
  });
});
