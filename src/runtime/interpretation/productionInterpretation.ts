import { domainSessionStore } from "../../state/domainSession";
import { interpretationDraftStore } from "../../state/interactionDraft";
import { interpretationPresentationStore } from "../../state/interpretationPresentation";
import { useStore } from "../../state/store";
import { castaliaResonanceLookup } from "../content/castaliaLookup";
import { cueBus } from "../cues";
import { sessionProgression } from "../progression";
import { gameNow } from "../testMode";
import { createProductionInterpretation } from "./createProductionInterpretation";
import { createCastaliaCandidateEvidenceResolver } from "./resolveCastaliaCandidateEvidence";

/**
 * The live interaction loop.
 *
 * Three bindings here are the whole point of the campaign's plumbing. Candidate
 * resonance now reads the Castalia pack's facets and the current topology
 * instead of a fixture list, so a bead answers because it genuinely shares
 * structure. `onCommitted` hands each committed thread straight to
 * progression, which resolves its outcome, appends what that implies to the
 * durable log, and stages one coordinated response — in the same turn as the
 * commit, so the thread and its meaning never arrive separately. And
 * `publishCuePlan` is the one that was missing: attending, arming and releasing
 * attention now reach the same bus the commit does, so three quarters of the
 * loop stopped being invisible to everything except an aria string.
 */
export const productionInterpretation = createProductionInterpretation({
  domainStore: domainSessionStore,
  draftStore: interpretationDraftStore,
  presentationStore: interpretationPresentationStore,
  now: gameNow,
  resolveCandidateEvidence: createCastaliaCandidateEvidenceResolver(
    castaliaResonanceLookup
  ),
  publishCuePlan: (plan) => cueBus.publish(plan),
  setInspection: (conceptId) =>
    useStore.getState().setPinnedInspect(
      conceptId === null ? null : String(conceptId)
    ),
  onCommitted: (threadId) => sessionProgression.afterCommit(threadId),
});
