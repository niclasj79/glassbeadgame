import { createStore, type StoreApi } from "zustand/vanilla";
import type { ThreadId } from "../../domain/ids";
import type { CandidateResonance } from "../../domain/relations/resonance";

const EMPTY_RESONANCE: readonly CandidateResonance[] = Object.freeze([]);
const IDLE_MESSAGE = "Choose a bead to Attend.";

export interface InterpretationPresentationState {
  readonly candidateResonance: readonly CandidateResonance[];
  readonly message: string;
  readonly failureMessage: string | null;
  readonly weaving: boolean;
  readonly lastCommittedThreadId: ThreadId | null;
  readonly publishAttention: (
    candidateResonance: readonly CandidateResonance[]
  ) => void;
  readonly announce: (message: string) => void;
  readonly announceFailure: (message: string) => void;
  readonly setWeaving: (weaving: boolean) => void;
  readonly publishCommit: (threadId: ThreadId) => void;
  readonly clearAttention: () => void;
  readonly reset: () => void;
}

export type InterpretationPresentationStore =
  StoreApi<InterpretationPresentationState>;

export function createInterpretationPresentationStore(): InterpretationPresentationStore {
  return createStore<InterpretationPresentationState>()((set) => ({
    candidateResonance: EMPTY_RESONANCE,
    message: IDLE_MESSAGE,
    failureMessage: null,
    weaving: false,
    lastCommittedThreadId: null,

    publishAttention: (candidateResonance) =>
      set({
        candidateResonance,
        message: "Attention set. Choose an intention.",
        failureMessage: null,
        weaving: false,
        lastCommittedThreadId: null,
      }),

    announce: (message) => set({ message, failureMessage: null }),

    announceFailure: (failureMessage) => set({ failureMessage }),

    setWeaving: (weaving) =>
      set({
        weaving,
        failureMessage: null,
        message: weaving
          ? "Weaving. Release to Commit; Escape cancels the gesture."
          : "Gesture released. The interpretation is held.",
      }),

    publishCommit: (lastCommittedThreadId) =>
      set({
        candidateResonance: EMPTY_RESONANCE,
        message: "Thread committed. The web now holds your interpretation.",
        failureMessage: null,
        weaving: false,
        lastCommittedThreadId,
      }),

    clearAttention: () =>
      set({
        candidateResonance: EMPTY_RESONANCE,
        message: IDLE_MESSAGE,
        failureMessage: null,
        weaving: false,
        lastCommittedThreadId: null,
      }),

    reset: () =>
      set({
        candidateResonance: EMPTY_RESONANCE,
        message: IDLE_MESSAGE,
        failureMessage: null,
        weaving: false,
        lastCommittedThreadId: null,
      }),
  }));
}
