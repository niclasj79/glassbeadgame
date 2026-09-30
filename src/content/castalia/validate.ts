import { RELATION_INTENTIONS, type RelationIntention } from "@/domain/events";
import type { ConceptId } from "@/domain/ids";
import type { ConceptStructureLookup } from "@/domain/outcomes/lookup";
import { sharedFacetsOf } from "@/domain/outcomes/resolveThreadOutcome";
import { studyCount, studyIdFor } from "@/domain/studies/goal";
import { containsAnswer, solveStudy } from "@/domain/studies/solveStudy";
import { STUDY_CHAPTERS } from "@/domain/studies/types";
import {
  CONCEPT_KINDS,
  EVIDENCE_CLASSES,
  FACULTY_IDS,
  INTENTION_FITS,
  MOTIF_ARTICULATIONS,
  MOTIF_REGISTERS,
  RELATION_TYPES,
  SIGIL_FAMILIES,
  SOURCE_KINDS,
  TIMBRE_IDS,
  relationKey,
  type CastaliaConcept,
  type CastaliaPack,
  type DocumentedRelation,
  type OpenThreadPrompt,
  type StudyDefinition,
} from "./schema";

/**
 * CONTENT VALIDATION
 *
 * The schema can only enforce shape. This enforces the rules that make the
 * shape mean something: that a relation asserting influence carries evidence and
 * a direction, that a contested claim states its own disagreement, that a
 * "shared" facet is genuinely shared, and that no bead is stranded with fewer
 * than two ways into the web.
 *
 * Errors are conditions under which the pack must not ship. Warnings are
 * conditions an author should look at — drift from the authored relation
 * target, a faculty going thin, a relation that concedes nothing, a source
 * nobody cites.
 *
 * This function is pure and imports nothing from the browser, React, Three.js
 * or Web Audio, so it runs in the build, in tests, and at any persistence
 * boundary that loads a pack it did not author.
 */
export interface CastaliaValidationResult {
  readonly errors: string[];
  readonly warnings: string[];
}

/** Authored bounds. Changing one of these is a content decision, not a fix. */
export const CASTALIA_LIMITS = {
  conceptCount: 24,
  conceptsPerFaculty: 6,
  conceptFacetsMin: 2,
  conceptFacetsMax: 4,
  captionMax: 72,
  facetGlossMax: 110,
  descriptionMin: 120,
  descriptionMax: 700,
  motifStepsMin: 2,
  /**
   * "2–5 entries — a motif, not a melody" (schema). A hard error, restored by
   * the concepts owner after the four over-long motifs were trimmed. It was
   * temporarily softened to a warning while `concepts.ts` was owned elsewhere;
   * leaving it soft would have been worse than never adding it, because a rule
   * that fires nothing reads as satisfied. The bound is real: a concept's
   * identity has to be learnable by ear in one hearing.
   *
   * Historical note on why the split existed: four concepts in
   * `concepts.ts` currently carry six-step motifs, and that file is authored
   * elsewhere.
   */
  motifStepsMax: 5,
  sigilSymmetryMin: 1,
  sigilSymmetryMax: 12,
  relationTitleMax: 56,
  insightMin: 140,
  insightMax: 620,
  counterpointMin: 40,
  counterpointMax: 320,
  relationsMin: 35,
  relationsMax: 45,
  relationsPerConceptMin: 2,
  facultyEndpointsMin: 12,
  questionMin: 40,
  questionMax: 220,
} as const;

/**
 * Copy that flatters the player or asserts universal connection. Forbidden in
 * insights, counterpoints and Open Thread questions alike (VERTICAL-SLICE-SPEC
 * §10; CONTENT-AUDIOVISUAL-REFERENCE, Open Thread reference).
 */
