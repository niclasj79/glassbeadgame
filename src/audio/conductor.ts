/**
 * THE CONDUCTOR — one musical time for the world (ADR-016).
 *
 * A per-frame read model of scheduled musical time: the bed's grid (the
 * world's slot, its eighths and sixteenths, the four-slot breath) and the
 * notes already scheduled ahead, each with the concept it belongs to. The
 * schedulers write it at the moment they schedule; the scene reads it every
 * frame. It is not an analyser: nothing listens to the output. The scene knows
 * the notes because the score was written ahead, which is why this is
 * deterministic, costs no per-frame audio work, and still conducts when the
 * game is muted.
 *
 * It defines no rule and holds nothing durable. Its clock is injected: the Web
 * Audio clock in production, the controlled presentation clock in test mode,
 * where no audio exists. Every read takes primitives and returns a number, and
 * none allocates, so a bead pass may ask for twenty-four lights a frame.
 */
import { presentationNow, testMode } from "@/runtime/testMode";
import { audio } from "./engine";
import type { AudioVoiceRole } from "./plan";

/** Divisions of the slot the world keeps time in. */
export type GridDivision = 1 | 8 | 16;

/** The answer grid: where the director's semantic sounds already land. */
export const ANSWER_DIVISION: GridDivision = 8;
/**
 * The hand grid: where the sounds the hand makes land. One constant, offered
 * to the director in play (ADR-016): the eighth and the sixteenth are both
 * lawful, and the visual answer never waits for either.
 */
export const HAND_DIVISION: GridDivision = 16;
/** One breath every four slots, cresting on the slot boundary that begins them. */
export const BREATH_SLOTS = 4;
/** A grid point closer than this is missed for the next one, as the bed's quantize does. */
export const GRID_LEAD_SECONDS = 0.03;
/** Without a grid the next moment is simply soon, as the bed's quantize answers. */
export const UNARMED_LEAD_SECONDS = 0.02;
/**
 * The bed's first slot begins this long after it starts, and that slot is the
 * grid's origin. Test mode, where no bed can start, arms the grid the same
 * distance ahead on the controlled clock.
 */
export const FIRST_SLOT_LEAD_SECONDS = 0.15;

/**
 * CAV-007: no luminance flicker above 3 Hz. Two onsets on one concept closer
 * than this merge into the stronger, here and nowhere else.
 */
export const LIGHT_MERGE_SECONDS = 1 / 3;
/** The light rises over this at the onset. */
export const LIGHT_RISE_SECONDS = 0.06;
/** And decays over the onset's duration, bounded to a legible range. */
export const LIGHT_DECAY_MIN_SECONDS = 0.35;
export const LIGHT_DECAY_MAX_SECONDS = 1.6;
/** An onset older than its decay plus this is forgotten on the next write. */
const LIGHT_KEEP_AFTER_SECONDS = 1;
/** How many scheduled onsets are held at once; the oldest goes first. */
export const ONSET_CAPACITY = 64;

/**
 * THE WEIGHT OF A NOTE'S LIGHT, BY ROLE — AND BY NOTHING ELSE.
 *
 * Identity and lead lines light fully; accompaniment, doublings and ensembles
 * at 0.6; the hand's own sounds at 0.35. There is no outcome axis: a documented,
 * an Open and an unresolved outcome light their beads alike (CAV-006).
 */
export const LIGHT_WEIGHT_BY_ROLE: Readonly<Record<AudioVoiceRole, number>> =
  Object.freeze({
    subject: 1,
    answer: 1,
    pedal: 0.6,
    ground: 0.6,
    shadow: 0.6,
    ensemble: 0.6,
    residue: 0.6,
  });
/** The ambient choir's identity notes. */
export const CHOIR_LIGHT_WEIGHT = 0.6;
/** The sounds the hand makes. */
export const HAND_LIGHT_WEIGHT = 0.35;

export interface ConductorClock {
  /** Seconds on the clock the onsets are stored in. */
  now(): number;
}

