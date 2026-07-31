import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { domainSessionStore } from "../../state/domainSession";
import { useStore } from "../../state/store";
import { startSession } from "./startSession";

const fixedNow = new Date("2025-03-04T05:06:07.000Z");

describe("production session-start composition", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState(useStore.getInitialState(), true);
    domainSessionStore.setState(domainSessionStore.getInitialState(), true);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => vi.useRealTimers());

  it("publishes the canonical values and unchanged legacy presentation view", () => {
    const applySessionStart = useStore.getState().applySessionStart;
    const result = startSession(["mathematics", "music"], { seed: 12_345 });
    const legacy = useStore.getState();

    expect(result.eventLog).toBe(domainSessionStore.getState().eventLog);
    expect(result.session).toBe(domainSessionStore.getState().session);
    expect(legacy.applySessionStart).toBe(applySessionStart);
    expect(result.eventLog.events).toHaveLength(1);
    // The slice has one world, so the pack and the world are fixed.
    expect(String(result.session.contentPackVersion)).toBe("castalia.v1");
    expect(String(result.session.worldId)).toBe("castalia");
    expect(result.session.conceptIds).toHaveLength(12);
    expect(legacy).toMatchObject({ phase: "arena", lensActive: false, focusedBeadId: null });
    expect(legacy.session).toMatchObject({
      seed: 12_345,
      disciplines: ["mathematics", "music"],
      beadIds: result.session.conceptIds,
      threads: [],
      discoveries: [],
      motifs: [],
      score: 0,
      startedAt: fixedNow.getTime(),
      interaction: { mode: "idle", fromId: null, sticky: false, reveal: null },
      // Insight was a legacy score currency spent to reveal a hidden pair.
      // Nothing grants it and nothing spends it any more; it is written as zero
      // and leaves with the legacy store.
      insight: 0,
      illuminationsUsed: 0,
      themeId: result.session.worldId,
    });
  });

  it("keeps the domain session and compatibility projection out of persistence", () => {
    startSession(["mathematics", "music"], { seed: 777 });
    useStore.getState().setMuted(true);

    const persisted = JSON.parse(localStorage.getItem("gbg.v1")!) as {
      state: Record<string, unknown>;
    };
    expect(persisted.state).not.toHaveProperty("session");
    expect(persisted.state).not.toHaveProperty("eventLog");
    expect(localStorage).toHaveLength(1);
  });
});
