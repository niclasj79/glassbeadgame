import { describe, expect, it, vi } from "vitest";
import { serializeSessionEventLogV1 } from "../../domain/replay";
import { drawSession } from "../../game/session";
import { createDomainSessionStore } from "../../state/domainSession";
import type { SessionStartProjection } from "../../state/types";
import { themeForSession } from "../../themes";
import { createSessionStartCoordinator, LEGACY_CONTENT_PACK_VERSION } from "./createSessionStartCoordinator";

const PICKS = ["mathematics", "music"] as const;

function createHarness(options?: { now?: number; invalidTheme?: boolean }) {
  const domainStore = createDomainSessionStore();
  const draw = vi.fn((picks, seed?: number) => drawSession(picks, seed));
  const now = vi.fn(() => options?.now ?? 1_700_000_000_000);
  const selectTheme = vi.fn((seed: number, daily?: boolean) => {
    const theme = themeForSession(seed, daily);
    return options?.invalidTheme ? { ...theme, id: "" } : theme;
  });
  const projections: SessionStartProjection[] = [];
  const applyProjection = vi.fn((projection: SessionStartProjection) => {
    projections.push(projection);
  });
  const start = createSessionStartCoordinator({
    domainStore,
    draw,
    now,
    selectTheme,
    applyProjection,
  });
  return { domainStore, draw, now, selectTheme, applyProjection, projections, start };
}

describe("createSessionStartCoordinator", () => {
  it("prepares once and publishes one canonical start with its matching projection", () => {
    const harness = createHarness();
    const input = [...PICKS];
    const inputSnapshot = [...input];
    let notifications = 0;
    harness.domainStore.subscribe(() => {
      notifications += 1;
    });

    const result = harness.start(input, { seed: 12_345 });
    const event = result.eventLog.events[0];
    const projection = harness.projections[0];

    expect(input).toEqual(inputSnapshot);
    expect(harness.draw).toHaveBeenCalledOnce();
    expect(harness.draw).toHaveBeenCalledWith(PICKS, 12_345);
    expect(harness.now).toHaveBeenCalledOnce();
    expect(harness.selectTheme).toHaveBeenCalledOnce();
    expect(harness.selectTheme).toHaveBeenCalledWith(12_345, undefined);
    expect(harness.applyProjection).toHaveBeenCalledOnce();
    expect(notifications).toBe(1);
    expect(result.eventLog).toBe(harness.domainStore.getState().eventLog);
    expect(result.session).toBe(harness.domainStore.getState().session);
    expect(event).toMatchObject({
      sequence: 0,
      at: 1_700_000_000_000,
      type: "session.started",
      payload: {
        seed: "12345",
        contentPackVersion: LEGACY_CONTENT_PACK_VERSION,
        worldId: projection.themeId,
        conceptIds: projection.beadIds,
      },
    });
    expect(result.session).toMatchObject({
      sessionId: event.sessionId,
      seed: String(projection.seed),
      worldId: projection.themeId,
      conceptIds: projection.beadIds,
      at: projection.startedAt,
    });
    expect(projection).toMatchObject({
      seed: 12_345,
      disciplines: PICKS,
      threads: [],
      discoveries: [],
      motifs: [],
      score: 0,
      startedAt: 1_700_000_000_000,
      interaction: { mode: "idle", fromId: null, sticky: false, reveal: null },
      insight: 1,
      illuminationsUsed: 0,
    });
  });

  it("is byte deterministic across fresh stores with controlled inputs", () => {
    const first = createHarness({ now: 123_456 });
    const second = createHarness({ now: 123_456 });

    const firstResult = first.start(PICKS, { seed: 777, daily: false });
    const secondResult = second.start(PICKS, { seed: 777, daily: false });

    expect(serializeSessionEventLogV1(secondResult.eventLog)).toBe(
      serializeSessionEventLogV1(firstResult.eventLog)
    );
    expect(secondResult.session).toEqual(firstResult.session);
    expect(second.projections[0]).toEqual(first.projections[0]);
  });

  it("replaces the prior canonical session instead of extending its log", () => {
    const harness = createHarness();
    const first = harness.start(PICKS, { seed: 111 });
    const second = harness.start(PICKS, { seed: 222 });

    expect(second.eventLog).not.toBe(first.eventLog);
    expect(second.session).not.toBe(first.session);
    expect(second.eventLog.events).toHaveLength(1);
    expect(second.eventLog.events[0].sequence).toBe(0);
    expect(second.session.seed).toBe("222");
  });

  it("rejects invalid picks before any dependency or store is touched", () => {
    const harness = createHarness();
    const before = harness.domainStore.getState();
    let notifications = 0;
    harness.domainStore.subscribe(() => {
      notifications += 1;
    });

    expect(() => harness.start(["music", "music"])).toThrow(RangeError);
    expect(harness.draw).not.toHaveBeenCalled();
    expect(harness.now).not.toHaveBeenCalled();
    expect(harness.selectTheme).not.toHaveBeenCalled();
    expect(harness.applyProjection).not.toHaveBeenCalled();
    expect(notifications).toBe(0);
    expect(harness.domainStore.getState()).toBe(before);
  });

  it("leaves both publication targets untouched when preparation fails", () => {
    const harness = createHarness({ invalidTheme: true });
    const before = harness.domainStore.getState();
    let notifications = 0;
    harness.domainStore.subscribe(() => {
      notifications += 1;
    });

    expect(() => harness.start(PICKS, { seed: 777 })).toThrow(TypeError);
    expect(harness.draw).toHaveBeenCalledOnce();
    expect(harness.now).toHaveBeenCalledOnce();
    expect(harness.selectTheme).toHaveBeenCalledOnce();
    expect(harness.applyProjection).not.toHaveBeenCalled();
    expect(notifications).toBe(0);
    expect(harness.domainStore.getState()).toBe(before);
  });
});
