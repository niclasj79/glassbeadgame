import type { ConceptPair, RelationIntention } from "../events";
import type { ThreadId } from "../ids";
import type {
  DocumentedRelation,
  FacetId,
  IntentionFit,
} from "@/content/castalia/schema";

/**
 * THREE SHAPES, AND ONLY THREE (VERTICAL-SLICE-SPEC §10).
 *
 * They differ in *resolution*, never in reward (CAV-006). A documented relation
 * closes; an Open Thread stays open at the same weight; an unresolved thread is
 * short and quiet because there is genuinely nothing to say — not because the
 * player did something wrong. Nothing in these types can carry a score, and
 * nothing here ever tells the player they were wrong.
 */
export const THREAD_OUTCOME_KINDS = Object.freeze([
  "documented",
  "open-thread",
  "unresolved",
] as const);
export type ThreadOutcomeKind = (typeof THREAD_OUTCOME_KINDS)[number];

/**
 * How the player's declared intention stands to the authored relation. Derived
 * strictly from the relation's `fit` for that intention (CAV-002):
 *
 *   primary                → confirmed
 *   supported | partial    → refined
 *   unsupported            → complicated
 *
 * "complicated" is not "wrong". It records that the documented material runs
 * across the reading rather than along it, and the reading stands.
 */
export const INTENTION_STANCES = Object.freeze([
  "confirmed",
  "refined",
  "complicated",
] as const);
export type IntentionStance = (typeof INTENTION_STANCES)[number];

interface ThreadOutcomeBaseV1 {
  readonly threadId: ThreadId;
  /** The pair exactly as the player committed it: [attended, candidate]. */
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  /** Sequence of the `thread.committed` event. Creation order, replay-stable. */
  readonly sequence: number;
}

export interface DocumentedThreadOutcome extends ThreadOutcomeBaseV1 {
  readonly kind: "documented";
  readonly relation: DocumentedRelation;
  /** The authored fit for the declared intention, unmodified. */
  readonly fit: IntentionFit;
  readonly stance: IntentionStance;
  /** Facets both concepts genuinely carry, sorted. Never invented. */
  readonly sharedFacets: readonly FacetId[];
  /** One sentence naming how the reading stands to the record. Never praise. */
  readonly statement: string;
}

export interface OpenThreadOutcome extends ThreadOutcomeBaseV1 {
  readonly kind: "open-thread";
  /** Every facet the pair shares, sorted. */
  readonly sharedFacets: readonly FacetId[];
  /** The one facet the question is built on. Deterministically chosen. */
  readonly facet: FacetId;
  /** Authored prompt id, or `null` when the domain fallback template was used. */
  readonly promptId: string | null;
  /** A specific question the player could actually pursue. Ends with '?'. */
  readonly question: string;
  /** The honest indication that no documented fact is being asserted. */
  readonly disclosure: string;
}

export interface UnresolvedThreadOutcome extends ThreadOutcomeBaseV1 {
  readonly kind: "unresolved";
  /** A short true statement. No praise, no filler, no invented significance. */
  readonly statement: string;
}

export type ThreadOutcomeResolution =
  | DocumentedThreadOutcome
  | OpenThreadOutcome
  | UnresolvedThreadOutcome;
