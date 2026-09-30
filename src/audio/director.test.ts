import { describe, expect, it } from "vitest";

import { CASTALIA_LOOKUP } from "@/content/castalia";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import type { RelationIntention } from "@/domain/events";
import { toConceptId, toMotifKindId, toThreadId } from "@/domain/ids";
import type { CuePayloadMap, CueType, PresentationCue } from "@/runtime/cues";
import { planAttentionSpace } from "./attention";
import { COMFORT, tensionCeiling } from "./comfort";
import { HAND_DIVISION, createConductor } from "./conductor";
import {
  createAudioDirector,
  isPerformanceScore,
  type AudioCaption,
  type AudioSink,
} from "./director";
import type { PerformanceScore } from "./conclusion";
import { FOCUS_VOICING, audibleEndSeconds } from "./focusVoicing";
import type { AudioIntensity } from "./intensity";
import { CASTALIA_MODE } from "./mode";
import {
  auditComfort,
  noteLifetime,
  peakSummedGain,
  type PlannedNote,
  type VoicePlan,
} from "./plan";
import { SCORE } from "./score";

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const JUST = "sound.just-intonation";
const EQUAL = "sound.equal-temperament";
const PRIME = "measure.prime-numbers";
const INTENTIONS: readonly RelationIntention[] = ["echo", "passage", "tension", "ground"];

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

interface Recorded {
  readonly plan: VoicePlan;
  readonly atSeconds: number;
}

/**
 * Where the recording sinks put the hand grid: a sixteenth of Castalia's slot
 * after the cue. Longer than the focus lane's lead, so an assertion that finds
 * it proves the lane asked the sink's grid rather than adding its own lead.
 */
const HAND = 0.125;

function harness(now = 100, slot = 2) {
  const played: Recorded[] = [];
  const conducted: Recorded[] = [];
  const spaces: { density: number; bed: number }[] = [];
  const captions: AudioCaption[] = [];
  const endings: { atSeconds: number; fadeSeconds: number }[] = [];
  let voices = 0;

  const sink: AudioSink = {
    now: () => now,
    quantize: () => now + 0.25,
    quantizeHand: () => now + HAND,
    slotSeconds: () => slot,
    play: (plan, atSeconds) => {
      played.push({ plan, atSeconds });
    },
    conduct: (plan, atSeconds) => {
      conducted.push({ plan, atSeconds });
    },
    setSpace: (density, bed) => {
      spaces.push({ density, bed });
    },
    activeVoiceCount: () => voices,
    concludeAt: (atSeconds, fadeSeconds) => {
      endings.push({ atSeconds, fadeSeconds });
    },
  };

  const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
  director.onCaption((caption) => captions.push(caption));

  return {
    director,
    played,
    conducted,
    spaces,
    captions,
    endings,
    setVoices: (count: number) => {
      voices = count;
    },
  };
}

// ─── The focus voice: a harness with a clock, and an oracle ─────────────────

type LogEntry =
  | { readonly type: "play"; readonly plan: VoicePlan; readonly atSeconds: number }
  | {
      readonly type: "retire";
      readonly planId: string;
      readonly atSeconds: number;
      readonly fadeSeconds: number;
    };

/**
 * A harness whose clock the test moves, and a log of everything the sink was
 * asked to do, in order. `retire: false` is a sink that cannot take a plan back,
 * which is what the production sink is until it learns to. `hand` is the sink's
 * hand grid, given the clock and the lead asked for; by default a sixteenth of
 * Castalia's slot after the cue.
 */
function focusHarness(options: {
  retire: boolean;
  startAt?: number;
  hand?: (now: number, leadSeconds: number) => number;
}) {
  let now = options.startAt ?? 100;
  const log: LogEntry[] = [];
  const played: Recorded[] = [];
  const conducted: Recorded[] = [];
  const spaces: { density: number; bed: number }[] = [];
  const captions: AudioCaption[] = [];
  const hand = options.hand ?? ((at: number) => at + HAND);

  const sink: AudioSink = {
    now: () => now,
    quantize: () => now + 0.25,
    quantizeHand: (leadSeconds) => hand(now, leadSeconds),
    slotSeconds: () => 2,
    play: (plan, atSeconds) => {
      played.push({ plan, atSeconds });
      log.push({ type: "play", plan, atSeconds });
    },
    conduct: (plan, atSeconds) => {
      conducted.push({ plan, atSeconds });
    },
    setSpace: (density, bed) => {
      spaces.push({ density, bed });
    },
    activeVoiceCount: () => 0,
    concludeAt: () => {},
    ...(options.retire
      ? {
          retire: (planId: string, atSeconds: number, fadeSeconds: number) => {
            log.push({ type: "retire", planId, atSeconds, fadeSeconds });
          },
        }
      : {}),
  };
  const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
  director.onCaption((caption) => captions.push(caption));

  return {
    director,
    played,
    conducted,
    log,
    spaces,
    captions,
    retired: () =>
      log.filter((entry): entry is Extract<LogEntry, { type: "retire" }> => entry.type === "retire"),
    at: (seconds: number) => {
      now = seconds;
    },
    advance: (seconds: number) => {
      now += seconds;
    },
  };
}

interface Instance {
  readonly plan: VoicePlan;
  readonly at: number;
  retiredAt: number | null;
  fade: number;
}

/**
 * What is sounding, reconstructed from nothing but the sink's own log — none of
 * the director's bookkeeping. A `retire` applies to the newest not-yet-retired
 * plan with that id, which is the contract `AudioSink.retire` documents.
 */
function instancesOf(log: readonly LogEntry[]): Instance[] {
  const instances: Instance[] = [];
  for (const entry of log) {
    if (entry.type === "play") {
      instances.push({ plan: entry.plan, at: entry.atSeconds, retiredAt: null, fade: 0 });
      continue;
    }
    const target = [...instances]
      .reverse()
      .find((instance) => instance.plan.id === entry.planId && instance.retiredAt === null);
    if (target) {
      target.retiredAt = entry.atSeconds;
      target.fade = entry.fadeSeconds;
    }
  }
  return instances;
}

interface Sounding {
  readonly plan: string;
  readonly note: PlannedNote;
  /** One until a retirement begins to fade it; zero once it has. */
  readonly factor: number;
}

function soundingAt(instances: readonly Instance[], t: number): Sounding[] {
  const sounding: Sounding[] = [];
  for (const instance of instances) {
    let factor = 1;
    if (instance.retiredAt !== null && t > instance.retiredAt) {
      factor = instance.fade <= 0 ? 0 : 1 - (t - instance.retiredAt) / instance.fade;
    }
    if (factor <= 1e-6) continue;
    for (const note of instance.plan.notes) {
      const start = instance.at + note.atSeconds;
      // The contract: what has not begun by the moment a plan is taken back never does.
      if (instance.retiredAt !== null && start >= instance.retiredAt) continue;
      if (start <= t && t < start + noteLifetime(note)) {
        sounding.push({ plan: instance.plan.id, note, factor });
      }
    }
  }
  return sounding;
}

/** The whole timeline of a log, sampled every 10 ms. */
function timeline(log: readonly LogEntry[]): { t: number; sounding: Sounding[] }[] {
  const instances = instancesOf(log);
  if (instances.length === 0) return [];
  const from = Math.min(...instances.map((instance) => instance.at));
  const to = Math.max(
    ...instances.map((instance) => instance.at + audibleEndSeconds(instance.plan))
  );
  const samples: { t: number; sounding: Sounding[] }[] = [];
  for (let t = from; t <= to; t += 0.01) {
    samples.push({ t, sounding: soundingAt(instances, t) });
  }
  return samples;
}

const plansAt = (sounding: readonly Sounding[]): Set<string> =>
  new Set(sounding.map((entry) => entry.plan));
const levelAt = (sounding: readonly Sounding[]): number =>
  sounding.reduce((sum, entry) => sum + entry.note.gain * entry.factor, 0);
const tenseAt = (sounding: readonly Sounding[]): number =>
  sounding.filter((entry) => entry.note.tense && entry.factor > 1e-6).length;

const PAIR = [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)] as const;
const previewed = (intention: RelationIntention, chosen = false): PresentationCue =>
  cue("reading.previewed", { pair: [PAIR[0], PAIR[1]], intention, chosen });
const sighted = (
  conceptId: string,
  band: "weak" | "medium" | "high" = "medium"
): PresentationCue =>
  cue("attention.sighted", {
    attendedConceptId: toConceptId(FIBONACCI),
    sighted: { conceptId: toConceptId(conceptId), band, sharedFacets: [] },
  });
const sightLost = (): PresentationCue =>
  cue("attention.sighted", { attendedConceptId: toConceptId(FIBONACCI), sighted: null });
const locked = (): PresentationCue =>
  cue("pair.locked", { pair: [PAIR[0], PAIR[1]], sharedFacets: [] });
