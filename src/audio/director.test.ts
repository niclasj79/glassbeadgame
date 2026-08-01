import { describe, expect, it } from "vitest";

import { CASTALIA_LOOKUP } from "@/content/castalia";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import type { RelationIntention } from "@/domain/events";
import { toConceptId, toMotifKindId, toThreadId } from "@/domain/ids";
import type { CuePayloadMap, CueType, PresentationCue } from "@/runtime/cues";
import {
  createAudioDirector,
  isPerformanceScore,
  type AudioCaption,
  type AudioSink,
} from "./director";
import type { PerformanceScore } from "./conclusion";
import { peakSummedGain, type VoicePlan } from "./plan";
import { SCORE } from "./score";

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const JUST = "sound.just-intonation";
const EQUAL = "sound.equal-temperament";

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

function harness(now = 100) {
  const played: Recorded[] = [];
  const spaces: { density: number; bed: number }[] = [];
  const captions: AudioCaption[] = [];
  const endings: { atSeconds: number; fadeSeconds: number }[] = [];
  let voices = 0;

  const sink: AudioSink = {
    now: () => now,
    quantize: () => now + 0.25,
    play: (plan, atSeconds) => {
      played.push({ plan, atSeconds });
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
    spaces,
    captions,
    endings,
    setVoices: (count: number) => {
      voices = count;
    },
  };
}

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

  it("changes the sound the instant an intention is armed", () => {
    const { director, played } = harness();
    const heard: number[] = [];
    for (const intention of ["echo", "passage", "tension", "ground"] as const) {
      director.handleCue(
        cue("intention.armed", { conceptId: toConceptId(FIBONACCI), intention })
      );
      heard.push(played.at(-1)!.plan.notes[0].degree);
    }
    expect(played).toHaveLength(4);
    // Four intentions, four different previews — arming is a tool, not a label.
    expect(new Set(heard).size).toBe(4);
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
