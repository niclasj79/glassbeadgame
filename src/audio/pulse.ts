/**
 * THE PULSE, AS PATTERNS (ADR-017, M4-002).
 *
 * The world's slot is the bar, and the pulse keeps it: a loping three-three-two
 * on the skin across the slot's eighths (sixteenths 0, 6 and 12), a brush in
 * the second group at half weight, and — only when an act asks for one — a fill
 * that rolls into the next slot boundary and lands on a bell. It sits under
 * everything at whisper level, and it answers acts, never time: nothing here
 * accelerates, counts, swells or anticipates, and the cell is the same in every
 * slot, so there is no cycle against the slot with which to imitate Tension's
 * co-prime interlock.
 *
 * What the bed's state does to it, in the order the rules are applied:
 *
 *  - silent intensity keeps nothing: muted means nothing to hear;
 *  - nothing sounds before the web has woken to `PULSE_SKIN_ENTRY`, and every
 *    onset's weight is the awakening itself, so the pulse grows with the web;
 *  - Attunement's space (density at or under `PULSE_SILENT_DENSITY`) leaves the
 *    slot to the heartbeat, and the pulse says nothing;
 *  - attention's space (density under 1) and reduced intensity keep the skin on
 *    the downbeat alone — no brush, no second voice, no fill;
 *  - otherwise the whole cell: the skin, the brush from `PULSE_BRUSH_ENTRY`, the
 *    second voice while a completed motif's phrase lasts, and a fill where a
 *    weave asked for one.
 *
 * No sixteenth is struck twice: the first body to take one keeps it — the skin,
 * then the cell's brush, then the second voice, then the fill.
 *
 * Pure. No Web Audio, no clock, no store: a cell is a function of the slot
 * index and the bed's state and of nothing else. No outcome is among its inputs,
 * so the fill a weave receives cannot depend on how the reading resolved
 * (CAV-006) — `fillIsUniform` below holds the compiler to that.
 */
import type { GridDivision } from "./conductor";
import type { AudioIntensity } from "./intensity";

/** The three bodies the pulse is played on (`pulseBodies.ts`). */
export type PulseBody = "skin" | "brush" | "bell";

export interface PulseOnset {
  /**
   * Sixteenths from the slot's start, on the conductor's grid. 16 is the next
   * slot's boundary, where only a fill's bell lands.
   */
  readonly sixteenth: number;
  readonly body: PulseBody;
  /** The share of the body's gain ceiling this onset takes, in (0, 1]. */
  readonly weight: number;
}

/** The bed's state a fill is computed from. */
export interface PulseFillOptions {
  /** How far the web has woken, 0–1: the bed's `awakening`. */
  readonly awakening: number;
  /** The space the score is leaving: `setSpace`'s density multiplier, 0–1. */
  readonly density: number;
  /** The profile the director's plans are heard at. */
  readonly intensity: AudioIntensity;
}

/** The bed's state a cell is computed from. */
export interface PulseCellOptions extends PulseFillOptions {
  /** A completed motif or a solved Study: the brush on every other eighth, for a phrase. */
  readonly secondVoice: boolean;
  /** A woven thread: this slot rolls into its closing boundary and lands on a bell. */
  readonly fill: boolean;
}

/** The pulse keeps the conductor's finest division: sixteenths of the slot. */
export const PULSE_DIVISION: GridDivision = 16;
/** The skin enters when the web has woken this far. */
export const PULSE_SKIN_ENTRY = 0.25;
/** The brush enters here, and with it the second voice and the fill's roll. */
export const PULSE_BRUSH_ENTRY = 0.5;
/**
 * At or under this density the score is holding Attunement's space (the
 * director sets 0.15), and the heartbeat alone keeps the slot. Attention's
 * space (0.45 or 0.25) sits above it and thins the pulse instead.
 */
export const PULSE_SILENT_DENSITY = 0.2;

/** The loping cell: the first, fourth and seventh eighths — three, three, two. */
export const SKIN_SIXTEENTHS: readonly number[] = Object.freeze([0, 6, 12]);
/** The brush, midway between the second and third skin onsets. */
export const BRUSH_SIXTEENTH = 9;
/** Every brush is struck at half the weight of the skin. */
export const BRUSH_WEIGHT = 0.5;
/** The second voice: the brush on every other eighth, where no onset is already. */
export const SECOND_VOICE_SIXTEENTHS: readonly number[] = Object.freeze([2, 6, 10, 14]);
/** The fill: brush sixteenths over the slot's last half ... */
export const FILL_SIXTEENTHS: readonly number[] = Object.freeze([
  8, 9, 10, 11, 12, 13, 14, 15,
]);
/** ... landing on one bell on the next slot's boundary. */
export const FILL_LANDING_SIXTEENTH = 16;