export interface GridArming {
  readonly slotSeconds: number;
  /** A slot boundary on the clock — the bed's first slot time. */
  readonly origin: number;
}

export interface ScheduledOnset {
  readonly conceptId: string;
  /** On the conductor's clock, seconds. */
  readonly at: number;
  /** How long the voice sounds; bounds the light's decay. */
  readonly duration: number;
  /** In [0, 1]. See the weight table. */
  readonly weight: number;
}

/** What the test adapter reports; allocated, so never read per frame. */
export interface MusicalTime {
  readonly armed: boolean;
  readonly slotSeconds: number;
  readonly slotPhase: number;
  readonly breathPhase: number;
  readonly nextHandAt: number;
  readonly nextAnswerAt: number;
}

export interface Conductor {
  arm(grid: GridArming): void;
  /** Forgets the grid and every onset: the room is empty. */
  disarm(): void;
  armed(): boolean;
  slotSeconds(): number;
  now(): number;
  /** The first grid point on the division at least `lead` ahead of now. */
  next(division: GridDivision, lead?: number): number;
  /** Position within the slot, in [0, 1). Zero while unarmed. */
  slotPhase(now?: number): number;
  /**
   * The breath's phase: 2π per four slots, monotonic, and so placed that
   * `sin(breathPhase)` crests on the slot boundary that begins each group.
   * Zero while unarmed, so a caller can tell it has nothing to follow.
   */
  breathPhase(now?: number): number;
  /** A note scheduled ahead on a concept. */
  sound(onset: ScheduledOnset): void;
  /** The light on a concept now, in [0, 1]. */
  light(conceptId: string, now?: number): number;
  /**
   * One sound of a kind per grid point: the first claim of `kind` at a grid
   * time is granted; another of the same kind at the same time is refused.
   */
  claim(kind: string, at: number): boolean;
  /** Forgets every onset and claim, keeps the grid. */
  reset(): void;
  report(): MusicalTime;
}

const TWO_PI = Math.PI * 2;
/** Two claims closer than this are the same grid point. */
const CLAIM_TOLERANCE_SECONDS = 0.001;

/**
 * The grid a bed starting at `nowSeconds` keeps: the world's slot, from a first
 * slot `FIRST_SLOT_LEAD_SECONDS` ahead. One rule for the bed and for test mode,
 * which arms the same grid on the controlled clock because no bed can start.
 */
export function gridAhead(slotSeconds: number, nowSeconds: number): GridArming {
  return { slotSeconds, origin: nowSeconds + FIRST_SLOT_LEAD_SECONDS };
}

/** Shape of one light in time, from `elapsed` seconds after its onset. */
export function lightEnvelope(
  elapsed: number,
  duration: number,
  weight: number
): number {
  if (elapsed < 0) return 0;
  if (elapsed < LIGHT_RISE_SECONDS) return (weight * elapsed) / LIGHT_RISE_SECONDS;
  const decay = Math.min(
    LIGHT_DECAY_MAX_SECONDS,
    Math.max(LIGHT_DECAY_MIN_SECONDS, duration)
  );
  const u = (elapsed - LIGHT_RISE_SECONDS) / decay;
  if (u >= 1) return 0;
  const left = 1 - u;
  return weight * left * left;
}

