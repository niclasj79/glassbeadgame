import { describe, expect, it } from "vitest";

import { CASTALIA_LOOKUP } from "@/content/castalia";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import type { RelationIntention } from "@/domain/events";
import { toConceptId, toThreadId } from "@/domain/ids";
import type { CuePayloadMap, CueType, PresentationCue } from "@/runtime/cues";
import {
  LIGHT_RISE_SECONDS,
  LIGHT_WEIGHT_BY_ROLE,
  ONSET_CAPACITY,
  createConductor,
  type ScheduledOnset,
} from "./conductor";
import { createAudioDirector, type AudioSink } from "./director";
import { makeVoicePlan, noteLifetime, type PlannedNote, type VoicePlan } from "./plan";
import {
  SCORE_FEED_CAPACITY,
  SCORE_HORIZON_SECONDS,
  createScoreFeed,
  publishPlanLights,
} from "./planLights";

/**
 * A PLAN'S NOTES ON THE SCORE THE SCENE READS (ADR-016, M4-001).
 *
 * The production sink hands every note of every plan the director schedules to
 * the conductor: at the plan's time plus the note's, for as long as its
 * envelope, weighted by its role — and by nothing else, which is CAV-006 made
 * structural: three outcome kinds, one weight per role.
 */

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const INTENTIONS: readonly RelationIntention[] = ["echo", "passage", "tension", "ground"];
const OUTCOMES = ["documented", "open-thread", "unresolved"] as const;
type Outcome = (typeof OUTCOMES)[number];

const cue = <Type extends CueType>(
  type: Type,
  payload: CuePayloadMap[Type]
): PresentationCue =>
  ({
    id: `cue:${type}`,
    type,
    sourceEventId: null,
    startAt: 0,
    duration: 1,
    channels: ["audio"],
    payload,
  }) as PresentationCue;

const pair = [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)] as const;

const outcomeCue = (outcome: Outcome, intention: RelationIntention): PresentationCue => {
  const threadId = toThreadId("t1");
  switch (outcome) {
    case "documented":
      return cue("outcome.documented", {
        threadId,
        pair: [pair[0], pair[1]],
        intention,
        relation: CASTALIA_RELATIONS[0],
        evidence: CASTALIA_RELATIONS[0].evidence,
        reception: "confirmed",
      });
    case "open-thread":
      return cue("outcome.open-thread", {
        threadId,
        pair: [pair[0], pair[1]],
        intention,
        question: "Is there a work in which this can be demonstrated?",
        sharedFacet: CASTALIA_RELATIONS[0].sharedFacets[0],
      });
    case "unresolved":
      return cue("outcome.unresolved", {
        threadId,
        pair: [pair[0], pair[1]],
        intention,
        statement: "The Game has no grounded relation here yet.",
      });
  }
};

/** Everything a director hands its sink to be conducted, and to be played. */
function recordingDirector() {
  const conducted: { plan: VoicePlan; atSeconds: number }[] = [];
  const played: { plan: VoicePlan; atSeconds: number }[] = [];
  const sink: AudioSink = {
    now: () => 100,
    quantize: () => 100.25,
    quantizeHand: () => 100.125,
    slotSeconds: () => 2,
    conduct: (plan, atSeconds) => {
      conducted.push({ plan, atSeconds });
    },
    play: (plan, atSeconds) => {
      played.push({ plan, atSeconds });
    },
    setSpace: () => {},
    activeVoiceCount: () => 0,
    concludeAt: () => {},
  };
  return {
    director: createAudioDirector({ sink, lookup: CASTALIA_LOOKUP }),
    conducted,
    played,
  };
}

/** The plan as written for one outcome — what the production sink conducts. */
const writtenOutcome = (outcome: Outcome, intention: RelationIntention): VoicePlan => {
  const { director, conducted } = recordingDirector();
  director.handleCue(outcomeCue(outcome, intention));
  expect(conducted).toHaveLength(1);
  return conducted[0].plan;
};

const record = (): { onsets: ScheduledOnset[]; sound: (onset: ScheduledOnset) => void } => {
  const onsets: ScheduledOnset[] = [];
  return { onsets, sound: (onset) => onsets.push(onset) };
};

const note = (overrides: Partial<PlannedNote>): PlannedNote =>
  Object.freeze({
    id: "n",
    conceptId: FIBONACCI,
    role: "subject",
    timbre: "glass",
    articulation: "struck",
    register: "mid",
    degree: 0,
    frequency: 264,
    detuneCents: 0,
    atSeconds: 0,
    envelope: Object.freeze({ attack: 0.01, hold: 0.1, release: 0.4 }),
    gain: 0.1,
    floorGain: 0,
    openEnded: false,
    tense: false,
    ...overrides,
  });

