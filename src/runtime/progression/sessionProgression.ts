import { detectMotifs } from "../../domain/motifs";
import { compileConclusion } from "../../domain/performance";
import { resolveThreadOutcome } from "../../domain/outcomes";
import { domainSessionStore } from "../../state/domainSession";
import { cueBus } from "../cues";
import { castaliaLookup } from "../content/castaliaLookup";
import { gameNow } from "../testMode";
import { isAttunementEligible } from "./attunementEligibility";
import { createSessionProgression } from "./createSessionProgression";

/**
 * The production progression singleton.
 *
 * This is the composition root for meaning: the pure domain functions that
 * decide what a thread *is*, what the web has *become*, and how the session
 * should *sound at its end* are bound here to the one durable log and the one
 * cue bus. Nothing above this line knows how outcomes are resolved; nothing
 * below it knows that a browser exists.
 */
export const sessionProgression = createSessionProgression({
  domainStore: domainSessionStore,
  cueBus,
  lookup: castaliaLookup,
  now: gameNow,
  resolveOutcome: (thread, lookup) => resolveThreadOutcome(thread, lookup),
  detectMotifs: (session, lookup) =>
    // The domain returns rich detections; progression needs only the identity
    // and the sentence. Mapping here keeps the event payload minimal and keeps
    // motif internals out of the durable log.
    detectMotifs(session, lookup).map((motif) => ({
      completionId: motif.key,
      motifKindId: motif.kind,
      conceptIds: motif.conceptIds.map(String),
      threadIds: motif.threadIds.map(String),
      reason: motif.reason,
    })),
  compileConclusion: (session, lookup) => compileConclusion(session, lookup),
  attunementEligible: isAttunementEligible,
});
