import { describe, expect, it } from "vitest";
import { createDomainSessionStore } from "../../state/domainSession";
import {
  CASTALIA_WORLD_ID,
  GOLDEN_PATH_CONCEPTS,
  createCastaliaSessionStart,
} from "./createCastaliaSessionStart";

const start = () => {
  let clock = 1_000;
  return createCastaliaSessionStart({
    domainStore: createDomainSessionStore(),
    now: () => (clock += 7),
  });
};

describe("Castalia session start", () => {
  it("opens a session with twelve beads across all four faculties", () => {
    const { session } = start()({ seed: "castalia-golden-001" });
    expect(session.conceptIds).toHaveLength(12);
    expect(
      new Set(session.conceptIds.map((id) => String(id).split(".")[0])).size
    ).toBe(4);
  });

  it("pins the golden path's beads so the canonical scenario is reachable", () => {
    for (const seed of ["a", "b", "castalia-golden-001", "zzz"]) {
      const { session } = start()({ seed });
      for (const conceptId of GOLDEN_PATH_CONCEPTS) {
        expect(session.conceptIds).toContain(conceptId);
      }
    }
  });

  it("derives session identity from seed and pack, never from the clock", () => {
    // The legacy id was session:${startedAt}:${seed}, so the same seed produced
    // a different identity every run and no session was reproducible from its
    // seed alone. That is what made the golden seed an approximation.
    const first = start()({ seed: "castalia-golden-001" });
    const second = start()({ seed: "castalia-golden-001" });
    expect(second.session.sessionId).toBe(first.session.sessionId);
    expect(second.session.conceptIds).toEqual(first.session.conceptIds);
  });

  it("makes a different seed a genuinely different Game", () => {
    const a = start()({ seed: "one" });
    const b = start()({ seed: "two" });
    expect(a.session.sessionId).not.toBe(b.session.sessionId);
    expect(a.session.conceptIds).not.toEqual(b.session.conceptIds);
  });

  it("pins the pack version into the log, so replay resolves the right content", () => {
    const { session } = start()({ seed: "castalia-golden-001" });
    expect(String(session.contentPackVersion)).toBe("castalia.v1");
    expect(session.worldId).toBe(CASTALIA_WORLD_ID);
  });

  it("starts empty: no threads, no outcomes, no motifs, not concluded", () => {
    const { session } = start()({ seed: "castalia-golden-001" });
    expect(session.threads).toHaveLength(0);
    expect(session.outcomes).toHaveLength(0);
    expect(session.completedMotifs).toHaveLength(0);
    expect(session.attunementActive).toBe(false);
    expect(session.concluded).toBe(false);
  });

  it("refuses an empty seed rather than inventing one", () => {
    expect(() => start()({ seed: "   " })).toThrow(RangeError);
  });

  it("can draw freely when the golden path is not pinned", () => {
    const { session } = start()({ seed: "free", pinGoldenPath: false });
    expect(session.conceptIds).toHaveLength(12);
  });
});
