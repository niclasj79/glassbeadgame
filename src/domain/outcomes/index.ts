export type {
  ConceptLookup,
  ConceptStructureLookup,
  DocumentedRelationLookup,
  FacetLookup,
  FacultyLookup,
  OpenThreadPromptLookup,
  RelationLookup,
} from "./lookup";
export {
  INTENTION_LABELS,
  INTENTION_PHRASES,
  RELATION_TYPE_GLOSS,
  capitalise,
  clamp01,
  compareStrings,
  countWord,
  facultyLabel,
  formatList,
  pluralise,
  quantise,
} from "./prose";
export {
  indexOutcomesByThread,
  resolveSessionOutcomes,
  resolveThreadOutcome,
  sharedFacetsOf,
  stanceForFit,
} from "./resolveThreadOutcome";
export {
  INTENTION_STANCES,
  THREAD_OUTCOME_KINDS,
  type DocumentedThreadOutcome,
  type IntentionStance,
  type OpenThreadOutcome,
  type ThreadOutcomeKind,
  type ThreadOutcomeResolution,
  type UnresolvedThreadOutcome,
} from "./types";
