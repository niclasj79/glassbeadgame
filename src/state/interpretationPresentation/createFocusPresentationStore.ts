import { createStore, type StoreApi } from "zustand/vanilla";
import type { ConceptPair, RelationIntention } from "../../domain/events";
import type { ConceptId, ThreadId } from "../../domain/ids";

/**
 * THE FOCUS VIEW'S PRESENTATION FACTS (I-015 … I-019).
 *
 * The draft records what the player has *decided*. This records what they are
 * *looking at*: the bead settled under the lens, the bead dwelt on while
 * roaming, the reading heard by hovering a sigil, and a committed thread
 * reopened for reading. None of it is durable, none of it is a decision, and
 * none of it may ever reach the event log.
 *
 * Discrete facts only. Where the lens *is* — a pointer position at 60 Hz —
 * belongs to `frameState`, never to a store (AGENTS.md: no React state for
 * per-frame animation).
 */
export interface ReopenedThread {
  readonly threadId: ThreadId;
  readonly pair: ConceptPair;
}

export interface FocusPresentationState {
  /** The bead settled under the lens while attending. */
  readonly sightedConceptId: ConceptId | null;
  /** A bead dwelt on while roaming (I-015). */
  readonly dwellConceptId: ConceptId | null;
  /** A reading heard by hovering its sigil — a preview, not a choice. */
  readonly previewIntention: RelationIntention | null;
  /** A committed thread reopened for reading (I-019). */
  readonly reopened: ReopenedThread | null;
  readonly setSighted: (conceptId: ConceptId | null) => void;
  readonly setDwell: (conceptId: ConceptId | null) => void;
  readonly setPreviewIntention: (intention: RelationIntention | null) => void;
  readonly reopen: (thread: ReopenedThread) => void;
  readonly closeReopened: () => void;
  /** Clears what belonged to the last look: sighting and preview. */
  readonly clearLook: () => void;
  readonly reset: () => void;
}

export type FocusPresentationStore = Pick<
  StoreApi<FocusPresentationState>,
  "getState" | "getInitialState" | "subscribe"
>;

export function createFocusPresentationStore(): FocusPresentationStore {
  return createStore<FocusPresentationState>()((set, get) => ({
    sightedConceptId: null,
    dwellConceptId: null,
    previewIntention: null,
    reopened: null,

    setSighted: (sightedConceptId) => {
      if (get().sightedConceptId === sightedConceptId) return;
      set({ sightedConceptId });
    },

    setDwell: (dwellConceptId) => {
      if (get().dwellConceptId === dwellConceptId) return;
      set({ dwellConceptId });
    },

    setPreviewIntention: (previewIntention) => {
      if (get().previewIntention === previewIntention) return;
      set({ previewIntention });
    },

    reopen: (thread) => {
      const current = get().reopened;
      if (current !== null && current.threadId === thread.threadId) return;
      set({
        reopened: Object.freeze({
          threadId: thread.threadId,
          pair: Object.freeze([thread.pair[0], thread.pair[1]]) as ConceptPair,
        }),
        dwellConceptId: null,
      });
    },

    closeReopened: () => {
      if (get().reopened === null) return;
      set({ reopened: null });
    },

    clearLook: () => {
      const state = get();
      if (state.sightedConceptId === null && state.previewIntention === null) return;
      set({ sightedConceptId: null, previewIntention: null });
    },

    reset: () => {
      const state = get();
      if (
        state.sightedConceptId === null &&
        state.dwellConceptId === null &&
        state.previewIntention === null &&
        state.reopened === null
      ) {
        return;
      }
      set({
        sightedConceptId: null,
        dwellConceptId: null,
        previewIntention: null,
        reopened: null,
      });
    },
  }));
}
