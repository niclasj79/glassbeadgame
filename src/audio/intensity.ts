/**
 * REDUCED INTENSITY AND SILENCE — first-class experiences, not fallbacks.
 *
 * CAV-007 requires a reduced-intensity path that expresses Tension "through
 * pattern, phase text, and stereo width instead of movement and glare — never by
 * removing the Tension". The audio equivalent of that sentence is precise: a
 * reduced plan is thinner, slower-beating, and gentler in attack, but it still
 * beats, still suspends, still refuses to resolve. Removing the friction would
 * be removing the meaning, which is a worse accessibility failure than being
 * loud.
 *
 * `silent` is not "audio off". It is the *captioned path*: the plan keeps its
 * whole `meta`, so `describe.ts` produces exactly the same sentence a hearing
 * player's plan produces. A muted player is told what happened, in the same
 * words, at the same moment. That is the only way the two paths cannot drift.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import { COMFORT, clampBeatingHz } from "./comfort";
import { beatingHzBetween, centsForBeatingHz, transposeCents } from "./mode";
import { makeVoicePlan, type PlannedNote, type VoicePlan } from "./plan";

/** The rate a note's own detuning beats at against its untuned twin. */
const beatingHzOf = (frequency: number, detuneCents: number): number =>
  beatingHzBetween(frequency, transposeCents(frequency, detuneCents));

export const AUDIO_INTENSITIES = Object.freeze([
  "full",
  "reduced",
  "silent",
] as const);
export type AudioIntensity = (typeof AUDIO_INTENSITIES)[number];

export interface IntensityProfile {
  readonly gainScale: number;
  /** Ceiling on notes in one plan. Thinning drops the least load-bearing roles. */
  readonly maxNotes: number;
  /** Multiplies planned beat rates. Always re-clamped into the comfort band. */
  readonly beatingScale: number;
  /** Multiplies every attack. A softer onset is a gentler event. */
  readonly attackScale: number;
  /** Whether decorative high partials sound at all. */
  readonly shimmer: boolean;
}

export const INTENSITY_PROFILES: Readonly<
  Record<AudioIntensity, IntensityProfile>
> = Object.freeze({
  full: Object.freeze({
    gainScale: 1,
    maxNotes: COMFORT.voice.maxConcurrent,
    beatingScale: 1,
    attackScale: 1,
    shimmer: true,
  }),
  reduced: Object.freeze({
    gainScale: 0.62,
    maxNotes: 10,
    // Toward the slow end of the band. Slow beating reads as breathing.
    beatingScale: 0.55,
    attackScale: 1.7,
    shimmer: false,
  }),
  silent: Object.freeze({
    gainScale: 0,
    maxNotes: 0,
    beatingScale: 1,
    attackScale: 1,
    shimmer: false,
  }),
});

/**
 * Which voices survive thinning, most load-bearing first.
 *
 * A Tension keeps its beating twin before it keeps its cadence, because the
 * beating *is* the Tension. A Ground keeps its pedal. Ordering by role rather
 * than by loudness is what stops reduced intensity from quietly turning every
 * relation into the same soft chord.
 */
const ROLE_PRIORITY: Readonly<Record<PlannedNote["role"], number>> = Object.freeze({
  subject: 0,
  answer: 1,
  pedal: 0,
  shadow: 1,
  ground: 2,
  ensemble: 3,
  residue: 4,
});

export function applyIntensity(
  plan: VoicePlan,
  intensity: AudioIntensity
): VoicePlan {
  const profile = INTENSITY_PROFILES[intensity];
  if (intensity === "full") return plan;

  if (intensity === "silent") {
    // Everything the caption needs survives; nothing that would make a sound does.
    return makeVoicePlan({
      id: plan.id,
      kind: plan.kind,
      intention: plan.intention,
      notes: [],
      beatings: [],
      meta: plan.meta,
    });
  }

  const kept = [...plan.notes]
    .map((note, index) => ({ note, index }))
    .sort((left, right) => {
      const byRole = ROLE_PRIORITY[left.note.role] - ROLE_PRIORITY[right.note.role];
      return byRole !== 0 ? byRole : left.index - right.index;
    })
    .slice(0, profile.maxNotes)
    .sort((left, right) => left.index - right.index)
    .map(({ note }) =>
      Object.freeze({
        ...note,
        // The beating twin is re-tuned rather than merely turned down: its whole
        // purpose is the rate, so the rate has to follow the profile.
        detuneCents:
          note.role === "shadow" && note.detuneCents !== 0
            ? Number(
                centsForBeatingHz(
                  note.frequency,
                  clampBeatingHz(
                    beatingHzOf(note.frequency, note.detuneCents) * profile.beatingScale
                  )
                ).toFixed(4)
              )
            : note.detuneCents,
        gain: Number((note.gain * profile.gainScale).toFixed(6)),
        floorGain: Number((note.floorGain * profile.gainScale).toFixed(6)),
        envelope: Object.freeze({
          attack: Number((note.envelope.attack * profile.attackScale).toFixed(5)),
          hold: note.envelope.hold,
          release: note.envelope.release,
        }),
      })
    );

  const beatings = plan.beatings.map((beating) => {
    const hz = clampBeatingHz(beating.beatingHz * profile.beatingScale);
    return Object.freeze({
      ...beating,
      beatingHz: Number(hz.toFixed(4)),
      frequencies: [
        beating.frequencies[0],
        Number((beating.frequencies[0] + hz).toFixed(4)),
      ] as const,
      gain: Number((beating.gain * profile.gainScale).toFixed(6)),
      floorGain: Number((beating.floorGain * profile.gainScale).toFixed(6)),
    });
  });

  return makeVoicePlan({
    id: plan.id,
    kind: plan.kind,
    intention: plan.intention,
    notes: kept,
    beatings,
    meta: {
      ...plan.meta,
      beatingHz: beatings.length > 0 ? beatings[0].beatingHz : plan.meta.beatingHz,
    },
  });
}
