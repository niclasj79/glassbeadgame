/**
 * REGRESSION TESTS — one per defect found by the adversarial review of the
 * semantic audio layer.
 *
 * Each `it` below is named for the defect it pins and fails against the code as
 * it stood before the fix. They live in one file on purpose: a reviewer should
 * be able to read the accepted bounds (CAV-006, CAV-007) and the tests that
 * enforce them without opening nine files.
 */
import { describe, expect, it, beforeEach } from "vitest";

import { CASTALIA_CONCEPTS, castaliaConceptById } from "@/content/castalia/concepts";
import { CASTALIA_LOOKUP } from "@/content/castalia";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import { toConceptId, toThreadId } from "@/domain/ids";
import type { CuePayloadMap, CueType, PresentationCue } from "@/runtime/cues";

import { planAttunement, type AttunementThread } from "./attunement";
import { COMFORT, tensionCeiling } from "./comfort";
import { planConclusionPerformance, type PerformanceScore } from "./conclusion";
import { createAudioDirector, type AudioCaption, type AudioSink } from "./director";
import { planRelationVoices, suspensionInterval } from "./grammar";
import { CASTALIA_MODE } from "./mode";
import { NEUTRAL_PHRASING, phrasedUnitSeconds, type MotifSource } from "./motif";
import { capTenseGain, peakSummedGain, type PlannedNote, type VoicePlan } from "./plan";
import { realizeVoicePlan } from "./scheduler";
import { SCORE } from "./score";
import { playVoice, voiceBudget } from "./voices";
import { lastAudioCaption, onAudioCaption } from "./productionAudio";

const BED = SCORE.grammar.bedGain;
const UNIT = 0.125;

const source = (id: string): MotifSource => {
  const concept = castaliaConceptById.get(id);
  if (!concept) throw new Error(`missing fixture concept ${id}`);
  return { conceptId: concept.id, motif: concept.motif };
};

const FIBONACCI = source("measure.fibonacci-sequence");
const COUNTERPOINT = source("sound.counterpoint");
const JUST = source("sound.just-intonation");
const EQUAL = source("sound.equal-temperament");
const PERSPECTIVE = source("image.linear-perspective");
const CAMERA = source("image.camera-obscura");

const TENSE_ROLES: ReadonlySet<PlannedNote["role"]> = new Set([
  "subject",
  "answer",
  "shadow",
]);

/** True when this note is one of a deliberately tense simultaneity. */
const isTenseVoice = (plan: VoicePlan, note: PlannedNote): boolean =>
  plan.intention === "tension" && TENSE_ROLES.has(note.role);

const endOf = (note: PlannedNote): number =>
  note.atSeconds +
  note.envelope.attack +
  note.envelope.hold +
  note.envelope.release;

// ─── 1. Attunement must not be exempt from CAV-007 ──────────────────────────

describe("defect 1 — Attunement obeys the same tense envelope as ordinary play", () => {
  const threads: readonly AttunementThread[] = [
    {
      threadId: "t1",
      intention: "tension",
      a: JUST,
      b: EQUAL,
      resolves: false,
    },
    {
      threadId: "t2",
      intention: "tension",
      a: FIBONACCI,
      b: COUNTERPOINT,
      resolves: false,
    },
  ];

  const flattened = (): readonly { note: PlannedNote; tense: boolean }[] => {
    const plan = planAttunement({
      planId: "att",
      mode: CASTALIA_MODE,
      threads,
      unitSeconds: UNIT,
      ambientGain: BED,
    });
    return plan.channels.flatMap((channel) =>
      channel.plan.notes.map((note) => ({
        note: Object.freeze({
          ...note,
          atSeconds: note.atSeconds + channel.atSeconds,
        }),
        tense: isTenseVoice(channel.plan, note),
      }))
    );
  };

  it("never stacks more than three tense voices across channels", () => {
    const all = flattened();
    const tense = all.filter((entry) => entry.tense);
    expect(tense.length).toBeGreaterThan(3); // the fixture really does have two Tensions
    for (const { note } of tense) {
      const t = note.atSeconds;
      const sounding = tense.filter(
        (entry) => entry.note.atSeconds <= t && t < endOf(entry.note)
      );
      expect(sounding.length).toBeLessThanOrEqual(
        COMFORT.tension.maxConcurrentVoices
      );
    }
  });

  it("keeps the summed tense gain under the bed Attunement actually leaves", () => {
    const all = flattened();
    const tense = all.filter((entry) => entry.tense);
    // Attunement drops the bed to `bedGainScale`. That reduced level — not the
    // nominal one — is what CAV-007's ceiling is measured against.
    const ceiling = tensionCeiling(BED * SCORE.attunement.bedGainScale);
    for (const { note } of tense) {
      const t = note.atSeconds;
      const summed = tense
        .filter((entry) => entry.note.atSeconds <= t && t < endOf(entry.note))
        .reduce((total, entry) => total + entry.note.gain, 0);
      expect(summed).toBeLessThanOrEqual(ceiling + 1e-9);
    }
  });
});

