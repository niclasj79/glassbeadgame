import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connections } from "@/content/connections";
import type { CodexEntry } from "@/state/types";
import {
  computeMilestones,
  decodeSharedProgress,
  encodeSharedProgress,
  makeSharedProgress,
  progressFromHash,
  unlockIdsFor,
} from "./progress";
import { RANKS, nextRank, rankFor, rankProgress, totalConnections } from "./ranks";

describe("legacy rank and milestone progression", () => {
  it("characterizes every rank threshold and progress boundary", () => {
    for (let i = 0; i < RANKS.length; i++) {
      const rank = RANKS[i];
      expect(rankFor(rank.threshold)).toBe(rank);
      expect(nextRank(rank.threshold)).toBe(RANKS[i + 1] ?? null);
    }
    expect(rankProgress(0)).toBe(0);
    expect(rankProgress(3)).toBe(0.5);
    expect(rankProgress(RANKS.at(-1)!.threshold)).toBe(1);
    expect(totalConnections()).toBe(connections.length);
  });

  it("derives empty and complete-corpus milestones from the codex", () => {
    expect(computeMilestones({})).toEqual({
      firstTriad: false,
      facultiesComplete: [],
      theHundred: false,
    });

    const fullCodex = Object.fromEntries(
      connections.map((connection) => [connection.id, { firstFoundAt: 1, count: 1 }])
    ) satisfies Record<string, CodexEntry>;
    const complete = computeMilestones(fullCodex);

    expect([...complete.facultiesComplete].sort()).toEqual([
      "art",
      "history",
      "mathematics",
      "music",
      "philosophy",
      "physics",
    ]);
    expect(complete.theHundred).toBe(connections.length >= 100);
    expect(unlockIdsFor(fullCodex)).toEqual(expect.arrayContaining(
      complete.facultiesComplete.map((discipline) => `faculty-${discipline}`)
    ));
  });
});

describe("shared progress boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-03T04:05:06.000Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("round-trips sanitized progress deterministically", () => {
    const connection = connections[0];
    const progress = makeSharedProgress({
      codex: {
        [connection.id]: { firstFoundAt: 123.9, count: 2.8 },
        "unknown+pair": { firstFoundAt: 1, count: 1 },
      },
      lifetimeStats: { sessions: 4.9, totalScore: 88.2 },
      settings: { hintsSeen: { weave: true, ignored: false } },
    });
    const encoded = encodeSharedProgress(progress);

    expect(decodeSharedProgress(encoded)).toEqual({
      version: 1,
      exportedAt: Date.now(),
      codex: { [connection.id]: { firstFoundAt: 123, count: 2 } },
      lifetimeStats: { sessions: 4, totalScore: 88 },
      hintsSeen: { weave: true },
    });
    expect(progressFromHash(`#gbg=${encoded}`)).toEqual(decodeSharedProgress(encoded));
  });

  it("rejects malformed, oversized, and unsupported tokens", () => {
    expect(decodeSharedProgress("not-json")).toBeNull();
    expect(decodeSharedProgress("x".repeat(24_001))).toBeNull();
    const unsupported = btoa(JSON.stringify({ version: 2 }));
    expect(decodeSharedProgress(unsupported)).toBeNull();
  });
});
