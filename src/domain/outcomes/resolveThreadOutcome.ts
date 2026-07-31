import type { RelationIntention } from "../events";
import type { ConceptId } from "../ids";
import type { CommittedThreadV1, SessionStateV1 } from "../model/sessionState";
import type { FacetId, IntentionFit } from "@/content/castalia/schema";
import type { RelationLookup } from "./lookup";
import {
  INTENTION_LABELS,
  RELATION_TYPE_GLOSS,
  compareStrings,
} from "./prose";
import type {
  DocumentedThreadOutcome,
  IntentionStance,
  OpenThreadOutcome,
  ThreadOutcomeResolution,
  UnresolvedThreadOutcome,
} from "./types";

/**
 * Last-resort Open Thread questions.
 *
 * These fire only when the content pack has *no* prompt for a declared intention
 * — a content gap, signalled to presentation by `promptId === null`. They are
 * deliberately austere: each states the facet the pair actually shares and asks
 * what evidence would be required, which is the one thing the Game can say
 * honestly without any authored material. None of them asserts influence, and
 * none of them praises.
 */
const FALLBACK_QUESTIONS: Readonly<Record<RelationIntention, string>> =
  Object.freeze({
    echo: "{a} and {b} both carry {facet}. What would show that this is a shared form rather than a shared description?",
    passage:
      "You are asking whether {facet} was carried from {a} into {b}. What record would have to exist for that to be more than resemblance?",
    tension:
      "{a} and {b} both carry {facet}, and you read them as opposed. Where exactly does the agreement break?",
    ground:
      "You are asking whether {a} supplies the {facet} that {b} depends on. What would that support actually consist of?",
  });

const OPEN_THREAD_DISCLOSURE =
  "Castalia has no documented relation for this pair. This is a question it can ask, not a finding it can assert.";

function sortFacets(facets: readonly FacetId[]): readonly FacetId[] {
  return Object.freeze([...facets].sort(compareStrings));
}

/** Facets both concepts genuinely carry, deduplicated and deterministically ordered. */
export function sharedFacetsOf(
  a: ConceptId,
  b: ConceptId,
  lookup: Pick<RelationLookup, "conceptFacets">
): readonly FacetId[] {
  if (a === b) return Object.freeze([]);
  const right = new Set<FacetId>(lookup.conceptFacets(b));
  const shared = new Set<FacetId>();
  for (const facet of lookup.conceptFacets(a)) {
    if (right.has(facet)) shared.add(facet);
  }
  return sortFacets([...shared]);
}

/**
 * CAV-002, made mechanical. There is exactly one mapping and it lives here, so
 * no presentation surface can quietly invent a fourth stance or a "wrong".
 */
export function stanceForFit(fit: IntentionFit): IntentionStance {
  switch (fit) {
    case "primary":
      return "confirmed";
    case "supported":
    case "partial":
      return "refined";
    case "unsupported":
      return "complicated";
    default: {
      const exhaustive: never = fit;
      return exhaustive;
    }
  }
}

function documentedStatement(
  intention: RelationIntention,
  fit: IntentionFit,
  gloss: string
): string {
  const label = INTENTION_LABELS[intention];
  switch (fit) {
    case "primary":
      return `Your ${label} reading is the one this relation is documented around: what is recorded here is ${gloss}.`;
    case "supported":
      return `The record supports your ${label} reading and sharpens it — what is documented here is ${gloss}.`;
    case "partial":
      return `Your ${label} reading holds in part; what is documented here is ${gloss}.`;
    case "unsupported":
      return `What is documented here is ${gloss}. Your ${label} reading runs across the record rather than along it, and it stands as yours.`;
    default: {
      const exhaustive: never = fit;
      return exhaustive;
    }
  }
}

function renderQuestion(
  template: string,
  aName: string,
  bName: string,
  facetName: string
): string {
  return template
    .split("{a}")
    .join(aName)
    .split("{b}")
    .join(bName)
    .split("{facet}")
    .join(facetName);
}

/**
 * Deterministic facet choice: prefer the facet the authored prompt was written
 * for, provided the pair actually shares it; otherwise the first shared facet in
 * sorted order. The same pair and intention always yield the same facet.
 */
function chooseFacet(
  shared: readonly FacetId[],
  promptFacet: FacetId | undefined
): FacetId {
  if (promptFacet !== undefined && shared.includes(promptFacet)) {
    return promptFacet;
  }
  return shared[0] as FacetId;
}

