/**
 * THE FOCUS LANE — one thing about the pair is said at a time.
 *
 * Looking is not acting, and it repeats. A lens crossing a cluster asks for a new
 * answer every few hundred milliseconds; a pointer crossing four sigils asks for
 * four bars in a second. Each answer is a plan already handed to the sink, and a
 * sink can only add. Left alone, a sweep is a pile.
 *
 * So the director keeps a ledger of what it has handed over on this lane — the
 * sighted bead, the locked pair, the reading being heard, a thread being returned
 * to — and each new voice *supersedes* what is still sounding. Where the sink can
 * take a voice back (`AudioSink.retire`) that is exactly what happens: the old
 * one fades over a few tens of milliseconds and the new one begins as it goes,
 * so at most one focus voice is ever audible. Where it cannot, the ledger is what
 * lets the director bound the overlap on its own instead of guessing:
 *
 *  - each voice still sounding under a new one ducks it, and one that would fall
 *    below the floor is not played, because a hover that stacks is worse than a
 *    hover that is skipped;
 *  - a voice carrying tense notes is never played over tense notes already
 *    sounding on the lane, because CAV-007 bounds *instants* and an instant does
 *    not know which plan a voice came from (`attunement.ts` learned the same
 *    thing the hard way: six tense voices, each plan individually lawful).
 *
 * The ledger knows only what the director scheduled, on the sink's own clock. It
 * cannot see a woven relation still ringing from an earlier commit, and it does
 * not pretend to.
 *
 * Deterministic, no clock of its own, no Web Audio. State, but no side effects.
 */
import { COMFORT, tensionCeiling } from "./comfort";
import { FOCUS_VOICING } from "./focusVoicing";
import {
  peakConcurrentTenseNotes,
  peakTenseSummedGain,
  type PlannedNote,
  type VoicePlan,
} from "./plan";

export type FocusVoiceKind = "sighting" | "exchange" | "reading" | "recall";

/** One plan handed to the sink on the lane. */
export interface FocusVoice {
  /**
   * The plan's id — what a sink is asked to retire, and what the voice is *about*:
   * the same id, still sounding, means there is nothing new to say, so a lens
   * that leaves a bead and returns does not restart it.
   */
  readonly id: string;
  readonly kind: FocusVoiceKind;
  /** Absolute time on the sink's clock at which the plan begins. */
  readonly onsetSeconds: number;
  /** The plan as it was handed over: after intensity, after any ducking. */
  readonly plan: VoicePlan;
}

export interface LiveFocusVoice extends FocusVoice {
  /** Null while nothing has asked for it to stop. */
  readonly retiredAt: number | null;
}

export interface FocusLane {
  readonly add: (voice: FocusVoice) => void;
  /** Voices that can still be heard at or after `now`, oldest first. */
  readonly live: (now: number) => readonly LiveFocusVoice[];
  /**
   * Fade a voice from `atSeconds` over `fadeSeconds` — or, if it has not begun by
   * then, never let it. Targets the newest live voice with that id; a later plan
   * that happens to share an id is a new voice.
   */
  readonly retire: (id: string, atSeconds: number, fadeSeconds: number) => void;
  /** How many voices are still sounding at `atSeconds`, retirements counted. */
  readonly soundingAt: (atSeconds: number) => number;
  /** The tense notes still sounding at `atSeconds`, and their summed level. */
  readonly tenseAt: (atSeconds: number) => {
    readonly voices: number;
    readonly gain: number;
  };
  readonly clear: () => void;
}

interface Entry {
  readonly voice: FocusVoice;
  retiredAt: number | null;
  fadeSeconds: number;
}

/** A hard bound on the ledger, so a pathological caller cannot grow it. */
const MAX_ENTRIES = 16;

const noteStart = (entry: Entry, note: PlannedNote): number =>
  entry.voice.onsetSeconds + note.atSeconds;

/** Where a retirement has finished. Infinity while none has been asked for. */
const cutOf = (entry: Entry): number =>
  entry.retiredAt === null
    ? Number.POSITIVE_INFINITY
    : entry.retiredAt + entry.fadeSeconds;

/**
 * Where a note ends, counting `releaseFraction` of its release — or never, if its
 * voice was retired before it began. That is the contract of `AudioSink.retire`:
 * what has not begun by the moment a plan is taken back never does, so a note that
 * was due a few milliseconds after it is not a sliver left to fade, it is not there.
 */