const FORBIDDEN_PHRASES: readonly string[] = [
  "everything is connected",
  "everything connects",
  "all things are connected",
  "you have discovered",
  "you have found",
  "well done",
  "congratulations",
  "brilliant insight",
  "profound connection",
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const inUnitRange = (value: unknown): boolean =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const forbiddenPhraseIn = (text: string): string | null => {
  const lowered = text.toLowerCase();
  return FORBIDDEN_PHRASES.find((phrase) => lowered.includes(phrase)) ?? null;
};

const duplicates = <T>(values: readonly T[]): T[] => {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
};

export function validateCastaliaPack(pack: CastaliaPack): CastaliaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const L = CASTALIA_LIMITS;

  // ── version ──────────────────────────────────────────────────────────────
  if (!nonEmpty(pack.version)) {
    errors.push("pack: version must be a non-empty string");
  }

  // ── faculties ────────────────────────────────────────────────────────────
  const facultyIds = pack.faculties.map((f) => f.id);
  for (const id of duplicates(facultyIds)) {
    errors.push(`faculty ${id}: duplicate id`);
  }
  for (const required of FACULTY_IDS) {
    if (!facultyIds.includes(required)) {
      errors.push(`faculty ${required}: missing from the pack`);
    }
  }
  for (const faculty of pack.faculties) {
    if (!(FACULTY_IDS as readonly string[]).includes(faculty.id)) {
      errors.push(`faculty ${faculty.id}: not a known faculty id`);
    }
    if (!nonEmpty(faculty.name)) errors.push(`faculty ${faculty.id}: empty name`);
    if (!nonEmpty(faculty.gloss)) errors.push(`faculty ${faculty.id}: empty gloss`);
    if (!(SIGIL_FAMILIES as readonly string[]).includes(faculty.geometry)) {
      errors.push(`faculty ${faculty.id}: unknown geometry ${faculty.geometry}`);
    }
    if (!nonEmpty(faculty.ink)) errors.push(`faculty ${faculty.id}: empty ink`);
    if (!isFiniteNumber(faculty.bearing) || faculty.bearing < 0 || faculty.bearing >= 1) {
      errors.push(`faculty ${faculty.id}: bearing must lie in [0,1)`);
    }
  }

  // ── facets ───────────────────────────────────────────────────────────────
  const facetIds = new Set<string>();
  for (const facet of pack.facets) {
    if (facetIds.has(facet.id)) errors.push(`facet ${facet.id}: duplicate id`);
    facetIds.add(facet.id);
    if (!nonEmpty(facet.name)) errors.push(`facet ${facet.id}: empty name`);
    if (!nonEmpty(facet.gloss)) errors.push(`facet ${facet.id}: empty gloss`);
    if (facet.gloss.length > L.facetGlossMax) {
      errors.push(
        `facet ${facet.id}: gloss is ${facet.gloss.length} chars, max ${L.facetGlossMax}`
      );
    }
  }

  // ── concepts ─────────────────────────────────────────────────────────────
  if (pack.concepts.length !== L.conceptCount) {
    errors.push(`concepts: expected ${L.conceptCount}, found ${pack.concepts.length}`);
  }

  const conceptIds = new Set<string>();
  const perFaculty = new Map<string, number>();
  const facetUseCount = new Map<string, number>();

  for (const concept of pack.concepts) {
    const where = `concept ${concept.id}`;
    if (conceptIds.has(concept.id)) errors.push(`${where}: duplicate id`);
    conceptIds.add(concept.id);

    if (!(FACULTY_IDS as readonly string[]).includes(concept.faculty)) {
      errors.push(`${where}: unknown faculty ${concept.faculty}`);
    } else {
      perFaculty.set(concept.faculty, (perFaculty.get(concept.faculty) ?? 0) + 1);
    }
    if (!(CONCEPT_KINDS as readonly string[]).includes(concept.kind)) {
      errors.push(`${where}: unknown kind ${concept.kind}`);
    }
    if (!nonEmpty(concept.name)) errors.push(`${where}: empty name`);
    if (!nonEmpty(concept.era)) errors.push(`${where}: empty era`);

    if (!nonEmpty(concept.caption)) {
      errors.push(`${where}: empty caption`);
    } else {
      if (concept.caption.length > L.captionMax) {
        errors.push(
          `${where}: caption is ${concept.caption.length} chars, max ${L.captionMax}`
        );
      }
      if (concept.caption.endsWith(".")) {
        errors.push(`${where}: caption must not end with a period`);
      }
    }

    if (
      concept.description.length < L.descriptionMin ||
      concept.description.length > L.descriptionMax
    ) {
      warnings.push(
        `${where}: description is ${concept.description.length} chars, expected ${L.descriptionMin}–${L.descriptionMax}`
      );
    }

    if (
      concept.facets.length < L.conceptFacetsMin ||
      concept.facets.length > L.conceptFacetsMax
    ) {
      errors.push(
        `${where}: has ${concept.facets.length} facets, expected ${L.conceptFacetsMin}–${L.conceptFacetsMax}`
      );
    }
    for (const duplicate of duplicates(concept.facets)) {
      errors.push(`${where}: repeats facet ${duplicate}`);
    }
    for (const facetId of concept.facets) {
      if (!facetIds.has(facetId)) {
        errors.push(`${where}: unknown facet ${facetId}`);
      }
      facetUseCount.set(facetId, (facetUseCount.get(facetId) ?? 0) + 1);
    }

    validateMotif(concept, errors);
    validateSigil(concept, errors);
  }

  for (const facultyId of FACULTY_IDS) {
    const count = perFaculty.get(facultyId) ?? 0;
    if (count !== L.conceptsPerFaculty) {
      errors.push(
        `faculty ${facultyId}: has ${count} concepts, expected ${L.conceptsPerFaculty}`
      );
    }
  }

  for (const facet of pack.facets) {
    if ((facetUseCount.get(facet.id) ?? 0) === 0) {
      warnings.push(`facet ${facet.id}: carried by no concept`);
    }
  }

  // ── sources ──────────────────────────────────────────────────────────────
  const sourceIds = new Set<string>();
  for (const source of pack.sources) {
    if (sourceIds.has(source.id)) errors.push(`source ${source.id}: duplicate id`);
    sourceIds.add(source.id);
    if (!(SOURCE_KINDS as readonly string[]).includes(source.kind)) {
      errors.push(`source ${source.id}: unknown kind ${source.kind}`);
    }
    if (!nonEmpty(source.citation) || source.citation.trim().length < 12) {
      errors.push(`source ${source.id}: citation is too short to be checkable`);
    } else if (!/\b\d{3,4}\b/.test(source.citation)) {
      warnings.push(`source ${source.id}: citation names no year`);
    }
  }

  // ── relations ────────────────────────────────────────────────────────────
  if (pack.relations.length < L.relationsMin || pack.relations.length > L.relationsMax) {
    warnings.push(
      `relations: pack holds ${pack.relations.length}, slice target is ${L.relationsMin}–${L.relationsMax}`
    );
  }

  const relationIds = new Set<string>();
  const relationKeys = new Set<string>();
  const citedSources = new Set<string>();
  const conceptRelationCount = new Map<string, number>();
  const facultyEndpointCount = new Map<string, number>();
  const conceptById = new Map(pack.concepts.map((c) => [c.id, c]));
  let crossFaculty = 0;
  let withinFaculty = 0;

  for (const relation of pack.relations) {
    const where = `relation ${relation.id}`;
    if (relationIds.has(relation.id)) errors.push(`${where}: duplicate id`);
    relationIds.add(relation.id);

    const [a, b] = relation.pair;
    if (a === b) errors.push(`${where}: pair names the same concept twice`);
    if (a >= b) {
      errors.push(`${where}: pair must be sorted, found [${a}, ${b}]`);
    }

    const conceptA = conceptById.get(a);
    const conceptB = conceptById.get(b);
    if (conceptA === undefined) errors.push(`${where}: unknown concept ${a}`);
    if (conceptB === undefined) errors.push(`${where}: unknown concept ${b}`);

    const key = relationKey(a, b);
    if (relationKeys.has(key)) errors.push(`${where}: duplicate relation for pair ${key}`);
    relationKeys.add(key);

    conceptRelationCount.set(a, (conceptRelationCount.get(a) ?? 0) + 1);
    conceptRelationCount.set(b, (conceptRelationCount.get(b) ?? 0) + 1);

    if (conceptA !== undefined && conceptB !== undefined) {
      for (const concept of [conceptA, conceptB]) {
        facultyEndpointCount.set(
          concept.faculty,
          (facultyEndpointCount.get(concept.faculty) ?? 0) + 1
        );
      }
      if (conceptA.faculty === conceptB.faculty) withinFaculty += 1;
      else crossFaculty += 1;
    }

    if (!nonEmpty(relation.title)) {
      errors.push(`${where}: empty title`);
    } else if (relation.title.length > L.relationTitleMax) {
      errors.push(
        `${where}: title is ${relation.title.length} chars, max ${L.relationTitleMax}`
      );
    }

    if (!(RELATION_TYPES as readonly string[]).includes(relation.relationType)) {
      errors.push(`${where}: unknown relationType ${relation.relationType}`);
    }
    if (!(EVIDENCE_CLASSES as readonly string[]).includes(relation.evidence)) {
      errors.push(`${where}: unknown evidence class ${relation.evidence}`);
    }

    validateFit(relation, errors);

    // insight
    if (
      relation.insight.length < L.insightMin ||
      relation.insight.length > L.insightMax
    ) {
      errors.push(
        `${where}: insight is ${relation.insight.length} chars, expected ${L.insightMin}–${L.insightMax}`
      );
    }
    const insightPhrase = forbiddenPhraseIn(relation.insight);
    if (insightPhrase !== null) {
      errors.push(`${where}: insight contains forbidden copy "${insightPhrase}"`);
    }

    // shared facets must be genuinely shared
    for (const duplicate of duplicates(relation.sharedFacets)) {
      errors.push(`${where}: repeats sharedFacet ${duplicate}`);
    }
    for (const facetId of relation.sharedFacets) {
      if (!facetIds.has(facetId)) {
        errors.push(`${where}: unknown sharedFacet ${facetId}`);
        continue;
      }
      if (conceptA !== undefined && !conceptA.facets.includes(facetId)) {
        errors.push(`${where}: sharedFacet ${facetId} is not carried by ${a}`);
      }
      if (conceptB !== undefined && !conceptB.facets.includes(facetId)) {
        errors.push(`${where}: sharedFacet ${facetId} is not carried by ${b}`);
      }
    }
    if (relation.sharedFacets.length === 0 && relation.relationType !== "opposition") {
      warnings.push(
        `${where}: no shared facet — resonance and Open Threads have nothing to build from`
      );
    }

    // direction: required by, and only by, historical-transmission
    if (relation.relationType === "historical-transmission") {
      if (relation.direction === undefined) {
        errors.push(`${where}: historical-transmission requires an explicit direction`);
      } else {
        const [from, to] = relation.direction;
        if (from === to) errors.push(`${where}: direction names one concept twice`);
        if (![a, b].includes(from) || ![a, b].includes(to)) {
          errors.push(`${where}: direction must use the concepts named in pair`);
        }
      }
      if (relation.sources.length === 0) {
        errors.push(`${where}: historical-transmission requires at least one source`);
      }
      if (relation.evidence === "interpretive") {
        errors.push(
          `${where}: historical-transmission cannot rest on interpretive evidence — it asserts influence`
        );
      }
    } else if (relation.direction !== undefined) {
      errors.push(
        `${where}: direction is only permitted on historical-transmission relations`
      );
    }

    // counterpoint
    if (relation.evidence === "contested") {
      if (!nonEmpty(relation.counterpoint)) {
        errors.push(`${where}: contested evidence requires a counterpoint`);
      }
    } else if (relation.counterpoint === undefined) {
      warnings.push(`${where}: no counterpoint — a relation that admits nothing is usually overstated`);
    }
    if (relation.counterpoint !== undefined) {
      if (
        relation.counterpoint.length < L.counterpointMin ||
        relation.counterpoint.length > L.counterpointMax
      ) {
        errors.push(
          `${where}: counterpoint is ${relation.counterpoint.length} chars, expected ${L.counterpointMin}–${L.counterpointMax}`
        );
      }
      const counterpointPhrase = forbiddenPhraseIn(relation.counterpoint);
      if (counterpointPhrase !== null) {
        errors.push(
          `${where}: counterpoint contains forbidden copy "${counterpointPhrase}"`
        );
      }
    }

    // sources
    for (const duplicate of duplicates(relation.sources)) {
      errors.push(`${where}: repeats source ${duplicate}`);
    }
    for (const sourceId of relation.sources) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${where}: unknown source ${sourceId}`);
      }
      citedSources.add(sourceId);
    }
    if (relation.evidence !== "interpretive" && relation.sources.length === 0) {
      errors.push(
        `${where}: evidence "${relation.evidence}" asserts a fact and requires at least one source`
      );
    }
  }

  for (const concept of pack.concepts) {
    const count = conceptRelationCount.get(concept.id) ?? 0;
    if (count < L.relationsPerConceptMin) {
      errors.push(
        `concept ${concept.id}: appears in ${count} relations, minimum ${L.relationsPerConceptMin}`
      );
    }
  }

  for (const facultyId of FACULTY_IDS) {
    const endpoints = facultyEndpointCount.get(facultyId) ?? 0;
    if (endpoints < L.facultyEndpointsMin) {
      warnings.push(
        `faculty ${facultyId}: only ${endpoints} relation endpoints — under-connected relative to the other faculties`
      );
    }
  }

  if (crossFaculty <= withinFaculty) {
    warnings.push(
      `relations: ${crossFaculty} cross-faculty vs ${withinFaculty} within-faculty — the pack should lean cross-faculty`
    );
  }

  for (const source of pack.sources) {
    if (!citedSources.has(source.id)) {
      warnings.push(`source ${source.id}: cited by no relation`);
    }
  }

  // ── open threads ─────────────────────────────────────────────────────────
  const openThreadIds = new Set<string>();
  const fallbackByIntention = new Map<RelationIntention, number>();
  const seenPromptKeys = new Set<string>();
  const sharedFacetIds = new Set(
    [...facetUseCount.entries()].filter(([, n]) => n >= 2).map(([id]) => id)
  );

  for (const thread of pack.openThreads) {
    const where = `open thread ${thread.id}`;
    if (openThreadIds.has(thread.id)) errors.push(`${where}: duplicate id`);
    openThreadIds.add(thread.id);

    if (!(RELATION_INTENTIONS as readonly string[]).includes(thread.intention)) {
      errors.push(`${where}: unknown intention ${thread.intention}`);
      continue;
    }

    if (thread.facet === undefined) {
      fallbackByIntention.set(
        thread.intention,
        (fallbackByIntention.get(thread.intention) ?? 0) + 1
      );
    } else {
      if (!facetIds.has(thread.facet)) {
        errors.push(`${where}: unknown facet ${thread.facet}`);
      } else if (!sharedFacetIds.has(thread.facet)) {
        warnings.push(
          `${where}: facet ${thread.facet} is carried by fewer than two concepts and can never be shared`
        );
      }
    }

    const promptKey = `${thread.intention}::${thread.facet ?? "*"}`;
    if (seenPromptKeys.has(promptKey)) {
      warnings.push(`${where}: a prompt already exists for ${promptKey}`);
    }
    seenPromptKeys.add(promptKey);

    validateQuestion(thread, errors);
  }

  for (const intention of RELATION_INTENTIONS) {
    if ((fallbackByIntention.get(intention) ?? 0) === 0) {
      errors.push(
        `open threads: intention "${intention}" has no facet-independent fallback prompt`
      );
    }
  }

  // ── studies ──────────────────────────────────────────────────────────────
  for (const issue of validateStudies(pack)) {
    errors.push(`${issue.subject}: ${issue.message} [${issue.code}]`);
  }

  return { errors, warnings };
}

// ─── Studies ────────────────────────────────────────────────────────────────

/** Authored bounds for Studies (STUDIES-SPEC §9). Changing one is a content decision. */
export const STUDY_LIMITS = {
  beads: 8,
  facultiesMin: 3,
  passageAnswersMax: 4,
  studiesPerChapter: 4,
} as const;

/** One code per rule a Study must satisfy, so a test can name the rule it breaks. */
export const STUDY_ERROR_CODES = [
  /** The id is not `study.<chapter>-<ordinal>`. */
  "study-id",
  /** The Study does not hold exactly eight beads. */
  "study-bead-count",
  /** A bead is repeated or out of pack order. */
  "study-bead-order",
  /** A bead the pack does not hold. */
  "study-unknown-concept",
  /** Fewer than three faculties among the beads. */
  "study-faculties",
  /** A bead that shares no facet with any other bead of the Study. */
  "study-distractor",
  /** The same set of beads as an earlier Study. */
  "study-duplicate-beads",
  /** A goal naming what the Study cannot hold: a bead outside it, an unknown facet or faculty, a count out of range. */
  "study-goal",
  /** The Magister's line is not an answer of the brief's exact count. */
  "study-answer",
  /** The Magister's line is not written bead to bead as it is read. */
  "study-answer-line",
  /** An answer shorter than the brief's count exists within the beads. */
  "study-shorter-answer",
  /** A passage with more than four answers within the beads. */
  "study-passage-answers",
  /** A silence Study that has an answer within the beads. */
  "study-silence-answer",
  /** A passage silence with no way of the count plus one. */
  "study-silence-longer-way",
  /** Chapters and ordinals not complete, unique and listed in order. */
  "study-sequence",
] as const;
export type StudyErrorCode = (typeof STUDY_ERROR_CODES)[number];

export interface StudyIssue {
  readonly code: StudyErrorCode;
  /** The Study's id, or the chapter, the issue is about. */
  readonly subject: string;
  readonly message: string;
}

/**
 * The structure of this pack's concepts, as the domain reads it. Built from the
 * pack being validated rather than from the shipped one, so a broken fixture
 * is judged by its own beads.
 */
function structureLookupFor(pack: CastaliaPack): ConceptStructureLookup {
  const byId = new Map(pack.concepts.map((concept) => [concept.id, concept]));
  return {
    conceptName: (id) => byId.get(id)?.name ?? id,
    conceptFaculty: (id) => byId.get(id)?.faculty ?? FACULTY_IDS[0],
    conceptFacets: (id) => byId.get(id)?.facets ?? [],
  };
}

function goalProblems(
  study: StudyDefinition,
  facetIds: ReadonlySet<string>
): readonly string[] {
  const problems: string[] = [];
  const { goal } = study;
  switch (goal.kind) {
    case "passage":
      for (const end of [goal.from, goal.to]) {
        if (!study.conceptIds.includes(end)) {
          problems.push(`passage names ${end}, which is not one of its beads`);
        }
      }
      if (goal.from === goal.to) problems.push("passage begins and ends at the same bead");
      if (!Number.isInteger(goal.threads) || goal.threads < 1) {
        problems.push(`passage must name a whole number of threads, found ${goal.threads}`);
      }
      break;
    case "canon":
      if (!facetIds.has(goal.facet)) problems.push(`canon names unknown facet ${goal.facet}`);
      if (
        !Number.isInteger(goal.faculties) ||
        goal.faculties < 2 ||
        goal.faculties > FACULTY_IDS.length
      ) {
        problems.push(
          `canon must reach 2–${FACULTY_IDS.length} faculties, found ${goal.faculties}`
        );
      }
      break;
    case "carry":
      if (!facetIds.has(goal.facet)) problems.push(`carry names unknown facet ${goal.facet}`);
      if (!(FACULTY_IDS as readonly string[]).includes(goal.into)) {
        problems.push(`carry names unknown faculty ${goal.into}`);
      }
      break;
    default: {
      const exhaustive: never = goal;
      return exhaustive;
    }
  }
  return problems;
}

/** Why a line is not written bead to bead as it is read, or null when it is. */
function lineProblem(
  study: StudyDefinition,
  pairs: readonly (readonly [ConceptId, ConceptId])[],
  lookup: ConceptStructureLookup
): string | null {
  const first = pairs[0];
  const last = pairs[pairs.length - 1];
  if (first === undefined || last === undefined) return "the Magister's line names no thread";
  for (let index = 1; index < pairs.length; index += 1) {
    if (pairs[index]?.[0] !== pairs[index - 1]?.[1]) {
      return `the Magister's thread ${index + 1} does not begin where thread ${index} ends`;
    }
  }
  const { goal } = study;
  if (goal.kind === "passage" && (first[0] !== goal.from || last[1] !== goal.to)) {
    return `the Magister's line must run from ${goal.from} to ${goal.to}`;
  }
  if (goal.kind === "carry" && lookup.conceptFaculty(last[1]) !== goal.into) {
    return `the Magister's line must end in ${goal.into}`;
  }
  return null;
}

