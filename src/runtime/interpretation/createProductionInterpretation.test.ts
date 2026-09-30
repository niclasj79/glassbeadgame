import { describe, expect, it, vi } from "vitest";
import { createSessionEvent } from "../../domain/events";
import {
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toWorldId,
} from "../../domain/ids";
import { SESSION_EVENT_LOG_FORMAT, SESSION_EVENT_LOG_SCHEMA_VERSION } from "../../domain/replay";
import { toFacetId } from "../../content/castalia/schema";
import { createDomainSessionStore } from "../../state/domainSession";
import { createInterpretationDraftStore } from "../../state/interactionDraft";
import {
  createFocusPresentationStore,
  createInterpretationPresentationStore,
} from "../../state/interpretationPresentation";
import type { CuePlan } from "../cues";
import { createProductionInterpretation } from ".";

const sessionId = toSessionId("session.production-interpretation");
const fibonacci = toConceptId("math.fibonacci-sequence");
const counterpoint = toConceptId("music.counterpoint");
const primes = toConceptId("math.prime-numbers");
const recursion = toFacetId("recursion");

function harness() {
  const domainStore = createDomainSessionStore();
  const draftStore = createInterpretationDraftStore();
  const presentationStore = createInterpretationPresentationStore();
  const focusStore = createFocusPresentationStore();
  let now = 100;
  domainStore.getState().loadEventLog({
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events: [
      createSessionEvent({
        sessionId,
        sequence: 0,
        at: now,
        type: "session.started",
        payload: {
          seed: "production-interpretation",
          contentPackVersion: toContentPackVersion("castalia.test.v1"),
          worldId: toWorldId("castalia"),
          conceptIds: [fibonacci, counterpoint, primes],
        },
      }),
    ],
  });
  const setInspection = vi.fn();
  const onCommitted = vi.fn();
  const published: CuePlan[] = [];
  const interpretation = createProductionInterpretation({
    domainStore,
    draftStore,
    presentationStore,
    focusStore,
    now: () => now,
    publishCuePlan: (plan) => published.push(plan),
    resolveCandidateEvidence: (request) =>
      request.session.conceptIds
        .filter((candidateId) => candidateId !== request.attendedConceptId)
        .map((candidateId) => ({
          candidateId,
          facetSupport: candidateId === counterpoint ? 2 : 0,
          topologySupport: candidateId === counterpoint ? 2 : 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        })),
    sharedFacets: (a, b) =>
      (a === fibonacci && b === counterpoint) || (a === counterpoint && b === fibonacci)
        ? [recursion]
        : [],
    setInspection,
    onCommitted,
  });
  return {
    domainStore,
    draftStore,
    presentationStore,
    focusStore,
    interpretation,
    published,
    onCommitted,
    cueTypes: () => published.flatMap((plan) => plan.cues.map((cue) => cue.type)),
    eventTypes: () => domainStore.getState().eventLog?.events.map((event) => event.type),
    setNow: (value: number) => {
      now = value;
    },
  };
}

/** Attend Fibonacci, sweep toward Counterpoint, lock it, choose a reading. */
function toReading(h: ReturnType<typeof harness>, intention: "echo" | "ground" = "echo") {
  h.interpretation.activateConcept(fibonacci);
  h.setNow(110);
  h.interpretation.recordApproach({ xViewport: 0.2, yViewport: 0.8 }, "mouse");
  h.setNow(130);
  h.interpretation.recordApproach({ xViewport: 0.4, yViewport: 0.6 }, "mouse");
  h.setNow(160);
  h.interpretation.recordApproach({ xViewport: 0.7, yViewport: 0.3 }, "mouse");
  h.interpretation.sight(counterpoint);
  h.interpretation.activateConcept(counterpoint);
  h.interpretation.chooseReading(intention);
}

