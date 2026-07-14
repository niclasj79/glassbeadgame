import { createStore, type StoreApi } from "zustand/vanilla";
import type { RelationIntention } from "../../domain/events";
import type { ConceptId } from "../../domain/ids";
import {
  armDraftIntention,
  attendDraft,
  cancelDraft,
  createInterpretationDraft,
  selectDraftCandidate,
  type InterpretationDraft,
} from "../../runtime/interactionDraft";

export interface InterpretationDraftAdapterState {
  readonly draft: InterpretationDraft;
  readonly attend: (
    conceptId: ConceptId,
    sessionConceptIds: readonly ConceptId[]
  ) => void;
  readonly armIntention: (intention: RelationIntention) => void;
  readonly selectCandidate: (
    conceptId: ConceptId,
    sessionConceptIds: readonly ConceptId[]
  ) => void;
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

      armIntention: (intention) => {
        publish(armDraftIntention(get().draft, intention));
      },

      selectCandidate: (conceptId, sessionConceptIds) => {
        publish(
          selectDraftCandidate(get().draft, conceptId, sessionConceptIds)
        );
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