const reopened = (threadId: string, intention: RelationIntention): PresentationCue =>
  cue("thread.reopened", { threadId: toThreadId(threadId), pair: [PAIR[0], PAIR[1]], intention });
const loudest = (plan: VoicePlan): number => Math.max(...plan.notes.map((note) => note.gain));

const wovenPayload = (
  threadId: string,
  a: string,
  b: string,
  intention: RelationIntention
): CuePayloadMap["thread.woven"] => ({
  threadId: toThreadId(threadId),
  pair: [toConceptId(a), toConceptId(b)],
  intention,
  gesture: { inputModality: "mouse", durationMs: 900 },
});

const documentedPayload = (
  threadId: string,
  a: string,
  b: string,
  intention: RelationIntention
): CuePayloadMap["outcome.documented"] => ({
  threadId: toThreadId(threadId),
  pair: [toConceptId(a), toConceptId(b)],
  intention,
  relation: CASTALIA_RELATIONS[0],
  evidence: CASTALIA_RELATIONS[0].evidence,
  reception: "confirmed",
});

describe("the audio director", () => {
  it("leaves space and foregrounds the attended figure", () => {
    const { director, played, spaces } = harness();
    director.handleCue(
      cue("attention.enter", {
        conceptId: toConceptId(FIBONACCI),
        candidates: [{ conceptId: toConceptId(COUNTERPOINT), band: "high" }],
      })
    );
    expect(spaces).toHaveLength(1);
    expect(spaces[0].density).toBeLessThan(1);
    expect(spaces[0].bed).toBeLessThan(1);
    expect(played).toHaveLength(1);
    expect(played[0].plan.meta.conceptIds).toEqual([FIBONACCI]);
  });

  it("opens call-and-response once the score is busy", () => {
    const { director, spaces, setVoices } = harness();
    setVoices(SCORE.attention.callAndResponseThreads + 1);
    director.handleCue(
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
    );
    expect(spaces[0].density).toBe(SCORE.attention.responseDensityScale);
  });

  it("restores the score when attention is released", () => {
    const { director, spaces } = harness();
    director.handleCue(
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
    );
    director.handleCue(cue("attention.clear", {}));
    expect(spaces.at(-1)).toEqual({ density: 1, bed: 1 });
  });

  it("restores the score when a weave ends the look that led to it", () => {
    const { director, spaces } = harness();
    director.handleCue(
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
    );
    expect(spaces.at(-1)!.bed).toBeLessThan(1);
    director.handleCue(
      cue("thread.woven", wovenPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    expect(spaces.at(-1)).toEqual({ density: 1, bed: 1 });
  });

  it("previews four intentions as four different readings — a reading is a tool, not a label", () => {
    const h = focusHarness({ retire: true });
    const heard: string[] = [];
    for (const intention of INTENTIONS) {
      h.advance(3); // one at a time: this is about what each one *is*, not how they mix
      h.director.handleCue(previewed(intention));
      const plan = h.played.at(-1)!.plan;
      expect(plan.intention).toBe(intention);
      heard.push(
        plan.notes
          .map((n) => `${n.role}:${n.conceptId}:${n.timbre}:${n.register}:${n.degree}`)
          .join("|")
      );
    }
    expect(h.played).toHaveLength(4);
    expect(new Set(heard).size).toBe(4);
    expect(h.played.map((p) => p.plan.meta.grammar)).toEqual([
      "imitation",
      "translation",
      "displacement",
      "foundation",
    ]);
  });

  it("sounds the relation grammar the player declared", () => {
    const { director, played } = harness();
    director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    const plan = played.at(-1)!.plan;
    expect(plan.intention).toBe("echo");
    expect(plan.meta.grammar).toBe("imitation");
    expect(plan.meta.resolves).toBe(true);
  });

  it("gives an Open Thread the same weight as a documented relation", () => {
    const documented = harness();
    documented.director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    const open = harness();
    open.director.handleCue(
      cue("outcome.open-thread", {
        threadId: toThreadId("t1"),
        pair: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
        intention: "echo",
        question: "Is there a work in which this can be demonstrated?",
        sharedFacet: CASTALIA_RELATIONS[0].sharedFacets[0],
      })
    );
    const a = documented.played.at(-1)!.plan;
    const b = open.played.at(-1)!.plan;
    expect(peakSummedGain(a)).toBeCloseTo(peakSummedGain(b), 9);
    expect(a.notes.filter((n) => n.role === "subject").map((n) => n.gain)).toEqual(
      b.notes.filter((n) => n.role === "subject").map((n) => n.gain)
    );
    // The difference is resolution, not reward: one closes, one does not.
    expect(a.meta.resolves).toBe(true);
    expect(b.meta.resolves).toBe(false);
    expect(b.notes.some((note) => note.openEnded)).toBe(true);
  });

  it("answers an unresolved outcome quietly and briefly, never with an error sound", () => {
    const documented = harness();
    documented.director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    const unresolved = harness();
    unresolved.director.handleCue(
      cue("outcome.unresolved", {
        threadId: toThreadId("t1"),
        pair: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
        intention: "echo",
        statement: "The Game has no grounded relation here yet.",
      })
    );
    const loud = documented.played.at(-1)!.plan;
    const quiet = unresolved.played.at(-1)!.plan;
    expect(peakSummedGain(quiet)).toBeLessThan(peakSummedGain(loud));
    expect(quiet.notes.length).toBeLessThanOrEqual(loud.notes.length);
    // Same grammar — the player did nothing wrong.
    expect(quiet.intention).toBe(loud.intention);
  });

  it("remembers threads in creation order for Attunement", () => {
    const { director } = harness();
    director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    director.handleCue(
      cue("outcome.documented", documentedPayload("t2", JUST, EQUAL, "tension"))
    );
    expect(director.threads().map((t) => t.threadId)).toEqual(["t1", "t2"]);
    expect(director.threads()[1].intention).toBe("tension");
  });

  it("sounds each thread on its own in Attunement", () => {
    const { director, played, spaces } = harness();
    director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    director.handleCue(
      cue("outcome.documented", documentedPayload("t2", JUST, EQUAL, "tension"))
    );
    played.length = 0;
    director.handleCue(cue("attunement.changed", { active: true }));
    expect(played).toHaveLength(2);
    expect(played[0].atSeconds).toBeLessThan(played[1].atSeconds);
    expect(spaces.at(-1)!.bed).toBeLessThan(1);
  });

  it("returns the score to ordinary density when Attunement is released", () => {
    const { director, spaces } = harness();
    director.handleCue(cue("attunement.changed", { active: false }));
    expect(spaces.at(-1)).toEqual({ density: 1, bed: 1 });
  });

  it("enters a completed motif as an ensemble rather than a fanfare", () => {
    const { director, played } = harness();
    director.handleCue(
      cue("motif.completed", {
        motifKindId: toMotifKindId("canon"),
        conceptIds: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
        threadIds: [toThreadId("t1")],
        reason: "A shared structure recurs across three concepts.",
      })
    );
    const plan = played.at(-1)!.plan;
    expect(plan.kind).toBe("ensemble");
    expect(plan.notes.every((note) => note.role === "ensemble")).toBe(true);
  });

  it("renders a compiled conclusion, and refuses a malformed one", () => {
    const score: PerformanceScore = {
      sessionId: "s1",
      secondsPerBeat: 0.75,
      entries: [
        {
          threadId: "t1",
          order: 0,
          conceptIds: [FIBONACCI, COUNTERPOINT],
          intention: "echo",
          atSeconds: 0,
          durationSeconds: 3,
          voices: [
            {
              conceptId: FIBONACCI,
              role: "subject",
              degrees: [0, 4],
              rhythm: [2, 2],
              register: "mid",
              articulation: "plucked",
              timbre: "gut",
              atSeconds: 0,
              durationSeconds: 2,
              gain: 0.1,
              openEnded: false,
            },
          ],
          dynamic: 1,
          phrasing: {
            attack: 0.5,
            legato: 0.5,
            rubato: 0.5,
            weight: 0.5,
            breadth: 0.5,
          },
          outcomeKind: "documented",
          speaksForRecord: true,
          resolved: true,
          weight: 0.4,
          isClimax: true,
        },
      ],
      ensembles: [],
      unresolved: [],
      coda: null,
      totalSeconds: 6,
    };
    expect(isPerformanceScore(score)).toBe(true);
    expect(isPerformanceScore({ sessionId: 1 })).toBe(false);
    expect(isPerformanceScore(null)).toBe(false);

    const good = harness();
    good.director.handleCue(cue("conclusion.perform", { performance: score }));
    expect(good.played).toHaveLength(1);

    const bad = harness();
    bad.director.handleCue(cue("conclusion.perform", { performance: { oops: true } }));
    expect(bad.played).toHaveLength(0);
    expect(bad.captions.at(-1)!.text).toContain("could not be read");
  });

  /**
   * Regression (BLOCK-2). The generative loop was never told to stop: the
   * conclusion thinned the bed and then let it run, so the last authored sound
   * of the performance arrived over a texture that carried on afterwards. The
   * Game stopped instead of ending.
   */
  it("brings the generative loop to an end under the coda, not after it", () => {
    const withEnding: PerformanceScore = {
      sessionId: "s2",
      secondsPerBeat: 0.75,
      entries: [],
      ensembles: [],
      unresolved: [],
      coda: {
        threadId: "t1",
        conceptIds: [FIBONACCI, COUNTERPOINT],
        atSeconds: 30,
        durationSeconds: 4,
        voices: [
          {
            conceptId: FIBONACCI,
            role: "ground",
            degrees: [0],
            rhythm: [1],
            register: "low",
            articulation: "sustained",
            timbre: "gut",
            atSeconds: 30,
            durationSeconds: 4,
            gain: 0.05,
            openEnded: false,
          },
          {
            conceptId: COUNTERPOINT,
            role: "answer",
            degrees: [7],
            rhythm: [1],
            register: "mid",
            articulation: "sustained",
            timbre: "glass",
            atSeconds: 30.5,
            durationSeconds: 3.5,
            gain: 0.05,
            openEnded: false,
          },
        ],
        resolves: true,
      },
      totalSeconds: 34,
    };

    const { director, played, endings } = harness();
    director.handleCue(cue("conclusion.perform", { performance: withEnding }));

    const codaPlan = played.find((record) =>
      record.plan.id.startsWith("conclusion:coda:")
    );
    expect(codaPlan).toBeDefined();
    expect(endings).toHaveLength(1);
    // The sink's own clock: quantize() + the coda's offset in the performance.
    expect(endings[0].atSeconds).toBeCloseTo(codaPlan!.atSeconds, 9);
    expect(endings[0].fadeSeconds).toBeGreaterThan(0);
  });

  it("asks for the ending on the captioned path too — a loop is not a caption", () => {
    const silent = harness();
    silent.director.setIntensity("silent");
    silent.director.handleCue(
      cue("conclusion.perform", {
        performance: {
          sessionId: "s3",
          secondsPerBeat: 0.75,
          entries: [],
          ensembles: [],
          unresolved: [],
          coda: {
            threadId: "t1",
            conceptIds: [FIBONACCI, COUNTERPOINT],
            atSeconds: 12,
            durationSeconds: 4,
            voices: [],
            resolves: false,
          },
          totalSeconds: 16,
        } satisfies PerformanceScore,
      })
    );
    expect(silent.played).toHaveLength(0);
    expect(silent.endings).toHaveLength(1);
  });

  it("refuses a payload that carries no ending at all", () => {
    expect(
      isPerformanceScore({
        sessionId: "s",
        totalSeconds: 4,
        entries: [],
        ensembles: [],
        unresolved: [],
      })
    ).toBe(false);
  });
});

describe("the accessible paths", () => {
  it("keeps captioning when muted, and makes no sound", () => {
    const { director, played, captions } = harness();
    director.setIntensity("silent");
    director.handleCue(
      cue("outcome.documented", documentedPayload("t1", JUST, EQUAL, "tension"))
    );
    expect(played).toHaveLength(0);
    expect(captions).toHaveLength(1);
    expect(captions[0].text).toContain("Tension");
    expect(captions[0].text).toContain("does not resolve");
  });

  it("says the same thing at every intensity", () => {
    const texts = (["full", "reduced", "silent"] as const).map((level) => {
      const { director, captions } = harness();
      director.setIntensity(level);
      director.handleCue(
        cue("outcome.documented", documentedPayload("t1", JUST, EQUAL, "tension"))
      );
      return captions.at(-1)!.text;
    });
    expect(new Set(texts).size).toBe(1);
  });

  it("thins but does not neutralise at reduced intensity", () => {
    const full = harness();
    full.director.handleCue(
      cue("outcome.documented", documentedPayload("t1", JUST, EQUAL, "tension"))
    );
    const reduced = harness();
    reduced.director.setIntensity("reduced");
    reduced.director.handleCue(
      cue("outcome.documented", documentedPayload("t1", JUST, EQUAL, "tension"))
    );
    const a = full.played.at(-1)!.plan;
    const b = reduced.played.at(-1)!.plan;
    expect(peakSummedGain(b)).toBeLessThan(peakSummedGain(a));
    // The Tension is still a Tension.
    expect(b.beatings).toHaveLength(1);
    expect(b.meta.resolves).toBe(false);
  });

  it("sounds a weave landing without duplicating the cue layer's caption", () => {
    const { director, captions, played } = harness();
    director.handleCue(
      cue("thread.woven", wovenPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    expect(played).toHaveLength(1);
    expect(played[0].plan.meta.grammar).toBe("landing");
    // `src/runtime/captions` already says "Woven: A and B, as Echo." A second
    // caption here would make the track ignorable.
    expect(captions).toHaveLength(0);
  });

  it("exposes the last caption for a region rendered after the fact", () => {
    const { director } = harness();
    expect(director.lastCaption()).toBeNull();
    director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "ground"))
    );
    expect(director.lastCaption()!.text).toContain("Ground.");
  });
});

describe("director lifecycle", () => {
  it("forgets everything on reset", () => {
    const { director, spaces } = harness();
    director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    director.reset();
    expect(director.threads()).toEqual([]);
    expect(director.lastCaption()).toBeNull();
    expect(spaces.at(-1)).toEqual({ density: 1, bed: 1 });
  });

  it("stops emitting to an unsubscribed caption listener", () => {
    const { director } = harness();
    const seen: AudioCaption[] = [];
    const off = director.onCaption((caption) => seen.push(caption));
    director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    off();
    director.handleCue(
      cue("outcome.documented", documentedPayload("t2", JUST, EQUAL, "tension"))
    );
    expect(seen).toHaveLength(1);
  });
});

// ─── The focus view ─────────────────────────────────────────────────────────

const LEAD = FOCUS_VOICING.leadSeconds;
const FADE = FOCUS_VOICING.fadeSeconds;

describe("a bead sighted under the lens", () => {
  it("says nothing when the lens has left every bead", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(sightLost());
    expect(h.played).toHaveLength(0);
    expect(h.retired()).toHaveLength(0);
    expect(h.captions).toHaveLength(0);
  });

  it("answers with the sighted concept's own figure, alone, on the hand grid after the cue", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(sighted(COUNTERPOINT, "high"));
    expect(h.played).toHaveLength(1);
    const { plan, atSeconds } = h.played[0];
    expect(atSeconds).toBeCloseTo(100 + HAND, 9);
    expect(plan.meta.conceptIds).toEqual([COUNTERPOINT]);
    expect(new Set(plan.notes.map((n) => n.conceptId))).toEqual(new Set([COUNTERPOINT]));
    expect(plan.notes.map((n) => n.degree)).toEqual(
      CASTALIA_LOOKUP.conceptMotif(COUNTERPOINT).degrees.slice(0, plan.notes.length)
    );
  });

  it("sits inside the attention sound-space without touching it", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
    );
    const spaces = h.spaces.length;
    h.advance(5);
    h.director.handleCue(sighted(COUNTERPOINT, "high"));
    expect(h.spaces).toHaveLength(spaces);
    expect(h.spaces.at(-1)!.bed).toBeLessThan(1);
  });

  it("answers at a level set by the band — high, medium, weak — and weak is still audible", () => {
    const gains: Record<string, number> = {};
    for (const band of ["high", "medium", "weak"] as const) {
      const h = focusHarness({ retire: true });
      h.director.handleCue(sighted(JUST, band));
      gains[band] = loudest(h.played[0].plan);
    }
    expect(gains.high).toBeGreaterThan(gains.medium);
    expect(gains.medium).toBeGreaterThan(gains.weak);
    // The quietest deliberate sound in the game is the hover ping, at 0.045.
    expect(gains.weak).toBeGreaterThan(0.045);
  });

  it("thins at reduced intensity rather than going quiet", () => {
    const full = focusHarness({ retire: true });
    full.director.handleCue(sighted(JUST, "weak"));
    const reduced = focusHarness({ retire: true });
    reduced.director.setIntensity("reduced");
    reduced.director.handleCue(sighted(JUST, "weak"));
    expect(loudest(reduced.played[0].plan)).toBeLessThan(loudest(full.played[0].plan));
    expect(loudest(reduced.played[0].plan)).toBeGreaterThan(0);
  });

  it("replaces rather than stacks when a new bead is sighted within ~200 ms", () => {
    const h = focusHarness({ retire: true });
    h.at(100);
    h.director.handleCue(sighted(COUNTERPOINT, "high")); // begins at 100.125
    h.at(100.15);
    h.director.handleCue(sighted(JUST, "high")); // inside the first's window
    h.at(100.2);
    h.director.handleCue(sighted(PRIME, "high")); // the lens moves on again

    // Onsets are at least a window apart: the third bead replaced the second
    // before it had begun, and was spaced from the first, which really sounded.
    const onsets = h.played.map((entry) => entry.atSeconds);
    expect(onsets).toHaveLength(3);
    const window = FOCUS_VOICING.sighting.windowSeconds;
    expect(onsets[1] - onsets[0]).toBeGreaterThanOrEqual(window - 1e-9);
    expect(onsets[2] - onsets[0]).toBeGreaterThanOrEqual(window - 1e-9);

    // The bead the lens came to rest on is the one heard — and never more than
    // one at any instant. The bead it passed through was never heard at all.
    const heard = new Set<string>();
    for (const sample of timeline(h.log)) {
      const plans = plansAt(sample.sounding);
      expect(plans.size).toBeLessThanOrEqual(1);
      plans.forEach((id) => heard.add(id));
    }
    expect([...heard].sort()).toEqual(
      [`sighted:${COUNTERPOINT}:high`, `sighted:${PRIME}:high`].sort()
    );
  });

  it("drops an answer the lens leaves before it has begun, so a fast pass is never a stutter", () => {
    const h = focusHarness({ retire: true });
    h.at(100);
    h.director.handleCue(sighted(COUNTERPOINT, "high")); // due at 100.125
    h.at(100.05);
    h.director.handleCue(sighted(JUST, "high"));
    // The first never began, so it is retired at once and the second is not
    // deferred on its account: it begins on the hand grid after its own cue.
    expect(h.retired().map((entry) => entry.planId)).toEqual([
      `sighted:${COUNTERPOINT}:high`,
    ]);
    expect(h.played[1].atSeconds).toBeCloseTo(100.05 + HAND, 9);
    const heard = new Set<string>();
    for (const sample of timeline(h.log)) plansAt(sample.sounding).forEach((id) => heard.add(id));
    expect([...heard]).toEqual([`sighted:${JUST}:high`]);
  });

  it("lets an answer finish until the next takes over, so each bead is heard for its window", () => {
    const h = focusHarness({ retire: true });
    h.at(100);
    h.director.handleCue(sighted(COUNTERPOINT, "high")); // begins at 100.125
    h.at(100.15);
    h.director.handleCue(sighted(JUST, "high"));
    const [first] = h.retired();
    const second = h.played[1].atSeconds;
    expect(first.planId).toBe(`sighted:${COUNTERPOINT}:high`);
    // The first is faded out exactly as the second begins — not the moment the
    // second was asked for.
    expect(first.atSeconds + first.fadeSeconds).toBeCloseTo(second, 9);
    expect(first.fadeSeconds).toBe(FADE);
  });

  it("declines an answer inside the window when the sink cannot take the last one back", () => {
    const h = focusHarness({ retire: false });
    h.at(100);
    h.director.handleCue(sighted(COUNTERPOINT, "high"));
    h.at(100.05);
    h.director.handleCue(sighted(JUST, "high"));
    expect(h.played).toHaveLength(1);
    expect(h.retired()).toHaveLength(0);

    // Beyond the window it answers, under what is still ringing — ducked, not
    // stacked whole.
    h.at(100.3);
    h.director.handleCue(sighted(JUST, "high"));
    expect(h.played).toHaveLength(2);
    const alone = focusHarness({ retire: false });
    alone.director.handleCue(sighted(JUST, "high"));
    expect(loudest(h.played[1].plan)).toBeCloseTo(
      loudest(alone.played[0].plan) * FOCUS_VOICING.lane.overlapDuck,
      5
    );
  });

  it("does not restart a bead it is still speaking — a lens that leaves and returns", () => {
    for (const retire of [true, false]) {
      const h = focusHarness({ retire });
      h.director.handleCue(sighted(COUNTERPOINT, "medium"));
      h.advance(0.1);
      h.director.handleCue(sightLost());
      h.advance(0.1);
      h.director.handleCue(sighted(COUNTERPOINT, "medium"));
      expect(h.played).toHaveLength(1);
      // Once it has finished, the same bead answers again.
      h.advance(4);
      h.director.handleCue(sighted(COUNTERPOINT, "medium"));
      expect(h.played).toHaveLength(2);
    }
  });

  it("stays silent at silent intensity, and does not poison the next answer", () => {
    const h = focusHarness({ retire: true });
    h.director.setIntensity("silent");
    h.director.handleCue(sighted(COUNTERPOINT, "high"));
    expect(h.played).toHaveLength(0);
    h.director.setIntensity("full");
    h.advance(0.01);
    h.director.handleCue(sighted(JUST, "high"));
    expect(h.played).toHaveLength(1);
    expect(h.played[0].atSeconds).toBeCloseTo(100.01 + HAND, 9);
  });
});

