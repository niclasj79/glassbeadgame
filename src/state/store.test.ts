import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connections } from "@/content/connections";
import { resolveAttempt } from "@/game/rules";
import { startSession } from "@/runtime/session";
import { makeThread } from "@/test/fixtures";
import { domainSessionStore } from "./domainSession";
import type { MotifAward } from "./types";
import { useStore } from "./store";

const fixedNow = new Date("2025-03-04T05:06:07.000Z");

describe("legacy Zustand mutation and persistence baseline", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState(useStore.getInitialState(), true);
    domainSessionStore.setState(domainSessionStore.getInitialState(), true);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => vi.useRealTimers());

  it("starts deterministically with a supplied seed and prevents duplicate threads", () => {
    startSession(["mathematics", "music"], { seed: 777 });
    const firstSession = useStore.getState().session!;
    const thread = makeThread(firstSession.beadIds[0], firstSession.beadIds[1]);

    useStore.getState().addThread(thread);
    useStore.getState().addThread({ ...thread, createdAt: 99 });

    expect(useStore.getState().session).toMatchObject({ seed: 777, startedAt: Date.now() });
    expect(useStore.getState().session!.threads).toEqual([thread]);
  });

  it("characterizes discovery, motif, codex, insight, and consecration updates", () => {
    startSession(["mathematics", "music"], { seed: 777 });
    const connection = connections[0];
    const attempt = resolveAttempt(connection.pair[0], connection.pair[1]);
    const motif: MotifAward = { motifId: "triad", name: "Triad", points: 15, at: Date.now() };
    const faintThread = makeThread("test.faint-a", "test.faint-b");

    useStore.getState().addThread(attempt.thread);
    useStore.getState().addThread(faintThread);
    const finalized = useStore.getState().addDiscovery(attempt.discovery, [motif]);
    useStore.getState().consecrateThreads([faintThread.id], "triad");

    const state = useStore.getState();
    expect(finalized.newToCodex).toBe(true);
    expect(state.codex[connection.id]).toEqual({ firstFoundAt: Date.now(), count: 1 });
    expect(state.session).toMatchObject({
      score: attempt.discovery.points + motif.points + 3,
      insight: 3,
    });
    expect(state.session!.threads.find((thread) => thread.id === faintThread.id)?.consecratedBy)
      .toBe("triad");
  });

  it("merges transferred progress by earliest discovery and maximum totals, then resets it", () => {
    const id = connections[0].id;
    useStore.setState({
      codex: { [id]: { firstFoundAt: 200, count: 2 } },
      lifetimeStats: { sessions: 2, totalScore: 20 },
    });
    useStore.getState().mergeProgress({
      version: 1,
      exportedAt: 300,
      codex: { [id]: { firstFoundAt: 100, count: 5 } },
      lifetimeStats: { sessions: 1, totalScore: 40 },
      hintsSeen: { weave: true },
    });

    expect(useStore.getState().codex[id]).toEqual({ firstFoundAt: 100, count: 5 });
    expect(useStore.getState().lifetimeStats).toEqual({ sessions: 2, totalScore: 40 });
    expect(useStore.getState().settings.hintsSeen).toEqual({ weave: true });

    useStore.getState().resetProgress();
    expect(useStore.getState()).toMatchObject({
      phase: "title",
      codex: {},
      sessionArchive: [],
      lifetimeStats: { sessions: 0, totalScore: 0 },
      unlocks: [],
      lastDaily: null,
    });
  });

  it("caps the archive, totals completed sessions, and records the UTC daily result", () => {
    for (let index = 0; index < 13; index++) {
      vi.setSystemTime(new Date(fixedNow.getTime() + index * 1_000));
      startSession(["mathematics", "music"], {
        seed: index,
        daily: index === 12,
      });
      const session = useStore.getState().session!;
      useStore.getState().addThread(makeThread(session.beadIds[0], session.beadIds[1]));
      useStore.getState().finishConcluding();
    }

    const state = useStore.getState();
    expect(state.sessionArchive).toHaveLength(12);
    expect(state.lifetimeStats.sessions).toBe(13);
    expect(state.lastDaily).toEqual({ date: "2025-03-04", score: 0 });
  });

  it("persists only the declared durable slice and restores device-derived settings", async () => {
    startSession(["mathematics", "music"], { seed: 777 });
    useStore.getState().setMuted(true);
    useStore.getState().markHintSeen("weave");

    const envelope = JSON.parse(localStorage.getItem("gbg.v1")!) as {
      state: Record<string, unknown> & { settings: Record<string, unknown> };
      version: number;
    };
    expect(envelope.version).toBe(1);
    expect(envelope.state).not.toHaveProperty("session");
    expect(envelope.state).not.toHaveProperty("phase");
    expect(envelope.state.settings).toEqual({ muted: true, binaural: true, hintsSeen: { weave: true } });

    localStorage.setItem("gbg.v1", JSON.stringify({
      version: 1,
      state: {
        codex: {},
        sessionArchive: [],
        lifetimeStats: { sessions: 7, totalScore: 70 },
        unlocks: [],
        lastDaily: null,
        settings: { muted: true, binaural: false, hintsSeen: { restored: true } },
      },
    }));
    await useStore.persist.rehydrate();

    expect(useStore.getState().lifetimeStats).toEqual({ sessions: 7, totalScore: 70 });
    expect(useStore.getState().settings).toMatchObject({
      muted: true,
      binaural: false,
      hintsSeen: { restored: true },
      qualityTier: "high",
      reducedMotion: false,
    });
  });
});
