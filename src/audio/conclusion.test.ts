import { describe, expect, it } from "vitest";

import { castaliaConceptById } from "@/content/castalia/concepts";
import type { ConclusionPerformance } from "@/domain/performance";
import { COMFORT, tensionCeiling } from "./comfort";
import {
  planConclusionPerformance,
  renderPerformedVoice,
  type ConclusionRenderOptions,
  type PerformanceScore,
  type PerformedCoda,
  type PerformedEntry,
  type PerformedVoice,
} from "./conclusion";
import { CASTALIA_MODE, isStable, isTense, registerIndex } from "./mode";
import {
  auditComfort,
  noteEndSeconds,
  noteLifetime,
  peakSummedGain,
} from "./plan";
import { SCORE } from "./score";

/**
 * INTERFACE ASSUMPTION, pinned.
 *
 * `PerformanceScore` is deliberately a narrow structural subset of the domain's
 * `ConclusionPerformance`, so the two packages can be edited independently. This
 * line is what stops that from becoming a hopeful comment: if the compiler
 * accepts it, the audio layer can render whatever the domain compiles.
 */
const _assignable = (performance: ConclusionPerformance): PerformanceScore =>
  performance;
void _assignable;

const BED = SCORE.grammar.bedGain;

/**
 * The render seam. `motifFor` is the real content pack, because an unresolved
 * thread has to sound like the two concepts it names rather than like a
 * placeholder — the pitches are looked up here exactly as the director looks
 * them up in production.
 */
const RENDER: ConclusionRenderOptions = {
  mode: CASTALIA_MODE,
  ambientGain: BED,
  bedGain: BED,
  motifFor: (id) => castaliaConceptById.get(id)?.motif ?? null,
};

const voice = (overrides: Partial<PerformedVoice> = {}): PerformedVoice => ({
  conceptId: "measure.fibonacci-sequence",
  role: "subject",
  degrees: [0, 4, 7],
  rhythm: [2, 2, 4],
  register: "mid",
  articulation: "plucked",
  timbre: "gut",
  atSeconds: 0,
  durationSeconds: 2,
  gain: 0.1,
  openEnded: false,
  ...overrides,
});

const entry = (overrides: Partial<PerformedEntry> = {}): PerformedEntry => ({
  threadId: "t1",
  order: 0,
  conceptIds: ["measure.fibonacci-sequence", "sound.counterpoint"],
  intention: "echo",
  atSeconds: 0,
  durationSeconds: 3,
  voices: [voice()],
  dynamic: 1,
  phrasing: { attack: 0.5, legato: 0.5, rubato: 0.5, weight: 0.5, breadth: 0.5 },
  outcomeKind: "documented",
  speaksForRecord: true,
  resolved: true,
  weight: 0.5,
  isClimax: false,
  ...overrides,
});

const coda = (overrides: Partial<PerformedCoda> = {}): PerformedCoda => ({
  threadId: "t1",
  conceptIds: ["measure.fibonacci-sequence", "sound.counterpoint"],
  atSeconds: 10,
  durationSeconds: 4,
  voices: [
    voice({
      conceptId: "measure.fibonacci-sequence",
      role: "ground",
      degrees: [0],
      rhythm: [1],
      register: "low",
      articulation: "sustained",
      atSeconds: 10,
      durationSeconds: 4,
    }),
    voice({
      conceptId: "sound.counterpoint",
      role: "answer",
      degrees: [6],
      rhythm: [1],
      register: "mid",
      articulation: "sustained",
      atSeconds: 10.5,
      durationSeconds: 3.5,
    }),
  ],
  resolves: true,
  ...overrides,
});

const score = (overrides: Partial<PerformanceScore> = {}): PerformanceScore => ({
  sessionId: "s1",
  secondsPerBeat: 0.75,
  entries: [entry()],
  ensembles: [],
  unresolved: [],
  coda: null,
  totalSeconds: 12,
  ...overrides,
});

