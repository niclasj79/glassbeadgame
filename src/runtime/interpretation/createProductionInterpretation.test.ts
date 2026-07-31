import { describe, expect, it, vi } from "vitest";
import { createSessionEvent } from "../../domain/events";
import { toConceptId, toContentPackVersion, toSessionId, toWorldId } from "../../domain/ids";
import { SESSION_EVENT_LOG_FORMAT, SESSION_EVENT_LOG_SCHEMA_VERSION } from "../../domain/replay";
import { createDomainSessionStore } from "../../state/domainSession";
import { createInterpretationDraftStore } from "../../state/interactionDraft";
import { createInterpretationPresentationStore } from "../../state/interpretationPresentation";
import type { CuePlan } from "../cues";
import { createProductionInterpretation } from ".";

const sessionId = toSessionId("session.production-interpretation");
const fibonacci = toConceptId("math.fibonacci-sequence");
const counterpoint = toConceptId("music.counterpoint");

function harness() {
  const domainStore = createDomainSessionStore();
  const draftStore = createInterpretationDraftStore();
  const presentationStore = createInterpretationPresentationStore();
  let now = 100;
  domainStore.getState().loadEventLog({
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events: [createSessionEvent({
      sessionId,
      sequence: 0,
      at: now,
      type: "session.started",
      payload: {
        seed: "production-interpretation",
        contentPackVersion: toContentPackVersion("castalia.test.v1"),
        worldId: toWorldId("castalia"),
        conceptIds: [fibonacci, counterpoint],
      },
    })],
  });
  const setInspection = vi.fn();
  const published: CuePlan[] = [];
  const interpretation = createProductionInterpretation({
    domainStore,
    draftStore,
    presentationStore,
    now: () => now,
    publishCuePlan: (plan) => published.push(plan),
    resolveCandidateEvidence: (request) => request.session.conceptIds
      .filter((candidateId) => candidateId !== request.attendedConceptId)
      .map((candidateId) => ({
        candidateId,
        facetSupport: 0,
        topologySupport: 0,
        contextSupport: 0,
        documentedRelationPresent: false,
      })),
    setInspection,
  });
  return {
    domainStore,
    draftStore,
    presentationStore,
    interpretation,
    published,
    cueTypes: () => published.flatMap((plan) => plan.cues.map((cue) => cue.type)),
    setNow: (value: number) => { now = value; },
  };
}