describe("a pair locked", () => {
  it("calls with the attended figure and answers with the second, never together", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(locked());
    expect(h.played).toHaveLength(1);
    const { plan, atSeconds } = h.played[0];
    expect(atSeconds).toBeCloseTo(100 + HAND, 9);
    const call = plan.notes.filter((n) => n.conceptId === FIBONACCI);
    const answer = plan.notes.filter((n) => n.conceptId === COUNTERPOINT);
    expect(call.length).toBeGreaterThan(0);
    expect(answer.length).toBeGreaterThan(0);
    expect(plan.notes.slice(0, call.length)).toEqual(call);
    // No reading has been chosen, so no interval is sounded: at no instant do
    // both concepts speak.
    for (const sample of timeline(h.log)) {
      const concepts = new Set(sample.sounding.map((entry) => entry.note.conceptId));
      expect(concepts.size).toBeLessThanOrEqual(1);
    }
  });

  it("is moderate — above the loudest sighting, below the attended figure and the commit", () => {
    const lock = focusHarness({ retire: true });
    lock.director.handleCue(locked());
    const sight = focusHarness({ retire: true });
    sight.director.handleCue(sighted(COUNTERPOINT, "high"));
    const attend = focusHarness({ retire: true });
    attend.director.handleCue(
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
    );
    const woven = focusHarness({ retire: true });
    woven.director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    const level = loudest(lock.played[0].plan);
    expect(level).toBeGreaterThan(loudest(sight.played[0].plan));
    expect(level).toBeLessThan(loudest(attend.played[0].plan));
    expect(level).toBeLessThan(loudest(woven.played[0].plan));
  });

  it("takes the lane from a sighting still sounding", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(sighted(COUNTERPOINT, "high"));
    h.advance(0.3);
    h.director.handleCue(locked());
    const [retired] = h.retired();
    expect(retired.planId).toBe(`sighted:${COUNTERPOINT}:high`);
    expect(retired.atSeconds).toBeCloseTo(100.3, 9);
    for (const sample of timeline(h.log)) {
      expect(plansAt(sample.sounding).size).toBeLessThanOrEqual(1);
    }
  });

  it("is not restarted while it is still sounding, and answers again for a different pair", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(locked());
    h.advance(0.2);
    h.director.handleCue(locked());
    expect(h.played).toHaveLength(1);
    h.advance(0.2);
    h.director.handleCue(
      cue("pair.locked", { pair: [PAIR[0], toConceptId(JUST)], sharedFacets: [] })
    );
    expect(h.played).toHaveLength(2);
  });
});

