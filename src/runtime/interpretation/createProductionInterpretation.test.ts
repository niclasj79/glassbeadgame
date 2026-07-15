import { describe, expect, it, vi } from "vitest";
import { createSessionEvent } from "../../domain/events";
import { toConceptId, toContentPackVersion, toSessionId, toWorldId } from "../../domain/ids";
import { SESSION_EVENT_LOG_FORMAT, SESSION_EVENT_LOG_SCHEMA_VERSION } from "../../domain/replay";
import { createDomainSessionStore } from "../../state/domainSession";
import { createInterpretationDraftStore } from "../../state/interactionDraft";
import { createInterpretationPresentationStore } from "../../state/interpretationPresentation";
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
  const interpretation = createProductionInterpretation({
    domainStore,
    draftStore,
    presentationStore,
    now: () => now,
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
  return { domainStore, draftStore, presentationStore, interpretation, setNow: (value: number) => { now = value; } };
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
