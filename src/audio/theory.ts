/**
 * THE LEGACY PITCH BRIDGE.
 *
 * The prototype's content pack (`src/content/concepts.ts`, `disciplines.ts`)
 * authors a pentatonic degree and one of six discipline timbres per concept. It
 * is being retired with the rest of the pre-Castalia loop, but it still plays,
 * and while it plays it must not keep its own private tuning system.
 *
 * So every legacy pitch is resolved through the world mode (`mode.ts`) and every
 * legacy timbre through the six bodies (`voices.ts`). The audible result is
 * essentially the old bed, in just intonation. What is gone is the *claim* the
 * old comment made — that all pitches live in one gamut so every simultaneity is
 * guaranteed consonant. That guarantee is what `docs/CURRENT-STATE-AUDIT.md`
 * lists for removal, because a world in which nothing can clash cannot say
 * Tension.
 *
 * New code should use `mode.ts` and the Castalia concept motifs directly.
 */
import type { MotifRegister, TimbreId } from "@/content/castalia/schema";
import type { Concept, Discipline } from "@/content/types";
import { disciplineById } from "@/content/disciplines";
import { conceptById } from "@/content/concepts";
import { CASTALIA_MODE, degreeFrequency } from "./mode";
import { LEGACY_TIMBRE } from "./voices";

/** Semitone offsets of the legacy pentatonic degrees, in the world mode. */
const PENTATONIC_SEMITONES: readonly number[] = Object.freeze([0, 2, 4, 7, 9]);

const REGISTER_FOR: Readonly<Record<Discipline["register"], MotifRegister>> =
  Object.freeze({ low: "low", mid: "mid", high: "high" });

/** Resolve a semitone degree in a register through the world mode. */
export function modeFreq(degree: number, register: MotifRegister): number {
  return degreeFrequency(CASTALIA_MODE, degree, register);
}

/** A legacy pentatonic degree index, resolved in the world mode. */
export function pentatonic(index: number, register: MotifRegister): number {
  const semitone = PENTATONIC_SEMITONES[((Math.round(index) % 5) + 5) % 5];
  return modeFreq(semitone, register);
}

/** A legacy concept's identity note, in its discipline's register. */
export function noteForConcept(concept: Concept): number {
  const discipline = disciplineById.get(concept.discipline);
  return pentatonic(
    concept.pitchDegree,
    discipline ? REGISTER_FOR[discipline.register] : "mid"
  );
}

export function timbreForDiscipline(discipline: Discipline | undefined): TimbreId {
  return discipline ? LEGACY_TIMBRE[discipline.timbre] : "gut";
}

export interface ChordNote {
  readonly freq: number;
  readonly timbre: TimbreId;
  readonly gain: number;
  /** Seconds after chord start (the strum). */
  readonly delay: number;
}

/**
 * The legacy discovery chord: both concepts' identity notes plus supporting
 * tones, voiced wider with tier and staggered like a harp strum.
 */
export function chordForPair(
  aId: string,
  bId: string,
  tier: 0 | 1 | 2 | 3
): ChordNote[] {
  const a = conceptById.get(aId);
  const b = conceptById.get(bId);
  if (!a || !b) return [];
  const da = disciplineById.get(a.discipline);
  const db = disciplineById.get(b.discipline);
  if (!da || !db) return [];

  const notes: ChordNote[] = [
    { freq: modeFreq(0, "low"), timbre: "glass", gain: 0.16, delay: 0 },
    { freq: modeFreq(7, "low"), timbre: "glass", gain: 0.1, delay: 0.05 },
    {
      freq: noteForConcept(a),
      timbre: timbreForDiscipline(da),
      gain: 0.24,
      delay: 0.09,
    },
    {
      freq: noteForConcept(b),
      timbre: timbreForDiscipline(db),
      gain: 0.24,
      delay: 0.16,
    },
  ];

  if (tier >= 2) {
    notes.push({
      freq: pentatonic(da.degrees[1], REGISTER_FOR[da.register] === "low" ? "mid" : "high"),
      timbre: timbreForDiscipline(da),
      gain: 0.14,
      delay: 0.24,
    });
    notes.push({
      freq: pentatonic(db.degrees[1], REGISTER_FOR[db.register] === "low" ? "mid" : "high"),
      timbre: timbreForDiscipline(db),
      gain: 0.12,
      delay: 0.32,
    });
  }
  if (tier >= 3) {
    notes.push({ freq: modeFreq(2, "air"), timbre: "glass", gain: 0.1, delay: 0.44 });
    notes.push({ freq: modeFreq(0, "air"), timbre: "glass", gain: 0.08, delay: 0.58 });
  }
  return notes;
}