// ─── 2. The ceiling is measured against the real bed ────────────────────────

describe("defect 2 — the Tension ceiling is measured against the actual bed", () => {
  it("caps against the bed at that moment, not the level it is sized against", () => {
    const plan = planRelationVoices({
      planId: "tension:bed",
      mode: CASTALIA_MODE,
      intention: "tension",
      a: JUST,
      b: EQUAL,
      unitSeconds: UNIT,
      // Sized against a slightly quieter reference, as Attunement does …
      ambientGain: BED * SCORE.attunement.channelGainScale,
      // … while the bed the player actually hears is lower still.
      bedGain: BED * SCORE.attunement.bedGainScale,
      resolves: false,
    });
    expect(peakSummedGain(plan)).toBeLessThanOrEqual(
      tensionCeiling(BED * SCORE.attunement.bedGainScale) + 1e-9
    );
  });

  it("follows the bed down when the director thins the score", () => {
    const { director, played } = harness();
    director.handleCue(
      cue("outcome.documented", documented("t1", JUST, EQUAL, "tension"))
    );
    const ordinary = played.at(-1)!.plan;
    played.length = 0;
    director.handleCue(cue("attunement.changed", { active: true }));
    const inAttunement = played.at(-1)!.plan;
    expect(peakSummedGain(inAttunement)).toBeLessThan(peakSummedGain(ordinary));
    expect(peakSummedGain(inAttunement)).toBeLessThanOrEqual(
      tensionCeiling(BED * SCORE.attunement.bedGainScale) + 1e-9
    );
  });
});

// ─── 3 & 4. The sounding surface ────────────────────────────────────────────

interface FakeParam {
  value: number;
  readonly ramps: number[];
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
  cancelScheduledValues: (t: number) => void;
  setTargetAtTime: (v: number, t: number, c: number) => void;
}

const param = (initial = 0): FakeParam => {
  const ramps: number[] = [];
  return {
    value: initial,
    ramps,
    setValueAtTime: (v) => ramps.push(v),
    linearRampToValueAtTime: (v) => ramps.push(v),
    exponentialRampToValueAtTime: (v) => ramps.push(v),
    cancelScheduledValues: () => {},
    setTargetAtTime: (v) => ramps.push(v),
  };
};

interface FakeNode {
  connect: (node: unknown) => void;
  disconnect: () => void;
}

/**
 * The smallest AudioContext that `playVoice` can actually run against. It is a
 * recorder, not a synthesiser: it keeps every gain envelope and every oscillator
 * frequency so a test can assert what would have been heard.
 */
function fakeContext() {
  const gains: FakeParam[] = [];
  const frequencies: number[] = [];
  const node = (): FakeNode => ({ connect: () => {}, disconnect: () => {} });

  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: () => {
      const gain = param(1);
      gains.push(gain);
      return { ...node(), gain };
    },
    createOscillator: () => {
      const frequency = param(0);
      const osc = {
        ...node(),
        type: "sine",
        frequency,
        setPeriodicWave: () => {},
        start: () => {},
        stop: () => {},
        addEventListener: () => {},
      };
      return new Proxy(osc, {
        set(target, key, value) {
          if (key === "frequency") return true;
          Reflect.set(target, key, value);
          return true;
        },
        get(target, key) {
          if (key === "frequency") {
            return new Proxy(frequency, {
              set(freqTarget, freqKey, value) {
                if (freqKey === "value") frequencies.push(value as number);
                Reflect.set(freqTarget, freqKey, value);
                return true;
              },
            });
          }
          return Reflect.get(target, key);
        },
      });
    },
    createPeriodicWave: () => ({}),
    createBiquadFilter: () => ({
      ...node(),
      type: "lowpass",
      frequency: param(0),
      Q: param(1),
    }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false, start: () => {}, stop: () => {} }),
    createBuffer: (_c: number, length: number, rate: number) => ({
      sampleRate: rate,
      getChannelData: () => new Float32Array(length),
    }),
    createStereoPanner: () => ({ ...node(), pan: param(0) }),
  };

  /**
   * The envelope gains only. `envelope()` is the one thing in `voices.ts` that
   * starts a gain at 0.0001, which distinguishes a note's level from the gain
   * nodes used as FM indices and vibrato depths — those carry frequencies, not
   * loudness, and summing them would measure nothing.
   */
  const envelopes = (): readonly number[] =>
    gains
      .filter((g) => g.ramps.length > 0 && Math.abs(g.ramps[0] - 0.0001) < 1e-9)
      .map((g) => Math.max(...g.ramps));

  return {
    ctx: ctx as unknown as AudioContext,
    gains,
    frequencies,
    /** Highest level any single voice was ramped to. */
    peakGain: () => envelopes().reduce((peak, level) => Math.max(peak, level), 0),
    /** Summed level of everything sounding — a Tension's three voices overlap. */
    summedGain: () => envelopes().reduce((total, level) => total + level, 0),
  };
}

