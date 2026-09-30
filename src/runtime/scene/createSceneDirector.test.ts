import { describe, expect, it } from "vitest";
import type { GestureProfile } from "../../domain/events";
import {
  toConceptId,
  toDocumentedRelationId,
  toEventId,
  toMotifKindId,
  toThreadId,
} from "../../domain/ids";
import {
  toFacetId,
  type DocumentedRelation,
} from "../../content/castalia/schema";
import {
  planAttention,
  planAttentionCleared,
  planCommitMoment,
  planMotifCompleted,
  planPairLocked,
  planReadingPreviewed,
  planAttunement,
  type CuePayloadMap,
  type CuePlan,
  type PresentationCue,
} from "../cues";
import { planStudyNotYet, planStudySolved } from "../cues/planCues";
import { createSceneDirector, type SceneStage } from "./createSceneDirector";

const a = toConceptId("measure.fibonacci-sequence");
const b = toConceptId("sound.counterpoint");
const threadId = toThreadId("thread.1");
const eventId = toEventId("event-0000-0000-0000-000000000001");
const gesture: GestureProfile = { inputModality: "mouse", durationMs: 900 };

interface Recorded {
  readonly flare: number[];
  readonly kick: number[];
  readonly bursts: { conceptId: string; count: number; speed: number }[];
  readonly attuned: boolean[];
  touched: number;
}

function recorder(): { stage: SceneStage; log: Recorded } {
  const log: Recorded = {
    flare: [],
    kick: [],
    bursts: [],
    attuned: [],
    touched: 0,
  };
  const stage: SceneStage = {
    flare: (amount) => log.flare.push(amount),
    kick: (amount) => log.kick.push(amount),
    burst: (conceptId, count, speed) =>
      log.bursts.push({ conceptId, count, speed }),
    setAttuned: (active) => log.attuned.push(active),
    touch: () => {
      log.touched += 1;
    },
  };
  return { stage, log };
}

/**
 * Both world channels, the way the bus delivers them. Every plan declares
 * `scene` and `camera`, so a test that only exercised one would let a CAV-006
 * inequality hide in the other.
 */
function deliverAll(plan: CuePlan, stage: SceneStage): void {
  const director = createSceneDirector(stage);
  for (const cue of plan.cues) {
    director.handleScene(cue);
    director.handleCamera(cue);
  }
}

const relation: DocumentedRelation = Object.freeze({
  id: toDocumentedRelationId("relation.fibonacci-counterpoint"),
  title: "Proportion carried into voice",
  insight: "A proportional series read as a rule for entries.",
  evidence: "attested",
  sources: Object.freeze([]),
}) as unknown as DocumentedRelation;

function commitPlan(
  outcome: "documented" | "open-thread" | "unresolved"
): CuePlan {
  const woven = { threadId, pair: [a, b] as const, intention: "echo" as const, gesture };
  if (outcome === "documented") {
    return planCommitMoment({
      woven,
      wovenEventId: eventId,
      outcome: {
        kind: "documented",
        eventId,
        payload: {
          threadId,
          pair: [a, b],
          intention: "echo",
          relation,
          evidence: "attested",
          reception: "refined",
        },
      },
    });
  }
  if (outcome === "open-thread") {
    return planCommitMoment({
      woven,
      wovenEventId: eventId,
      outcome: {
        kind: "open-thread",
        eventId,
        payload: {
          threadId,
          pair: [a, b],
          intention: "echo",
          question: "Does the proportion survive inversion?",
          sharedFacet: toFacetId("facet.proportion"),
        },
      },
    });
  }
  return planCommitMoment({
    woven,
    wovenEventId: eventId,
    outcome: {
      kind: "unresolved",
      payload: {
        threadId,
        pair: [a, b],
        intention: "echo",
        statement: "Nothing is grounded here yet.",
      },
    },
  });
}

