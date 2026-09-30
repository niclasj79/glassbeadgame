/**
 * THE STEMS (ADR-017, M4-002).
 *
 * What each faculty's stem plays, where its onsets fall, what it may never
 * sound, and — with the ground — what a whole harmony cycle of a ten-thread
 * session looks like to the comfort audit.
 */
import { describe, expect, it } from "vitest";

import { CASTALIA_CONCEPTS, castaliaConceptById } from "@/content/castalia";
import { FACULTY_IDS, type FacultyId } from "@/content/castalia/schema";
import { castalia } from "@/themes/worlds";
import { COMFORT } from "./comfort";
import {
  chordFor,
  groundStrike,
  groundStrikeSlots,
  nextVoicing,
  rootForPhrase,
} from "./harmony";
import { CASTALIA_MODE, intervalClass, isTense, pitchClass } from "./mode";
import {
  auditComfort,
  makeVoicePlan,
  noteEndSeconds,
  peakConcurrentNotes,
  type PlannedNote,
} from "./plan";
import { SCORE } from "./score";
import {
  STEM_CEILING,
  STEM_GAIN,
  STEM_MAX_VOICES,
  STEM_VOICE_RESERVE,
  isIdentityPitch,
  stemFor,
  stemPlan,
  stemSpeaks,
  type StemNote,
} from "./stems";
import { modeFreq } from "./theory";

const CYCLE = [0, 5, 9, 7] as const;
/** The choir's first note peaks at 0.075 of the bed (`ambient.ts`); the stems sit under it. */
const CHOIR_PEAK = 0.075;

/** The largest number of a stem's notes that begin together. */
const voicesAtOnce = (notes: readonly StemNote[]): number => {
  const byOnset = new Map<number, number>();
  for (const note of notes) byOnset.set(note.sixteenth, (byOnset.get(note.sixteenth) ?? 0) + 1);
  return Math.max(0, ...byOnset.values());
};