function sequenceProblems(
  studies: readonly StudyDefinition[],
  report: (subject: string, code: StudyErrorCode, message: string) => void
): void {
  const chapters = STUDY_CHAPTERS as readonly string[];
  const seen = new Set<string>();
  for (const study of studies) {
    if (seen.has(study.id)) report(study.id, "study-sequence", "duplicate id");
    seen.add(study.id);
    if (!chapters.includes(study.chapter)) {
      report(study.id, "study-sequence", `unknown chapter ${study.chapter}`);
    }
  }

  const expected = Array.from({ length: STUDY_LIMITS.studiesPerChapter }, (_, index) => index + 1);
  for (const chapter of STUDY_CHAPTERS) {
    const ordinals = studies
      .filter((study) => study.chapter === chapter)
      .map((study) => study.ordinal);
    const complete =
      ordinals.length === expected.length &&
      expected.every((ordinal) => ordinals.includes(ordinal));
    if (!complete) {
      report(
        `chapter ${chapter}`,
        "study-sequence",
        `holds ordinals ${ordinals.join(", ") || "none"}; expected ${expected.join(", ")}, each once`
      );
    }
  }

  for (let index = 1; index < studies.length; index += 1) {
    const previous = studies[index - 1] as StudyDefinition;
    const current = studies[index] as StudyDefinition;
    const before = chapters.indexOf(previous.chapter);
    const after = chapters.indexOf(current.chapter);
    if (after < before || (after === before && current.ordinal <= previous.ordinal)) {
      report(
        current.id,
        "study-sequence",
        `is listed after ${previous.id}; Studies are listed in chapter order, then by ordinal`
      );
    }
  }
}

