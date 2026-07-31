/**
 * ONE PITCH AND ONE BODY PER BEAD.
 *
 * The presentation layer — hover, selection, the thread choir, the discovery
 * chord — needs a single note and a single instrument for a bead, not a whole
 * rendered motif. Both are authored: `motif.degrees[0]` is the bead's identity
 * note, `motif.register` places it, and `motif.timbre` names the body that
 * plays it. This module is the only place those fields become frequencies.
 *
 * This file used to be the bridge to the prototype's content pack, which
 * authored a pentatonic degree per concept and a timbre per discipline. That
 * pack is gone, and with it the last private tuning system: every pitch here
 * resolves through the world mode (`mode.ts`) and every body through the six in
 * `voices.ts`.
 *
 * Code that needs a bead's whole motif rather than its first note should use
 * `renderMotif` in `motif.ts`.
 */
import { castaliaConceptById } from "@/content/castalia";
import type {
  CastaliaConcept,
  MotifRegister,
  TimbreId,
} from "@/content/castalia/schema";
import { CASTALIA_MODE, degreeFrequency, shiftRegister } from "./mode";

/** Resolve a semitone degree in a register through the world mode. */
export function modeFreq(degree: number, register: MotifRegister): number {
  return degreeFrequency(CASTALIA_MODE, degree, register);
}

export interface BeadVoice {
  readonly freq: number;
  readonly timbre: TimbreId;
}

function voiceOf(concept: CastaliaConcept): BeadVoice {
  const { degrees, register, timbre } = concept.motif;
  return { freq: modeFreq(degrees[0] ?? 0, register), timbre };
}

/**
 * A bead's identity note and body, straight from its authored motif. `null` for
 * an id the pack does not know — callers fall silent rather than substitute a
 * pitch no one wrote.
 */
export function beadVoice(id: string): BeadVoice | null {
  const concept = castaliaConceptById.get(id);
  return concept ? voiceOf(concept) : null;
}

export interface ChordNote {
  readonly freq: number;
  readonly timbre: TimbreId;
  readonly gain: number;
  /** Seconds after chord start (the strum). */
  readonly delay: number;
}

/**
 * The second step of a bead's motif, lifted a register — the pair's own
 * contour widening, rather than a supporting tone the audio layer picked.
 */
function secondStep(concept: CastaliaConcept, gain: number, delay: number): ChordNote {
  const { degrees, register, timbre } = concept.motif;
  return {
    freq: modeFreq(degrees[1] ?? degrees[0] ?? 0, shiftRegister(register, 1)),
    timbre,
    gain,
    delay,
  };
}

/**
 * The discovery chord: both beads' identity notes over the world's ground,
 * voiced wider with tier and staggered like a harp strum.
 */
export function chordForPair(
  aId: string,
  bId: string,
  tier: 0 | 1 | 2 | 3
): ChordNote[] {
  const a = castaliaConceptById.get(aId);
  const b = castaliaConceptById.get(bId);
  if (!a || !b) return [];
  const va = voiceOf(a);
  const vb = voiceOf(b);

  const notes: ChordNote[] = [
    { freq: modeFreq(0, "low"), timbre: "glass", gain: 0.16, delay: 0 },
    { freq: modeFreq(7, "low"), timbre: "glass", gain: 0.1, delay: 0.05 },
    { freq: va.freq, timbre: va.timbre, gain: 0.24, delay: 0.09 },
    { freq: vb.freq, timbre: vb.timbre, gain: 0.24, delay: 0.16 },
  ];

  if (tier >= 2) {
    notes.push(secondStep(a, 0.14, 0.24), secondStep(b, 0.12, 0.32));
  }
  if (tier >= 3) {
    notes.push({ freq: modeFreq(2, "air"), timbre: "glass", gain: 0.1, delay: 0.44 });
    notes.push({ freq: modeFreq(0, "air"), timbre: "glass", gain: 0.08, delay: 0.58 });
  }
  return notes;
}
