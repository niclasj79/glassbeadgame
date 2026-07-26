import { createInterpretationDraftStore } from "./createInterpretationDraftStore";

/** The one ephemeral interpretation draft used by the live application. */
export const interpretationDraftStore = createInterpretationDraftStore();