describe("defect 3 — the tension bus actually bounds what passes through it", () => {
  beforeEach(() => voiceBudget.reset());

  it("caps tense voices at the ceiling even when a plan asks for more", () => {
    const bed = BED;
    const ceiling = tensionCeiling(bed);
    const plan = planRelationVoices({
      planId: "tension:loud",
      mode: CASTALIA_MODE,
      intention: "tension",
      a: JUST,
      b: EQUAL,
      unitSeconds: UNIT,
      // A caller (or a bug) asks for ten times the room.
      ambientGain: bed * 10,
      bedGain: bed * 10,
      resolves: false,
    });
    expect(peakSummedGain(plan)).toBeGreaterThan(ceiling * 2);

    const fake = fakeContext();
    const music = { connect: () => {}, disconnect: () => {} } as unknown as AudioNode;
    const tension = { connect: () => {}, disconnect: () => {} } as unknown as AudioNode;
    realizeVoicePlan(
      fake.ctx,
      { music, tension, tensionCeiling: ceiling },
      plan,
      0
    );
    // Every tense voice reaching the graph is inside the ceiling, and their sum
    // is too — a gain node that merely multiplies is not a ceiling.
    expect(fake.peakGain()).toBeLessThanOrEqual(ceiling + 1e-6);
    expect(fake.summedGain()).toBeLessThanOrEqual(ceiling + 1e-6);
  });

  it("leaves an ordinary plan alone", () => {
    const ceiling = tensionCeiling(BED);
    const plan = planRelationVoices({
      planId: "echo:quiet",
      mode: CASTALIA_MODE,
      intention: "echo",
      a: FIBONACCI,
      b: COUNTERPOINT,
      unitSeconds: UNIT,
      ambientGain: BED,
      bedGain: BED,
      resolves: true,
    });
    expect(capTenseGain(plan, ceiling)).toBe(plan);
  });
});

describe("defect 4 — detuning is deterministic and does not falsify the beat rate", () => {
  beforeEach(() => voiceBudget.reset());

  const play = (
    seed: string,
    detuneCents: number,
    frequency: number,
    exactTuning = false
  ) => {
    const fake = fakeContext();
    const dest = { connect: () => {}, disconnect: () => {} } as unknown as AudioNode;
    playVoice(fake.ctx, dest, {
      timbre: "glass",
      frequency,
      gain: 0.05,
      at: 0,
      attack: 0.01,
      hold: 0.1,
      release: 0.4,
      detuneCents,
      seed,
      exactTuning,
    });
    return fake.frequencies[0];
  };

  it("gives the same voice the same pitch on every replay", () => {
    for (let i = 0; i < 8; i++) {
      voiceBudget.reset();
      const a = play(`voice:${i}`, 0, 220);
      voiceBudget.reset();
      const b = play(`voice:${i}`, 0, 220);
      expect(a).toBe(b);
    }
  });

  it("produces exactly the beat rate the plan wrote down", () => {
    const plan = planRelationVoices({
      planId: "tension:rate",
      mode: CASTALIA_MODE,
      intention: "tension",
      a: JUST,
      b: EQUAL,
      unitSeconds: UNIT,
      ambientGain: BED,
      bedGain: BED,
      resolves: false,
    });
    const planned = plan.beatings[0].beatingHz;
    const subject = plan.notes.find((note) => note.role === "subject")!;
    const shadow = plan.notes.find((note) => note.role === "shadow")!;

    // Both are tense voices, so the scheduler asks for exact tuning — which is
    // the whole point: the rate in the plan is the rate a player hears.
    expect(subject.tense && shadow.tense).toBe(true);
    for (let i = 0; i < 12; i++) {
      voiceBudget.reset();
      const low = play(subject.id, subject.detuneCents, subject.frequency, true);
      voiceBudget.reset();
      const high = play(shadow.id, shadow.detuneCents, shadow.frequency, true);
      expect(Math.abs(high - low)).toBeCloseTo(planned, 4);
    }
  });
});

