import type { StudyNames } from "../../domain/studies";
import { facetById, facultyById } from "../../content/castalia";
import { castaliaStudyLookup } from "./lookup";

/**
 * The names the Studies' renderers need, from the pack. Public structure
 * only: concept, facet and faculty names (R1). Concept names come from the
 * Studies' own structural lookup, so nothing in the Studies runtime holds an
 * object that could answer a documented relation.
 */
const names: StudyNames = {
  conceptName: (id) => castaliaStudyLookup.conceptName(id),
  facetName: (id) => facetById.get(id)?.name ?? String(id),
  facultyName: (id) => facultyById.get(id)?.name ?? String(id),
};

export const studyNames: StudyNames = Object.freeze(names);
