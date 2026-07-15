import { createInterpretationPresentationStore } from "./createInterpretationPresentationStore";

/** Presentation-only state for the active interpretation; never persisted. */
export const interpretationPresentationStore =
  createInterpretationPresentationStore();