/** Every sixteenth a cell may strike, in order. Nothing else is ever used. */
export const PULSE_SIXTEENTHS: readonly number[] = Object.freeze(
  [
    ...new Set([
      ...SKIN_SIXTEENTHS,
      BRUSH_SIXTEENTH,
      ...SECOND_VOICE_SIXTEENTHS,
      ...FILL_SIXTEENTHS,
      FILL_LANDING_SIXTEENTH,
    ]),
  ].sort((a, b) => a - b)
);

/**
 * CAV-006, enforced by the compiler: the fill is one fill for every outcome
 * kind because the cell is computed from nothing that could name one. Add an
 * option whose name mentions an outcome and this constant stops compiling.
 */
type NamesAnOutcome<Key> = Key extends string
  ? Lowercase<Key> extends `${string}outcome${string}`
    ? Key
    : never
  : never;
export const fillIsUniform: [NamesAnOutcome<keyof PulseCellOptions>] extends [never]
  ? true
  : false = true;

const EMPTY: readonly PulseOnset[] = Object.freeze([]);

/** What survives the bed's state: the level, and whether only the downbeat does. */
interface PulseLevel {
  readonly awakening: number;
  readonly downbeatOnly: boolean;
}

function levelOf(slotIndex: number, options: PulseFillOptions): PulseLevel | null {
  // A slot the bed never wrote has no cell.
  if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;
  // Anything but the two audible profiles is silence (muted is silence).
  if (options.intensity !== "full" && options.intensity !== "reduced") return null;
  const awakening = Number.isFinite(options.awakening)
    ? Math.min(1, Math.max(0, options.awakening))
    : 0;
  if (awakening < PULSE_SKIN_ENTRY) return null;
  // A space that cannot be read is not a reason to play.
  if (!Number.isFinite(options.density) || options.density <= PULSE_SILENT_DENSITY) {
    return null;
  }
  return {
    awakening,
    downbeatOnly: options.intensity === "reduced" || options.density < 1,
  };
}

const onset = (sixteenth: number, body: PulseBody, weight: number): PulseOnset =>
  Object.freeze({ sixteenth, body, weight });

/**
 * The fill on its own, before a cell takes it in: brush sixteenths over the
 * slot's last half (once the brush has entered) and one bell on the boundary
 * it rolls into. Nothing under attention's space or reduced intensity, which
 * keep only the downbeat. It is the same fill whichever weave asked for it,
 * and whatever that weave turned out to mean.
 */
export function pulseFill(
  slotIndex: number,
  options: PulseFillOptions
): readonly PulseOnset[] {
  const level = levelOf(slotIndex, options);
  if (level === null || level.downbeatOnly) return EMPTY;
  const onsets: PulseOnset[] = [];
  if (level.awakening >= PULSE_BRUSH_ENTRY) {
    for (const sixteenth of FILL_SIXTEENTHS) {
      onsets.push(onset(sixteenth, "brush", level.awakening * BRUSH_WEIGHT));
    }
  }
  onsets.push(onset(FILL_LANDING_SIXTEENTH, "bell", level.awakening));
  return Object.freeze(onsets);
}

/**
 * Fold `extra` into `onsets`: every onset of `extra` on a sixteenth nothing has
 * struck yet, the whole in sixteenth order. The bed uses it to add a fill to a
 * slot it has already written, so the slot sounds as the cell with the fill
 * would have.
 */
export function mergePulse(
  onsets: readonly PulseOnset[],
  extra: readonly PulseOnset[]
): readonly PulseOnset[] {
  const merged = [...onsets];
  for (const candidate of extra) {
    if (merged.some((taken) => taken.sixteenth === candidate.sixteenth)) continue;
    merged.push(candidate);
  }
  return Object.freeze(merged.sort((a, b) => a.sixteenth - b.sixteenth));
}

/**
 * The onsets of one slot of the pulse, in sixteenth order. The same for every
 * slot index under the same state: the cell repeats each slot, so it keeps no
 * cycle of its own against the slot's eighths.
 */
export function pulseCell(
  slotIndex: number,
  options: PulseCellOptions
): readonly PulseOnset[] {
  const level = levelOf(slotIndex, options);
  if (level === null) return EMPTY;
  const { awakening } = level;
  if (level.downbeatOnly) return Object.freeze([onset(0, "skin", awakening)]);

  const onsets: PulseOnset[] = SKIN_SIXTEENTHS.map((sixteenth) =>
    onset(sixteenth, "skin", awakening)
  );
  if (awakening >= PULSE_BRUSH_ENTRY) {
    const brush = awakening * BRUSH_WEIGHT;
    onsets.push(onset(BRUSH_SIXTEENTH, "brush", brush));
    if (options.secondVoice) {
      for (const sixteenth of SECOND_VOICE_SIXTEENTHS) {
        if (onsets.some((taken) => taken.sixteenth === sixteenth)) continue;
        onsets.push(onset(sixteenth, "brush", brush));
      }
    }
  }
  const cell = Object.freeze(onsets.sort((a, b) => a.sixteenth - b.sixteenth));
  return options.fill ? mergePulse(cell, pulseFill(slotIndex, options)) : cell;
}
