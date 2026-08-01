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
  createCueBus,
  planAttention,
  planAttentionCleared,
  planAttunement,
  planCandidateLatched,
  planCommitMoment,
  planConclusion,
  planIntentionArmed,
  planMotifCompleted,
  type CueChannel,
  type CuePlan,
} from "../cues";
import { attachWorldDirectors } from "./attachWorldDirectors";
import {
  createHapticsDirector,
  HAPTIC_PATTERNS,
  type HapticsStage,
} from "./createHapticsDirector";
import { createSceneDirector, type SceneStage } from "./createSceneDirector";

/**
 * THE CHANNEL CONTRACT.
 *
 * Every plan declares which directors should act. Two of the three world
 * channels — `camera` and `haptics` — were declared by every plan in the game
 * and subscribed by nothing anywhere in the repository, which is a contract
 * advertising directors that do not exist. These tests are the reason that
 * cannot happen quietly again: they read the channels straight off the planner
 * and require a subscriber for each.
 */

const a = toConceptId("measure.fibonacci-sequence");
const b = toConceptId("sound.counterpoint");
const c = toConceptId("measure.prime-numbers");
const threadId = toThreadId("thread.1");
const eventId = toEventId("event-0000-0000-0000-000000000001");
const gesture: GestureProfile = { inputModality: "mouse", durationMs: 900 };

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
  const woven = {
    threadId,
    pair: [a, b] as const,
    intention: "echo" as const,
    gesture,
  };
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

/** Every plan the planner can produce, once each. */
function everyPlan(): readonly CuePlan[] {
  return [
    planAttention({ conceptId: a, candidates: [] }, null),
    planAttentionCleared(),
    planIntentionArmed({ conceptId: a, intention: "tension" }),
    planCandidateLatched({ pair: [a, b], intention: "tension" }),
    commitPlan("documented"),
    commitPlan("open-thread"),
    commitPlan("unresolved"),
    planMotifCompleted(
      {
        motifKindId: toMotifKindId("motif.canon"),
        conceptIds: [a, b, c],
        threadIds: [threadId],
        reason: "Proportion recurs, transformed rather than repeated.",
      },
      eventId
    ),
    planAttunement({ active: true }, eventId),
    planAttunement({ active: false }, eventId),
    planConclusion({ performance: null }, eventId),
  ];
}

interface Harness {
  readonly publishAll: () => void;
  readonly scene: string[];
  readonly camera: number[];
  readonly haptics: readonly number[][];
}

function harness(): Harness {
  const scene: string[] = [];
  const camera: number[] = [];
  const haptics: readonly number[][] = [];
  const hapticLog = haptics as number[][];

  const sceneStage: SceneStage = {
    flare: (amount) => scene.push(`flare:${amount}`),
    kick: (amount) => camera.push(amount),
    burst: (conceptId, count) => scene.push(`burst:${conceptId}:${count}`),
    setAttuned: (active) => scene.push(`attuned:${String(active)}`),
    touch: () => scene.push("touch"),
  };
  const hapticsStage: HapticsStage = {
    vibrate: (pattern) => hapticLog.push([...pattern]),
  };

  let clock = 0;
  const bus = createCueBus({ now: () => clock });
  attachWorldDirectors(bus, {
    scene: createSceneDirector(sceneStage),
    haptics: createHapticsDirector(hapticsStage),
  });

  return {
    scene,
    camera,
    haptics,
    publishAll: () => {
      for (const plan of everyPlan()) {
        bus.publish(plan);
        // Deferred cues (an outcome following its weave) land on the tick.
        clock += plan.duration + 1;
        bus.tick(clock);
      }
      expect(bus.pending()).toBe(0);
    },
  };
}

describe("the world's cue channels", () => {
  it("has a subscriber for every world channel the planner declares", () => {
    const declared = new Set<CueChannel>();
    for (const plan of everyPlan()) {
      for (const cue of plan.cues) {
        for (const channel of cue.channels) declared.add(channel);
      }
    }
    // The three the world owns. `audio`, `ui` and `caption` are subscribed by
    // their own directors; these are the ones that had none.
    expect(declared.has("scene")).toBe(true);
    expect(declared.has("camera")).toBe(true);
    expect(declared.has("haptics")).toBe(true);

    const world = harness();
    world.publishAll();
    expect(world.scene.length, "the scene channel was answered").toBeGreaterThan(0);
    expect(world.camera.length, "the camera channel was answered").toBeGreaterThan(0);
    expect(world.haptics.length, "the haptics channel was answered").toBeGreaterThan(0);
  });

  it("delivers a camera impact through the camera channel, not the scene one", () => {
    const camera: number[] = [];
    const sceneOnly: SceneStage = {
      flare: () => {},
      kick: (amount) => camera.push(amount),
      burst: () => {},
      setAttuned: () => {},
      touch: () => {},
    };
    const director = createSceneDirector(sceneOnly);
    const cue = planCandidateLatched({ pair: [a, b], intention: "echo" }).cues[0];

    director.handleScene(cue);
    expect(camera, "the scene channel must not spend the camera's impact").toEqual([]);

    director.handleCamera(cue);
    expect(camera).toHaveLength(1);
  });

  /**
   * CAV-006 in the hand. The three epistemic states are different states of
   * knowledge, not better and worse results, so a documented relation may not
   * buzz longer than an Open Thread.
   */
  it("gives the three epistemic outcomes an identical haptic pattern", () => {
    const felt = (kind: "documented" | "open-thread" | "unresolved") => {
      const patterns: number[][] = [];
      const director = createHapticsDirector({
        vibrate: (pattern) => patterns.push([...pattern]),
      });
      for (const cue of commitPlan(kind).cues) director.handleCue(cue);
      return patterns;
    };
    expect(felt("open-thread")).toEqual(felt("documented"));
    expect(felt("unresolved")).toEqual(felt("documented"));
    expect(felt("documented")).toContainEqual([...HAPTIC_PATTERNS.outcome]);
  });

  /**
   * Attention fires on every glance. A device that buzzes when the player looks
   * at something is nervous, not responsive.
   */
  it("stays silent in the hand while the player is only looking", () => {
    const patterns: number[][] = [];
    const director = createHapticsDirector({
      vibrate: (pattern) => patterns.push([...pattern]),
    });
    director.handleCue(planAttention({ conceptId: a, candidates: [] }, null).cues[0]);
    director.handleCue(planAttentionCleared().cues[0]);
    expect(patterns).toEqual([]);
  });

  /** Nothing in the vocabulary may loop, hold, or run long. */
  it("keeps every pattern short and finite", () => {
    for (const [name, pattern] of Object.entries(HAPTIC_PATTERNS)) {
      const total = pattern.reduce((sum, ms) => sum + ms, 0);
      expect(total, `${name} is a tap, not a buzz`).toBeLessThanOrEqual(200);
      for (const ms of pattern) {
        expect(ms, `${name} has a finite step`).toBeGreaterThan(0);
      }
    }
  });
});