const endOf = (entry: Entry, note: PlannedNote, releaseFraction: number): number => {
  const start = noteStart(entry, note);
  if (entry.retiredAt !== null && start >= entry.retiredAt) {
    return Number.NEGATIVE_INFINITY;
  }
  return Math.min(
    cutOf(entry),
    start +
      note.envelope.attack +
      note.envelope.hold +
      note.envelope.release * releaseFraction
  );
};

/**
 * Where a note has stopped *mattering*: through its attack and hold, and a
 * fraction of its release. An exponential release is twenty decibels down a third
 * of the way in, and a voice that quiet is not one a new voice needs to duck for.
 */
const audibleEnd = (entry: Entry, note: PlannedNote): number =>
  endOf(entry, note, FOCUS_VOICING.lane.audibleReleaseFraction);

/** Where a note has stopped altogether — the end CAV-007's count is taken against. */
const fullEnd = (entry: Entry, note: PlannedNote): number =>
  endOf(entry, note, 1);

const voiceEnd = (entry: Entry): number =>
  entry.voice.plan.notes.reduce(
    (end, note) => Math.max(end, audibleEnd(entry, note)),
    Number.NEGATIVE_INFINITY
  );

export function createFocusLane(): FocusLane {
  let entries: Entry[] = [];

  const prune = (now: number): void => {
    entries = entries.filter((entry) => voiceEnd(entry) > now);
  };

  const lane: FocusLane = {
    add: (voice) => {
      entries.push({ voice, retiredAt: null, fadeSeconds: 0 });
      // The oldest goes first. It has almost certainly finished; if it has not,
      // forgetting it can only make the lane more permissive by one voice.
      if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    },

    live: (now) => {
      prune(now);
      return Object.freeze(
        entries.map((entry) =>
          Object.freeze({ ...entry.voice, retiredAt: entry.retiredAt })
        )
      );
    },

    retire: (id, atSeconds, fadeSeconds) => {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (entry.voice.id !== id) continue;
        // Asking twice can only bring the end forward, never push it back.
        const already = cutOf(entry);
        const next = atSeconds + Math.max(0, fadeSeconds);
        if (next < already) {
          entry.retiredAt = atSeconds;
          entry.fadeSeconds = Math.max(0, fadeSeconds);
        }
        return;
      }
    },

    soundingAt: (atSeconds) =>
      entries.filter((entry) => voiceEnd(entry) > atSeconds).length,

    tenseAt: (atSeconds) => {
      let voices = 0;
      let gain = 0;
      for (const entry of entries) {
        for (const note of entry.voice.plan.notes) {
          if (!note.tense || fullEnd(entry, note) <= atSeconds) continue;
          voices += 1;
          gain += note.gain;
        }
      }
      return Object.freeze({ voices, gain });
    },

    clear: () => {
      entries = [];
    },
  };
  return Object.freeze(lane);
}

// ─── Admission ──────────────────────────────────────────────────────────────

export interface Admission {
  readonly play: boolean;
  /** Fraction of the plan's own level to play it at. One when nothing sounds under it. */
  readonly scale: number;
}

const SKIP: Admission = Object.freeze({ play: false, scale: 0 });

/**
 * Whether a plan may begin at `atSeconds`, and how loudly, given what the lane
 * still has sounding.
 *
 * When the sink has retired what was there, nothing is sounding by then and every
 * plan is admitted whole. This function matters when it has not.
 *
 * @param bedGain the bed as it sounds now — the tense ceiling is a fraction of it.
 */
export function admit(
  plan: VoicePlan,
  lane: Pick<FocusLane, "soundingAt" | "tenseAt">,
  atSeconds: number,
  bedGain: number
): Admission {
  const limits = FOCUS_VOICING.lane;
  const scale = limits.overlapDuck ** lane.soundingAt(atSeconds);
  if (scale < limits.minScale) return SKIP;

  const tenseVoices = peakConcurrentTenseNotes(plan);
  if (tenseVoices > 0) {
    const under = lane.tenseAt(atSeconds);
    if (under.voices + tenseVoices > COMFORT.tension.maxConcurrentVoices) {
      return SKIP;
    }
    if (
      under.gain + peakTenseSummedGain(plan) * scale >
      tensionCeiling(bedGain) + 1e-9
    ) {
      return SKIP;
    }
  }
  return Object.freeze({ play: true, scale });
}