describe("a reading previewed", () => {
  it("plays that intention's grammar on the pair, on the hand grid after the cue", () => {
    const grammars: Record<RelationIntention, string> = {
      echo: "imitation",
      passage: "translation",
      tension: "displacement",
      ground: "foundation",
    };
    for (const intention of INTENTIONS) {
      const h = focusHarness({ retire: true });
      h.director.handleCue(previewed(intention));
      expect(h.played).toHaveLength(1);
      const { plan, atSeconds } = h.played[0];
      expect(atSeconds).toBeCloseTo(100 + HAND, 9);
      expect(plan.intention).toBe(intention);
      expect(plan.meta.grammar).toBe(grammars[intention]);
      expect([...plan.meta.conceptIds].sort()).toEqual([COUNTERPOINT, FIBONACCI].sort());
      // Heard on the pair: both concepts sound, in the grammar of the reading.
      const concepts = new Set(plan.notes.map((n) => n.conceptId));
      expect(concepts.has(FIBONACCI)).toBe(true);
      expect(concepts.has(COUNTERPOINT)).toBe(true);
    }
  });

  it("is quieter and shorter hovered than chosen — for every intention", () => {
    for (const intention of INTENTIONS) {
      const hover = focusHarness({ retire: true });
      hover.director.handleCue(previewed(intention, false));
      const chosen = focusHarness({ retire: true });
      chosen.director.handleCue(previewed(intention, true));
      const a = hover.played[0].plan;
      const b = chosen.played[0].plan;
      expect(loudest(a)).toBeLessThan(loudest(b));
      expect(audibleEndSeconds(a)).toBeLessThan(audibleEndSeconds(b));
      expect(a.id).not.toBe(b.id);
    }
  });

  it("stays under the commit — a chosen reading is never louder than the phrase it leads to", () => {
    for (const intention of INTENTIONS) {
      const chosen = focusHarness({ retire: true });
      chosen.director.handleCue(previewed(intention, true));
      const woven = focusHarness({ retire: true });
      woven.director.handleCue(
        cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, intention))
      );
      expect(loudest(chosen.played[0].plan)).toBeLessThan(loudest(woven.played[0].plan));
    }
  });

  it("hears the same reading a hover, a choice and a recall promise", () => {
    for (const intention of ["echo", "tension"] as const) {
      const hover = focusHarness({ retire: true });
      hover.director.handleCue(previewed(intention, false));
      const chosen = focusHarness({ retire: true });
      chosen.director.handleCue(previewed(intention, true));
      const recall = focusHarness({ retire: true });
      recall.director.handleCue(reopened("t1", intention));
      const woven = focusHarness({ retire: true });
      woven.director.handleCue(
        cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, intention))
      );
      const interval = woven.played[0].plan.meta.interval;
      expect(hover.played[0].plan.meta.interval).toBe(interval);
      expect(chosen.played[0].plan.meta.interval).toBe(interval);
      expect(recall.played[0].plan.meta.interval).toBe(interval);
    }
    // A Tension is never a different suspension for being previewed: the same
    // beating rate, in band.
    const tension = focusHarness({ retire: true });
    tension.director.handleCue(previewed("tension", true));
    const beating = tension.played[0].plan.meta.beatingHz!;
    expect(beating).toBeGreaterThanOrEqual(COMFORT.beating.minHz);
    expect(beating).toBeLessThanOrEqual(COMFORT.beating.maxHz);
  });

  it("replaces the last preview instead of stacking — hovering across four sigils", () => {
    const h = focusHarness({ retire: true });
    INTENTIONS.forEach((intention, index) => {
      h.at(100 + index * 0.25);
      h.director.handleCue(previewed(intention));
    });

    // Immediate: each begins on the hand grid after its cue.
    expect(h.played.map((entry) => entry.atSeconds)).toEqual(
      INTENTIONS.map((_, index) => expect.closeTo(100 + index * 0.25 + HAND, 9))
    );
    // Each preview took the last one back, at the moment it was asked for.
    const retired = h.retired();
    expect(retired.map((entry) => entry.planId)).toEqual(
      h.played.slice(0, 3).map((entry) => entry.plan.id)
    );
    retired.forEach((entry, index) => {
      expect(entry.atSeconds).toBeCloseTo(100 + (index + 1) * 0.25, 9);
      expect(entry.fadeSeconds).toBe(FADE);
    });

    // Never four bars: at no instant is more than one preview audible, however
    // the pointer crossed them, and the sum never exceeds the loudest single one.
    const single = Math.max(...h.played.map((entry) => peakSummedGain(entry.plan)));
    for (const sample of timeline(h.log)) {
      expect(plansAt(sample.sounding).size).toBeLessThanOrEqual(1);
      expect(levelAt(sample.sounding)).toBeLessThanOrEqual(single + 1e-9);
      expect(tenseAt(sample.sounding)).toBeLessThanOrEqual(
        COMFORT.tension.maxConcurrentVoices
      );
    }
    // And each was played whole: replacing is not ducking.
    INTENTIONS.forEach((intention, index) => {
      const alone = focusHarness({ retire: true });
      alone.director.handleCue(previewed(intention));
      expect(h.played[index].plan.notes.map((n) => n.gain)).toEqual(
        alone.played[0].plan.notes.map((n) => n.gain)
      );
    });
  });

  it("bounds the pile instead, when the sink cannot take a preview back", () => {
    const h = focusHarness({ retire: false });
    INTENTIONS.forEach((intention, index) => {
      h.at(100 + index * 0.25);
      h.director.handleCue(previewed(intention));
    });
    expect(h.retired()).toHaveLength(0);
    // The fourth would have to be ducked below the floor, so it is not played on
    // top: silence is better than a stack.
    expect(h.played.length).toBeLessThan(4);
    expect(h.played.length).toBeGreaterThanOrEqual(2);

    const stillSounding = (entry: Recorded, at: number): boolean =>
      entry.plan.notes.some(
        (n) =>
          entry.atSeconds +
            n.atSeconds +
            n.envelope.attack +
            n.envelope.hold +
            n.envelope.release * FOCUS_VOICING.lane.audibleReleaseFraction >
          at
      );
    h.played.forEach((entry, index) => {
      const under = h.played.slice(0, index).filter((earlier) => stillSounding(earlier, entry.atSeconds));
      // Never more than two voices under a new one — the third is declined.
      expect(under.length).toBeLessThanOrEqual(2);
      // Each later preview is ducked against what it would have been alone.
      if (index > 0) {
        const alone = focusHarness({ retire: false });
        alone.director.handleCue(previewed(INTENTIONS[index]));
        expect(loudest(entry.plan)).toBeLessThan(loudest(alone.played[0].plan));
      }
    });
  });

  it("does not restart a reading it is still playing", () => {
    for (const retire of [true, false]) {
      const h = focusHarness({ retire });
      h.director.handleCue(previewed("echo"));
      h.advance(0.2);
      h.director.handleCue(previewed("echo"));
      expect(h.played).toHaveLength(1);
      expect(h.retired()).toHaveLength(0);
    }
  });

  it("lets choosing take over from the hover of the same reading", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(previewed("passage", false));
    h.advance(0.4);
    h.director.handleCue(previewed("passage", true));
    expect(h.played).toHaveLength(2);
    expect(h.retired().map((entry) => entry.planId)).toEqual([h.played[0].plan.id]);
    expect(loudest(h.played[1].plan)).toBeGreaterThan(loudest(h.played[0].plan));
  });

  it("stays inside CAV-007 when a Tension is heard, then chosen, before the first has finished", () => {
    const withRetire = focusHarness({ retire: true });
    withRetire.director.handleCue(previewed("tension", false));
    withRetire.advance(0.3);
    withRetire.director.handleCue(previewed("tension", true));
    expect(withRetire.played).toHaveLength(2);
    for (const sample of timeline(withRetire.log)) {
      expect(tenseAt(sample.sounding)).toBeLessThanOrEqual(COMFORT.tension.maxConcurrentVoices);
    }

    // A sink that cannot take the hover back must not be handed six tense
    // voices: the second is declined, and the first is the reading being heard.
    const without = focusHarness({ retire: false });
    without.director.handleCue(previewed("tension", false));
    without.advance(0.3);
    without.director.handleCue(previewed("tension", true));
    expect(without.played).toHaveLength(1);
    for (const sample of timeline(without.log)) {
      expect(tenseAt(sample.sounding)).toBeLessThanOrEqual(COMFORT.tension.maxConcurrentVoices);
    }

    // Given room, both are heard, in either kind of sink.
    for (const retire of [true, false]) {
      const spaced = focusHarness({ retire });
      spaced.director.handleCue(previewed("tension", false));
      spaced.advance(4);
      spaced.director.handleCue(previewed("tension", true));
      expect(spaced.played).toHaveLength(2);
    }
  });

  it("hands the sink only lawful plans at every bed a preview can be heard against", () => {
    const beds: { name: string; scale: number; prepare: (h: ReturnType<typeof focusHarness>) => void }[] = [
      { name: "released", scale: 1, prepare: () => {} },
      {
        name: "attending",
        scale: SCORE.attention.bedGainScale,
        prepare: (h) =>
          h.director.handleCue(
            cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
          ),
      },
      {
        name: "attuned",
        scale: SCORE.attunement.bedGainScale,
        prepare: (h) => h.director.handleCue(cue("attunement.changed", { active: true })),
      },
    ];
    for (const bed of beds) {
      const h = focusHarness({ retire: true });
      bed.prepare(h);
      h.played.length = 0;
      const bedGain = SCORE.grammar.bedGain * bed.scale;
      for (const intention of INTENTIONS) {
        for (const chosen of [false, true]) {
          h.advance(10);
          h.director.handleCue(previewed(intention, chosen));
          const plan = h.played.at(-1)!.plan;
          expect(auditComfort(plan, { bedGain })).toEqual([]);
          if (intention === "tension") {
            expect(plan.notes.filter((n) => n.tense).length).toBeLessThanOrEqual(
              COMFORT.tension.maxConcurrentVoices
            );
            expect(
              plan.notes.filter((n) => n.tense).reduce((sum, n) => sum + n.gain, 0)
            ).toBeLessThanOrEqual(tensionCeiling(bedGain) + 1e-9);
          }
        }
      }
    }
  });

  it("thins at reduced intensity, keeps its beating, and is silent at silent intensity", () => {
    const full = focusHarness({ retire: true });
    full.director.handleCue(previewed("tension", true));
    const reduced = focusHarness({ retire: true });
    reduced.director.setIntensity("reduced");
    reduced.director.handleCue(previewed("tension", true));
    expect(loudest(reduced.played[0].plan)).toBeLessThan(loudest(full.played[0].plan));
    expect(reduced.played[0].plan.beatings).toHaveLength(1);

    const silent = focusHarness({ retire: true });
    silent.director.setIntensity("silent");
    silent.director.handleCue(previewed("echo", true));
    expect(silent.played).toHaveLength(0);
  });
});

