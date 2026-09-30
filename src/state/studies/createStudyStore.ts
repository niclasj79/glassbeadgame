import { createStore, type StoreApi } from "zustand/vanilla";
import type { StudyStatus } from "../../domain/studies";

/**
 * THE STUDY BEING PLAYED (STUDIES-SPEC §§5–7).
 *
 * A Study session is an ordinary canonical session (§8); this store only says
 * which Study it is being played against and what the evaluator last said.
 * Nothing here is durable: declaring silence is not logged, a restart is a
 * new session, and leaving discards everything (§10). The status is the
 * evaluator's output as it came, never a copy the presentation re-derives.
 */
export type StudyNotYetKind = "no-answer-yet" | "can-be-done";

export interface StudyNotYetAnswer {
  readonly kind: StudyNotYetKind;
  /** Increments on every answer, so the same words said twice still arrive. */
  readonly serial: number;
}

export interface StudyStoreState {
  /** The Study being played; null in the Free Game (R4). */
  readonly studyId: string | null;
  /** The evaluator's latest word on this session. */
  readonly status: StudyStatus | null;
  /** The last "not yet" given to a declared silence: a caption and a margin line, never a plate. */
  readonly notYet: StudyNotYetAnswer | null;
  /** The solved plate is showing. */
  readonly plateOpen: boolean;
  readonly begin: (studyId: string) => void;
  readonly publishStatus: (status: StudyStatus) => void;
  readonly answerNotYet: (kind: StudyNotYetKind) => void;
  readonly openPlate: () => void;
  readonly closePlate: () => void;
  readonly reset: () => void;
}

export type StudyStore = StoreApi<StudyStoreState>;

export function createStudyStore(): StudyStore {
  return createStore<StudyStoreState>()((set, get) => ({
    studyId: null,
    status: null,
    notYet: null,
    plateOpen: false,
    begin: (studyId) => set({ studyId, status: null, notYet: null, plateOpen: false }),
    publishStatus: (status) => {
      if (get().status === status) return;
      set({ status });
    },
    answerNotYet: (kind) =>
      set({ notYet: { kind, serial: (get().notYet?.serial ?? 0) + 1 } }),
    openPlate: () => {
      if (get().plateOpen) return;
      set({ plateOpen: true });
    },
    closePlate: () => {
      if (!get().plateOpen) return;
      set({ plateOpen: false });
    },
    reset: () => set({ studyId: null, status: null, notYet: null, plateOpen: false }),
  }));
}
