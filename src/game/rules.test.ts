import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concepts } from "@/content/concepts";
import { connectionByPair, connections } from "@/content/connections";
import { pairKey } from "@/content/types";
import { makeSession, makeThread } from "@/test/fixtures";
import {
  CONSECRATION_POINTS,
  TIER_POINTS,
  composeFaintInsight,
  consecrateComponent,
  detectNewMotifs,
  faintPoints,
  pickIlluminationTarget,
  resolveAttempt,
} from "./rules";
import { drawSession } from "./session";

function firstFaintPair(): [string, string] {
  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      if (!connectionByPair.has(pairKey(concepts[i].id, concepts[j].id))) {
        return [concepts[i].id, concepts[j].id];
      }
    }
  }
  throw new Error("expected at least one faint pair");
}

describe("legacy attempt rules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-02T03:04:05.000Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("resolves curated pairs through the canonical connection index", () => {
    const connection = connections[0];
    const result = resolveAttempt(connection.pair[1], connection.pair[0]);

    expect(result.thread).toMatchObject({
      id: connection.id,
      kind: "curated",
      tier: connection.tier,
      createdAt: Date.now(),
    });
    expect(result.discovery).toMatchObject({
      id: connection.id,
      title: connection.title,
      insight: connection.insight,
      points: TIER_POINTS[connection.tier],
    });
  });

  it("characterizes deterministic faint prose and diminishing rewards", () => {
    const [a, b] = firstFaintPair();

    expect(composeFaintInsight(a, b)).toBe(composeFaintInsight(a, b));
    expect(composeFaintInsight(a, b)).not.toBe(composeFaintInsight(b, a));
    expect(resolveAttempt(a, b, 0).discovery).toMatchObject({
      kind: "faint",
      title: "Faint Resonance",
      points: 2,
    });
    expect(faintPoints(1)).toBe(2);
    expect(faintPoints(2)).toBe(1);
    expect(resolveAttempt(a, b, 9).discovery.points).toBe(1);
  });
});

describe("legacy motif rules", () => {
  it("detects a triad when the new thread closes a triangle", () => {
    const [a, b, c] = concepts.filter((concept) => concept.discipline === "mathematics").slice(0, 3);
    const session = makeSession({ threads: [makeThread(a.id, b.id), makeThread(b.id, c.id)] });
    const awards = detectNewMotifs(session, makeThread(c.id, a.id));

    expect(awards.map((award) => award.motifId)).toContain("triad");
  });

  it("detects a symposium across a three-discipline component", () => {
    const a = concepts.find((concept) => concept.discipline === "mathematics")!;
    const b = concepts.find((concept) => concept.discipline === "music")!;
    const c = concepts.find((concept) => concept.discipline === "physics")!;
    const session = makeSession({ threads: [makeThread(a.id, b.id)] });
    const awards = detectNewMotifs(session, makeThread(b.id, c.id));

    expect(awards.map((award) => award.motifId)).toContain("symposium");
  });

  it("detects a fugue when the new thread extends a simple path to five beads", () => {
    const [a, b, c, d, e] = concepts
      .filter((concept) => concept.discipline === "mathematics")
      .slice(0, 5);
    const session = makeSession({
      threads: [makeThread(a.id, b.id), makeThread(b.id, c.id), makeThread(c.id, d.id)],
    });
    const awards = detectNewMotifs(session, makeThread(d.id, e.id));

    expect(awards.map((award) => award.motifId)).toContain("fugue");
  });

  it("does not award a motif twice in one session", () => {
    const [a, b, c] = concepts.filter((concept) => concept.discipline === "mathematics").slice(0, 3);
    const session = makeSession({
      threads: [makeThread(a.id, b.id), makeThread(b.id, c.id)],
      motifs: [{ motifId: "triad", name: "Triad", points: 15, at: 0 }],
    });

    expect(detectNewMotifs(session, makeThread(c.id, a.id)).map((award) => award.motifId))
      .not.toContain("triad");
  });
});

describe("legacy graph consequences", () => {
  it("consecrates only unconsecrated faint threads in the anchor component", () => {
    const [a, b, c, d, e] = concepts.slice(0, 5);
    const anchor = makeThread(a.id, b.id);
    const eligible = makeThread(b.id, c.id);
    const curated = makeThread(c.id, d.id, "curated", 2);
    const disconnected = makeThread(d.id, e.id);
    disconnected.a = "detached-a";
    disconnected.b = "detached-b";
    disconnected.id = pairKey(disconnected.a, disconnected.b);
    const already = makeThread(a.id, c.id);
    already.consecratedBy = "triad";

    expect(consecrateComponent([anchor, eligible, curated, disconnected, already], anchor.id))
      .toEqual([anchor.id, eligible.id]);
    expect(CONSECRATION_POINTS).toBe(3);
  });

  it("selects an unwoven top-tier illumination deterministically", () => {
    const draw = drawSession(["mathematics", "music"], 12_345);
    const session = makeSession({
      seed: draw.seed,
      beadIds: draw.beadIds,
      curatedAvailable: draw.curatedAvailable,
      illuminationsUsed: 2,
    });
    const first = pickIlluminationTarget(session);
    const second = pickIlluminationTarget(session);

    expect(first).toEqual(second);
    expect(first).not.toBeNull();
    const selectedTier = connectionByPair.get(pairKey(first![0], first![1]))!.tier;
    const availableTiers = connections
      .filter((connection) => connection.pair.every((id) => draw.beadIds.includes(id)))
      .map((connection) => connection.tier);
    expect(selectedTier).toBe(Math.max(...availableTiers));
  });
});
