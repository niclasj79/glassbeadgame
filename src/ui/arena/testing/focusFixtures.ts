import type { ConceptPair, RelationIntention } from "@/domain/events";
import { toConceptId, toThreadId, type ConceptId, type ThreadId } from "@/domain/ids";
import { sharedFacetsOf } from "@/domain/outcomes";
import { CASTALIA_CONCEPTS } from "@/content/castalia";
import { planThreadReopened, type PresentationCue } from "@/runtime/cues";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import {
  deriveFocusView,
  type FocusView,
  type InterpretationDraft,
} from "@/runtime/interactionDraft";

/**
 * Real focus views, derived by the real `deriveFocusView`, for the column that
 * reads them. A hand-written view could describe a state the derivation never
 * produces, which is the one thing a presentation test must not do.
 */

/** The golden path's pair: they share Recursion and nothing else. */
export const FIBONACCI = toConceptId("measure.fibonacci-sequence");
export const COUNTERPOINT = toConceptId("sound.counterpoint");
export const GOLDEN_PAIR: ConceptPair = Object.freeze([FIBONACCI, COUNTERPOINT]) as ConceptPair;
export const GOLDEN_THREAD: ThreadId = toThreadId("thread:1:s:1");

/**
 * The first pair in the pack, in pack order, whose beads share no facet at
 * all — found rather than named, so the fixture cannot rot when facets are
 * re-authored.
 */
export const UNSHARED_PAIR: ConceptPair = (() => {
  for (const a of CASTALIA_CONCEPTS) {
    for (const b of CASTALIA_CONCEPTS) {
      if (a.id === b.id) continue;
      const pair = [toConceptId(a.id), toConceptId(b.id)] as const;
      if (sharedFacetsOf(pair[0], pair[1], castaliaLookup).length === 0) {
        return Object.freeze([pair[0], pair[1]]) as ConceptPair;
      }
    }
  }
  throw new Error("every pair in the pack shares a facet");
})();

interface ViewOptions {
  readonly sighted?: ConceptId | null;
  readonly dwell?: ConceptId | null;
  readonly preview?: RelationIntention | null;
  readonly reopened?: Readonly<{ threadId: ThreadId; pair: ConceptPair }> | null;
  readonly reducedMotion?: boolean;
}

function view(draft: InterpretationDraft, options: ViewOptions = {}): FocusView {
  return deriveFocusView({
    draft,
    sightedConceptId: options.sighted ?? null,
    dwellConceptId: options.dwell ?? null,
    previewIntention: options.preview ?? null,
    reopened: options.reopened ?? null,
    holding: false,
    profile: { reducedMotion: options.reducedMotion ?? false, qualityTier: "base" },
  });
}

export const roamingView = (dwell: ConceptId | null = null): FocusView =>
  view({ stage: "inactive" }, { dwell });

export const focusView = (
  attended: ConceptId = FIBONACCI,
  sighted: ConceptId | null = null
): FocusView =>
  view({ stage: "attending", attendedConceptId: attended }, { sighted });

export const lockedView = (
  pair: ConceptPair = GOLDEN_PAIR,
  preview: RelationIntention | null = null
): FocusView =>
  view(
    {
      stage: "locked",
      attendedConceptId: pair[0],
      candidateConceptId: pair[1],
      pair,
    },
    { preview }
  );

export const readingView = (
  intention: RelationIntention,
  pair: ConceptPair = GOLDEN_PAIR
): FocusView =>
  view({
    stage: "reading",
    attendedConceptId: pair[0],
    candidateConceptId: pair[1],
    intention,
    pair,
  });

export const heldView = (
  threadId: ThreadId = GOLDEN_THREAD,
  pair: ConceptPair = GOLDEN_PAIR
): FocusView => view({ stage: "inactive" }, { reopened: { threadId, pair } });

/** The `thread.reopened` cue the runtime publishes when a thread is reopened. */
export const reopenedCue = (
  threadId: ThreadId = GOLDEN_THREAD,
  pair: ConceptPair = GOLDEN_PAIR,
  intention: RelationIntention = "echo"
): PresentationCue => planThreadReopened({ threadId, pair, intention }).cues[0];