/**
 * THE STUDIES, PROVED.
 *
 * Every rule of STUDIES-SPEC §9, checked against the pack's own beads with the
 * domain's solver: a Study that is not what it claims to be cannot ship. The
 * solver reads facets and faculties only, so these proofs rest on exactly the
 * information a player has (R1).
 */
export function validateStudies(pack: CastaliaPack): readonly StudyIssue[] {
  const issues: StudyIssue[] = [];
  const report = (subject: string, code: StudyErrorCode, message: string): void => {
    issues.push({ code, subject, message });
  };
  const L = STUDY_LIMITS;
  const packIndex = new Map(pack.concepts.map((concept, index) => [concept.id, index]));
  const facetIds = new Set<string>(pack.facets.map((facet) => facet.id));
  const lookup = structureLookupFor(pack);
  const beadSets = new Map<string, string>();

  for (const study of pack.studies) {
    const where = String(study.id);

    const expectedId = studyIdFor(study.chapter, study.ordinal);
    if (study.id !== expectedId) {
      report(where, "study-id", `id must be ${expectedId}`);
    }

    if (study.conceptIds.length !== L.beads) {
      report(where, "study-bead-count", `has ${study.conceptIds.length} beads, expected ${L.beads}`);
    }

    const unknown = study.conceptIds.filter((bead) => !packIndex.has(bead));
    for (const bead of unknown) report(where, "study-unknown-concept", `unknown concept ${bead}`);
    const known = study.conceptIds.filter((bead) => packIndex.has(bead));

    const order = known.map((bead) => packIndex.get(bead) ?? -1);
    if (order.some((position, index) => index > 0 && position <= (order[index - 1] ?? -1))) {
      report(where, "study-bead-order", "beads must be listed once each, in pack order");
    }

    const faculties = new Set(known.map((bead) => lookup.conceptFaculty(bead)));
    if (faculties.size < L.facultiesMin) {
      report(
        where,
        "study-faculties",
        `spans ${faculties.size} faculties, expected at least ${L.facultiesMin}`
      );
    }

    const key = [...new Set(study.conceptIds)].sort().join("+");
    const twin = beadSets.get(key);
    if (twin === undefined) beadSets.set(key, where);
    else report(where, "study-duplicate-beads", `uses the same beads as ${twin}`);

    const answerBeads = new Set<ConceptId>(
      study.answer.kind === "threads" ? study.answer.pairs.flat() : []
    );
    for (const bead of known) {
      if (answerBeads.has(bead)) continue;
      const shares = known.some(
        (other) => other !== bead && sharedFacetsOf(bead, other, lookup).length > 0
      );
      if (!shares) {
        report(where, "study-distractor", `${bead} shares no facet with any other bead`);
      }
    }

    const problems = goalProblems(study, facetIds);
    for (const problem of problems) report(where, "study-goal", problem);

    // A proof needs a well-formed Study over beads the pack actually holds.
    if (unknown.length > 0 || problems.length > 0) continue;

    const solution = solveStudy(study, lookup);
    const count = studyCount(study.goal);
    const answers = solution.answers.length;

    if (study.answer.kind === "threads") {
      const { pairs } = study.answer;
      if (pairs.length !== count || !containsAnswer(solution, pairs)) {
        report(
          where,
          "study-answer",
          `the Magister's line is not an answer of the brief's ${count} threads`
        );
      }
      const problem = lineProblem(study, pairs, lookup);
      if (problem !== null) report(where, "study-answer-line", problem);
      if (solution.shortest !== null && solution.shortest < count) {
        report(
          where,
          "study-shorter-answer",
          `an answer of ${solution.shortest} threads exists; the brief names ${count}`
        );
      }
      if (study.goal.kind === "passage" && answers > L.passageAnswersMax) {
        report(
          where,
          "study-passage-answers",
          `has ${answers} answers within its beads, at most ${L.passageAnswersMax}`
        );
      }
    } else {
      if (answers > 0) {
        report(
          where,
          "study-silence-answer",
          `is authored as silence but has ${answers} answers within its beads`
        );
      }
      if (
        study.goal.kind === "passage" &&
        (solution.shortest === null || solution.shortest > count + 1)
      ) {
        report(
          where,
          "study-silence-longer-way",
          `a passage silence needs a way of ${count + 1} threads within its beads`
        );
      }
    }
  }

  sequenceProblems(pack.studies, report);
  return issues;
}

