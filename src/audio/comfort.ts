/**
 * THE COMFORT ENVELOPE — CAV-007, encoded once.
 *
 * The director accepted measurable bounds "in one shared constant table so that
 * no scene, shader, or audio path can exceed them locally". This is the audio
 * half of that table. Nothing in `src/audio` may hard-code a beating rate, a
 * tense voice count, a decay time, or a voice lifetime; it reads them here, and
 * `auditComfort()` is the mechanism that makes the bound enforceable rather than
 * merely stated.
 *
 * The distinction that matters, because it is easy to get wrong:
 *
 *  - **Beating** is the slow amplitude modulation heard when two nearly-equal
 *    frequencies sum. It is a *pulsation*, and pulsation is what becomes an
 *    irritant. This is what 0.8–6.5 Hz bounds.
 *  - **Roughness** is what a close interval between two clearly different
 *    pitches produces. It is timbral friction, not pulsation, and it is what a
 *    suspension is made of. Bounding it to 6.5 Hz would forbid dissonance
 *    outright, which is exactly what CAV-007 says not to do.
 *
 * So Tension gets its harmonic identity from a *compound* tense interval — a
 * minor ninth rather than a minor second, so the pair never turns to mud in the
 * bass — and gets its audible instability from one deliberately detuned voice
 * whose beat rate is computed, clamped, and written into the plan where a test
 * can read it.
 */

/** Pure data. No Web Audio, no browser, no rules — only bounds. */
export const COMFORT = Object.freeze({
  beating: Object.freeze({
    /** Below this the pulse reads as drift rather than instability. */
    minHz: 0.8,
    /** The accepted working maximum. */
    maxHz: 6.5,
    /** The absolute ceiling. Crossing it is a defect, not a taste choice. */
    ceilingHz: 7,
  }),

  tension: Object.freeze({
    /** At most three sounding voices in a tense interval class at once. */
    maxConcurrentVoices: 3,
    /** The tense pair's summed gain stays below the ambient bed. */
    gainFractionOfBed: 0.85,
    /** Amplitude reaches its low floor within roughly twelve seconds. */
    decayToFloorSeconds: 12,
    /** The floor the instability persists at, as a fraction of its peak. */
    floorFraction: 0.18,
    /**
     * A tense figure is re-sounded rather than held forever: instability
     * persists as a musical fact, but no single voice is unbounded.
     */
    lifetimeSeconds: 20,
  }),

  voice: Object.freeze({
    /** No scheduled voice may outlive this, whatever a plan asks for. */
    maxLifetimeSeconds: 30,
    /** Hard ceiling on simultaneously scheduled voices. */
    maxConcurrent: 48,
  }),
} as const);

export type ComfortTable = typeof COMFORT;

/** Clamp a requested beat rate into the accepted working band. */
export function clampBeatingHz(hz: number): number {
  if (!Number.isFinite(hz)) return COMFORT.beating.minHz;
  if (hz < COMFORT.beating.minHz) return COMFORT.beating.minHz;
  if (hz > COMFORT.beating.maxHz) return COMFORT.beating.maxHz;
  return hz;
}

/**
 * The absolute level a tense simultaneity may not exceed, given the ambient bed
 * *as it actually sounds at that moment*.
 *
 * This function exists because the review found the ceiling being computed
 * against a level that was not the bed — a plan's own reference gain, or the
 * nominal bed while the score had already dropped it for Attunement. CAV-007
 * says "below the ambient bed", so the only argument this takes is the bed, and
 * every caller has to produce one.
 */
export function tensionCeiling(bedGain: number): number {
  if (!Number.isFinite(bedGain) || bedGain <= 0) return 0;
  return bedGain * COMFORT.tension.gainFractionOfBed;
}

/** Clamp a voice's total lifetime. Applied at the last moment before scheduling. */
export function clampLifetimeSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, COMFORT.voice.maxLifetimeSeconds);
}
