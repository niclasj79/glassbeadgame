import { useStore as useVanillaStore } from "zustand";
import { createStudyStore, type StudyStoreState } from "./createStudyStore";

export {
  createStudyStore,
  type StudyNotYetAnswer,
  type StudyNotYetKind,
  type StudyStore,
  type StudyStoreState,
} from "./createStudyStore";

/** The one Study store. Small and dependency-free, so the first load can hold it. */
export const studyStore = createStudyStore();

/** Whether the session in the arena is a Study (R4: nothing of a Study reaches a Free Game). */
export const isStudyMode = (): boolean => studyStore.getState().studyId !== null;

export function useStudy<T>(selector: (state: StudyStoreState) => T): T {
  return useVanillaStore(studyStore, selector);
}
