import type { StudyNames } from "../../domain/studies";
import { facetById, facultyById } from "../../content/castalia";
import { castaliaLookup } from "../content/castaliaLookup";

/**
 * The names the Studies' renderers need, from the pack. Public structure
 * only: concept, facet and faculty names (R1).
 */
const names: StudyNames = {
  conceptName: (id) => castaliaLookup.conceptName(id),
  facetName: (id) => facetById.get(id)?.name ?? String(id),
  facultyName: (id) => facultyById.get(id)?.name ?? String(id),
};

export const studyNames: StudyNames = Object.freeze(names);