function validateMotif(concept: CastaliaConcept, errors: string[]): void {
  const where = `concept ${concept.id}`;
  const { degrees, rhythm, register, articulation, timbre } = concept.motif;
  const L = CASTALIA_LIMITS;

  if (degrees.length !== rhythm.length) {
    errors.push(
      `${where}: motif has ${degrees.length} degrees and ${rhythm.length} rhythm values`
    );
  }
  if (degrees.length < L.motifStepsMin || degrees.length > L.motifStepsMax) {
    errors.push(
      `${where}: motif has ${degrees.length} steps, expected ${L.motifStepsMin}–${L.motifStepsMax} — a motif, not a melody`
    );
  }
  if (!degrees.every((d) => Number.isInteger(d))) {
    errors.push(`${where}: motif degrees must be integers`);
  }
  if (!rhythm.every((r) => Number.isInteger(r) && r > 0)) {
    errors.push(`${where}: motif rhythm values must be positive integers`);
  }
  if (!(MOTIF_REGISTERS as readonly string[]).includes(register)) {
    errors.push(`${where}: unknown motif register ${register}`);
  }
  if (!(MOTIF_ARTICULATIONS as readonly string[]).includes(articulation)) {
    errors.push(`${where}: unknown motif articulation ${articulation}`);
  }
  if (!(TIMBRE_IDS as readonly string[]).includes(timbre)) {
    errors.push(`${where}: unknown timbre ${timbre}`);
  }
}