function resolveDocumented(
  thread: CommittedThreadV1,
  lookup: RelationLookup,
  shared: readonly FacetId[]
): DocumentedThreadOutcome | null {
  const relation = lookup.findRelation(thread.pair[0], thread.pair[1]);
  if (relation === null) return null;

  const fit = relation.fit[thread.intention];
  const stance = stanceForFit(fit);
  const gloss = RELATION_TYPE_GLOSS[relation.relationType];

  /*
   * The relation's own `sharedFacets` are authored and reviewed; they are the
   * claim. Facets merely computed from both concepts' facet lists are used only
   * when the relation declares none, so the Game never widens an authored claim.
   */
  const facets =
    relation.sharedFacets.length > 0 ? sortFacets(relation.sharedFacets) : shared;

  return Object.freeze({
    kind: "documented" as const,
    threadId: thread.id,
    pair: thread.pair,
    intention: thread.intention,
    sequence: thread.sequence,
    relation,
    fit,
    stance,
    sharedFacets: facets,
    statement: documentedStatement(thread.intention, fit, gloss),
  });
}

function resolveOpenThread(
  thread: CommittedThreadV1,
  lookup: RelationLookup,
  shared: readonly FacetId[]
): OpenThreadOutcome {
  const prompt = lookup.openThreadPrompt(thread.intention, shared);
  const facet = chooseFacet(shared, prompt?.facet);
  const template = prompt?.question ?? FALLBACK_QUESTIONS[thread.intention];

  return Object.freeze({
    kind: "open-thread" as const,
    threadId: thread.id,
    pair: thread.pair,
    intention: thread.intention,
    sequence: thread.sequence,
    sharedFacets: shared,
    facet,
    promptId: prompt?.id ?? null,
    question: renderQuestion(
      template,
      lookup.conceptName(thread.pair[0]),
      lookup.conceptName(thread.pair[1]),
      lookup.facetName(facet)
    ),
    disclosure: OPEN_THREAD_DISCLOSURE,
  });
}

function resolveUnresolved(
  thread: CommittedThreadV1,
  lookup: RelationLookup
): UnresolvedThreadOutcome {
  const aName = lookup.conceptName(thread.pair[0]);
  const bName = lookup.conceptName(thread.pair[1]);
  const label = INTENTION_LABELS[thread.intention];

  if (thread.pair[0] === thread.pair[1]) {
    return Object.freeze({
      kind: "unresolved" as const,
      threadId: thread.id,
      pair: thread.pair,
      intention: thread.intention,
      sequence: thread.sequence,
      statement: `${aName} is read against itself here, and Castalia has no relation to offer between a thing and itself.`,
    });
  }

  return Object.freeze({
    kind: "unresolved" as const,
    threadId: thread.id,
    pair: thread.pair,
    intention: thread.intention,
    sequence: thread.sequence,
    statement: `Castalia documents no relation between ${aName} and ${bName}, and names no facet they share. The thread holds your ${label} reading and nothing else.`,
  });
}

/**
 * Resolve one committed thread into exactly one of the three outcome shapes.
 *
 * Total, pure, and deterministic: the same thread and the same content always
 * produce the identical object, including which shared facet the Open Thread
 * question is built on. Nothing here reads a clock, a random source, or state
 * outside the thread and the lookup.
 */
export function resolveThreadOutcome(
  thread: CommittedThreadV1,
  lookup: RelationLookup
): ThreadOutcomeResolution {
  const shared = sharedFacetsOf(thread.pair[0], thread.pair[1], lookup);

  const documented = resolveDocumented(thread, lookup, shared);
  if (documented !== null) return documented;

  if (shared.length > 0) return resolveOpenThread(thread, lookup, shared);

  return resolveUnresolved(thread, lookup);
}

/** Every committed thread resolved, in creation order. */
export function resolveSessionOutcomes(
  state: SessionStateV1,
  lookup: RelationLookup
): readonly ThreadOutcomeResolution[] {
  return Object.freeze(
    state.threads.map((thread) => resolveThreadOutcome(thread, lookup))
  );
}

/** Creation-ordered outcomes indexed by thread, for cheap repeated access. */
export function indexOutcomesByThread(
  outcomes: readonly ThreadOutcomeResolution[]
): ReadonlyMap<string, ThreadOutcomeResolution> {
  const index = new Map<string, ThreadOutcomeResolution>();
  for (const outcome of outcomes) index.set(outcome.threadId, outcome);
  return index;
}
