import { domainSessionStore } from "../../state/domainSession";
import { interpretationDraftStore } from "../../state/interactionDraft";
import { interpretationPresentationStore } from "../../state/interpretationPresentation";
import { useStore } from "../../state/store";
import { gameNow } from "../testMode";
import { createProductionInterpretation } from "./createProductionInterpretation";
import { resolveProvisionalCandidateEvidence } from "./resolveProvisionalCandidateEvidence";

export const productionInterpretation = createProductionInterpretation({
  domainStore: domainSessionStore,
  draftStore: interpretationDraftStore,
  presentationStore: interpretationPresentationStore,
  now: gameNow,
  resolveCandidateEvidence: resolveProvisionalCandidateEvidence,
  setInspection: (conceptId) =>
    useStore.getState().setPinnedInspect(
      conceptId === null ? null : String(conceptId)
    ),
});