function validateSigil(concept: CastaliaConcept, errors: string[]): void {
  const where = `concept ${concept.id}`;
  const { family, symmetry, density, turbulence } = concept.sigil;
  const L = CASTALIA_LIMITS;

  if (!(SIGIL_FAMILIES as readonly string[]).includes(family)) {
    errors.push(`${where}: unknown sigil family ${family}`);
  }
  if (
    !Number.isInteger(symmetry) ||
    symmetry < L.sigilSymmetryMin ||
    symmetry > L.sigilSymmetryMax
  ) {
    errors.push(
      `${where}: sigil symmetry must be an integer in ${L.sigilSymmetryMin}–${L.sigilSymmetryMax}`
    );
  }
  if (!inUnitRange(density)) errors.push(`${where}: sigil density must lie in [0,1]`);
  if (!inUnitRange(turbulence)) {
    errors.push(`${where}: sigil turbulence must lie in [0,1]`);
  }
}

function validateFit(relation: DocumentedRelation, errors: string[]): void {
  const where = `relation ${relation.id}`;
  const keys = Object.keys(relation.fit);

  for (const intention of RELATION_INTENTIONS) {
    if (!keys.includes(intention)) {
      errors.push(`${where}: fit is missing intention "${intention}"`);
    }
  }
  for (const key of keys) {
    if (!(RELATION_INTENTIONS as readonly string[]).includes(key)) {
      errors.push(`${where}: fit names unknown intention "${key}"`);
    }
  }

  let primaries = 0;
  for (const intention of RELATION_INTENTIONS) {
    const value = relation.fit[intention];
    if (value === undefined) continue;
    if (!(INTENTION_FITS as readonly string[]).includes(value)) {
      errors.push(`${where}: fit.${intention} has unknown value "${value}"`);
    }
    if (value === "primary") primaries += 1;
  }
  if (primaries !== 1) {
    errors.push(`${where}: fit must name exactly one primary intention, found ${primaries}`);
  }
}

