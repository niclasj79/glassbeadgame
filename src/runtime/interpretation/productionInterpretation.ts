import { sharedFacetsOf } from "../../domain/outcomes";
import { domainSessionStore } from "../../state/domainSession";
import { interpretationDraftStore } from "../../state/interactionDraft";
import {
  focusPresentationStore,
  interpretationPresentationStore,
} from "../../state/interpretationPresentation";
import { useStore } from "../../state/store";
import { castaliaLookup, castaliaResonanceLookup } from "../content/castaliaLookup";
import { cueBus } from "../cues";
import { sessionProgression } from "../progression";
import { gameNow } from "../testMode";
import { createProductionInterpretation } from "./createProductionInterpretation";
import { createCastaliaCandidateEvidenceResolver } from "./resolveCastaliaCandidateEvidence";

/**
 * The live interaction loop.
 *
 * Candidate resonance reads the Castalia pack's facets and the current
 * topology, so a bead answers because it genuinely shares structure.
 * `sharedFacets` is the same public structure, handed to the lock and the
 * sighting so the two cards and the captions can name what both beads carry
 * (I-018). `onCommitted` hands each committed thread straight to progression,
 * which resolves its outcome in the same turn as the commit. And
 * `publishCuePlan` carries every ephemeral moment — attending, sighting,
 * locking, hearing a reading, reopening — to the same bus the commit uses.
 */
export const productionInterpretation = createProductionInterpretation({
  domainStore: domainSessionStore,
  draftStore: interpretationDraftStore,
  presentationStore: interpretationPresentationStore,
  focusStore: focusPresentationStore,
  now: gameNow,
  resolveCandidateEvidence: createCastaliaCandidateEvidenceResolver(
    castaliaResonanceLookup
  ),
  sharedFacets: (a, b) => sharedFacetsOf(a, b, castaliaLookup),
  publishCuePlan: (plan) => cueBus.publish(plan),
  setInspection: (conceptId) =>
    useStore.getState().setPinnedInspect(
      conceptId === null ? null : String(conceptId)
    ),
  onCommitted: (threadId) => sessionProgression.afterCommit(threadId),
});