describe("a thread reopened", () => {
  it("returns to the thread's own phrase, softly, once", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(reopened("t1", "echo"));
    expect(h.played).toHaveLength(1);
    const { plan, atSeconds } = h.played[0];
    expect(atSeconds).toBeCloseTo(100 + HAND, 9);
    expect(plan.id).toBe("relation:t1:recall");
    expect(plan.intention).toBe("echo");
    expect(plan.meta.grammar).toBe("imitation");
    // It is the weave's own voices, not a lookalike: the same note identities.
    expect(plan.notes.every((n) => n.id.startsWith("relation:t1:"))).toBe(true);

    const chosen = focusHarness({ retire: true });
    chosen.director.handleCue(previewed("echo", true));
    expect(loudest(plan)).toBeLessThan(loudest(chosen.played[0].plan));

    // Once: asking again while it sounds does not restart it.
    h.advance(0.3);
    h.director.handleCue(reopened("t1", "echo"));
    expect(h.played).toHaveLength(1);
  });

  it("does not depend on what the record said of the thread (CAV-006)", () => {
    const openThread = cue("outcome.open-thread", {
      threadId: toThreadId("t1"),
      pair: [PAIR[0], PAIR[1]],
      intention: "echo",
      question: "Is there a work in which this can be demonstrated?",
      sharedFacet: CASTALIA_RELATIONS[0].sharedFacets[0],
    });
    const unresolved = cue("outcome.unresolved", {
      threadId: toThreadId("t1"),
      pair: [PAIR[0], PAIR[1]],
      intention: "echo",
      statement: "The Game has no grounded relation here yet.",
    });
    const priors: (PresentationCue | null)[] = [
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo")),
      openThread,
      unresolved,
      null,
    ];
    const plans = priors.map((prior) => {
      const h = focusHarness({ retire: true });
      if (prior !== null) h.director.handleCue(prior);
      h.advance(30);
      h.played.length = 0;
      h.director.handleCue(reopened("t1", "echo"));
      return h.played[0].plan;
    });
    for (const plan of plans) expect(plan).toEqual(plans[0]);
  });

  it("never depends on the record for a preview, a lock, or a sighting either", () => {
    const record = cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "tension"));
    const cues: PresentationCue[] = [
      sighted(COUNTERPOINT, "medium"),
      locked(),
      previewed("tension", true),
      previewed("ground", false),
    ];
    for (const focus of cues) {
      const bare = focusHarness({ retire: true });
      bare.director.handleCue(focus);
      const informed = focusHarness({ retire: true });
      informed.director.handleCue(record);
      informed.advance(30);
      informed.played.length = 0;
      informed.director.handleCue(focus);
      const a = bare.played[0].plan;
      const b = informed.played[0].plan;
      expect(b.notes.map((n) => [n.degree, n.gain, n.atSeconds])).toEqual(
        a.notes.map((n) => [n.degree, n.gain, n.atSeconds])
      );
    }
  });
});

