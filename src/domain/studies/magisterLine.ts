import { cloneAndFreeze } from "../model/immutable";
import type { ConceptStructureLookup } from "../outcomes/lookup";
import { sharedFacetsOf } from "../outcomes/resolveThreadOutcome";
import type { StudyDefinition, StudyLineStep } from "./types";

/**
 * The Magister's answer as a line of steps, each with the facets its thread
 * carries — the same shape as the player's answer, so the plate sets the two
 * side by side without computing a facet of its own. Null for a silence.
 *
 * The line is read as authored; the pack validator requires an authored answer
 * to be written bead to bead, starting where a passage starts.
 */
export function magisterLine(
  study: StudyDefinition,
  lookup: ConceptStructureLookup
): readonly StudyLineStep[] | null {
  if (study.answer.kind === "silence") return null;
  return cloneAndFreeze(
    study.answer.pairs.map(([from, to]) => ({
      from,
      to,
      facets: sharedFacetsOf(from, to, lookup),
    }))
  );
}
