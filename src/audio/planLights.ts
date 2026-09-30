/**
 * A PLAN'S NOTES, ON THE SCORE THE SCENE READS (ADR-016).
 *
 * The director writes every plan down before it sounds. That is what lets the
 * conductor know which bead a note belongs to without listening to anything:
 * each note that speaks for a concept is handed over as an onset, at the moment
 * it will sound, for as long as its envelope lasts, weighted by its role.
 *
 * The weight is the role's and nothing else's. A plan's `meta.outcome` is never
 * read here, so a documented relation, an Open Thread and an unresolved outcome
 * light their beads alike (CAV-006): outcomes differ in resolution, never in
 * reward, and light is a reward if it can be earned.
 *
 * Pure: no Web Audio, no clock of its own, no React.
 */
import {
  LIGHT_WEIGHT_BY_ROLE,
  type Conductor,
  type ScheduledOnset,
} from "./conductor";
import { noteLifetime, type VoicePlan } from "./plan";

/**
 * Hand every note of `plan` that speaks for a concept to `conductor`, as if the
 * plan began at `atSeconds` on the conductor's clock. Structural voices (no
 * concept) light nothing. Returns how many onsets were handed over.
 */
export function publishPlanLights(
  conductor: Pick<Conductor, "sound">,
  plan: VoicePlan,
  atSeconds: number
): number {
  let published = 0;
  for (const note of plan.notes) {
    if (note.conceptId === null) continue;
    conductor.sound({
      conceptId: note.conceptId,
      at: atSeconds + note.atSeconds,
      duration: noteLifetime(note),
      weight: LIGHT_WEIGHT_BY_ROLE[note.role],
    });
    published += 1;
  }
  return published;
}

// ─── The feed: the score, a little ahead ────────────────────────────────────

/**
 * How far ahead of now a note is put on the conductor.
 *
 * The conductor holds a bounded ring of onsets and lets the one due soonest go
 * when it is full, which is right for a score written a little ahead and wrong
 * for one written all at once: Attunement's channels and the conclusion's
 * sections are scheduled in one breath, tens of seconds ahead, and a ten-thread
 * conclusion alone is a hundred onsets. Published whole, it would crowd its own
 * opening out of the ring. So a note further ahead than this waits here and
 * goes on the score as it nears — still well before it sounds.
 */
export const SCORE_HORIZON_SECONDS = 1.5;
/** At most this many notes wait at once; past it the latest are let go. */
export const SCORE_FEED_CAPACITY = 512;

/**
 * A gate in front of the conductor that takes onsets as the conductor does,
 * publishes the near ones at once and holds the rest in time order.
 */
export interface ScoreFeed extends Pick<Conductor, "sound"> {
  /** Put every held onset that now begins within the horizon on the score. */
  readonly pump: () => void;
  /** Onsets held, not yet on the score. */
  readonly pending: () => number;
  /** Forget every held onset: the room is changing. */
  readonly clear: () => void;
}

export function createScoreFeed(
  conductor: Pick<Conductor, "sound" | "now">,
  horizonSeconds: number = SCORE_HORIZON_SECONDS,
  capacity: number = SCORE_FEED_CAPACITY
): ScoreFeed {
  /** In time order, soonest first. */
  const held: ScheduledOnset[] = [];

  return {
    sound: (onset) => {
      if (onset.at <= conductor.now() + horizonSeconds) {
        conductor.sound(onset);
        return;
      }
      let index = held.length;
      while (index > 0 && held[index - 1].at > onset.at) index -= 1;
      held.splice(index, 0, onset);
      if (held.length > capacity) held.length = capacity;
    },
    pump: () => {
      const until = conductor.now() + horizonSeconds;
      let due = 0;
      while (due < held.length && held[due].at <= until) {
        conductor.sound(held[due]);
        due += 1;
      }
      if (due > 0) held.splice(0, due);
    },
    pending: () => held.length,
    clear: () => {
      held.length = 0;
    },
  };
}
