import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSession } from "@/runtime/session";
import { domainSessionStore } from "./domainSession";
import { useStore } from "./store";

/**
 * What is left of the presentation store once the legacy progression is gone.
 *
 * The cases that characterised `addThread`, `addDiscovery`, `consecrateThreads`,
 * `mergeProgress`, `resetProgress`, the codex, the session archive, lifetime
 * totals and the daily record were deleted with the behaviour they described —
 * there is no weakened assertion left behind, because there is nothing left to
 * assert. What remains is the store's two real jobs: carrying the phase, and
 * persisting taste settings and nothing else.
 */
const fixedNow = new Date("2025-03-04T05:06:07.000Z");

describe("presentation store", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState(useStore.getInitialState(), true);
    domainSessionStore.setState(domainSessionStore.getInitialState(), true);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => vi.useRealTimers());

  it("moves to the conclusion and leaves the gesture idle", () => {
    startSession(["mathematics", "music"], { seed: 777 });
    expect(useStore.getState().phase).toBe("arena");

    useStore.getState().finishConcluding();

    const state = useStore.getState();
    expect(state.phase).toBe("conclusion");
    expect(state.session?.interaction).toEqual({
      mode: "idle",
      fromId: null,
      sticky: false,
      reveal: null,
    });
    expect(state.focusedBeadId).toBeNull();
    expect(state.pinnedInspectId).toBeNull();
  });

  it("does nothing when asked to conclude without a session", () => {
    useStore.getState().finishConcluding();
    expect(useStore.getState().phase).toBe("title");
  });

  it("drops the session when returning to the title", () => {
    startSession(["mathematics", "music"], { seed: 777 });
    useStore.getState().setFocusedBead("measure.prime-numbers");

    useStore.getState().returnToTitle();

    expect(useStore.getState()).toMatchObject({
      phase: "title",
      session: null,
      lensActive: false,
      focusedBeadId: null,
    });
  });

  it("persists settings and nothing else, and keeps device-derived values device-derived", async () => {
    startSession(["mathematics", "music"], { seed: 777 });
    useStore.getState().setMuted(true);
    useStore.getState().markHintSeen("weave");

    const envelope = JSON.parse(localStorage.getItem("gbg.v1")!) as {
      state: Record<string, unknown> & { settings: Record<string, unknown> };
      version: number;
    };
    expect(envelope.version).toBe(1);
    expect(Object.keys(envelope.state)).toEqual(["settings"]);
    expect(envelope.state.settings).toEqual({
      muted: true,
      binaural: true,
      hintsSeen: { weave: true },
    });

    localStorage.setItem(
      "gbg.v1",
      JSON.stringify({
        version: 1,
        state: {
          settings: { muted: true, binaural: false, hintsSeen: { restored: true } },
        },
      })
    );
    await useStore.persist.rehydrate();

    expect(useStore.getState().settings).toMatchObject({
      muted: true,
      binaural: false,
      hintsSeen: { restored: true },
      qualityTier: "high",
      reducedMotion: false,
    });
  });
});