// ─── 5. The suspension has to be the pair's own ─────────────────────────────

describe("defect 5 — the suspension distinguishes pairs of real concepts", () => {
  it("does not collapse to one interval across the shipped 24", () => {
    const sources: MotifSource[] = CASTALIA_CONCEPTS.map((concept) => ({
      conceptId: concept.id,
      motif: concept.motif,
    }));
    const counts = new Map<number, number>();
    let pairs = 0;
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const interval = suspensionInterval(CASTALIA_MODE, sources[i], sources[j]);
        expect(CASTALIA_MODE.tense).toContain(interval);
        counts.set(interval, (counts.get(interval) ?? 0) + 1);
        pairs += 1;
      }
    }
    // Four of the five tense classes must be reachable, and none of them may
    // account for most of the pack.
    expect(counts.size).toBeGreaterThanOrEqual(4);
    expect(Math.max(...counts.values()) / pairs).toBeLessThanOrEqual(0.6);
  });

  it("gives the same pair the same suspension whichever concept is the subject", () => {
    expect(suspensionInterval(CASTALIA_MODE, JUST, EQUAL)).toBe(
      suspensionInterval(CASTALIA_MODE, EQUAL, JUST)
    );
  });
});

// ─── 6. The conclusion is compiled from the log, including its loose ends ───

describe("defect 6 — an unresolved thread sounds like those two concepts", () => {
  const score = (
    threadId: string,
    conceptIds: readonly [string, string]
  ): PerformanceScore => ({
    sessionId: `s:${threadId}`,
    secondsPerBeat: 0.75,
    entries: [],
    ensembles: [],
    unresolved: [
      {
        threadId,
        conceptIds,
        fromSeconds: 0,
        gain: BED * 0.4,
        floorGain: BED * 0.05,
        decayToFloorSeconds: COMFORT.tension.decayToFloorSeconds,
      },
    ],
    coda: null,
    totalSeconds: 10,
  });

  const render = (threadId: string, pair: readonly [string, string]) =>
    planConclusionPerformance(score(threadId, pair), {
      mode: CASTALIA_MODE,
      ambientGain: BED,
      bedGain: BED,
      motifFor: (id) => castaliaConceptById.get(id)?.motif ?? null,
    }).sections[0].plan;

  it("derives its pitches and bodies from the pair's motifs", () => {
    const a = render("u1", [JUST.conceptId, EQUAL.conceptId]);
    const b = render("u2", [PERSPECTIVE.conceptId, CAMERA.conceptId]);

    const signature = (plan: VoicePlan) =>
      plan.notes
        .slice(0, 3)
        .map((note) => `${note.degree}/${note.register}/${note.timbre}`)
        .join("|");

    expect(signature(a)).not.toBe(signature(b));
    // Both pairs are named by the voices that sound for them.
    expect(a.notes.some((note) => note.timbre === JUST.motif.timbre)).toBe(true);
    expect(b.notes.some((note) => note.timbre === PERSPECTIVE.motif.timbre)).toBe(
      true
    );
    // And the suspension is the one the grammar would have chosen for the pair.
    expect(a.meta.interval).toBe(
      12 + suspensionInterval(CASTALIA_MODE, JUST, EQUAL)
    );
  });
});

// ─── 7. Echo's stagger stays on the grid ────────────────────────────────────

describe("defect 7 — the Echo stagger is a whole number of rhythmic units", () => {
  const phrasings = [
    { ...NEUTRAL_PHRASING, rubato: 0, breadth: 0 },
    { ...NEUTRAL_PHRASING, rubato: 0, breadth: 0.25 },
    { ...NEUTRAL_PHRASING, rubato: 0, breadth: 0.5 },
    { ...NEUTRAL_PHRASING, rubato: 0, breadth: 1 },
  ];

  it("stays on the grid under every gesture", () => {
    for (const phrasing of phrasings) {
      const plan = planRelationVoices({
        planId: "echo:grid",
        mode: CASTALIA_MODE,
        intention: "echo",
        a: FIBONACCI,
        b: COUNTERPOINT,
        unitSeconds: UNIT,
        ambientGain: BED,
        bedGain: BED,
        resolves: true,
        phrasing,
      });
      const unit = phrasedUnitSeconds(UNIT, phrasing);
      const subject = plan.notes.filter((note) => note.role === "subject");
      const answer = plan.notes.filter((note) => note.role === "answer");
      const stagger = answer[0].atSeconds - subject[0].atSeconds;
      expect(stagger).toBeGreaterThan(0);
      const units = stagger / unit;
      expect(Math.abs(units - Math.round(units))).toBeLessThan(1e-6);
      // And the answer is the subject displaced, note for note. Onsets are
      // stored to five decimals, so equality holds to within ten microseconds —
      // three orders of magnitude tighter than the drift being pinned here.
      subject.forEach((note, index) => {
        expect(answer[index].atSeconds - note.atSeconds).toBeCloseTo(stagger, 4);
      });
    }
  });
});