describe("publishing a plan's notes", () => {
  it("hands every note that speaks for a concept to the conductor, on the plan's clock", () => {
    const plan = writtenOutcome("documented", "echo");
    const recorder = record();
    const count = publishPlanLights(recorder, plan, 42);
    const speaking = plan.notes.filter((n) => n.conceptId !== null);
    expect(count).toBe(speaking.length);
    expect(recorder.onsets).toEqual(
      speaking.map((n) => ({
        conceptId: n.conceptId,
        at: 42 + n.atSeconds,
        duration: noteLifetime(n),
        weight: LIGHT_WEIGHT_BY_ROLE[n.role],
      }))
    );
  });

  it("lights nothing for a structural voice that speaks for no concept", () => {
    const plan = makeVoicePlan({
      id: "structural",
      kind: "attention",
      intention: null,
      notes: [
        note({ id: "a", conceptId: FIBONACCI, atSeconds: 0 }),
        note({ id: "b", conceptId: null, role: "ground", atSeconds: 0.5 }),
        note({ id: "c", conceptId: COUNTERPOINT, role: "answer", atSeconds: 1 }),
      ],
      meta: {
        conceptIds: [FIBONACCI, COUNTERPOINT],
        grammar: "test",
        resolves: false,
        interval: null,
        beatingHz: null,
      },
    });
    const recorder = record();
    expect(publishPlanLights(recorder, plan, 10)).toBe(2);
    expect(recorder.onsets.map((onset) => onset.conceptId)).toEqual([FIBONACCI, COUNTERPOINT]);
  });

  it("reaches a real conductor: the bead lights at its note, and only its bead", () => {
    let t = 0;
    const c = createConductor({ now: () => t });
    const plan = makeVoicePlan({
      id: "one",
      kind: "attention",
      intention: null,
      notes: [note({ atSeconds: 0.5, role: "answer" })],
      meta: {
        conceptIds: [FIBONACCI],
        grammar: "test",
        resolves: false,
        interval: null,
        beatingHz: null,
      },
    });
    publishPlanLights(c, plan, 10);
    t = 10.5 - 0.01;
    expect(c.light(FIBONACCI)).toBe(0);
    t = 10.5 + LIGHT_RISE_SECONDS;
    expect(c.light(FIBONACCI)).toBeCloseTo(LIGHT_WEIGHT_BY_ROLE.answer, 9);
    expect(c.light(COUNTERPOINT)).toBe(0);
  });

  it("never reads what the record said of a relation", () => {
    const plan = writtenOutcome("documented", "echo");
    const meta = { ...plan.meta };
    Object.defineProperty(meta, "outcome", {
      enumerable: true,
      get: () => {
        throw new Error("the light must not know the outcome (CAV-006)");
      },
    });
    const blind = { ...plan, meta } as VoicePlan;
    expect(() => publishPlanLights(record(), blind, 0)).not.toThrow();
  });
});

describe("the three outcomes light their beads alike (CAV-006)", () => {
  /** Every weight each role was published at. */
  const weightsByRole = (plan: VoicePlan): Map<string, number[]> => {
    const recorder = record();
    publishPlanLights(recorder, plan, 0);
    const byRole = new Map<string, number[]>();
    recorder.onsets.forEach((onset, index) => {
      const role = plan.notes.filter((n) => n.conceptId !== null)[index].role;
      byRole.set(role, [...new Set([...(byRole.get(role) ?? []), onset.weight])]);
    });
    return byRole;
  };

  /** The brightest a concept's bead becomes over the whole plan. */
  const crest = (plan: VoicePlan, conceptId: string): number => {
    let t = 0;
    const c = createConductor({ now: () => t });
    publishPlanLights(c, plan, 0);
    let peak = 0;
    for (t = 0; t < 30; t += 0.01) peak = Math.max(peak, c.light(conceptId));
    return peak;
  };

  it("publishes one weight per role, the same for a documented, an Open and an unresolved outcome", () => {
    for (const intention of INTENTIONS) {
      const plans = OUTCOMES.map((outcome) => writtenOutcome(outcome, intention));
      // The plans really are three different outcomes…
      expect(plans.map((plan) => plan.meta.outcome)).toEqual([...OUTCOMES]);
      const tables = plans.map(weightsByRole);
      for (const table of tables) {
        for (const [role, weights] of table) {
          expect(weights).toEqual([LIGHT_WEIGHT_BY_ROLE[role as PlannedNote["role"]]]);
        }
      }
      // …and every role they share is lit at the same weight in all three.
      const shared = [...tables[0].keys()].filter((role) =>
        tables.every((table) => table.has(role))
      );
      expect(shared).toContain("subject");
      for (const role of shared) {
        expect(tables[1].get(role)).toEqual(tables[0].get(role));
        expect(tables[2].get(role)).toEqual(tables[0].get(role));
      }
    }
  });

  it("brings both beads of the pair to the same crest whatever the record said", () => {
    for (const intention of INTENTIONS) {
      for (const conceptId of [FIBONACCI, COUNTERPOINT]) {
        const crests = OUTCOMES.map((outcome) => crest(writtenOutcome(outcome, intention), conceptId));
        expect(crests[0]).toBeGreaterThan(0);
        expect(crests[1]).toBeCloseTo(crests[0], 9);
        expect(crests[2]).toBeCloseTo(crests[0], 9);
      }
    }
  });

  it("conducts an unresolved outcome as written, though it is heard thinner", () => {
    const { director, conducted, played } = recordingDirector();
    director.handleCue(outcomeCue("unresolved", "ground"));
    expect(conducted).toHaveLength(1);
    expect(played).toHaveLength(1);
    // Quieter to the ear…
    const loudest = (plan: VoicePlan) => Math.max(...plan.notes.map((n) => n.gain));
    expect(loudest(played[0].plan)).toBeLessThan(loudest(conducted[0].plan));
    // …and the score the eye reads is the written one, at the same moment.
    expect(conducted[0].plan).toEqual(writtenOutcome("unresolved", "ground"));
    expect(conducted[0].atSeconds).toBe(played[0].atSeconds);
  });
});