describe("moments that end the looking", () => {
  it("lets a weave take the lane, and leaves the commit's landing unchanged", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(previewed("echo", true));
    h.advance(0.4);
    h.director.handleCue(cue("thread.woven", wovenPayload("t1", FIBONACCI, COUNTERPOINT, "echo")));
    expect(h.retired().map((entry) => entry.planId)).toEqual([h.played[0].plan.id]);
    expect(h.retired()[0].atSeconds).toBeCloseTo(100.4, 9);
    const landing = h.played.at(-1)!;
    expect(landing.plan.meta.grammar).toBe("landing");
    expect(landing.atSeconds).toBeCloseTo(100.4 + 0.25, 9);
  });

  it("lets a new Attend and a release of attention take the lane", () => {
    for (const ending of [
      cue("attention.enter", { conceptId: toConceptId(JUST), candidates: [] }),
      cue("attention.clear", {}),
    ]) {
      const h = focusHarness({ retire: true });
      h.director.handleCue(previewed("passage", false));
      h.advance(0.3);
      h.director.handleCue(ending);
      expect(h.retired().map((entry) => entry.planId)).toEqual([h.played[0].plan.id]);
    }
  });

  it("spaces sightings afresh after a new Attend, not from a bead that was sighted before it", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(sighted(COUNTERPOINT, "high"));
    h.advance(0.05);
    h.director.handleCue(cue("attention.enter", { conceptId: toConceptId(JUST), candidates: [] }));
    h.advance(0.01);
    h.director.handleCue(sighted(PRIME, "high"));
    const last = h.played.at(-1)!;
    expect(last.plan.id).toBe(`sighted:${PRIME}:high`);
    expect(last.atSeconds).toBeCloseTo(100.06 + HAND, 9);
  });

  it("forgets the lane on reset, so a stale plan is never retired into a new session", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(previewed("echo", true));
    h.director.reset();
    h.advance(0.1);
    h.director.handleCue(previewed("passage", true));
    expect(h.retired()).toHaveLength(0);
  });

  it("leaves every other cue as it was: a relation, an attention foreground, an ensemble", () => {
    const h = focusHarness({ retire: true });
    h.director.handleCue(
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    h.director.handleCue(
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
    );
    expect(h.played.map((entry) => entry.plan.kind)).toEqual(["relation", "attention"]);
    expect(h.retired()).toHaveLength(0);
  });
});

describe("the focus voice on the captioned path", () => {
  it("adds no caption of its own: src/runtime/captions already says each moment", () => {
    const h = focusHarness({ retire: true });
    const sequence: PresentationCue[] = [
      sighted(COUNTERPOINT, "high"),
      sightLost(),
      locked(),
      ...INTENTIONS.flatMap((intention) => [previewed(intention, false), previewed(intention, true)]),
      reopened("t1", "ground"),
    ];
    for (const focus of sequence) {
      h.advance(4);
      h.director.handleCue(focus);
    }
    expect(h.played.length).toBeGreaterThan(0);
    expect(h.captions).toHaveLength(0);
    expect(h.director.lastCaption()).toBeNull();
  });

  it("makes no sound at silent intensity and still asks nothing of the sink", () => {
    const h = focusHarness({ retire: true });
    h.director.setIntensity("silent");
    for (const focus of [sighted(JUST, "high"), locked(), previewed("tension", true), reopened("t1", "echo")]) {
      h.advance(1);
      h.director.handleCue(focus);
    }
    expect(h.played).toHaveLength(0);
  });
});

describe("a Study solved (M9-001)", () => {
  const solved = (
    conceptIds: readonly string[],
    overrides: Partial<CuePayloadMap["study.solved"]> = {}
  ): PresentationCue =>
    cue("study.solved", {
      studyId: "study.eschholz-1",
      by: "threads",
      threadIds: [toThreadId("t1"), toThreadId("t2")],
      conceptIds: conceptIds.map(toConceptId),
      marks: ["economical"],
      brief: "From Fibonacci Sequence to Prime Numbers in two threads",
      ...overrides,
    });

  const ANSWER = [FIBONACCI, COUNTERPOINT, PRIME] as const;

  it("takes a seat as an ensemble of the answer's own beads, as a completed motif does", () => {
    const { director, played, captions } = harness();
    director.handleCue(solved(ANSWER));
    expect(played).toHaveLength(1);
    const { plan } = played[0];
    expect(plan.kind).toBe("ensemble");
    expect(plan.meta.grammar).toBe("ensemble");
    expect(plan.meta.conceptIds).toEqual([...ANSWER]);
    expect(plan.notes.every((note) => note.role === "ensemble")).toBe(true);
    expect(captions.at(-1)?.text).toBe(
      "An ensemble enters: Fibonacci Sequence, Counterpoint, Prime Numbers."
    );
  });

  it("invents no grammar: the notes a motif over the same beads would play", () => {
    const study = harness();
    study.director.handleCue(solved(ANSWER));
    const motif = harness();
    motif.director.handleCue(
      cue("motif.completed", {
        motifKindId: toMotifKindId("canon"),
        conceptIds: ANSWER.map(toConceptId),
        threadIds: [toThreadId("t1"), toThreadId("t2")],
        reason: "A shared structure recurs across three concepts.",
      })
    );
    // Everything but the identity and the humanising sway, which is seeded by
    // the note's id and bounded to a fraction of a unit (`renderMotif`).
    const voice = (plan: VoicePlan) =>
      plan.notes.map(({ id: _id, atSeconds: _at, ...note }) => note);
    const solvedPlan = study.played[0].plan;
    const motifPlan = motif.played[0].plan;
    expect(voice(solvedPlan)).toEqual(voice(motifPlan));
    solvedPlan.notes.forEach((note, index) => {
      expect(Math.abs(note.atSeconds - motifPlan.notes[index].atSeconds)).toBeLessThan(0.1);
    });
    expect(study.played[0].atSeconds).toBe(motif.played[0].atSeconds);
  });

  it("cannot hear how the answer was marked or reached (CAV-006): the beads alone decide it", () => {
    const plain = harness();
    plain.director.handleCue(solved(ANSWER, { marks: [] }));
    const marked = harness();
    marked.director.handleCue(solved(ANSWER, { marks: ["economical", "wide", "varied"] }));
    expect(JSON.stringify(marked.played)).toBe(JSON.stringify(plain.played));
  });

  it("answers a silence with silence, and says nothing of its own", () => {
    const { director, played, captions } = harness();
    director.handleCue(solved([], { by: "silence", threadIds: [], marks: [] }));
    expect(played).toHaveLength(0);
    expect(captions).toHaveLength(0);
  });

  it("sounds nothing for a not yet: it is a caption, and the cue layer says it", () => {
    const { director, played, captions, spaces } = harness();
    director.handleCue(
      cue("study.not-yet", { studyId: "study.eschholz-1", statement: "can-be-done" })
    );
    expect(played).toHaveLength(0);
    expect(captions).toHaveLength(0);
    expect(spaces).toHaveLength(0);
  });
});