describe("the four stems", () => {
  it("gives each faculty its own body", () => {
    const measure = stemFor("measure");
    expect(measure.timbres).toEqual(["metal", "glass"]);
    // Four notes across the slot, every one on an eighth.
    expect(measure.onsets).toEqual([0, 4, 8, 12]);
    expect(measure.register).toBe("mid");

    expect(stemFor("sound")).toMatchObject({ timbres: ["voice"], tone: 2, onsets: [0] });
    expect(stemFor("matter")).toMatchObject({
      timbres: ["gut"],
      tone: 0,
      spanSlots: 2,
      register: "sub",
    });
    expect(stemFor("image")).toMatchObject({ timbres: ["reed"], tone: 1, register: "high" });
  });

  it("is silent without a thread, enters with the first, and thickens to three voices at most", () => {
    for (const faculty of FACULTY_IDS) {
      for (const root of CYCLE) {
        expect(stemPlan(faculty, chordFor(root), 0, 0)).toEqual([]);
        for (let threads = 1; threads <= 10; threads += 1) {
          const notes = stemPlan(faculty, chordFor(root), threads, 0);
          expect(notes.length).toBeGreaterThan(0);
          expect(voicesAtOnce(notes)).toBe(Math.min(STEM_MAX_VOICES, threads));
        }
      }
    }
  });

  it("speaks Matter's pedal every other slot, and every other stem every slot", () => {
    for (const faculty of FACULTY_IDS) {
      for (let slot = 0; slot < 24; slot += 1) {
        const speaks = stemPlan(faculty, chordFor(0), 3, slot).length > 0;
        expect(speaks).toBe(faculty !== "matter" || slot % 2 === 0);
      }
    }
  });

  it("is pitched from the current chord", () => {
    for (const faculty of FACULTY_IDS) {
      for (const root of CASTALIA_MODE.stable) {
        const chord = chordFor(root);
        for (let threads = 1; threads <= 3; threads += 1) {
          for (const note of stemPlan(faculty, chord, threads, 0)) {
            expect(chord).toContain(pitchClass(note.degree));
            expect(note.frequency).toBe(modeFreq(note.degree, note.register));
          }
        }
      }
    }
  });

  it("stands where it is asked to over every root of the cycle", () => {
    const standing = (faculty: FacultyId, root: number): number =>
      pitchClass(stemPlan(faculty, chordFor(root), 1, 0)[0].degree);
    // Sound on the colour, except over A, whose colour is C and C3 is a
    // concept's own note: the root instead.
    expect(CYCLE.map((root) => standing("sound", root))).toEqual([4, 9, 9, 4]);
    // Matter on the root, except over C, whose C1 is a concept's own note: the fifth.
    expect(CYCLE.map((root) => standing("matter", root))).toEqual([7, 5, 9, 7]);
    // Image on the fifth, except where the fifth is C, whose C4 is a concept's own note.
    expect(CYCLE.map((root) => standing("image", root))).toEqual([7, 9, 4, 4]);
  });

  it("keeps every note under its stem's ceiling, and every ceiling under the choir's", () => {
    for (const faculty of FACULTY_IDS) {
      expect(STEM_GAIN[faculty]).toBeLessThanOrEqual(STEM_CEILING);
      for (const root of CYCLE) {
        for (let threads = 1; threads <= 4; threads += 1) {
          for (const note of stemPlan(faculty, chordFor(root), threads, 0)) {
            expect(note.gain).toBeLessThanOrEqual(STEM_GAIN[faculty]);
          }
        }
      }
    }
    expect(STEM_CEILING).toBeLessThan(CHOIR_PEAK);
  });

  /**
   * STEMS ARE HARMONY, NEVER MELODY.
   *
   * No stem note is any concept's identity note at the concept's register —
   * over every chord the rule can make, every thickness and both parities of
   * the slot. Every motif begins on its identity note in its own register, so
   * no stem can state a motif either.
   */
  it("never sounds a concept's identity note in the concept's register, so never states a motif", () => {
    const identities = CASTALIA_CONCEPTS.map((concept) =>
      modeFreq(concept.motif.degrees[0] ?? 0, concept.motif.register)
    );
    for (const concept of CASTALIA_CONCEPTS) {
      const [first] = concept.motif.degrees;
      expect(isIdentityPitch(modeFreq(first ?? 0, concept.motif.register))).toBe(true);
    }
    let checked = 0;
    for (const faculty of FACULTY_IDS) {
      for (const root of CASTALIA_MODE.stable) {
        for (let threads = 1; threads <= 4; threads += 1) {
          for (let slot = 0; slot < 4; slot += 1) {
            for (const note of stemPlan(faculty, chordFor(root), threads, slot)) {
              for (const identity of identities) {
                expect(Math.abs(1200 * Math.log2(note.frequency / identity))).toBeGreaterThan(1);
              }
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("puts every onset on the eighth or sixteenth grid, Measure's on the eighths", () => {
    for (const faculty of FACULTY_IDS) {
      for (const root of CYCLE) {
        for (let slot = 0; slot < 24; slot += 1) {
          for (const note of stemPlan(faculty, chordFor(root), 3, slot)) {
            expect(Number.isInteger(note.sixteenth)).toBe(true);
            expect(note.sixteenth).toBeGreaterThanOrEqual(0);
            expect(note.sixteenth).toBeLessThan(16);
            if (faculty === "measure") expect(note.sixteenth % 2).toBe(0);
          }
        }
      }
    }
  });

  /**
   * CAV-007 and ADR-017: no pattern on a cycle co-prime to the slot's eighths
   * (that is Tension's grammar). Every stem's onsets repeat within two slots,
   * so each pattern's cycle is eight or sixteen eighths, never co-prime to
   * eight; and within a slot the onsets are a whole number of sixteenths apart.
   */
  it("keeps no pattern on a cycle co-prime to the slot's eighths", () => {
    const onsetsOf = (faculty: FacultyId, slot: number): number[] =>
      [...new Set(stemPlan(faculty, chordFor(0), 3, slot).map((note) => note.sixteenth))];
    for (const faculty of FACULTY_IDS) {
      for (let slot = 0; slot < 22; slot += 1) {
        expect(onsetsOf(faculty, slot + 2)).toEqual(onsetsOf(faculty, slot));
      }
      const cycleEighths = stemFor(faculty).spanSlots * 8;
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      expect(gcd(cycleEighths, 8)).toBe(8);
    }
  });

  it("ends every note inside its own statement, so no stem sounds across a phrase boundary", () => {
    for (const faculty of FACULTY_IDS) {
      const { spanSlots } = stemFor(faculty);
      // A statement never straddles a phrase: the phrase is a whole number of spans.
      expect(SCORE.harmony.phraseSlots % spanSlots).toBe(0);
      for (const root of CYCLE) {
        for (const note of stemPlan(faculty, chordFor(root), 3, 0)) {
          const end = note.sixteenth / 16 + note.attack + note.hold + note.release;
          expect(end).toBeLessThanOrEqual(spanSlots + 1e-9);
        }
      }
    }
  });

  it("speaks in ordinary play, never in silence, and thins the same way every time under space", () => {
    for (const faculty of FACULTY_IDS) {
      for (let slot = 0; slot < 50; slot += 1) {
        expect(stemSpeaks(faculty, slot, 1)).toBe(true);
        expect(stemSpeaks(faculty, slot, 0)).toBe(false);
      }
      for (const density of [
        SCORE.attention.thinDensityScale,
        SCORE.attention.responseDensityScale,
        SCORE.attunement.densityScale,
      ]) {
        const slots = Array.from({ length: 2000 }, (_, slot) => slot);
        const heard = slots.filter((slot) => stemSpeaks(faculty, slot, density));
        expect(heard.length / slots.length).toBeGreaterThan(density - 0.05);
        expect(heard.length / slots.length).toBeLessThan(density + 0.05);
        expect(slots.filter((slot) => stemSpeaks(faculty, slot, density))).toEqual(heard);
      }
    }
  });
});

// ─── One harmony cycle of a ten-thread session, audited ─────────────────────

describe("the comfort audit over one harmony cycle of a ten-thread session", () => {
  const SLOT = castalia.music.slotSeconds;
  const CYCLE_SLOTS = SCORE.harmony.rootCycle.length * SCORE.harmony.phraseSlots;

  /** Ten threads, reaching all four faculties at least three times each. */
  const THREADS: readonly (readonly [string, string])[] = [
    ["measure.fibonacci-sequence", "sound.counterpoint"],
    ["measure.prime-numbers", "sound.polyrhythm"],
    ["measure.fourier-series", "sound.overtone-series"],
    ["sound.just-intonation", "sound.equal-temperament"],
    ["matter.standing-wave", "sound.overtone-series"],
    ["matter.crystal-lattice", "image.girih-tiling"],
    ["matter.diffraction", "image.divisionism"],
    ["image.linear-perspective", "image.anamorphosis"],
    ["image.camera-obscura", "measure.continuous-symmetry"],
    ["matter.entropy", "matter.coupled-pendulums"],
  ];

  /** A thread counts in the faculty of each of its concepts, as the bed seats it. */
  const threadsByFaculty = new Map<FacultyId, Set<number>>();
  THREADS.forEach((pair, thread) => {
    for (const id of pair) {
      const faculty = castaliaConceptById.get(id)?.faculty;
      if (faculty === undefined) throw new Error(`unknown concept ${id}`);
      threadsByFaculty.set(faculty, (threadsByFaculty.get(faculty) ?? new Set()).add(thread));
    }
  });

  const note = (
    id: string,
    fields: Pick<PlannedNote, "timbre" | "register" | "degree" | "atSeconds" | "gain" | "envelope">
  ): PlannedNote => ({
    id,
    conceptId: null,
    role: "ensemble",
    articulation: "sustained",
    frequency: modeFreq(fields.degree, fields.register),
    detuneCents: 0,
    floorGain: 0,
    openEnded: false,
    tense: false,
    ...fields,
  });

  /** The ground and every stem, slot by slot, as the bed schedules them. */
  const timeline = (): PlannedNote[] => {
    const notes: PlannedNote[] = [];
    const strike = groundStrikeSlots(SLOT);
    let pad: number[] | null = null;
    for (let slot = 0; slot < CYCLE_SLOTS; slot += 1) {
      const at = slot * SLOT;
      const root = rootForPhrase(Math.floor(slot / SCORE.harmony.phraseSlots));
      if (slot % strike === 0) {
        if (pad === null || slot % SCORE.harmony.phraseSlots === 0) pad = nextVoicing(pad, root);
        groundStrike(root, pad, strike * SLOT, castalia.music.droneGain).forEach((voice, i) => {
          const { attack, hold, release } = voice;
          notes.push(
            note(`ground:${slot}:${i}`, {
              timbre: voice.timbre,
              register: "low",
              degree: voice.degree,
              atSeconds: at,
              gain: voice.gain,
              envelope: { attack, hold, release },
            })
          );
        });
      }
      for (const faculty of FACULTY_IDS) {
        const threads = threadsByFaculty.get(faculty)?.size ?? 0;
        stemPlan(faculty, chordFor(root), threads, slot).forEach((stem, i) => {
          notes.push(
            note(`stem:${faculty}:${slot}:${i}`, {
              timbre: stem.timbre,
              register: stem.register,
              degree: stem.degree,
              atSeconds: at + (stem.sixteenth * SLOT) / 16,
              gain: stem.gain,
              envelope: {
                attack: stem.attack * SLOT,
                hold: stem.hold * SLOT,
                release: stem.release * SLOT,
              },
            })
          );
        });
      }
    }
    return notes;
  };

  const heldUntil = (n: PlannedNote): number =>
    n.atSeconds + n.envelope.attack + n.envelope.hold;
  const rubs = (a: PlannedNote, b: PlannedNote): boolean =>
    isTense(CASTALIA_MODE, intervalClass(a.degree, b.degree));

  /**
   * A voice is tense when it is held — attacking or holding, not released —
   * while another held voice stands at a tense interval class from it. That is
   * the dissonance CAV-007 bounds; the audit then measures it over the whole
   * timeline.
   */
  const withTension = (notes: readonly PlannedNote[]): PlannedNote[] =>
    notes.map((n) => ({
      ...n,
      tense: notes.some(
        (other) =>
          other !== n &&
          other.atSeconds < heldUntil(n) &&
          n.atSeconds < heldUntil(other) &&
          rubs(n, other)
      ),
    }));

  it("seats all four faculties at full thickness", () => {
    expect(THREADS).toHaveLength(10);
    for (const faculty of FACULTY_IDS) {
      expect(threadsByFaculty.get(faculty)?.size ?? 0).toBeGreaterThanOrEqual(STEM_MAX_VOICES);
    }
  });

  it("holds no dissonance anywhere in the cycle: bed, chord and stems are consonant wherever they are held", () => {
    const notes = withTension(timeline());
    expect(notes.length).toBeGreaterThan(400);
    expect(notes.filter((n) => n.tense).map((n) => n.id)).toEqual([]);
  });

  it("passes only through the crossfade: every rub is a released voice under an arriving one, for at most two seconds", () => {
    const notes = timeline();
    let crossings = 0;
    for (const a of notes) {
      for (const b of notes) {
        if (a.atSeconds >= b.atSeconds || !rubs(a, b)) continue;
        const from = b.atSeconds;
        const until = Math.min(noteEndSeconds(a), noteEndSeconds(b));
        if (until <= from) continue;
        // The earlier voice is already released when the later one arrives,
        // and the two overlap no longer than the crossfade.
        expect(heldUntil(a)).toBeLessThanOrEqual(from + 1e-9);
        expect(until - from).toBeLessThanOrEqual(SCORE.harmony.crossfadeSeconds + 1e-9);
        crossings += 1;
      }
    }
    // The chord does turn: the crossfades are real, not vacuous.
    expect(crossings).toBeGreaterThan(0);
  });

  it("passes the comfort audit slot by slot, against the bed as it sounds", () => {
    const notes = withTension(timeline());
    for (let slot = 0; slot < CYCLE_SLOTS; slot += 1) {
      const from = slot * SLOT;
      const until = from + SLOT;
      const sounding = notes.filter((n) => n.atSeconds < until && noteEndSeconds(n) > from);
      const plan = makeVoicePlan({
        id: `bed:${slot}`,
        kind: "ensemble",
        intention: null,
        notes: sounding,
        meta: {
          conceptIds: [],
          grammar: "the bed, its chord and its stems",
          resolves: true,
          interval: null,
          beatingHz: null,
        },
      });
      expect(auditComfort(plan, { bedGain: SCORE.grammar.bedGain })).toEqual([]);
    }
  });

  it("sounds the ground and all four stems at full thickness within the stems' half of the voice budget", () => {
    const plan = makeVoicePlan({
      id: "bed:cycle",
      kind: "ensemble",
      intention: null,
      notes: timeline(),
      meta: {
        conceptIds: [],
        grammar: "the bed, its chord and its stems",
        resolves: true,
        interval: null,
        beatingHz: null,
      },
    });
    expect(peakConcurrentNotes(plan)).toBeLessThanOrEqual(
      COMFORT.voice.maxConcurrent - STEM_VOICE_RESERVE
    );
  });
});