describe("createProductionInterpretation", () => {
  it("routes a directional release through one canonical atomic commit", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    h.interpretation.armIntention("echo");
    h.interpretation.beginDirectionalWeave("mouse", { xViewport: 0.1, yViewport: 0.2 });
    h.setNow(150);
    h.interpretation.commitDirectionalWeave(counterpoint, { xViewport: 0.4, yViewport: 0.5 });

    expect(h.domainStore.getState().eventLog?.events.map((event) => event.type)).toEqual([
      "session.started", "bead.attended", "pair.selected", "relation.hypothesized", "thread.committed",
    ]);
    expect(h.domainStore.getState().session?.threads[0]).toMatchObject({
      pair: [fibonacci, counterpoint], intention: "echo", gesture: { inputModality: "mouse" },
    });
    expect(h.draftStore.getState().draft.stage).toBe("inactive");
    expect(h.presentationStore.getState().message).toMatch(/committed/i);
  });

  it("abandons a missed directional gesture without losing the armed draft", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    h.interpretation.armIntention("passage");
    const count = h.domainStore.getState().eventLog?.events.length;

    h.interpretation.beginDirectionalWeave("touch", { xViewport: 0.2, yViewport: 0.4 });
    h.interpretation.cancelWeave();

    expect(h.interpretation.isWeaving()).toBe(false);
    expect(h.draftStore.getState().draft).toMatchObject({
      stage: "armed",
      attendedConceptId: fibonacci,
      intention: "passage",
    });
    expect(h.domainStore.getState().eventLog?.events.length).toBe(count);
  });

  it("restores the armed draft when a directional Commit is rejected", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    h.interpretation.armIntention("echo");
    const eventCount = h.domainStore.getState().eventLog?.events.length;
    const message = h.presentationStore.getState().message;
    h.interpretation.beginDirectionalWeave("mouse");
    h.setNow(50);

    expect(() =>
      h.interpretation.commitDirectionalWeave(counterpoint)
    ).toThrow();
    expect(h.interpretation.isWeaving()).toBe(false);
    expect(h.draftStore.getState().draft).toMatchObject({
      stage: "armed",
      attendedConceptId: fibonacci,
      intention: "echo",
    });
    expect(h.presentationStore.getState().message).toBe(message);
    expect(h.presentationStore.getState().failureMessage).toMatch(
      /Commit was not completed.+interpretation is still held/i
    );
    expect(h.domainStore.getState().eventLog?.events.length).toBe(eventCount);
    expect(h.domainStore.getState().session?.threads).toHaveLength(0);
  });

  it("cancels one level at a time without durable writes", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    h.interpretation.armIntention("tension");
    const count = h.domainStore.getState().eventLog?.events.length;
    expect(h.interpretation.cancel().stage).toBe("attending");
    expect(h.interpretation.cancel().stage).toBe("inactive");
    expect(h.domainStore.getState().eventLog?.events.length).toBe(count);
  });

  /**
   * GAP-B2. `planAttention`, `planAttentionCleared` and `planIntentionArmed`
   * were exported, unit-tested and never published by anything: three of the
   * four loop moments reached a store field and an aria string and stopped
   * there, so the scene, the camera and the haptics channel could not know the
   * player had done anything until a thread was committed.
   */
  describe("stages every draft transition on the cue bus", () => {
    it("publishes attention with relation-neutral bands only", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);

      expect(h.cueTypes()).toEqual(["attention.enter"]);
      const cue = h.published[0].cues[0];
      expect(cue.type).toBe("attention.enter");
      if (cue.type !== "attention.enter") throw new Error("unreachable");
      expect(cue.payload.conceptId).toBe(fibonacci);
      expect(cue.payload.candidates).toEqual([
        { conceptId: counterpoint, band: "weak" },
      ]);
      // A preview may suggest possibility, never correctness (CAV-004).
      expect(JSON.stringify(cue.payload)).not.toMatch(
        /documented|strength|support|score/i
      );
      // Ephemeral: no durable mutation is implied by a draft transition.
      expect(cue.sourceEventId).toBeNull();
    });

    it("publishes arming immediately, naming the attended bead", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);
      h.interpretation.armIntention("tension");

      expect(h.cueTypes()).toEqual(["attention.enter", "intention.armed"]);
      const cue = h.published[1].cues[0];
      if (cue.type !== "intention.armed") throw new Error("unreachable");
      expect(cue.payload).toEqual({
        conceptId: fibonacci,
        intention: "tension",
      });
      // Spec §8 — the preview changes now, not after the next frame of state.
      expect(cue.startAt).toBe(0);
    });

    it("publishes attention cleared only when attention is actually released", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);
      h.interpretation.armIntention("echo");
      h.interpretation.cancel();

      // Stepping back from armed to attending is not a release.
      expect(h.cueTypes()).toEqual(["attention.enter", "intention.armed"]);

      h.interpretation.cancel();
      expect(h.cueTypes()).toEqual([
        "attention.enter",
        "intention.armed",
        "attention.clear",
      ]);
    });

    it("stages nothing extra for an abandoned weave", () => {
      const h = harness();
      h.interpretation.activateConcept(fibonacci);
      h.interpretation.armIntention("passage");
      const before = h.cueTypes().length;
      h.interpretation.beginDirectionalWeave("touch", { xViewport: 0.2, yViewport: 0.4 });
      h.interpretation.cancelWeave();
      expect(h.cueTypes()).toHaveLength(before);
    });
  });

  it("bounds capture and clears it on reset", () => {
    const h = harness();
    h.interpretation.activateConcept(fibonacci);
    h.interpretation.armIntention("ground");
    h.interpretation.activateConcept(counterpoint);
    h.interpretation.beginWeave("pen");
    for (let index = 1; index <= 200; index += 1) {
      h.setNow(100 + index);
      h.interpretation.updateWeave({ xViewport: index / 200, yViewport: 0.5, pressure: 0.5 });
    }
    expect(h.interpretation.isWeaving()).toBe(true);
    h.interpretation.reset();
    expect(h.interpretation.isWeaving()).toBe(false);
    expect(h.draftStore.getState().draft.stage).toBe("inactive");
  });
});