// ─── One musical time (ADR-016, M4-001) ─────────────────────────────────────

describe("one slot for the world in the room (ADR-016)", () => {
  /** The renderer's humanising sway at neutral phrasing: at most 0.04 of a unit (`renderMotif`). */
  const SWAY_UNITS = 0.04;
  const offUnit = (seconds: number, unit: number): number => {
    const units = seconds / unit;
    return Math.abs(units - Math.round(units));
  };
  const onsets = (plan: VoicePlan): number[] => plan.notes.map((note) => note.atSeconds);
  const attendedFigure = (slot: number): VoicePlan => {
    const { director, played } = harness(100, slot);
    director.handleCue(
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] })
    );
    expect(played).toHaveLength(1);
    return played[0].plan;
  };

  it("puts the attended figure on Tide's sixteenth: every onset a multiple of 0.15 s", () => {
    const plan = attendedFigure(2.4);
    expect(plan.notes.length).toBeGreaterThanOrEqual(10);
    for (const at of onsets(plan)) {
      expect(offUnit(at, 0.15)).toBeLessThanOrEqual(SWAY_UNITS + 1e-4);
    }
    // Not Castalia's gait under Tide's name: measured in the old unit, it misses.
    expect(Math.max(...onsets(plan).map((at) => offUnit(at, 0.125)))).toBeGreaterThan(0.1);
  });

  it("leaves Castalia's figure exactly as it was", () => {
    const today = planAttentionSpace({
      planId: `attention:${FIBONACCI}`,
      mode: CASTALIA_MODE,
      attended: { conceptId: FIBONACCI, motif: CASTALIA_LOOKUP.conceptMotif(FIBONACCI) },
      unitSeconds: 0.125,
      ambientGain: SCORE.grammar.bedGain,
      activeThreadCount: 0,
    }).foreground;
    expect(attendedFigure(2)).toEqual(today);
  });

  it("gives every world the gait of its own slot", () => {
    const castalia = onsets(attendedFigure(2));
    // Tide, Ember, Aurora.
    for (const slot of [2.4, 1.8, 2.2]) {
      const unit = slot / 16;
      onsets(attendedFigure(slot)).forEach((at, index) => {
        expect(offUnit(at, unit)).toBeLessThanOrEqual(SWAY_UNITS + 1e-4);
        // The same figure, drawn out or in with the slot.
        expect(at).toBeCloseTo(castalia[index] * (slot / 2), 4);
      });
    }
  });

  it("carries the slot into a relation and an ensemble as well", () => {
    const relation = (slot: number): number[] => {
      const { director, played } = harness(100, slot);
      director.handleCue(
        cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo"))
      );
      return onsets(played[0].plan);
    };
    const ensemble = (slot: number): number[] => {
      const { director, played } = harness(100, slot);
      director.handleCue(
        cue("motif.completed", {
          motifKindId: toMotifKindId("canon"),
          conceptIds: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
          threadIds: [toThreadId("t1")],
          reason: "A shared structure recurs across three concepts.",
        })
      );
      return onsets(played[0].plan);
    };
    for (const render of [relation, ensemble]) {
      const castalia = render(2);
      const tide = render(2.4);
      expect(tide).toHaveLength(castalia.length);
      tide.forEach((at, index) => expect(at).toBeCloseTo(castalia[index] * 1.2, 4));
    }
  });

  it("reads the slot per plan, from the sink", () => {
    let slot = 2;
    const played: Recorded[] = [];
    const sink: AudioSink = {
      now: () => 100,
      quantize: () => 100.25,
      quantizeHand: () => 100 + HAND,
      slotSeconds: () => slot,
      conduct: () => {},
      play: (plan, atSeconds) => {
        played.push({ plan, atSeconds });
      },
      setSpace: () => {},
      activeVoiceCount: () => 0,
      concludeAt: () => {},
    };
    const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
    const attend = cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] });
    director.handleCue(attend);
    slot = 2.4;
    director.handleCue(attend);
    const [before, after] = played.map((entry) => onsets(entry.plan));
    after.forEach((at, index) => expect(at).toBeCloseTo(before[index] * 1.2, 4));
  });

  it("keeps two seconds when the sink reports no usable slot", () => {
    const castalia = attendedFigure(2);
    for (const slot of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(attendedFigure(slot)).toEqual(castalia);
    }
  });
});

describe("the score as written, conducted (ADR-016)", () => {
  const performance: PerformanceScore = {
    sessionId: "s1",
    secondsPerBeat: 0.75,
    entries: [
      {
        threadId: "t1",
        order: 0,
        conceptIds: [FIBONACCI, COUNTERPOINT],
        intention: "echo",
        atSeconds: 0,
        durationSeconds: 3,
        voices: [
          {
            conceptId: FIBONACCI,
            role: "subject",
            degrees: [0, 4],
            rhythm: [2, 2],
            register: "mid",
            articulation: "plucked",
            timbre: "gut",
            atSeconds: 0,
            durationSeconds: 2,
            gain: 0.1,
            openEnded: false,
          },
        ],
        dynamic: 1,
        phrasing: { attack: 0.5, legato: 0.5, rubato: 0.5, weight: 0.5, breadth: 0.5 },
        outcomeKind: "documented",
        speaksForRecord: true,
        resolved: true,
        weight: 0.4,
        isClimax: true,
      },
    ],
    ensembles: [],
    unresolved: [],
    coda: {
      threadId: "t1",
      conceptIds: [FIBONACCI, COUNTERPOINT],
      atSeconds: 6,
      durationSeconds: 4,
      voices: [
        {
          conceptId: COUNTERPOINT,
          role: "answer",
          degrees: [7],
          rhythm: [1],
          register: "mid",
          articulation: "sustained",
          timbre: "glass",
          atSeconds: 6,
          durationSeconds: 3.5,
          gain: 0.05,
          openEnded: false,
        },
      ],
      resolves: true,
    },
    totalSeconds: 10,
  };

  /** Every kind of moment the director schedules a plan for, ten seconds apart. */
  const session = (): PresentationCue[] => [
    cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] }),
    sighted(COUNTERPOINT, "high"),
    locked(),
    previewed("tension", true),
    cue("thread.woven", wovenPayload("t1", FIBONACCI, COUNTERPOINT, "tension")),
    cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "tension")),
    cue("outcome.open-thread", {
      threadId: toThreadId("t2"),
      pair: [toConceptId(JUST), toConceptId(EQUAL)],
      intention: "echo",
      question: "Is there a work in which this can be demonstrated?",
      sharedFacet: CASTALIA_RELATIONS[0].sharedFacets[0],
    }),
    cue("outcome.unresolved", {
      threadId: toThreadId("t3"),
      pair: [toConceptId(PRIME), toConceptId(COUNTERPOINT)],
      intention: "ground",
      statement: "The Game has no grounded relation here yet.",
    }),
    reopened("t1", "tension"),
    cue("motif.completed", {
      motifKindId: toMotifKindId("canon"),
      conceptIds: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
      threadIds: [toThreadId("t1")],
      reason: "A shared structure recurs across three concepts.",
    }),
    cue("attunement.changed", { active: true }),
    cue("conclusion.perform", { performance }),
  ];

  /** A sink that logs, in the order asked, what it conducted and what it played. */
  function played(intensity: AudioIntensity) {
    let now = 100;
    const log: { kind: "conduct" | "play"; plan: VoicePlan; atSeconds: number }[] = [];
    const sink: AudioSink = {
      now: () => now,
      quantize: () => now + 0.25,
      quantizeHand: () => now + HAND,
      slotSeconds: () => 2,
      conduct: (plan, atSeconds) => {
        log.push({ kind: "conduct", plan, atSeconds });
      },
      play: (plan, atSeconds) => {
        log.push({ kind: "play", plan, atSeconds });
      },
      retire: () => {},
      setSpace: () => {},
      activeVoiceCount: () => 0,
      concludeAt: () => {},
    };
    const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP, intensity });
    for (const moment of session()) {
      now += 10;
      director.handleCue(moment);
    }
    return log;
  }

  const conducted = (log: ReturnType<typeof played>) =>
    log
      .filter((entry) => entry.kind === "conduct")
      .map(({ plan, atSeconds }) => ({ plan, atSeconds }));

  it("conducts every plan it plays, just before it plays it and at the same moment", () => {
    const log = played("full");
    const plays = log.filter((entry) => entry.kind === "play");
    // Attend, sighting, lock, preview, landing, three outcomes, recall, ensemble,
    // two Attunement channels… and the conclusion's sections.
    expect(plays.length).toBeGreaterThanOrEqual(13);
    log.forEach((entry, index) => {
      if (entry.kind !== "play") return;
      const before = log[index - 1];
      expect(before.kind).toBe("conduct");
      expect(before.plan.id).toBe(entry.plan.id);
      expect(before.atSeconds).toBe(entry.atSeconds);
    });
    expect(conducted(log)).toHaveLength(plays.length);
  });

  it("conducts the same written score at every intensity, silent included", () => {
    const full = conducted(played("full"));
    expect(conducted(played("reduced"))).toEqual(full);
    const silent = played("silent");
    expect(conducted(silent)).toEqual(full);
    // Muted, nothing is handed over to be heard.
    expect(silent.filter((entry) => entry.kind === "play")).toEqual([]);
  });

  it("conducts nothing the focus lane turns away", () => {
    // A sink that cannot take a Tension's hover back must not be handed a second
    // Tension on top of it; what is not scheduled is not on the score either.
    const h = focusHarness({ retire: false });
    h.director.handleCue(previewed("tension", false));
    h.advance(0.3);
    h.director.handleCue(previewed("tension", true));
    expect(h.played).toHaveLength(1);
    expect(h.conducted).toHaveLength(1);
    expect(h.conducted[0].plan.id).toBe(h.played[0].plan.id);
  });

  it("conducts a silent focus answer without letting it take the lane", () => {
    const h = focusHarness({ retire: true });
    h.director.setIntensity("silent");
    h.director.handleCue(sighted(COUNTERPOINT, "high"));
    h.advance(0.01);
    h.director.handleCue(sighted(JUST, "high"));
    expect(h.played).toHaveLength(0);
    expect(h.retired()).toHaveLength(0);
    // Both are on the score, each on the hand grid after its own cue: the first
    // spaced nothing, because nothing was heard.
    expect(h.conducted.map((entry) => [entry.plan.id, entry.atSeconds])).toEqual([
      [`sighted:${COUNTERPOINT}:high`, expect.closeTo(100 + HAND, 9)],
      [`sighted:${JUST}:high`, expect.closeTo(100.01 + HAND, 9)],
    ]);
  });
});

