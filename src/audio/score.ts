/**
 * THE SCORE — every musical decision that is taste rather than plumbing.
 *
 * This file is written for a musician, not a programmer: change numbers,
 * save, and the game re-tunes live (npm run dev). Nothing here can break
 * the engine — stay roughly within the suggested ranges and trust your ears.
 *
 * The instrument underneath: all pitches live in C major pentatonic across
 * four octaves, so every simultaneous combination is consonant. Six timbre
 * families (bell, pluck, pad, fm, breath, drone) map one-to-one onto the
 * six disciplines. The ambient engine schedules in "slots" (one gentle
 * pulse each ~2s, per world); melodies land on a slot/8 grid.
 *
 * Adding real samples later: voices.ts's playVoice() is the single place
 * every note is born — swap a timbre's branch for an AudioBufferSourceNode
 * and the whole game plays your recordings.
 */
export const SCORE = {
  /** The room. Longer + wetter = more cathedral; 0 wet = the old dry synth. */
  reverb: {
    seconds: 3.2, // impulse length (2.0–4.5)
    decay: 2.4, // how fast the tail dies (1.5 sharp – 4 slow)
    wet: 0.28, // reverb level (0–0.5); the single biggest "organic" lever
  },

  /** Small human imperfections applied to every note. */
  humanize: {
    detuneCents: 3.5, // random per-note detune, ± this many cents (0–8)
    gainJitter: 0.1, // random per-note level variation, ± this fraction (0–0.2)
    vibratoDepth: 0.0035, // pad/fm pitch wobble as a fraction of freq (0–0.006)
    vibratoHz: 4.6, // pad/fm vibrato speed
  },

  /** The slow harmonic journey. The drone alternates its root: mostly C
   *  (bright, grounded), leaning to A (the pentatonic's minor shadow) for
   *  one phrase in every `cycle`. */
  harmony: {
    phraseSlots: 12, // slots per phrase (8–16)
    cycle: 3, // every Nth phrase leans minor (2–4)
    minorRootDegree: 4 as const, // A — do not change unless you re-voice pads
  },

  /** The motif voices — each completed motif joins the ensemble forever. */
  motifVoices: {
    speakProbability: 0.11, // chance per slot that a motif's voice enters
    triadGain: 0.05, // the triangle's three-note strum (pad)
    symposiumGain: 0.045, // the council chord (wide pad)
    fugueGain: 0.062, // the five-note subject (pluck line)
    fugueStepDivisor: 8, // subject note spacing = slot / this (6–10)
  },

  /** High shimmer that enters when the session is nearly fully awakened. */
  shimmer: {
    threshold: 0.75, // awakening level that unlocks it (0–1)
    probability: 0.15, // chance per slot
    gain: 0.022,
  },

  /** The consecration chime — faint threads rising to silver. */
  consecration: {
    gain: 0.055,
    noteGapSeconds: 0.11,
  },
} as const;