describe("rendering a compiled performance", () => {
  it("enters threads in creation order, not in the order the array happened to be in", () => {
    const plan = planConclusionPerformance(
      score({
        entries: [
          entry({ threadId: "third", order: 2, atSeconds: 8 }),
          entry({ threadId: "first", order: 0, atSeconds: 0 }),
          entry({ threadId: "second", order: 1, atSeconds: 4 }),
        ],
      }),
      RENDER
    );
    expect(plan.sections.map((s) => s.threadId)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("places each entry exactly where the compiler put it", () => {
    const plan = planConclusionPerformance(
      score({ entries: [entry({ atSeconds: 4.25 })] }),
      RENDER
    );
    expect(plan.sections[0].atSeconds).toBe(4.25);
  });

  /**
   * Found by driving the running build. The scheduler plays a plan at a moment
   * and adds each note's own time to it, so note times are section-relative;
   * entries and ensembles were handing it the compiler's *absolute* times while
   * also being played at the section's absolute time. Every entry after the
   * first sounded at twice its offset, and a real four-thread conclusion spread
   * thirty seconds wider than the score it claims to reconstruct. The fixtures
   * all used voices at 0, which is why nothing had caught it.
   */
  it("states an entry's time once, so the scheduler cannot add it twice", () => {
    const plan = planConclusionPerformance(
      score({
        entries: [
          entry({
            atSeconds: 4.25,
            voices: [
              voice({ atSeconds: 4.25 }),
              voice({ conceptId: "b", role: "answer", atSeconds: 5.75 }),
            ],
          }),
        ],
      }),
      RENDER
    );
    const section = plan.sections[0];
    // Where the note actually sounds is section + note, and that must be where
    // the compiler put the voice.
    const onsets = section.plan.notes
      .filter((note) => note.id.endsWith(":0"))
      .map((note) => section.atSeconds + note.atSeconds);
    expect(onsets).toEqual([4.25, 5.75]);
  });

  it("adds no rule of its own about outcome kind — equal weight stays equal", () => {
    const documented = entry({ threadId: "d", resolved: true });
    const open = entry({
      threadId: "o",
      order: 1,
      resolved: false,
      voices: [voice({ openEnded: true })],
    });
    const plan = planConclusionPerformance(
      score({ entries: [documented, open] }),
      RENDER
    );
    const [a, b] = plan.sections;
    expect(peakSummedGain(a.plan)).toBeCloseTo(peakSummedGain(b.plan), 9);
    expect(a.plan.notes).toHaveLength(b.plan.notes.length);
    // The only difference is whether it closes.
    expect(a.plan.meta.resolves).toBe(true);
    expect(b.plan.meta.resolves).toBe(false);
  });

  it("ends an open line on an unresolved degree, at full length", () => {
    const notes = renderPerformedVoice(voice({ openEnded: true }), {
      mode: CASTALIA_MODE,
      idPrefix: "v",
      phrasing: { attack: 0.5, legato: 0.5, rubato: 0.5, weight: 0.5, breadth: 0.5 },
      gainScale: 1,
    });
    const closed = renderPerformedVoice(voice({ openEnded: false }), {
      mode: CASTALIA_MODE,
      idPrefix: "v",
      phrasing: { attack: 0.5, legato: 0.5, rubato: 0.5, weight: 0.5, breadth: 0.5 },
      gainScale: 1,
    });
    expect(notes).toHaveLength(closed.length);
    expect(notes.at(-1)!.openEnded).toBe(true);
    expect(isTense(CASTALIA_MODE, notes.at(-1)!.degree)).toBe(true);
    expect(notes.at(-1)!.gain).toBeCloseTo(closed.at(-1)!.gain, 9);
  });

  it("normalises the compiled rhythm into the compiled duration", () => {
    const notes = renderPerformedVoice(
      voice({ degrees: [0, 2, 4], rhythm: [1, 1, 2], durationSeconds: 4 }),
      {
        mode: CASTALIA_MODE,
        idPrefix: "v",
        phrasing: { attack: 0.5, legato: 0.5, rubato: 0.5, weight: 0.5, breadth: 0.5 },
        gainScale: 1,
      }
    );
    expect(notes.map((n) => n.atSeconds)).toEqual([0, 1, 2]);
  });

  it("lets gesture phrasing shape the onset without changing the notes", () => {
    const sharp = planConclusionPerformance(
      score({
        entries: [
          entry({
            voices: [voice({ articulation: "bowed" })],
            phrasing: { attack: 1, legato: 0.5, rubato: 0.5, weight: 0.5, breadth: 0.5 },
          }),
        ],
      }),
      RENDER
    );
    const drawn = planConclusionPerformance(
      score({
        entries: [
          entry({
            voices: [voice({ articulation: "bowed" })],
            phrasing: { attack: 0, legato: 0.5, rubato: 0.5, weight: 0.5, breadth: 0.5 },
          }),
        ],
      }),
      RENDER
    );
    expect(sharp.sections[0].plan.notes[0].envelope.attack).toBeLessThan(
      drawn.sections[0].plan.notes[0].envelope.attack
    );
    expect(sharp.sections[0].plan.notes.map((n) => n.degree)).toEqual(
      drawn.sections[0].plan.notes.map((n) => n.degree)
    );
  });

  it("keeps an unresolved Tension sounding to the end, in bounded voices", () => {
    const plan = planConclusionPerformance(
      score({
        totalSeconds: 60,
        unresolved: [
          {
            threadId: "u1",
            conceptIds: ["sound.just-intonation", "sound.equal-temperament"],
            fromSeconds: 10,
            gain: 0.09,
            floorGain: 0.02,
            decayToFloorSeconds: 12,
          },
        ],
      }),
      RENDER
    );
    const section = plan.sections.find((s) => s.kind === "unresolved")!;
    expect(section.atSeconds).toBe(10);
    expect(section.plan.meta.resolves).toBe(false);
    expect(section.plan.notes.every((note) => note.openEnded)).toBe(true);
    // Re-stated rather than held open: instability persists, voices do not.
    expect(section.plan.beatings.length).toBeGreaterThan(1);
    expect(section.plan.beatings.length).toBeLessThanOrEqual(
      SCORE.conclusion.unresolvedRepeats
    );
    for (const note of section.plan.notes) {
      expect(noteLifetime(note)).toBeLessThanOrEqual(COMFORT.tension.lifetimeSeconds);
    }
    for (const beat of section.plan.beatings) {
      expect(beat.beatingHz).toBeGreaterThanOrEqual(COMFORT.beating.minHz);
      expect(beat.beatingHz).toBeLessThanOrEqual(COMFORT.beating.maxHz);
    }
  });

  it("caps an unresolved Tension below the ambient bed", () => {
    const plan = planConclusionPerformance(
      score({
        unresolved: [
          {
            threadId: "u1",
            conceptIds: ["a", "b"],
            fromSeconds: 0,
            // A compiler that asked for far too much still cannot get it.
            gain: 5,
            floorGain: 5,
            decayToFloorSeconds: 12,
          },
        ],
      }),
      RENDER
    );
    const section = plan.sections.find((s) => s.kind === "unresolved")!;
    const peak = section.plan.notes
      .filter((note) => note.id.endsWith(":0"))
      .reduce((total, note) => total + note.gain, 0);
    expect(peak).toBeLessThan(BED);
    expect(peak).toBeLessThanOrEqual(tensionCeiling(BED));
  });

  it("renders completed motifs as ensembles", () => {
    const plan = planConclusionPerformance(
      score({
        ensembles: [
          {
            key: "canon:1",
            atSeconds: 6,
            durationSeconds: 4,
            conceptIds: ["a", "b"],
            voices: [
              voice({ conceptId: "a", role: "ensemble" }),
              voice({ conceptId: "b", role: "residue", atSeconds: 1 }),
            ],
          },
        ],
      }),
      RENDER
    );
    const section = plan.sections.find((s) => s.kind === "ensemble")!;
    expect(section.threadId).toBeNull();
    expect(section.plan.kind).toBe("ensemble");
    // Roles come from the compiler and are preserved, not reassigned here —
    // this module renders the score, it does not re-decide it.
    expect(new Set(section.plan.notes.map((note) => note.role))).toEqual(
      new Set(["ensemble", "residue"])
    );
    expect(section.plan.meta.conceptIds).toEqual(["a", "b"]);
  });

  it("falls back to an ensemble role for a role it does not recognise", () => {
    const plan = planConclusionPerformance(
      score({ entries: [entry({ voices: [voice({ role: "chorus-mistake" })] })] }),
      RENDER
    );
    expect(plan.sections[0].plan.notes[0].role).toBe("ensemble");
  });

  it("clamps a runaway dynamic instead of trusting it", () => {
    const loud = planConclusionPerformance(
      score({ entries: [entry({ dynamic: 40 })] }),
      RENDER
    );
    expect(loud.sections[0].plan.notes[0].gain).toBeCloseTo(
      0.1 * SCORE.conclusion.dynamicCeiling,
      6
    );
    const quiet = planConclusionPerformance(
      score({ entries: [entry({ dynamic: 0 })] }),
      RENDER
    );
    expect(quiet.sections[0].plan.notes[0].gain).toBeGreaterThan(0);
  });

  it("survives an empty session without inventing anything", () => {
    const plan = planConclusionPerformance(
      score({ entries: [], totalSeconds: 0 }),
      RENDER
    );
    expect(plan.sections).toEqual([]);
    expect(plan.totalSeconds).toBe(0);
  });
});

// ─── The ending ─────────────────────────────────────────────────────────────

/**
 * Regression (BLOCK-2). The renderer emitted entries, ensembles and unresolved
 * holds and nothing else — there was no coda section at all, so the last thing a
 * player heard was whichever held voice happened to outlive the others while the
 * generative bed carried on underneath. These pin the ending as an ending.
 */
describe("the coda ends the performance", () => {
  const ending = (overrides: Partial<PerformedCoda> = {}) =>
    planConclusionPerformance(
      score({
        entries: [],
        coda: coda({ atSeconds: 50, ...overrides }),
        totalSeconds: 54,
      }),
      RENDER
    );

  const codaOf = (plan: ReturnType<typeof planConclusionPerformance>) =>
    plan.sections.find((section) => section.kind === "coda")!;

  it("sounds after the moment the compiler placed it, never before", () => {
    const plan = ending();
    const section = codaOf(plan);
    expect(section).toBeDefined();
    expect(section.atSeconds).toBe(
      50 + SCORE.conclusion.breathBeforeCodaSeconds
    );
    expect(section.plan.notes.length).toBe(2);
    expect(section.plan.notes.every((note) => note.envelope.hold > 0)).toBe(true);
  });

  it("is the last thing that sounds, even over a Tension left ringing", () => {
    const plan = planConclusionPerformance(
      score({
        entries: [],
        unresolved: [
          {
            threadId: "u1",
            conceptIds: ["sound.just-intonation", "sound.equal-temperament"],
            fromSeconds: 4,
            gain: 0.09,
            floorGain: 0.02,
            decayToFloorSeconds: 12,
          },
        ],
        coda: coda({ atSeconds: 50 }),
        totalSeconds: 54,
      }),
      RENDER
    );
    const section = codaOf(plan);
    const endOf = (s: (typeof plan.sections)[number]) =>
      s.plan.notes.reduce(
        (last, note) => Math.max(last, s.atSeconds + noteEndSeconds(note)),
        s.atSeconds
      );
    const codaEnd = endOf(section);
    for (const other of plan.sections) {
      if (other === section) continue;
      // Nothing else may still be sounding when the ending speaks, and nothing
      // may outlive it.
      expect(endOf(other)).toBeLessThanOrEqual(section.atSeconds + 1e-6);
      expect(endOf(other)).toBeLessThan(codaEnd);
    }
    // The loose end still rings for a real span before handing over.
    const held = plan.sections.find((s) => s.kind === "unresolved")!;
    expect(held.plan.notes.length).toBeGreaterThan(0);
  });

  /**
   * Found by driving the running build rather than by a fixture: with real
   * concept motifs behind them, an entry and three ensembles were still
   * decaying over the ending at eighteen times its level. An ending nobody can
   * hear is not an ending.
   */
  it("waits for the room to clear rather than speaking under the tails", () => {
    const long = voice({
      articulation: "sustained",
      atSeconds: 0,
      durationSeconds: 8,
      degrees: [0],
      rhythm: [1],
    });
    const plan = planConclusionPerformance(
      score({
        entries: [entry({ voices: [long], atSeconds: 0, durationSeconds: 8 })],
        coda: coda({ atSeconds: 9 }),
        totalSeconds: 13,
      }),
      RENDER
    );
    const section = codaOf(plan);
    const tail = plan.sections.find((s) => s.kind === "entry")!;
    const tailEnd = tail.atSeconds + tail.plan.durationSeconds;

    expect(tailEnd).toBeGreaterThan(9); // the fixture really does overrun
    expect(section.atSeconds).toBeGreaterThanOrEqual(tailEnd);
    // And never earlier than the compiler placed it, even with a silent web.
    expect(section.atSeconds).toBeGreaterThanOrEqual(9);
  });

  it("keeps a Tension ringing right up to the ending, wherever the ending lands", () => {
    const long = voice({
      articulation: "sustained",
      atSeconds: 0,
      durationSeconds: 8,
      degrees: [0],
      rhythm: [1],
    });
    const plan = planConclusionPerformance(
      score({
        entries: [entry({ voices: [long], atSeconds: 0, durationSeconds: 8 })],
        unresolved: [
          {
            threadId: "u1",
            conceptIds: ["sound.just-intonation", "sound.equal-temperament"],
            fromSeconds: 2,
            gain: 0.05,
            floorGain: 0.01,
            decayToFloorSeconds: 12,
          },
        ],
        coda: coda({ atSeconds: 9 }),
        totalSeconds: 13,
      }),
      RENDER
    );
    const section = codaOf(plan);
    const held = plan.sections.find((s) => s.kind === "unresolved")!;
    const heldEnd = held.plan.notes.reduce(
      (last, note) => Math.max(last, held.atSeconds + noteEndSeconds(note)),
      held.atSeconds
    );
    // It hands over to the ending across one breath of silence — neither
    // stopping early nor talking over it.
    expect(heldEnd).toBeCloseTo(
      section.atSeconds - SCORE.conclusion.breathBeforeCodaSeconds,
      4
    );
    // And the silence is real: nothing at all sounds in it.
    const gapStart = heldEnd + 1e-6;
    for (const other of plan.sections) {
      if (other === section) continue;
      const end = other.plan.notes.reduce(
        (last, note) => Math.max(last, other.atSeconds + noteEndSeconds(note)),
        other.atSeconds
      );
      expect(end).toBeLessThanOrEqual(gapStart);
    }
  });

  it("closes on a stable interval, and refuses to when the web left a Tension open", () => {
    const closed = codaOf(ending({ resolves: true })).plan;
    const unclosed = codaOf(ending({ resolves: false })).plan;

    const reach = (plan: typeof closed) =>
      plan.notes[1].degree - plan.notes[0].degree;
    expect(isStable(CASTALIA_MODE, reach(closed))).toBe(true);
    expect(closed.notes.every((note) => !note.openEnded)).toBe(true);
    expect(closed.meta.resolves).toBe(true);

    expect(isTense(CASTALIA_MODE, reach(unclosed))).toBe(true);
    expect(unclosed.notes.every((note) => note.openEnded)).toBe(true);
    expect(unclosed.meta.resolves).toBe(false);
  });

  it("gives both endings the same weight — resolution differs, reward does not", () => {
    const closed = codaOf(ending({ resolves: true })).plan;
    const unclosed = codaOf(ending({ resolves: false })).plan;
    expect(unclosed.notes).toHaveLength(closed.notes.length);
    expect(peakSummedGain(unclosed)).toBeCloseTo(peakSummedGain(closed), 6);
    expect(unclosed.notes.map((note) => note.atSeconds)).toEqual(
      closed.notes.map((note) => note.atSeconds)
    );
  });

  it("keeps an unclosed ending inside the comfort envelope", () => {
    const unclosed = codaOf(ending({ resolves: false })).plan;
    expect(unclosed.notes.every((note) => note.tense)).toBe(true);
    expect(auditComfort(unclosed, { bedGain: BED })).toEqual([]);
  });
});

// ─── The arrival ────────────────────────────────────────────────────────────

/**
 * Regression (BLOCK-1, audio half). `renderEntry` read only dynamic, phrasing
 * and voices, so the entry the compiler had identified as the structurally
 * justified high point of the player's own web was rendered identically to every
 * other entry.
 */
describe("the web's high point arrives", () => {
  const twoVoices = [
    voice({ conceptId: "a", role: "subject", register: "mid" }),
    voice({ conceptId: "b", role: "answer", register: "mid", atSeconds: 1 }),
  ];
  const plain = planConclusionPerformance(
    score({ entries: [entry({ voices: twoVoices, isClimax: false })] }),
    RENDER
  ).sections[0].plan;
  const arrival = planConclusionPerformance(
    score({ entries: [entry({ voices: twoVoices, isClimax: true, weight: 1 })] }),
    RENDER
  ).sections[0].plan;

  it("is not louder — that would be a score in disguise", () => {
    expect(peakSummedGain(arrival)).toBeCloseTo(peakSummedGain(plain), 5);
    expect(Math.max(...arrival.notes.map((n) => n.gain))).toBeLessThanOrEqual(
      Math.max(...plain.notes.map((n) => n.gain)) + 1e-9
    );
  });

  it("is wider: doubled at the octave and spread in register", () => {
    expect(arrival.notes.length).toBeGreaterThan(plain.notes.length);
    const span = (plan: typeof plain) => {
      const indices = plan.notes.map((note) => registerIndex(note.register));
      return Math.max(...indices) - Math.min(...indices);
    };
    expect(span(arrival)).toBeGreaterThan(span(plain));
    // Same music: every degree of the plain rendering is still stated.
    for (const note of plain.notes) {
      expect(arrival.notes.some((other) => other.degree === note.degree)).toBe(
        true
      );
    }
  });

  it("opens out further for a heavier high point, and never by getting louder", () => {
    const light = planConclusionPerformance(
      score({
        entries: [entry({ voices: twoVoices, isClimax: true, weight: 0 })],
      }),
      RENDER
    ).sections[0].plan;
    const octaveGain = (plan: typeof plain) =>
      plan.notes
        .filter((note) => note.id.includes(":octave"))
        .reduce((total, note) => total + note.gain, 0);
    expect(octaveGain(arrival)).toBeGreaterThan(octaveGain(light));
    expect(peakSummedGain(arrival)).toBeCloseTo(peakSummedGain(light), 5);
  });
});

// ─── The fourth state ───────────────────────────────────────────────────────

/**
 * Regression. The caption track derived its epistemic state from `resolved`
 * alone: `resolved ? "documented" : "open-thread"`. An interpretive relation —
 * a reading the Game offers about two structures — does not close, so it was
 * captioned as an Open Thread, telling the player the Game had nothing authored
 * to say when in fact it did.
 */
describe("the conclusion caption says which state of knowledge an entry is in", () => {
  const outcomeOf = (overrides: Partial<PerformedEntry>) =>
    planConclusionPerformance(score({ entries: [entry(overrides)] }), RENDER)
      .sections[0].plan.meta.outcome;

  it("separates a record from a reading the Game merely offers", () => {
    expect(
      outcomeOf({ outcomeKind: "documented", speaksForRecord: true, resolved: true })
    ).toBe("documented");
    expect(
      outcomeOf({
        outcomeKind: "documented",
        speaksForRecord: false,
        resolved: false,
      })
    ).toBe("reading");
  });

  it("does not call an unclosed record or a weak outcome an Open Thread", () => {
    // A documented Tension: the record is there, the grammar refuses to close it.
    expect(
      outcomeOf({
        intention: "tension",
        outcomeKind: "documented",
        speaksForRecord: true,
        resolved: false,
      })
    ).toBe("documented");
    expect(
      outcomeOf({
        outcomeKind: "unresolved",
        speaksForRecord: false,
        resolved: false,
      })
    ).toBe("unresolved");
    expect(
      outcomeOf({
        outcomeKind: "open-thread",
        speaksForRecord: false,
        resolved: false,
      })
    ).toBe("open-thread");
  });

  it("still gives all four states the same weight of sound (CAV-006)", () => {
    const level = (overrides: Partial<PerformedEntry>) =>
      peakSummedGain(
        planConclusionPerformance(score({ entries: [entry(overrides)] }), RENDER)
          .sections[0].plan
      );
    expect(
      level({ outcomeKind: "documented", speaksForRecord: false, resolved: false })
    ).toBeCloseTo(
      level({ outcomeKind: "documented", speaksForRecord: true, resolved: true }),
      9
    );
  });
});

describe("rendering, continued", () => {
  it("survives an empty session without inventing anything", () => {
    const plan = planConclusionPerformance(
      score({ entries: [], totalSeconds: 0 }),
      RENDER
    );
    expect(plan.sections).toEqual([]);
    expect(plan.totalSeconds).toBe(0);
  });
});
