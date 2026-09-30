import { createStore, type StoreApi } from "zustand/vanilla";
import type { RelationIntention } from "../../domain/events";
import type { ConceptId } from "../../domain/ids";
import {
  attendDraft,
  cancelDraft,
  chooseDraftReading,
  createInterpretationDraft,
  lockDraftCandidate,
  type InterpretationDraft,
} from "../../runtime/interactionDraft";

export interface InterpretationDraftAdapterState {
  readonly draft: InterpretationDraft;
  readonly attend: (
    conceptId: ConceptId,
    sessionConceptIds: readonly ConceptId[]
  ) => void;
  /** Fix — or replace — the second bead (I-016). */
  readonly lockCandidate: (
    conceptId: ConceptId,
    sessionConceptIds: readonly ConceptId[]
  ) => void;
  /** Choose — or change — the reading of the locked pair. */
  readonly chooseReading: (intention: RelationIntention) => void;
  readonly cancel: () => void;
  readonly reset: () => void;
}

export type InterpretationDraftStore = Pick<
  StoreApi<InterpretationDraftAdapterState>,
  "getState" | "getInitialState" | "subscribe"
>;

export function createInterpretationDraftStore(): InterpretationDraftStore {
  return createStore<InterpretationDraftAdapterState>()((set, get) => {
    const publish = (draft: InterpretationDraft): void => {
      if (draft === get().draft) return;
      set({ draft });
    };

    return {
      draft: createInterpretationDraft(),

      attend: (conceptId, sessionConceptIds) => {
        publish(attendDraft(get().draft, conceptId, sessionConceptIds));
      },

      lockCandidate: (conceptId, sessionConceptIds) => {
        publish(lockDraftCandidate(get().draft, conceptId, sessionConceptIds));
      },

      chooseReading: (intention) => {
        publish(chooseDraftReading(get().draft, intention));
      },

      cancel: () => {
        publish(cancelDraft(get().draft));
      },

      reset: () => {
        publish(createInterpretationDraft());
      },
    };
  });
}