export function createConductor(clock: ConductorClock): Conductor {
  let armed = false;
  let slot = 0;
  let origin = 0;

  // The ring: parallel fixed-size lanes, so a write moves no memory and a
  // read allocates nothing. An empty lane holds null.
  const ids: (string | null)[] = new Array<string | null>(ONSET_CAPACITY).fill(null);
  const ats = new Float64Array(ONSET_CAPACITY);
  const durations = new Float64Array(ONSET_CAPACITY);
  const weights = new Float64Array(ONSET_CAPACITY);
  const claims = new Map<string, number>();

  const decayOf = (duration: number): number =>
    Math.min(LIGHT_DECAY_MAX_SECONDS, Math.max(LIGHT_DECAY_MIN_SECONDS, duration));

  const forgotten = (i: number, now: number): boolean =>
    ids[i] === null ||
    ats[i] + LIGHT_RISE_SECONDS + decayOf(durations[i]) + LIGHT_KEEP_AFTER_SECONDS < now;

  const next = (division: GridDivision, lead = GRID_LEAD_SECONDS): number => {
    const now = clock.now();
    if (!armed) return now + UNARMED_LEAD_SECONDS;
    const grid = slot / division;
    // Measured from the lead itself rather than from now, so that a lead longer
    // than one grid step (a sighting deferred to the end of its window) still
    // lands on the first point at or after it, not one step short of it.
    const from = now + lead;
    const until = origin - from;
    const phase = ((until % grid) + grid) % grid;
    return from + phase;
  };

  const slotPhase = (now = clock.now()): number => {
    if (!armed) return 0;
    const turns = (now - origin) / slot;
    return ((turns % 1) + 1) % 1;
  };

  const breathPhase = (now = clock.now()): number => {
    if (!armed) return 0;
    return (TWO_PI * (now - origin)) / (BREATH_SLOTS * slot) + Math.PI / 2;
  };

  const reset = (): void => {
    ids.fill(null);
    claims.clear();
  };

  return {
    arm: (grid) => {
      armed = grid.slotSeconds > 0;
      slot = grid.slotSeconds;
      origin = grid.origin;
    },
    disarm: () => {
      armed = false;
      reset();
    },
    armed: () => armed,
    slotSeconds: () => (armed ? slot : 0),
    now: () => clock.now(),
    next,
    slotPhase,
    breathPhase,
    sound: (onset) => {
      const now = clock.now();
      const weight = Math.min(1, Math.max(0, onset.weight));
      if (weight === 0) return;
      // The same concept within the merge window: keep the stronger.
      for (let i = 0; i < ONSET_CAPACITY; i += 1) {
        if (ids[i] !== onset.conceptId) continue;
        if (Math.abs(ats[i] - onset.at) >= LIGHT_MERGE_SECONDS) continue;
        if (weight > weights[i]) {
          ats[i] = onset.at;
          durations[i] = onset.duration;
          weights[i] = weight;
        }
        return;
      }
      // A forgotten lane first; otherwise the oldest onset goes.
      let lane = -1;
      let oldest = Number.POSITIVE_INFINITY;
      for (let i = 0; i < ONSET_CAPACITY; i += 1) {
        if (forgotten(i, now)) {
          lane = i;
          break;
        }
        if (ats[i] < oldest) {
          oldest = ats[i];
          lane = i;
        }
      }
      ids[lane] = onset.conceptId;
      ats[lane] = onset.at;
      durations[lane] = onset.duration;
      weights[lane] = weight;
    },
    light: (conceptId, now = clock.now()) => {
      let light = 0;
      for (let i = 0; i < ONSET_CAPACITY; i += 1) {
        if (ids[i] !== conceptId) continue;
        const l = lightEnvelope(now - ats[i], durations[i], weights[i]);
        if (l > light) light = l;
      }
      return light;
    },
    claim: (kind, at) => {
      const last = claims.get(kind);
      if (last !== undefined && Math.abs(last - at) < CLAIM_TOLERANCE_SECONDS) {
        return false;
      }
      claims.set(kind, at);
      return true;
    },
    reset,
    report: () => {
      const now = clock.now();
      return {
        armed,
        slotSeconds: armed ? slot : 0,
        slotPhase: slotPhase(now),
        breathPhase: breathPhase(now),
        nextHandAt: next(HAND_DIVISION),
        nextAnswerAt: next(ANSWER_DIVISION),
      };
    },
  };
}

/**
 * THE ONE CONDUCTOR. Its clock is the Web Audio clock in production, and the
 * controlled presentation clock in test mode, where no audio exists and the
 * grid is armed by the room lifecycle on that clock instead of by the bed.
 */
export const conductor: Conductor = createConductor({
  now: () => (testMode.enabled ? presentationNow() / 1000 : audio.now()),
});
