import { toConceptId, type ConceptId } from "../../ids";
import type { ConceptStructureLookup } from "../../outcomes/lookup";
import { studyIdFor } from "../goal";
import type {
  FacetId,
  FacultyId,
  StudyAnswer,
  StudyChapter,
  StudyDefinition,
  StudyGoal,
  StudyNames,
} from "../types";

/**
 * HAND-BUILT BEADS FOR STUDY TESTS.
 *
 * Each test declares the few beads it needs — a faculty and some facets — so
 * the graph a rule is tested on is visible in the test itself. Nothing here
 * reads the Castalia pack: the Studies' rules are proved against material the
 * tests control, and the shipped Studies are proved separately in the content
 * tests.
 */

export type FixtureBeads = Readonly<
  Record<string, readonly [faculty: FacultyId, facets: readonly string[]]>
>;

export interface StudyFixture {
  readonly lookup: ConceptStructureLookup;
  readonly names: StudyNames;
  /** Every bead, in declared order. */
  readonly ids: readonly ConceptId[];
  readonly id: (key: string) => ConceptId;
  readonly facet: (name: string) => FacetId;
}

const title = (value: string): string =>
  value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export function studyFixture(beads: FixtureBeads): StudyFixture {
  const table = new Map<string, readonly [FacultyId, readonly FacetId[]]>();
  for (const [key, [faculty, facets]] of Object.entries(beads)) {
    table.set(key, [faculty, Object.freeze(facets.map((facet) => facet as FacetId))]);
  }
  const id = (key: string): ConceptId => {
    if (!table.has(key)) throw new RangeError(`fixture has no bead ${key}`);
    return toConceptId(key);
  };
  const lookup: ConceptStructureLookup = Object.freeze({
    conceptName: (conceptId: ConceptId) => title(String(conceptId)),
    conceptFaculty: (conceptId: ConceptId): FacultyId =>
      table.get(String(conceptId))?.[0] ?? "measure",
    conceptFacets: (conceptId: ConceptId): readonly FacetId[] =>
      table.get(String(conceptId))?.[1] ?? [],
  });
  return Object.freeze({
    lookup,
    names: Object.freeze({
      conceptName: (conceptId: ConceptId) => title(String(conceptId)),
      facetName: (facet: FacetId) => title(String(facet)),
      facultyName: (faculty: FacultyId) => title(String(faculty)),
    }),
    ids: Object.freeze([...table.keys()].map(toConceptId)),
    id,
    facet: (name: string) => name as FacetId,
  });
}

export interface FixtureStudySpec {
  readonly chapter?: StudyChapter;
  readonly ordinal?: number;
  readonly conceptIds: readonly ConceptId[];
  readonly goal: StudyGoal;
  readonly answer?: StudyAnswer;
}

/** A Study over fixture beads. The answer defaults to silence; most tests never read it. */
export function fixtureStudy(spec: FixtureStudySpec): StudyDefinition {
  const chapter = spec.chapter ?? "eschholz";
  const ordinal = spec.ordinal ?? 1;
  return Object.freeze({
    id: studyIdFor(chapter, ordinal),
    chapter,
    ordinal,
    conceptIds: Object.freeze([...spec.conceptIds]),
    goal: spec.goal,
    answer: spec.answer ?? Object.freeze({ kind: "silence" as const }),
  });
}