describe("the focus lane on the hand grid (ADR-016)", () => {
  const ORIGIN = 100;
  const SIXTEENTH = 2 / HAND_DIVISION;

  /** The production sink's hand grid: a conductor on the harness's clock, armed with Castalia's slot. */
  const theGrid = (armed = true) => {
    let t = 0;
    const grid = createConductor({ now: () => t });
    if (armed) grid.arm({ slotSeconds: 2, origin: ORIGIN });
    return (now: number, leadSeconds: number): number => {
      t = now;
      return grid.next(HAND_DIVISION, leadSeconds);
    };
  };
  const onGrid = (at: number): boolean => {
    const steps = (at - ORIGIN) / SIXTEENTH;
    return Math.abs(steps - Math.round(steps)) < 1e-6;
  };

  it("begins a lock, a preview and a return on the first sixteenth at least a lead ahead", () => {
    // Cues falling everywhere across one grid step.
    for (let i = 0; i <= 12; i += 1) {
      const cueAt = 100 + i * 0.011;
      for (const moment of [locked(), previewed("echo", true), reopened("t1", "echo")]) {
        const h = focusHarness({ retire: true, startAt: cueAt, hand: theGrid() });
        h.director.handleCue(moment);
        const at = h.played[0].atSeconds;
        expect(onGrid(at)).toBe(true);
        expect(at).toBeGreaterThanOrEqual(cueAt + LEAD - 1e-9);
        expect(at).toBeLessThan(cueAt + LEAD + SIXTEENTH);
      }
    }
  });

  it("puts a lens's sightings on the grid, a window apart, one heard at a time", () => {
    const h = focusHarness({ retire: true, hand: theGrid() });
    const beads = [COUNTERPOINT, JUST, PRIME, EQUAL];
    beads.forEach((bead, index) => {
      h.at(100 + index * 0.15);
      h.director.handleCue(sighted(bead, "high"));
    });
    expect(h.played.length).toBeGreaterThanOrEqual(beads.length - 1);
    for (const entry of h.played) expect(onGrid(entry.atSeconds)).toBe(true);

    const heard = new Set<string>();
    for (const sample of timeline(h.log)) {
      const plans = plansAt(sample.sounding);
      expect(plans.size).toBeLessThanOrEqual(1);
      plans.forEach((id) => heard.add(id));
    }
    // The bead the lens came to rest on is heard, and what was heard was spaced.
    expect(heard.has(`sighted:${EQUAL}:high`)).toBe(true);
    const onsetsHeard = h.played
      .filter((entry) => heard.has(entry.plan.id))
      .map((entry) => entry.atSeconds)
      .sort((a, b) => a - b);
    expect(onsetsHeard.length).toBeGreaterThanOrEqual(2);
    for (let index = 1; index < onsetsHeard.length; index += 1) {
      expect(onsetsHeard[index] - onsetsHeard[index - 1]).toBeGreaterThanOrEqual(
        FOCUS_VOICING.sighting.windowSeconds - 1e-9
      );
    }
  });

  it("replaces a preview wherever the cue falls, playing the new one whole", () => {
    for (let i = 0; i <= 12; i += 1) {
      const h = focusHarness({ retire: true, startAt: 100 + i * 0.011, hand: theGrid() });
      h.director.handleCue(previewed("tension", false));
      h.advance(0.3 + i * 0.007);
      h.director.handleCue(previewed("tension", true));
      // The hover had faded by the time the choice began, so the choice was
      // neither turned away as a second Tension nor ducked under the first.
      expect(h.played).toHaveLength(2);
      const alone = focusHarness({ retire: true });
      alone.director.handleCue(previewed("tension", true));
      expect(h.played[1].plan.notes.map((n) => n.gain)).toEqual(
        alone.played[0].plan.notes.map((n) => n.gain)
      );
      for (const sample of timeline(h.log)) {
        expect(plansAt(sample.sounding).size).toBeLessThanOrEqual(1);
        expect(tenseAt(sample.sounding)).toBeLessThanOrEqual(COMFORT.tension.maxConcurrentVoices);
      }
    }
  });

  it("never begins sooner than the lead, whatever the sink's grid answers", () => {
    const h = focusHarness({ retire: true, hand: (now) => now + 0.01 });
    h.director.handleCue(locked());
    expect(h.played[0].atSeconds).toBeCloseTo(100 + LEAD, 9);
  });

  it("begins a lead after the cue, as it always did, when there is no grid", () => {
    const h = focusHarness({ retire: true, hand: theGrid(false) });
    let now = 100;
    for (const moment of [
      sighted(COUNTERPOINT),
      locked(),
      previewed("passage"),
      reopened("t1", "ground"),
    ]) {
      now += 10;
      h.at(now);
      h.director.handleCue(moment);
      expect(h.played.at(-1)!.atSeconds).toBeCloseTo(now + LEAD, 9);
    }
  });

  it("leaves every moment that is not looking on the eighth", () => {
    const h = focusHarness({ retire: true, hand: theGrid() });
    const others: PresentationCue[] = [
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] }),
      cue("thread.woven", wovenPayload("t1", FIBONACCI, COUNTERPOINT, "echo")),
      cue("outcome.documented", documentedPayload("t1", FIBONACCI, COUNTERPOINT, "echo")),
      cue("motif.completed", {
        motifKindId: toMotifKindId("canon"),
        conceptIds: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
        threadIds: [toThreadId("t1")],
        reason: "A shared structure recurs across three concepts.",
      }),
    ];
    let now = 100;
    for (const moment of others) {
      now += 10;
      h.at(now);
      h.director.handleCue(moment);
      // The recording sink's quantize: the answer grid, not the hand's.
      expect(h.played.at(-1)!.atSeconds).toBeCloseTo(now + 0.25, 9);
    }
  });
});
