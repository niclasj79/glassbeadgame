import type { Concept, Discipline } from "@/content/types";
import { disciplineById } from "@/content/disciplines";
import { conceptById } from "@/content/concepts";

/**
 * One shared pitch space: C major pentatonic (C D E G A) across four octaves.
 * Any subset of it is consonant, so every possible discovery chord is
 * guaranteed pleasant — this is the fix for v1's cross-discipline clashes.
 */
const GAMUT_SEMITONES = [0, 2, 4, 7, 9]; // C D E G A

const REGISTER_OCTAVE: Record<Discipline["register"], number> = {
  low: 2,
  mid: 3,
  high: 4,
};

export function degreeToFreq(degree: number, octave: number): number {
  const midi = 12 * (octave + 1) + GAMUT_SEMITONES[((degree % 5) + 5) % 5];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A concept's identity note: its pitch degree in its discipline's register. */
export function noteForConcept(concept: Concept): number {
  const disc = disciplineById.get(concept.discipline);
  const octave = disc ? REGISTER_OCTAVE[disc.register] : 3;
  return degreeToFreq(concept.pitchDegree, octave);
}

export interface ChordNote {
  freq: number;
  timbre: Discipline["timbre"];
  gain: number;
  /** Seconds after chord start (the strum). */
  delay: number;
}

/**
 * The discovery chord: both concepts' identity notes plus supporting tones,
 * voiced wider and richer with tier. Staggered like a harp strum.
 */
export function chordForPair(aId: string, bId: string, tier: 0 | 1 | 2 | 3): ChordNote[] {
  const a = conceptById.get(aId);
  const b = conceptById.get(bId);
  if (!a || !b) return [];
  const da = disciplineById.get(a.discipline)!;
  const db = disciplineById.get(b.discipline)!;
  const octA = REGISTER_OCTAVE[da.register];
  const octB = REGISTER_OCTAVE[db.register];

  const notes: ChordNote[] = [
    // Grounding root + fifth, always low, always quiet.
    { freq: degreeToFreq(0, 2), timbre: "drone", gain: 0.16, delay: 0 },
    { freq: degreeToFreq(3, 2), timbre: "drone", gain: 0.1, delay: 0.05 },
    // The two voices themselves.
    { freq: noteForConcept(a), timbre: da.timbre, gain: 0.24, delay: 0.09 },
    { freq: noteForConcept(b), timbre: db.timbre, gain: 0.24, delay: 0.16 },
  ];

  if (tier >= 2) {
    notes.push({
      freq: degreeToFreq(da.degrees[1], octA + 1),
      timbre: da.timbre,
      gain: 0.14,
      delay: 0.24,
    });
    notes.push({
      freq: degreeToFreq(db.degrees[1], Math.min(octB + 1, 5)),
      timbre: db.timbre,
      gain: 0.12,
      delay: 0.32,
    });
  }
  if (tier >= 3) {
    // The floated ninth — a high D that makes profound discoveries shimmer.
    notes.push({ freq: degreeToFreq(1, 5), timbre: "bell", gain: 0.1, delay: 0.44 });
    notes.push({ freq: degreeToFreq(0, 5), timbre: "bell", gain: 0.08, delay: 0.58 });
  }
  return notes;
}
