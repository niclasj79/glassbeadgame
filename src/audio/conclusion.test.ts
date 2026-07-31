import { describe, expect, it } from "vitest";

import type { ConclusionPerformance } from "@/domain/performance";
import { COMFORT } from "./comfort";
import {
  planConclusionPerformance,
  renderPerformedVoice,
  type PerformanceScore,
  type PerformedEntry,
  type PerformedVoice,
} from "./conclusion";
import { CASTALIA_MODE, isTense } from "./mode";
import { noteLifetime, peakSummedGain } from "./plan";
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
  resolved: true,
  ...overrides,
});

const score = (overrides: Partial<PerformanceScore> = {}): PerformanceScore => ({
  sessionId: "s1",
  secondsPerBeat: 0.75,
  entries: [entry()],
  ensembles: [],
  unresolved: [],
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
      { mode: CASTALIA_MODE, ambientGain: BED }
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
      { mode: CASTALIA_MODE, ambientGain: BED }
    );
    expect(plan.sections[0].atSeconds).toBe(4.25);
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
      { mode: CASTALIA_MODE, ambientGain: BED }
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
      { mode: CASTALIA_MODE, ambientGain: BED }
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
      { mode: CASTALIA_MODE, ambientGain: BED }
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
      { mode: CASTALIA_MODE, ambientGain: BED }
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
      { mode: CASTALIA_MODE, ambientGain: BED }
    );
    const section = plan.sections.find((s) => s.kind === "unresolved")!;
    const peak = section.plan.notes
      .filter((note) => note.id.endsWith(":0"))
      .reduce((total, note) => total + note.gain, 0);
    expect(peak).toBeLessThan(BED);
    expect(peak).toBeLessThanOrEqual(BED * COMFORT.tension.gainFractionOfBed);
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
      { mode: CASTALIA_MODE, ambientGain: BED }
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
      { mode: CASTALIA_MODE, ambientGain: BED }
    );
    expect(plan.sections[0].plan.notes[0].role).toBe("ensemble");
  });

  it("clamps a runaway dynamic instead of trusting it", () => {
    const loud = planConclusionPerformance(
      score({ entries: [entry({ dynamic: 40 })] }),
      { mode: CASTALIA_MODE, ambientGain: BED }
    );
    expect(loud.sections[0].plan.notes[0].gain).toBeCloseTo(
      0.1 * SCORE.conclusion.dynamicCeiling,
      6
    );
    const quiet = planConclusionPerformance(
      score({ entries: [entry({ dynamic: 0 })] }),
      { mode: CASTALIA_MODE, ambientGain: BED }
    );
    expect(quiet.sections[0].plan.notes[0].gain).toBeGreaterThan(0);
  });

  it("survives an empty session without inventing anything", () => {
    const plan = planConclusionPerformance(
      score({ entries: [], totalSeconds: 0 }),
      { mode: CASTALIA_MODE, ambientGain: BED }
    );
    expect(plan.sections).toEqual([]);
    expect(plan.totalSeconds).toBe(0);
  });
});
