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

  /**
   * The harmony that moves (ADR-017): the bed's root walks this cycle of the
   * mode's stable degrees one phrase at a time and returns, and the pad is a
   * three-voice chord over it (`harmony.ts`). `harmony.test.ts` holds the cycle
   * to what it does to every concept's identity note, so it cannot change
   * without that test changing with it.
   */
  harmony: {
    phraseSlots: 12, // slots per phrase (8–16)
    rootCycle: [0, 5, 9, 7] as const, // C, F, A, G — one root per phrase
    crossfadeSeconds: 2, // the old chord releases while the new one attacks, from the boundary
    padGain: 0.03, // each of the chord's three voices; the one-note pad it replaced was 0.05
    padFloor: 7, // the pad's first voicing starts here, in the low register (G2)
    // Attunement's release (ADR-018): the cadence begins on the first slot
    // boundary at least this far ahead, on the conductor's grid. The bed and
    // the scene both read it at the cue, so they choose the same boundary.
    cadenceLeadSeconds: 0.05,
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

    /**
     * Where a beat rate sits inside the accepted band. The band itself is
     * CAV-007's and lives in `comfort.ts`; only its centre of gravity is taste.
     * Floor 0.15 + spread 0.55 leans toward the slower half, because slow
     * beating reads as breathing and fast beating reads as a fault.
     */
    beatingBandFloor: 0.15,
    beatingBandSpread: 0.55,

    /**
     * How a Tension picks the interval it suspends on. A degree of one motif
     * against a degree of the other counts for more than two degrees inside the
     * same motif, and an exact tense occurrence counts far more than a class one
     * semitone away — the neighbours only decide when the pair never truly rubs.
     */
    suspensionCrossWeight: 3,
    suspensionWithinWeight: 1,
    suspensionExactWeight: 8,

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
    /** Shorter than this and a re-statement is a stub, not a statement. */
    minUnresolvedHoldSeconds: 2.5,
    /**
     * Silence between the last of the performance and the coda. Musically it is
     * the breath before a final sonority; structurally it is what makes the
     * handover unambiguous, so the loose ends and the ending are never counted
     * as one tense simultaneity by the width of a rounding error.
     */
    breathBeforeCodaSeconds: 0.6,

    /**
     * THE ARRIVAL, not the volume.
     *
     * The web's heaviest entry is rendered wider, not louder: its voices are
     * spread a register apart and doubled at the octave, and the level of each
     * doubled line is *taken from* the line it doubles. The summed level of the
     * climax is therefore identical to the same entry rendered ordinarily —
     * which is the whole point. A high point that is merely louder is a score
     * wearing an orchestration (ADR-010).
     */
    climaxDoubleShare: 0.34, // share of a voice's level that moves to its octave
    climaxWeightFloor: 0.45, // what a structurally light climax still receives

    /**
     * How long the generative bed takes to fade out before the coda, in
     * seconds. The loop must not be audible under the last authored sound.
     */
    bedFadeSeconds: 4,
  },

  /** The motif voices — each completed motif joins the ensemble forever. */
  motifVoices: {
    speakProbability: 0.11, // chance per slot that a motif's voice enters
    bridgeGain: 0.05, // the joint's arpeggio, crossing the two regions
    dialecticGain: 0.045, // the held chord: two poles and the third that holds them
    canonGain: 0.062, // the recurring subject, walking
    canonStepDivisor: 8, // subject note spacing = slot / this (6–10)
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