function validateQuestion(thread: OpenThreadPrompt, errors: string[]): void {
  const where = `open thread ${thread.id}`;
  const { question } = thread;
  const L = CASTALIA_LIMITS;

  if (!question.includes("{a}")) errors.push(`${where}: question must contain {a}`);
  if (!question.includes("{b}")) errors.push(`${where}: question must contain {b}`);
  if (!question.trimEnd().endsWith("?")) {
    errors.push(`${where}: question must end with '?'`);
  }
  if (question.length < L.questionMin || question.length > L.questionMax) {
    errors.push(
      `${where}: question is ${question.length} chars, expected ${L.questionMin}–${L.questionMax}`
    );
  }
  if (thread.facet === undefined && question.includes("{facet}")) {
    errors.push(
      `${where}: a fallback prompt cannot use {facet} — it must render with no shared facet`
    );
  }
  const phrase = forbiddenPhraseIn(question);
  if (phrase !== null) {
    errors.push(`${where}: question contains forbidden copy "${phrase}"`);
  }
}

/** Convenience for build scripts and tests: throws on the first error found. */
export function assertCastaliaPackValid(pack: CastaliaPack): void {
  const { errors } = validateCastaliaPack(pack);
  if (errors.length > 0) {
    throw new Error(`Castalia content pack is invalid:\n- ${errors.join("\n- ")}`);
  }
}
