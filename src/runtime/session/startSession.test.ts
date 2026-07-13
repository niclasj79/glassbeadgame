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
      insight: 1,
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

  it("retains the deprecated legacy entry only as an inactive guard", () => {
    expect(() => useStore.getState().beginSession(["mathematics", "music"])).toThrow(
      /deprecated/
    );
    expect(useStore.getState().session).toBeNull();
    expect(domainSessionStore.getState().session).toBeNull();
  });
});
