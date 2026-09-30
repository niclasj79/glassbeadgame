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
 * A reading closes when exactly one of these things happens, and every one of
 * them is something the player did:
 *
 *  - the player sets it aside,
 *  - another outcome arrives and takes its place,
 *  - the player begins another interpretation, at which point the margin gets
 *    out of the way of the arena rather than sitting over it,
 *  - the player leaves a thread they reopened (I-019): the reading that the
 *    reopening put on the page goes with the view it belonged to.
 *
 * So the thread card a weave leaves behind stays until the player's next act
 * (I-018), however long they take to read it.
 *
 * And because a session's readings are the only record of what the player
 * actually said, they are kept: every one can be re-opened from the margin's
 * index, and a reopened thread finds its own reading again by the thread it
 * answers.
 */

/**
 * How many readings the margin keeps. A session is finite and short, but an
 * unbounded array in a surface that lives for the whole session is a leak
 * waiting for a long game, so the oldest fall off the front. A thread whose
 * reading has fallen off is rebuilt from the log when it is reopened.
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
  /**
   * The open reading whose second layer the player asked for ("Read more").
   * Never anything but the open reading: a new page starts on its first layer.
   */
  readonly expandedId: string | null;
  /**
   * The reading a reopened thread put on the page (I-019), for as long as it
   * is still the one open. Leaving the reopened view sets exactly this reading
   * aside and nothing else.
   */
  readonly heldId: string | null;
}

export const EMPTY_MARGIN: MarginState = Object.freeze({
  readings: Object.freeze([]) as readonly Note[],
  openId: null,
  indexOpen: false,
  pendingId: null,
  expandedId: null,
  heldId: null,
});

/**
 * Cues that mean the player has picked the thread of play back up: attending
 * a bead, locking a second, or weaving. Each is the player's next act, which
 * is the one thing allowed to close a reading (I-018).
 */
export const RESUMES_COMPOSING: ReadonlySet<CueType> = new Set<CueType>([
  "attention.enter",
  "pair.locked",
  "thread.woven",
]);

/**
 * Rebuilds the reading of a committed thread when the margin no longer keeps
 * one. Injected rather than imported so this module stays pure and clockless.
 */
export type RecoverReading = (threadId: string) => Note | null;

const NOTHING_TO_RECOVER: RecoverReading = () => null;

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

/** The most recent kept reading of one committed thread, or null. */
export function readingOfThread(state: MarginState, threadId: string): Note | null {
  for (let index = state.readings.length - 1; index >= 0; index -= 1) {
    const note = state.readings[index];
    if (note.threadId === threadId) return note;
  }
  return null;
}

/** True while the open reading is showing its second layer. */
export function isExpanded(state: MarginState): boolean {
  return state.openId !== null && state.expandedId === state.openId;
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

/** A page with nothing written on it and nothing held open. */
function cleared(state: MarginState): MarginState {
  if (
    state.openId === null &&
    !state.indexOpen &&
    state.expandedId === null &&
    state.heldId === null
  ) {
    return state;
  }
  return { ...state, openId: null, indexOpen: false, expandedId: null, heldId: null };
}

/**
 * Opens one kept reading. A reading that was already open keeps the layer the
 * player had it on; any other starts on its first layer.
 */
function opened(state: MarginState, id: string, heldId: string | null): MarginState {
  return {
    ...state,
    openId: id,
    indexOpen: false,
    pendingId: state.pendingId === id ? null : state.pendingId,
    expandedId: state.openId === id ? state.expandedId : null,
    heldId,
  };
}

/**
 * Apply a cue. An outcome is written into the margin and kept; a reopened
 * thread brings its own reading back; leaving a reopened thread sets that
 * reading aside; a cue that means play has resumed clears the page without
 * discarding it; anything else is not the margin's business.
 */
export function receive(
  state: MarginState,
  cue: PresentationCue,
  recover: RecoverReading = NOTHING_TO_RECOVER
): MarginState {
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
      expandedId: null,
      heldId: null,
    };
  }
  if (cue.type === "thread.reopened") {
    return reopenThread(state, String(cue.payload.threadId), recover);
  }
  if (cue.type === "attention.clear") return leaveHeld(state);
  if (RESUMES_COMPOSING.has(cue.type)) {
    // The margin steps out of the arena's way; a waiting motif keeps waiting.
    return cleared(state);
  }
  return state;
}

/**
 * REOPEN A THREAD'S READING (I-019).
 *
 * Reopening a committed thread — from the world or from the mirror's list of
 * woven threads — returns to the focus view held on that pair, with both bead
 * cards and the thread's own card. This finds that card: the most recent kept
 * reading that answers the thread, or, if a long Game has pushed it off the
 * front of the history, the reading rebuilt from the log. It is the player's
 * act, so it takes the page from whatever was open; if there is genuinely
 * nothing to show, the page is cleared rather than left showing another
 * thread's reading under this pair.
 */
export function reopenThread(
  state: MarginState,
  threadId: string,
  recover: RecoverReading = NOTHING_TO_RECOVER
): MarginState {
  const kept = readingOfThread(state, threadId);
  if (kept !== null) return opened(state, kept.id, kept.id);
  const recovered = recover(threadId);
  if (recovered === null || recovered.threadId !== threadId) return cleared(state);
  const readings = keep(state.readings, recovered);
  return opened({ ...state, readings }, recovered.id, recovered.id);
}

/**
 * The reopened view has closed. The reading it put on the page goes with it —
 * the player opened it by reopening the thread and closed it by leaving — and
 * any other reading the player opened since is theirs and stays.
 */
export function leaveHeld(state: MarginState): MarginState {
  if (state.heldId === null) return state;
  if (state.openId === state.heldId) return cleared(state);
  return { ...state, heldId: null };
}

/**
 * The player is done with this reading. It stays in the index — and if a motif
 * has been waiting under it, that is what the margin turns to next.
 */
export function setAside(state: MarginState): MarginState {
  if (state.pendingId !== null) {
    return {
      ...state,
      openId: state.pendingId,
      indexOpen: false,
      pendingId: null,
      expandedId: null,
      heldId: null,
    };
  }
  return cleared(state);
}

/** Re-open a reading the player already made. The path that did not exist. */
export function reopen(state: MarginState, id: string): MarginState {
  if (!state.readings.some((note) => note.id === id)) return state;
  return opened(state, id, state.heldId === id ? id : null);
}

/** "Read more": the open thread card shows its second layer. */
export function readMore(state: MarginState): MarginState {
  if (state.openId === null || state.expandedId === state.openId) return state;
  return { ...state, expandedId: state.openId };
}

/** "Read less": back to the first layer. The reading stays on the page. */
export function readLess(state: MarginState): MarginState {
  if (state.expandedId === null) return state;
  return { ...state, expandedId: null };
}

export function toggleIndex(state: MarginState): MarginState {
  if (state.readings.length === 0) return state;
  return { ...state, indexOpen: !state.indexOpen };
}