describe("createProductionInterpretation — the focus view", () => {
  it("attends, locks and reads before anything durable is written", () => {
    const h = harness();

    expect(h.interpretation.activateConcept(fibonacci).stage).toBe("attending");
    expect(h.interpretation.activateConcept(counterpoint)).toMatchObject({
      stage: "locked",
      pair: [fibonacci, counterpoint],
    });
    expect(h.interpretation.chooseReading("echo")).toMatchObject({
      stage: "reading",
      intention: "echo",
    });
    // Attention collapses to the latest; nothing provisional is in the log.
    expect(h.eventTypes()).toEqual(["session.started", "bead.attended"]);
  });

  it("commits the unchanged atomic batch: approach geometry, hold duration", () => {
    const h = harness();
    toReading(h, "echo");
    h.setNow(1_000);
    h.interpretation.beginHold("mouse", { xViewport: 0.5, yViewport: 0.5 });
    h.setNow(1_450);
    h.interpretation.commitHold({ xViewport: 0.5, yViewport: 0.5 });

    expect(h.eventTypes()).toEqual([
      "session.started",
      "bead.attended",
      "pair.selected",
      "relation.hypothesized",
      "thread.committed",
    ]);
    const thread = h.domainStore.getState().session?.threads[0];
    expect(thread).toMatchObject({
      pair: [fibonacci, counterpoint],
      intention: "echo",
      gesture: { inputModality: "mouse", durationMs: 450 },
    });
    expect(thread?.gesture.pathLengthViewport).toBeGreaterThan(0);
    expect(Object.keys(thread!.gesture).sort()).toEqual([
      "averageSpeedViewportPerSecond",
      "curvature",
      "durationMs",
      "inputModality",
      "pathLengthViewport",
      "speedVariance",
    ]);
    expect(h.draftStore.getState().draft.stage).toBe("inactive");
    expect(h.onCommitted).toHaveBeenCalledWith(thread?.id);
    expect(h.presentationStore.getState().message).toMatch(/committed/i);
  });

  it("never lends a pointer's approach to a keyboard hold (I-009)", () => {
    const h = harness();
    toReading(h, "ground");
    h.setNow(2_000);
    h.interpretation.beginHold("keyboard");
    h.setNow(2_300);
    h.interpretation.commitHold();

    expect(h.domainStore.getState().session?.threads[0].gesture).toEqual({
      inputModality: "keyboard",
      durationMs: 300,
    });
  });

  it("chooses the pressed reading when the hold begins on a sigil", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    h.interpretation.activateConcept(counterpoint);
    h.setNow(500);
    h.interpretation.beginHold("touch", undefined, "ground");
    h.setNow(700);
    h.interpretation.commitHold();

    expect(h.domainStore.getState().session?.threads[0]).toMatchObject({
      intention: "ground",
      gesture: { inputModality: "touch", durationMs: 200 },
    });
  });

  it("refuses to hold without a chosen reading", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    h.interpretation.activateConcept(counterpoint);
    expect(() => h.interpretation.beginHold("mouse")).toThrow(/reading/);
    expect(h.interpretation.isHolding()).toBe(false);
  });

  it("steps back one stage per Cancel: hold, read, lock, attend", () => {
    const h = harness();
    toReading(h, "echo");
    h.interpretation.beginHold("mouse");
    const count = h.eventTypes()?.length;

    expect(h.interpretation.cancel().stage).toBe("reading");
    expect(h.interpretation.isHolding()).toBe(false);
    expect(h.interpretation.cancel().stage).toBe("locked");
    expect(h.interpretation.cancel().stage).toBe("attending");
    expect(h.interpretation.cancel().stage).toBe("inactive");
    expect(h.eventTypes()?.length).toBe(count);
  });

  it("replaces the second bead when another is activated during a lock", () => {
    const h = harness();
    toReading(h, "echo");
    expect(h.interpretation.activateConcept(primes)).toMatchObject({
      stage: "locked",
      pair: [fibonacci, primes],
    });
    // Activating a bead already in the pair changes nothing.
    expect(h.interpretation.activateConcept(fibonacci).stage).toBe("locked");
  });

  it("re-Attends explicitly from any stage and discards the draft", () => {
    const h = harness();
    toReading(h, "echo");
    expect(h.interpretation.attendConcept(primes)).toEqual({
      stage: "attending",
      attendedConceptId: primes,
    });
    expect(h.focusStore.getState().sightedConceptId).toBeNull();
  });

  it("restores the held reading when a Commit is rejected", () => {
    const h = harness();
    toReading(h, "echo");
    const eventCount = h.eventTypes()?.length;
    const message = h.presentationStore.getState().message;
    h.setNow(2_000);
    h.interpretation.beginHold("mouse");
    h.setNow(1_000); // the clock runs backwards: the gesture cannot validate

    expect(() => h.interpretation.commitHold()).toThrow();
    expect(h.interpretation.isHolding()).toBe(false);
    expect(h.draftStore.getState().draft).toMatchObject({
      stage: "reading",
      intention: "echo",
    });
    expect(h.presentationStore.getState().message).toBe(message);
    expect(h.presentationStore.getState().failureMessage).toMatch(
      /Commit was not completed.+interpretation is still held/i
    );
    expect(h.eventTypes()?.length).toBe(eventCount);
  });

  describe("stages every look and choice on the cue bus", () => {
    it("publishes attention with relation-neutral bands only", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);

      expect(h.cueTypes()).toEqual(["attention.enter"]);
      const cue = h.published[0].cues[0];
      if (cue.type !== "attention.enter") throw new Error("unreachable");
      expect(cue.payload.candidates).toEqual([
        { conceptId: counterpoint, band: "high" },
        { conceptId: primes, band: "weak" },
      ]);
      expect(JSON.stringify(cue.payload)).not.toMatch(/documented|strength|support|score/i);
      expect(cue.sourceEventId).toBeNull();
    });

    it("publishes a sighting with its band and public shared facets, once per change", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);
      h.interpretation.sight(counterpoint);
      h.interpretation.sight(counterpoint);
      h.interpretation.sight(primes);
      h.interpretation.sight(null);
      h.interpretation.sight(fibonacci); // the attended bead is not a sighting

      expect(h.cueTypes()).toEqual([
        "attention.enter",
        "attention.sighted",
        "attention.sighted",
        "attention.sighted",
      ]);
      const first = h.published[1].cues[0];
      if (first.type !== "attention.sighted") throw new Error("unreachable");
      expect(first.payload).toEqual({
        attendedConceptId: fibonacci,
        sighted: { conceptId: counterpoint, band: "high", sharedFacets: [recursion] },
      });
      expect(JSON.stringify(first.payload)).not.toMatch(/documented|relation|score/i);
      expect(h.focusStore.getState().sightedConceptId).toBeNull();
    });

    it("ignores sighting and approach samples outside Attend", () => {
      const h = harness();
      h.interpretation.sight(counterpoint);
      h.interpretation.recordApproach({ xViewport: 0.1, yViewport: 0.1 }, "mouse");
      expect(h.cueTypes()).toEqual([]);
      expect(h.focusStore.getState().sightedConceptId).toBeNull();
    });

    it("publishes the lock, hovered previews, and a chosen reading", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);
      h.interpretation.activateConcept(counterpoint);
      h.interpretation.previewReading("tension");
      h.interpretation.previewReading("tension");
      h.interpretation.previewReading(null);
      h.interpretation.chooseReading("echo");
      h.interpretation.chooseReading("echo");

      expect(h.cueTypes()).toEqual([
        "attention.enter",
        "pair.locked",
        "reading.previewed",
        "reading.previewed",
      ]);
      const locked = h.published[1].cues[0];
      if (locked.type !== "pair.locked") throw new Error("unreachable");
      expect(locked.payload).toEqual({
        pair: [fibonacci, counterpoint],
        sharedFacets: [recursion],
      });
      const hovered = h.published[2].cues[0];
      const chosen = h.published[3].cues[0];
      if (hovered.type !== "reading.previewed" || chosen.type !== "reading.previewed") {
        throw new Error("unreachable");
      }
      expect(hovered.payload).toMatchObject({ intention: "tension", chosen: false });
      expect(chosen.payload).toMatchObject({ intention: "echo", chosen: true });
      // A hover is a look: no camera, no hand.
      expect(hovered.channels).not.toContain("camera");
      expect(hovered.channels).not.toContain("haptics");
      expect(h.focusStore.getState().previewIntention).toBeNull();
    });

    it("releases attention only when the whole draft is released", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);
      h.interpretation.activateConcept(counterpoint);
      h.interpretation.cancel();
      expect(h.cueTypes()).toEqual(["attention.enter", "pair.locked"]);
      h.interpretation.cancel();
      expect(h.cueTypes()).toEqual(["attention.enter", "pair.locked", "attention.clear"]);
    });
  });

  describe("reopening a committed thread (I-019)", () => {
    function committed() {
      const h = harness();
      toReading(h, "echo");
      h.setNow(3_000);
      h.interpretation.beginHold("mouse");
      h.setNow(3_200);
      h.interpretation.commitHold();
      return h;
    }

    it("reopens for reading without touching the log, and Escape closes it", () => {
      const h = committed();
      const threadId = h.domainStore.getState().session!.threads[0].id;
      const count = h.eventTypes()?.length;

      h.interpretation.reopenThread(threadId);
      expect(h.focusStore.getState().reopened).toEqual({
        threadId,
        pair: [fibonacci, counterpoint],
      });
      const cue = h.published[h.published.length - 1].cues[0];
      if (cue.type !== "thread.reopened") throw new Error("unreachable");
      expect(cue.payload).toEqual({
        threadId,
        pair: [fibonacci, counterpoint],
        intention: "echo",
      });

      expect(h.interpretation.cancel().stage).toBe("inactive");
      expect(h.focusStore.getState().reopened).toBeNull();
      expect(h.eventTypes()?.length).toBe(count);
    });

    it("is a no-op while an interpretation is being made, and Attend closes it", () => {
      const h = committed();
      const threadId = h.domainStore.getState().session!.threads[0].id;
      h.interpretation.reopenThread(threadId);
      h.interpretation.activateConcept(primes);
      expect(h.focusStore.getState().reopened).toBeNull();

      const before = h.cueTypes().length;
      h.interpretation.reopenThread(threadId);
      expect(h.cueTypes()).toHaveLength(before);
    });
  });

  it("dwells only while roaming", () => {
    const h = harness();
    h.interpretation.dwell(primes);
    expect(h.focusStore.getState().dwellConceptId).toBe(primes);
    h.interpretation.activateConcept(fibonacci);
    expect(h.focusStore.getState().dwellConceptId).toBeNull();
    h.interpretation.dwell(counterpoint);
    expect(h.focusStore.getState().dwellConceptId).toBeNull();
  });

  it("bounds both captures and clears everything on reset", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    for (let index = 1; index <= 200; index += 1) {
      h.setNow(100 + index);
      h.interpretation.recordApproach({ xViewport: index / 200, yViewport: 0.5 }, "pen");
    }
    h.interpretation.activateConcept(counterpoint);
    h.interpretation.chooseReading("ground");
    h.setNow(1_000);
    h.interpretation.beginHold("pen");
    for (let index = 1; index <= 200; index += 1) {
      h.setNow(1_000 + index);
      h.interpretation.updateHold({ xViewport: index / 200, yViewport: 0.5, pressure: 0.5 });
    }
    expect(h.interpretation.isHolding()).toBe(true);
    h.interpretation.reset();
    expect(h.interpretation.isHolding()).toBe(false);
    expect(h.draftStore.getState().draft.stage).toBe("inactive");
    expect(h.focusStore.getState()).toMatchObject({
      sightedConceptId: null,
      dwellConceptId: null,
      previewIntention: null,
      reopened: null,
    });
  });
});
