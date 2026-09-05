import type { CueType, PresentationCue } from "@/runtime/cues";
import { noteFor, type Note } from "./marginaliaNote";

/**
 * WHO IS ALLOWED TO CLOSE THE PAGE.
 *
 * The margin's whole defect was that it answered that question with a timer.
 * This module answers it with the player, and it is deliberately a pure state
 * machine with no clock in it at all — there is no argument you can pass these
 * functions that makes a note disappear on its own, which is the invariant, not
 * a detail of the component.
 *
 * A reading closes when exactly one of three things happens:
 *
 *  - the player sets it aside,
 *  - another outcome arrives and takes its place,
 *  - the player begins another interpretation, at which point the margin gets
 *    out of the way of the arena rather than sitting over it.
 *
 * And because a session's readings are the only record of what the player
 * actually said, they are kept: every one can be re-opened from the margin's
 * index, which is the re-open path the game had nowhere at all.
 */

/**
 * How many readings the margin keeps. A session is finite and short, but an
 * unbounded array in a surface that lives for the whole session is a leak
 * waiting for a long game, so the oldest fall off the front.
 */
export const MARGIN_KEPT = 12;

export interface MarginState {
  /** Oldest first — the order the player made them. */
  readonly readings: readonly Note[];
  /** The reading currently written in the margin, if any. */
  readonly openId: string | null;
  /** Whether the index of earlier readings is expanded. */
  readonly indexOpen: boolean;
  /**
   * A reading that arrived while another was open and has not been read yet.
   *
   * Only a motif can be pending. A motif is completed by a commit, and it is
   * now staged after that commit's outcome has resolved — so when it arrives
   * the player is, by construction, reading the outcome. Taking that page away
   * to announce the motif would be the timer's defect in a new coat. Instead
   * the motif waits: it is offered under the open plate, it opens the moment
   * the player sets the outcome aside, and it is never lost to the index.
   */
  readonly pendingId: string | null;
}

export const EMPTY_MARGIN: MarginState = Object.freeze({
  readings: Object.freeze([]) as readonly Note[],
  openId: null,
  indexOpen: false,
  pendingId: null,
});

/**
 * Cues that mean the player has picked the thread of play back up. Three of
 * these publish nothing today — the loop's attention, armed and latched moments
 * are being restored elsewhere — and they are listed anyway so the margin
 * behaves correctly the moment they arrive rather than needing a second pass.
 */
export const RESUMES_COMPOSING: ReadonlySet<CueType> = new Set<CueType>([
  "attention.enter",
  "intention.armed",
  "candidate.latched",
  "thread.woven",
]);

/** The reading currently on the page, or null when the margin is clear. */
export function openReading(state: MarginState): Note | null {
  if (state.openId === null) return null;
  return state.readings.find((note) => note.id === state.openId) ?? null;
}

/** The most recent reading, which is what the re-open control offers first. */
export function lastReading(state: MarginState): Note | null {
  return state.readings.length === 0
    ? null
    : state.readings[state.readings.length - 1];
}

/** The reading waiting its turn, or null when nothing is waiting. */
export function pendingReading(state: MarginState): Note | null {
  if (state.pendingId === null) return null;
  return state.readings.find((note) => note.id === state.pendingId) ?? null;
}

function keep(readings: readonly Note[], next: Note): readonly Note[] {
  // Cue ids are deterministic, so a replayed plan can present the same reading
  // twice. It moves to the end rather than appearing twice in the index.
  const without = readings.filter((note) => note.id !== next.id);
  const grown = [...without, next];
  return Object.freeze(
    grown.length > MARGIN_KEPT ? grown.slice(grown.length - MARGIN_KEPT) : grown
  );
}

/**
 * Apply a cue. An outcome is written into the margin and kept; a cue that means
 * play has resumed clears the page without discarding it; anything else is not
 * the margin's business.
 */
export function receive(state: MarginState, cue: PresentationCue): MarginState {
  const next = noteFor(cue);
  if (next !== null) {
    const readings = keep(state.readings, next);
    // A motif arriving over an open reading waits; it does not take the page.
    if (next.kind === "motif" && state.openId !== null) {
      return { ...state, readings, pendingId: next.id };
    }
    return {
      readings,
      openId: next.id,
      indexOpen: false,
      pendingId: state.pendingId === next.id ? null : state.pendingId,
    };
  }
  if (RESUMES_COMPOSING.has(cue.type) && (state.openId !== null || state.indexOpen)) {
    // The margin steps out of the arena's way; a waiting motif keeps waiting.
    return { ...state, openId: null, indexOpen: false };
  }
  return state;
}

/**
 * The player is done with this reading. It stays in the index — and if a motif
 * has been waiting under it, that is what the margin turns to next.
 */
export function setAside(state: MarginState): MarginState {
  if (state.pendingId !== null) {
    return { ...state, openId: state.pendingId, indexOpen: false, pendingId: null };
  }
  if (state.openId === null && !state.indexOpen) return state;
  return { ...state, openId: null, indexOpen: false };
}

/** Re-open a reading the player already made. The path that did not exist. */
export function reopen(state: MarginState, id: string): MarginState {
  if (!state.readings.some((note) => note.id === id)) return state;
  return {
    ...state,
    openId: id,
    indexOpen: false,
    pendingId: state.pendingId === id ? null : state.pendingId,
  };
}

export function toggleIndex(state: MarginState): MarginState {
  if (state.readings.length === 0) return state;
  return { ...state, indexOpen: !state.indexOpen };
}
