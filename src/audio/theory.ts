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
import { CASTALIA_MODE, degreeFrequency } from "./mode";

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

/**
 * `chordForPair` and its `secondStep` helper were removed here.
 *
 * They voiced a pair by `tier` — wider and brighter for a higher-tier
 * discovery — which is a reward gradient expressed in harmony, and their one
 * caller (`sfx.discoveryChord`) read `session.discoveries`, a projection
 * published empty since the legacy scoring model was retired. A relation is now
 * voiced by the intention the player declared, in `audio/grammar.ts`, at the
 * same weight whatever its epistemic status (CAV-006).
 */
