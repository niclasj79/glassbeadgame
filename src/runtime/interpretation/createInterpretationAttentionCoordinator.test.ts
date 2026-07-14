import { describe, expect, it, vi } from "vitest";
import { createSessionEvent, type SessionEventV1 } from "../../domain/events";
import {
  CandidateResonanceError,
  type CandidateResonanceErrorCode,
  type CandidateResonanceEvidence,
} from "../../domain/relations/resonance";
import {
  eventIdFor,
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toWorldId,
} from "../../domain/ids";
import {
  createFullSessionEventSequenceV1,
  FULL_SESSION_FIXTURE_IDS,
} from "../../domain/reducer";
import {
  serializeSessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  SessionEventLogError,
} from "../../domain/replay";
import {
  createDomainSessionStore,
  type DomainSessionStore,
} from "../../state/domainSession";
import {
  createInterpretationDraftStore,
  type InterpretationDraftStore,
} from "../../state/interactionDraft";
import { AttendConceptCommandError } from "../commands/attention";
import type { InterpretationDraft } from "../interactionDraft";
import {
  createInterpretationAttentionCoordinator,
  type CandidateEvidenceResolutionRequest,
  type ResolveCandidateEvidence,
} from ".";

const IDS = Object.freeze({
  session: toSessionId("session.interpretive-attention"),
  fibonacci: toConceptId("math.fibonacci-sequence"),
  counterpoint: toConceptId("music.counterpoint"),
  primeNumbers: toConceptId("math.prime-numbers"),
  unknown: toConceptId("unknown.concept"),
});

const START_EVENT = createSessionEvent({
  sessionId: IDS.session,
  sequence: 0,
  at: 100,
  type: "session.started",
  payload: {
    seed: "interpretive-attention-seed",
    contentPackVersion: toContentPackVersion("castalia.test.v1"),
    worldId: toWorldId("castalia"),
    conceptIds: [IDS.fibonacci, IDS.counterpoint, IDS.primeNumbers],
  },
});

function loadEvents(
  store: DomainSessionStore,
  events: readonly SessionEventV1[]
): void {
  store.getState().loadEventLog({
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events,
  });
}

function evidenceFor(
  request: CandidateEvidenceResolutionRequest
): readonly CandidateResonanceEvidence[] {
  return request.session.conceptIds
    .filter((candidateId) => candidateId !== request.attendedConceptId)
    .map((candidateId) => {
      if (candidateId === IDS.counterpoint) {
        return {
          candidateId,
          facetSupport: 1,
          topologySupport: 1,
          contextSupport: 1,
          documentedRelationPresent: true,
        };
      }
      if (candidateId === IDS.primeNumbers) {
        return {
          candidateId,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 2,
          documentedRelationPresent: false,
        };
      }
      return {
        candidateId,
        facetSupport: 0,
        topologySupport: 0,
        contextSupport: 0,
        documentedRelationPresent: false,
      };
    });
}

function createHarness(
  resolver: ResolveCandidateEvidence = vi.fn(evidenceFor),
  nowValue = 250
) {
  const domainStore = createDomainSessionStore();
  const draftStore = createInterpretationDraftStore();
  loadEvents(domainStore, [START_EVENT]);
  const now = vi.fn(() => nowValue);
  const attend = createInterpretationAttentionCoordinator({
    domainStore,
    draftStore,
    now,
    resolveCandidateEvidence: resolver,
  });
  return { attend, domainStore, draftStore, now, resolver };
}

