/**
 * THE SCORE — every musical decision that is taste rather than plumbing.
 *
 * This file is written for a musician, not a programmer: change numbers, save,
 * and the game re-tunes live (npm run dev). Nothing here can break the engine —
 * stay roughly within the suggested ranges and trust your ears.
 *
 * The instrument underneath (changed, and the change matters):
 *
 * Pitch no longer lives in one C-pentatonic gamut. It lives in a *world mode*
 * (`mode.ts`): a tonic, five-limit just intonation, and an explicit split of the
 * twelve semitone classes into stable and tense. Nothing is consonant by
 * accident any more. That is deliberate — the old gamut made every simultaneity
 * pleasant, which also made Tension impossible to say. Stable intervals are now
 * exact ratios and do not beat at all, so any beating you hear is something a
 * plan asked for by name.
 *
 * Six timbre bodies — glass, gut, reed, metal, wood, voice — are authored per
 * concept in the content pack, not assigned per discipline by code.
 *
 * The ambient engine schedules in "slots" (one gentle pulse each ~2s, per
 * world); motif rhythms are authored in sixteenths of a slot.
 *
 * Adding real recordings later: `voices.ts`'s `playVoice()` is still the single
 * place every note is born — swap a timbre's branch for an AudioBufferSourceNode
 * and the whole game plays your samples, with no content change.
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
    vibratoDepth: 0.0035, // sustained-voice pitch wobble as a fraction of freq (0–0.006)
    vibratoHz: 4.6, // vibrato speed
  },

  /** The slow harmonic journey of the ambient bed. */
  harmony: {
    phraseSlots: 12, // slots per phrase (8–16)
    cycle: 3, // every Nth phrase leans toward the mode's shadow (2–4)
    minorRootDegree: 9 as const, // the major sixth — the mode's minor shadow
  },

  /**
   * THE RELATION GRAMMAR — the numbers behind Echo, Passage, Tension, Ground.
   *
   * Gains are expressed as multiples of the ambient bed's summed level, so a
   * relation is always sized *against the room* rather than against an absolute
   * that stops making sense when the bed thickens.
   */
  grammar: {
    unitsPerSlot: 16, // a motif rhythm value of 1 = one sixteenth of a slot
    bedGain: 0.19, // summed peak level of the ambient bed (drone + pad)

    subjectGain: 0.9, // the line that states the figure
    answerGain: 0.72, // the line that answers it
    pedalGain: 0.8, // Ground's invariant base
    groundGain: 0.45, // the fifth that reinforces the pedal
    residueGain: 0.4, // cadences, carriers, tails
    shimmerGain: 0.22, // Attunement's per-channel high partial

    echoStaggerFraction: 0.5, // where the imitation enters, as a share of the subject
    echoFallbackInterval: 7, // the fifth, when two motifs share no interval

    tensionHeadroom: 0.95, // safety under the CAV-007 gain ceiling
    tensionShares: [0.45, 0.34, 0.21] as const, // subject / suspension / beating twin
    tensionAttackSeconds: 1.4, // instability arrives, it does not stab

    groundPasses: 2, // how many times the grounded motif continues above
    groundEntryUnits: 4, // units of pedal alone before the motif enters
  },

  /**
   * ATTENTION — the score leaves space (VERTICAL-SLICE-SPEC §6).
   *
   * Two ways of leaving it. Under a thin web the density simply drops; once the
   * web is busy, dropping density is not enough to be legible and the score
   * moves to call-and-response so the attended bead has actual silence to speak
   * into.
   */
  attention: {
    callAndResponseThreads: 3, // active threads above which the score answers instead of thins
    thinDensityScale: 0.45, // per-voice speak probability while attending
    responseDensityScale: 0.25, // ... in call-and-response
    bedGainScale: 0.72, // the bed recedes
    foregroundGain: 0.95, // the attended motif, as a multiple of the bed
    responseGapSeconds: 1.1, // silence held open after the motif speaks
    repeats: 2, // statements of the attended motif per attention cycle
  },

  /** ATTUNEMENT — threads become individually audible (VERTICAL-SLICE-SPEC §13). */
  attunement: {
    maxChannelsPerCycle: 6, // bounded: a long session rotates rather than piles up
    channelGapSeconds: 0.9, // silence between threads, so each is its own
    channelGainScale: 0.85, // slightly under ordinary play; this is a held state
    bedGainScale: 0.55,
    densityScale: 0.15,
  },

  /** THE CONCLUSION — rendering a compiled performance (VERTICAL-SLICE-SPEC §14). */
  conclusion: {
    dynamicFloor: 0.35, // no entry is ever rendered inaudible
    dynamicCeiling: 1.4,
    unresolvedRepeats: 6, // bounded re-statements of an unresolved Tension
  },

  /** The motif voices — each completed motif joins the ensemble forever. */
  motifVoices: {
    speakProbability: 0.11, // chance per slot that a motif's voice enters
    triadGain: 0.05, // the triangle's three-note strum
    symposiumGain: 0.045, // the council chord
    fugueGain: 0.062, // the five-note subject
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

/** One rhythm unit in seconds, for a world whose phrase slot is `slotSeconds`. */
export const unitSecondsFor = (slotSeconds: number): number =>
  slotSeconds / SCORE.grammar.unitsPerSlot;