describe("createSceneDirector", () => {
  it("answers every moment of the loop, not only the commit", () => {
    const moments: PresentationCue[] = [
      planAttention({ conceptId: a, candidates: [] }, null).cues[0],
      planReadingPreviewed({ pair: [a, b], intention: "tension", chosen: true }).cues[0],
      planPairLocked({ pair: [a, b], sharedFacets: [] }).cues[0],
      ...commitPlan("documented").cues,
    ];
    for (const cue of moments) {
      const { stage, log } = recorder();
      const director = createSceneDirector(stage);
      director.handleScene(cue);
      director.handleCamera(cue);
      const wrote =
        log.flare.length +
        log.kick.length +
        log.bursts.length +
        log.attuned.length +
        log.touched;
      expect(wrote, `${cue.type} reached the world`).toBeGreaterThan(0);
    }
  });

  it("keeps the player's presence known while they compose", () => {
    const { stage, log } = recorder();
    const director = createSceneDirector(stage);
    director.handleScene(planAttention({ conceptId: a, candidates: [] }, null).cues[0]);
    director.handleScene(planAttentionCleared().cues[0]);
    expect(log.touched).toBe(2);
  });

  it("gives a latch a world response distinct from arming", () => {
    const { stage: armStage, log: armLog } = recorder();
    createSceneDirector(armStage).handleScene(
      planReadingPreviewed({ pair: [a, b], intention: "echo", chosen: true }).cues[0]
    );
    const { stage: latchStage, log: latchLog } = recorder();
    createSceneDirector(latchStage).handleScene(
      planPairLocked({ pair: [a, b], sharedFacets: [] }).cues[0]
    );
    // A chosen reading stirs the attended bead; a lock answers at the second.
    expect(armLog.bursts.map((entry) => entry.conceptId)).toEqual([String(a)]);
    expect(latchLog.bursts.map((entry) => entry.conceptId)).toEqual([String(b)]);
  });

  /**
   * CAV-006. Documented, Open Thread and Unresolved are different states of
   * knowledge, not better and worse results, so the world may not pay one of
   * them more than another.
   */
  it("spends exactly the same light on every epistemic outcome", () => {
    const spend = (kind: "documented" | "open-thread" | "unresolved") => {
      const { stage, log } = recorder();
      deliverAll(commitPlan(kind), stage);
      return {
        flare: log.flare,
        particles: log.bursts.reduce((sum, entry) => sum + entry.count, 0),
        beads: log.bursts.map((entry) => entry.conceptId).sort(),
      };
    };
    const documented = spend("documented");
    const open = spend("open-thread");
    const unresolved = spend("unresolved");

    expect(open.flare).toEqual(documented.flare);
    expect(unresolved.flare).toEqual(documented.flare);
    expect(open.particles).toBe(documented.particles);
    expect(unresolved.particles).toBe(documented.particles);
    expect(open.beads).toEqual(documented.beads);
    expect(unresolved.beads).toEqual(documented.beads);
  });

  /**
   * The director must add nothing of its own to the epistemic distinction.
   * `scene/resolution.ts` solves it in the ribbon's material — dry ink that
   * closes versus wet ink that stops short, at equal coverage — and any second
   * mark here would re-introduce the reward gradient that module removed.
   */
  it("draws no epistemic distinction of its own", () => {
    const calls = (kind: "documented" | "open-thread" | "unresolved") => {
      const { stage, log } = recorder();
      deliverAll(commitPlan(kind), stage);
      return JSON.stringify(log);
    };
    expect(calls("open-thread")).toBe(calls("documented"));
    expect(calls("unresolved")).toBe(calls("documented"));
  });

  it("holds the world in Attunement and releases it again", () => {
    const { stage, log } = recorder();
    const director = createSceneDirector(stage);
    director.handleScene(planAttunement({ active: true }, eventId).cues[0]);
    director.handleScene(planAttunement({ active: false }, eventId).cues[0]);
    expect(log.attuned).toEqual([true, false]);
  });

  it("answers a motif at every bead that formed it", () => {
    const { stage, log } = recorder();
    createSceneDirector(stage).handleScene(
      planMotifCompleted(
        {
          motifKindId: toMotifKindId("motif.triangle"),
          conceptIds: [a, b],
          threadIds: [threadId],
          reason: "Three readings closed on each other.",
        },
        eventId
      ).cues[0]
    );
    expect(log.bursts.map((entry) => entry.conceptId)).toEqual([
      String(a),
      String(b),
    ]);
    expect(log.flare).toHaveLength(1);
  });
});

describe("a Study solved (M9-001)", () => {
  const c = toConceptId("matter.standing-wave");
  const solved = (
    overrides: Partial<CuePayloadMap["study.solved"]> = {}
  ): CuePlan =>
    planStudySolved(
      {
        studyId: "study.eschholz-2",
        by: "threads",
        threadIds: [threadId],
        conceptIds: [a, b, c],
        marks: ["economical"],
        brief: "Carry Superposition through three faculties",
        ...overrides,
      },
      eventId,
      2.4
    );

  it("answers with an outcome's light and a gentle stir at each bead of the answer, and no impact", () => {
    const outcome = recorder();
    deliverAll(commitPlan("documented"), outcome.stage);
    const { stage, log } = recorder();
    deliverAll(solved(), stage);

    expect(log.flare).toEqual([outcome.log.flare[0]]);
    expect(log.bursts.map((entry) => entry.conceptId)).toEqual([
      String(a),
      String(b),
      String(c),
    ]);
    expect(log.kick).toEqual([]);
    expect(log.touched).toBe(1);

    // Quieter than a motif: a recognition of the web, not a new structure in it.
    const motif = recorder();
    deliverAll(
      planMotifCompleted(
        {
          motifKindId: toMotifKindId("canon"),
          conceptIds: [a, b, c],
          threadIds: [threadId],
          reason: "Superposition recurs.",
        },
        eventId
      ),
      motif.stage
    );
    const particles = (entries: Recorded["bursts"]) =>
      entries.reduce((sum, entry) => sum + entry.count, 0);
    expect(log.flare[0]).toBeLessThan(motif.log.flare[0]);
    expect(particles(log.bursts)).toBeLessThan(particles(motif.log.bursts));
  });

  it("answers a silence with the sky alone: there are no beads to stir", () => {
    const { stage, log } = recorder();
    deliverAll(solved({ by: "silence", threadIds: [], conceptIds: [], marks: [] }), stage);
    expect(log.flare).toHaveLength(1);
    expect(log.bursts).toEqual([]);
    expect(log.kick).toEqual([]);
  });

  it("answers the same beads the same way, whatever the marks (CAV-006: no reward gradient)", () => {
    const calls = (plan: CuePlan) => {
      const { stage, log } = recorder();
      deliverAll(plan, stage);
      return JSON.stringify(log);
    };
    expect(calls(solved({ marks: [] }))).toBe(calls(solved({ marks: ["economical", "wide", "varied"] })));
  });

  it("does nothing for a not yet: the world did not change", () => {
    const { stage, log } = recorder();
    deliverAll(planStudyNotYet({ studyId: "study.eschholz-1", statement: "can-be-done" }), stage);
    expect(log).toEqual({ flare: [], kick: [], bursts: [], attuned: [], touched: 0 });
  });
});