function advanceDraft(
  store: InterpretationDraftStore,
  stage: Exclude<InterpretationDraft["stage"], "inactive">
): void {
  const conceptIds = START_EVENT.payload.conceptIds;
  store.getState().attend(IDS.fibonacci, conceptIds);
  if (stage === "attending") return;
  store.getState().armIntention("echo");
  if (stage === "armed") return;
  store.getState().selectCandidate(IDS.counterpoint, conceptIds);
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("createInterpretationAttentionCoordinator", () => {
  it("creates an isolated coordinator without reading dependencies or publishing", () => {
    const domainStore = createDomainSessionStore();
    const draftStore = createInterpretationDraftStore();
    loadEvents(domainStore, [START_EVENT]);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const now = vi.fn(() => 250);
    const resolver = vi.fn(evidenceFor);
    let domainNotifications = 0;
    let draftNotifications = 0;
    domainStore.subscribe(() => {
      domainNotifications += 1;
    });
    draftStore.subscribe(() => {
      draftNotifications += 1;
    });

    const attend = createInterpretationAttentionCoordinator({
      domainStore,
      draftStore,
      now,
      resolveCandidateEvidence: resolver,
    });

    expect(typeof attend).toBe("function");
    expect(now).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
    expect(domainNotifications).toBe(0);
    expect(draftNotifications).toBe(0);
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it("publishes one complete interpretive Attend in draft-then-domain order", () => {
    const resolver = vi.fn(evidenceFor);
    const { attend, domainStore, draftStore, now } = createHarness(resolver);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const publicationOrder: string[] = [];
    draftStore.subscribe(() => publicationOrder.push("draft"));
    domainStore.subscribe(() => publicationOrder.push("domain"));

    const result = attend(IDS.fibonacci);
    const domainPublished = domainStore.getState();
    const draftPublished = draftStore.getState();

    expect(now).toHaveBeenCalledOnce();
    expect(resolver).toHaveBeenCalledOnce();
    expect(resolver.mock.calls[0][0]).toEqual({
      attendedConceptId: IDS.fibonacci,
      session: domainBefore.session,
    });
    expect(resolver.mock.calls[0][0].session).toBe(domainBefore.session);
    expect(Object.isFrozen(resolver.mock.calls[0][0])).toBe(true);
    expect(publicationOrder).toEqual(["draft", "domain"]);
    expect(result.event).toEqual({
      schemaVersion: 1,
      id: eventIdFor(IDS.session, 1),
      sessionId: IDS.session,
      sequence: 1,
      at: 250,
      type: "bead.attended",
      payload: { conceptId: IDS.fibonacci },
    });
    expect(result.eventLog).toBe(domainPublished.eventLog);
    expect(result.session).toBe(domainPublished.session);
    expect(result.draft).toBe(draftPublished.draft);
    expect(result.draft).toEqual({
      stage: "attending",
      attendedConceptId: IDS.fibonacci,
    });
    expect(result.candidateResonance).toEqual([
      { candidateId: IDS.counterpoint, band: "high" },
      { candidateId: IDS.primeNumbers, band: "medium" },
    ]);
    expect(result.session.attendedConceptId).toBe(IDS.fibonacci);
    expect(result.eventLog.events).toHaveLength(2);
    expect(result.eventLog.events.at(-1)).toEqual(result.event);
    expect(domainPublished.appendEvent).toBe(domainBefore.appendEvent);
    expect(draftPublished.attend).toBe(draftBefore.attend);
    expectDeeplyFrozen(result);
    expectDeeplyFrozen(domainBefore.eventLog);
    expectDeeplyFrozen(domainBefore.session);
    expectDeeplyFrozen(draftBefore.draft);
  });

  it.each(["attending", "armed", "candidate-selected"] as const)(
    "re-Attends from %s by discarding only provisional draft state",
    (stage) => {
      const { attend, domainStore, draftStore } = createHarness();
      advanceDraft(draftStore, stage);
      const priorDraft = draftStore.getState().draft;
      const domainBefore = domainStore.getState();

      const result = attend(IDS.primeNumbers);

      expect(result.draft).toEqual({
        stage: "attending",
        attendedConceptId: IDS.primeNumbers,
      });
      expect(result.eventLog.events).toHaveLength(2);
      expect(result.eventLog.events.at(-1)?.type).toBe("bead.attended");
      expect(result.session.selectedPair).toBe(domainBefore.session?.selectedPair);
      expect(result.session.hypothesis).toBe(domainBefore.session?.hypothesis);
      expect(result.session.threads).toEqual(domainBefore.session?.threads);
      expect(result.session.outcomes).toEqual(domainBefore.session?.outcomes);
      expectDeeplyFrozen(priorDraft);
    }
  );

  it("propagates no-active-session before clock, evidence, or publication", () => {
    const domainStore = createDomainSessionStore();
    const draftStore = createInterpretationDraftStore();
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const now = vi.fn(() => 250);
    const resolver = vi.fn(evidenceFor);
    const attend = createInterpretationAttentionCoordinator({
      domainStore,
      draftStore,
      now,
      resolveCandidateEvidence: resolver,
    });
    let domainNotifications = 0;
    let draftNotifications = 0;
    domainStore.subscribe(() => {
      domainNotifications += 1;
    });
    draftStore.subscribe(() => {
      draftNotifications += 1;
    });
    let thrown: unknown;

    try {
      attend(IDS.fibonacci);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AttendConceptCommandError);
    expect(thrown).toMatchObject({ code: "no-active-session" });
    expect(now).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
    expect(domainNotifications).toBe(0);
    expect(draftNotifications).toBe(0);
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it("propagates unknown-concept replay rejection before evidence or publication", () => {
    const resolver = vi.fn(evidenceFor);
    const { attend, domainStore, draftStore, now } = createHarness(resolver);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    let domainNotifications = 0;
    let draftNotifications = 0;
    domainStore.subscribe(() => {
      domainNotifications += 1;
    });
    draftStore.subscribe(() => {
      draftNotifications += 1;
    });
    let thrown: unknown;

    try {
      attend(IDS.unknown);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SessionEventLogError);
    expect(thrown).toMatchObject({
      code: "replay-transition",
      transitionCode: "unknown-concept",
    });
    expect(now).toHaveBeenCalledOnce();
    expect(resolver).not.toHaveBeenCalled();
    expect(domainNotifications).toBe(0);
    expect(draftNotifications).toBe(0);
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it.each([
    {
      label: "concluded session",
      events: createFullSessionEventSequenceV1(),
      conceptId: FULL_SESSION_FIXTURE_IDS.fibonacciId,
      at: 1_400,
      transitionCode: "invalid-lifecycle",
    },
    {
      label: "regressed clock",
      events: [START_EVENT],
      conceptId: IDS.fibonacci,
      at: 99,
      transitionCode: "relative-time-regression",
    },
  ] as const)(
    "preflights $label before evidence or publication",
    ({ events, conceptId, at, transitionCode }) => {
      const domainStore = createDomainSessionStore();
      const draftStore = createInterpretationDraftStore();
      loadEvents(domainStore, events);
      const domainBefore = domainStore.getState();
      const draftBefore = draftStore.getState();
      const now = vi.fn(() => at);
      const resolver = vi.fn(evidenceFor);
      const attend = createInterpretationAttentionCoordinator({
        domainStore,
        draftStore,
        now,
        resolveCandidateEvidence: resolver,
      });
      let domainNotifications = 0;
      let draftNotifications = 0;
      domainStore.subscribe(() => {
        domainNotifications += 1;
      });
      draftStore.subscribe(() => {
        draftNotifications += 1;
      });
      let thrown: unknown;

      try {
        attend(conceptId);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(SessionEventLogError);
      expect(thrown).toMatchObject({
        code: "replay-transition",
        transitionCode,
      });
      expect(now).toHaveBeenCalledOnce();
      expect(resolver).not.toHaveBeenCalled();
      expect(domainNotifications).toBe(0);
      expect(draftNotifications).toBe(0);
      expect(domainStore.getState()).toBe(domainBefore);
      expect(draftStore.getState()).toBe(draftBefore);
    }
  );

  it("propagates invalid captured time before evidence or publication", () => {
    const domainStore = createDomainSessionStore();
    const draftStore = createInterpretationDraftStore();
    loadEvents(domainStore, [START_EVENT]);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    const now = vi.fn(() => Number.NaN);
    const resolver = vi.fn(evidenceFor);
    const attend = createInterpretationAttentionCoordinator({
      domainStore,
      draftStore,
      now,
      resolveCandidateEvidence: resolver,
    });
    let domainNotifications = 0;
    let draftNotifications = 0;
    domainStore.subscribe(() => {
      domainNotifications += 1;
    });
    draftStore.subscribe(() => {
      draftNotifications += 1;
    });

    expect(() => attend(IDS.fibonacci)).toThrow(RangeError);

    expect(now).toHaveBeenCalledOnce();
    expect(resolver).not.toHaveBeenCalled();
    expect(domainNotifications).toBe(0);
    expect(draftNotifications).toBe(0);
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it("propagates an evidence resolver failure without publishing prepared state", () => {
    const failure = new Error("evidence unavailable");
    const resolver = vi.fn(() => {
      throw failure;
    });
    const { attend, domainStore, draftStore, now } = createHarness(resolver);
    const domainBefore = domainStore.getState();
    const draftBefore = draftStore.getState();
    let domainNotifications = 0;
    let draftNotifications = 0;
    domainStore.subscribe(() => {
      domainNotifications += 1;
    });
    draftStore.subscribe(() => {
      draftNotifications += 1;
    });

    expect(() => attend(IDS.fibonacci)).toThrow(failure);

    expect(now).toHaveBeenCalledOnce();
    expect(resolver).toHaveBeenCalledOnce();
    expect(domainNotifications).toBe(0);
    expect(draftNotifications).toBe(0);
    expect(domainStore.getState()).toBe(domainBefore);
    expect(draftStore.getState()).toBe(draftBefore);
  });

  it.each([
    {
      label: "invalid candidate identity",
      code: "invalid-candidate-identity",
      resolve: () => [
        {
          candidateId: IDS.counterpoint,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        },
        {
          candidateId: IDS.counterpoint,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        },
        {
          candidateId: IDS.primeNumbers,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        },
      ],
    },
    {
      label: "incomplete candidate coverage",
      code: "incomplete-candidate-coverage",
      resolve: () => [
        {
          candidateId: IDS.counterpoint,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        },
      ],
    },
    {
      label: "invalid support",
      code: "invalid-support-level",
      resolve: () => [
        {
          candidateId: IDS.counterpoint,
          facetSupport: 3,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        },
        {
          candidateId: IDS.primeNumbers,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        },
      ],
    },
    {
      label: "invalid documented-relation presence",
      code: "invalid-documented-relation-presence",
      resolve: () => [
        {
          candidateId: IDS.counterpoint,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: 1,
        },
        {
          candidateId: IDS.primeNumbers,
          facetSupport: 0,
          topologySupport: 0,
          contextSupport: 0,
          documentedRelationPresent: false,
        },
      ],
    },
  ] as const)(
    "propagates $label without publishing",
    ({ code, resolve }) => {
      const resolver = vi.fn(
        resolve as unknown as ResolveCandidateEvidence
      );
      const { attend, domainStore, draftStore } = createHarness(resolver);
      const domainBefore = domainStore.getState();
      const draftBefore = draftStore.getState();
      let domainNotifications = 0;
      let draftNotifications = 0;
      domainStore.subscribe(() => {
        domainNotifications += 1;
      });
      draftStore.subscribe(() => {
        draftNotifications += 1;
      });
      let thrown: unknown;

      try {
        attend(IDS.fibonacci);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(CandidateResonanceError);
      expect((thrown as CandidateResonanceError).code).toBe(
        code as CandidateResonanceErrorCode
      );
      expect(resolver).toHaveBeenCalledOnce();
      expect(domainNotifications).toBe(0);
      expect(draftNotifications).toBe(0);
      expect(domainStore.getState()).toBe(domainBefore);
      expect(draftStore.getState()).toBe(draftBefore);
    }
  );

  it("does not mutate or retain evidence and is byte deterministic", () => {
    const run = () => {
      const evidence = [
        {
          candidateId: IDS.counterpoint,
          facetSupport: 1 as const,
          topologySupport: 1 as const,
          contextSupport: 1 as const,
          documentedRelationPresent: true,
        },
        {
          candidateId: IDS.primeNumbers,
          facetSupport: 0 as const,
          topologySupport: 0 as const,
          contextSupport: 2 as const,
          documentedRelationPresent: false,
        },
      ];
      const snapshot = structuredClone(evidence);
      const resolver = vi.fn(() => evidence);
      const { attend } = createHarness(resolver);
      const result = attend(IDS.fibonacci);
      evidence.reverse();
      return { result, evidence, snapshot };
    };

    const first = run();
    const second = run();

    expect(first.evidence.slice().reverse()).toEqual(first.snapshot);
    expect(first.result.candidateResonance).toEqual([
      { candidateId: IDS.counterpoint, band: "high" },
      { candidateId: IDS.primeNumbers, band: "medium" },
    ]);
    expect(second.result).toEqual(first.result);
    expect(JSON.stringify(second.result)).toBe(JSON.stringify(first.result));
    expect(serializeSessionEventLogV1(second.result.eventLog)).toBe(
      serializeSessionEventLogV1(first.result.eventLog)
    );
    expectDeeplyFrozen(first.result);
    expectDeeplyFrozen(second.result);
  });
});