describe("the score, fed a little ahead", () => {
  /** A clock the test moves, and a conductor reading it. */
  const onClock = (start = 100) => {
    const clock = { t: start };
    const c = createConductor({ now: () => clock.t });
    return { clock, c };
  };

  const onset = (conceptId: string, at: number, weight = 1): ScheduledOnset => ({
    conceptId,
    at,
    duration: 0.5,
    weight,
  });

  it("puts a near note on the score at once and holds a far one until it nears", () => {
    const { clock, c } = onClock();
    const feed = createScoreFeed(c);
    const heard: ScheduledOnset[] = [];
    const spy = { now: () => c.now(), sound: (o: ScheduledOnset) => heard.push(o) };
    const spied = createScoreFeed(spy);
    for (const target of [feed, spied]) {
      target.sound(onset(FIBONACCI, 100 + SCORE_HORIZON_SECONDS - 0.01));
      target.sound(onset(COUNTERPOINT, 104));
    }
    expect(heard.map((o) => o.conceptId)).toEqual([FIBONACCI]);
    expect(spied.pending()).toBe(1);
    // Nothing goes early.
    clock.t = 104 - SCORE_HORIZON_SECONDS - 0.01;
    spied.pump();
    expect(heard).toHaveLength(1);
    // And it goes as soon as it is within the horizon — before it sounds.
    clock.t = 104 - SCORE_HORIZON_SECONDS;
    spied.pump();
    expect(heard.map((o) => o.conceptId)).toEqual([FIBONACCI, COUNTERPOINT]);
    expect(spied.pending()).toBe(0);
    // The real conductor behind the other feed lights each at its own time.
    feed.pump();
    clock.t = 104 + LIGHT_RISE_SECONDS;
    feed.pump();
    expect(c.light(COUNTERPOINT)).toBeCloseTo(1, 9);
  });

  it("hands held notes on in time order, whatever order they were written in", () => {
    const { clock, c } = onClock();
    const heard: number[] = [];
    const feed = createScoreFeed({ now: () => c.now(), sound: (o) => heard.push(o.at) });
    for (const at of [109, 103, 107, 105, 103.5]) feed.sound(onset(FIBONACCI, at));
    clock.t = 108;
    feed.pump();
    expect(heard).toEqual([103, 103.5, 105, 107, 109]);
  });

  it("holds a bounded number of notes, letting the latest go, and forgets them on clear", () => {
    const { c } = onClock();
    const feed = createScoreFeed(c, SCORE_HORIZON_SECONDS, 4);
    for (const at of [110, 111, 112, 113, 114, 115]) feed.sound(onset(FIBONACCI, at));
    expect(feed.pending()).toBe(4);
    feed.clear();
    expect(feed.pending()).toBe(0);
    expect(SCORE_FEED_CAPACITY).toBeGreaterThan(ONSET_CAPACITY);
  });

  it("keeps a long performance's opening that the conductor alone would lose", () => {
    // A performance written all at once: a hundred and twenty notes over a
    // minute, on twelve concepts in turn — more onsets than the conductor holds.
    const concepts = Array.from({ length: 12 }, (_, i) => `concept.${i}`);
    const notes = Array.from({ length: 120 }, (_, i) =>
      note({ id: `n${i}`, conceptId: concepts[i % 12], atSeconds: i * 0.5 })
    );
    const plan = makeVoicePlan({
      id: "performance",
      kind: "conclusion",
      intention: null,
      notes,
      meta: { conceptIds: concepts, grammar: "test", resolves: false, interval: null, beatingHz: null },
    });
    expect(notes.length).toBeGreaterThan(ONSET_CAPACITY);

    const litAtTheirTime = (publish: "direct" | "fed"): number => {
      const { clock, c } = onClock(100);
      const feed = createScoreFeed(c);
      publishPlanLights(publish === "fed" ? feed : c, plan, 100.25);
      let lit = 0;
      for (const n of notes) {
        const at = 100.25 + n.atSeconds + LIGHT_RISE_SECONDS;
        // The scheduler's loop, every 25 ms of the way.
        while (clock.t < at) {
          clock.t = Math.min(at, clock.t + 0.025);
          feed.pump();
        }
        if (c.light(n.conceptId!) > 0) lit += 1;
      }
      return lit;
    };
    // Published whole, the soonest notes are the ones the full ring lets go.
    expect(litAtTheirTime("direct")).toBeLessThan(notes.length);
    // Fed as they near, every note lights at its own time.
    expect(litAtTheirTime("fed")).toBe(notes.length);
  });
});