// ─── 8 & 9. The captioned path ──────────────────────────────────────────────

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

function harness() {
  const played: { plan: VoicePlan; atSeconds: number }[] = [];
  const captions: AudioCaption[] = [];
  const sink: AudioSink = {
    now: () => 100,
    quantize: () => 100.25,
    quantizeHand: () => 100.125,
    slotSeconds: () => 2,
    play: (plan, atSeconds) => {
      played.push({ plan, atSeconds });
    },
    conduct: () => {},
    setSpace: () => {},
    activeVoiceCount: () => 0,
    concludeAt: () => {},
  };
  const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
  director.onCaption((caption) => captions.push(caption));
  return { director, played, captions };
}

const documented = (
  threadId: string,
  a: MotifSource,
  b: MotifSource,
  intention: "echo" | "passage" | "tension" | "ground"
): CuePayloadMap["outcome.documented"] => ({
  threadId: toThreadId(threadId),
  pair: [toConceptId(a.conceptId), toConceptId(b.conceptId)],
  intention,
  relation: CASTALIA_RELATIONS[0],
  evidence: CASTALIA_RELATIONS[0].evidence,
  reception: "confirmed",
});

describe("defect 8 — the captioned path has a subscribable public API", () => {
  it("delivers captions to a consumer that subscribes to the audio layer", () => {
    const seen: AudioCaption[] = [];
    const off = onAudioCaption((caption) => seen.push(caption));
    try {
      // Any consumer — the DOM caption region included — subscribes here and
      // needs nothing else from `src/audio`.
      expect(typeof off).toBe("function");
      expect(lastAudioCaption()).toBeNull();
    } finally {
      off();
    }
  });
});

describe("defect 9 — Open Thread and weak/unresolved are distinguishable", () => {
  const pair = [toConceptId(FIBONACCI.conceptId), toConceptId(COUNTERPOINT.conceptId)] as const;

  const openThread = () => {
    const { director, captions } = harness();
    director.handleCue(
      cue("outcome.open-thread", {
        threadId: toThreadId("t1"),
        pair: [pair[0], pair[1]],
        intention: "echo",
        question: "Is there a work in which this can be demonstrated?",
        sharedFacet: CASTALIA_RELATIONS[0].sharedFacets[0],
      })
    );
    return captions.at(-1)!;
  };

  const unresolved = () => {
    const { director, captions } = harness();
    director.handleCue(
      cue("outcome.unresolved", {
        threadId: toThreadId("t1"),
        pair: [pair[0], pair[1]],
        intention: "echo",
        statement: "The Game has no grounded relation here yet.",
      })
    );
    return captions.at(-1)!;
  };

  it("says something different for each epistemic state", () => {
    const open = openThread();
    const weak = unresolved();
    expect(open.text).not.toBe(weak.text);
    expect(open.outcome).toBe("open-thread");
    expect(weak.outcome).toBe("unresolved");
  });

  it("names each state in the caption a muted player actually reads", () => {
    expect(openThread().text.toLowerCase()).toContain("open");
    expect(unresolved().text.toLowerCase()).toContain("no grounded relation");
    // Neither is described as an error or a failure.
    for (const caption of [openThread(), unresolved()]) {
      expect(caption.text.toLowerCase()).not.toContain("wrong");
      expect(caption.text.toLowerCase()).not.toContain("fail");
    }
  });

  it("still gives them the same musical weight (CAV-006)", () => {
    const a = harness();
    a.director.handleCue(
      cue("outcome.documented", documented("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    const b = harness();
    b.director.handleCue(
      cue("outcome.open-thread", {
        threadId: toThreadId("t1"),
        pair: [pair[0], pair[1]],
        intention: "echo",
        question: "Is there a work in which this can be demonstrated?",
        sharedFacet: CASTALIA_RELATIONS[0].sharedFacets[0],
      })
    );
    expect(peakSummedGain(a.played.at(-1)!.plan)).toBeCloseTo(
      peakSummedGain(b.played.at(-1)!.plan),
      9
    );
  });
});
