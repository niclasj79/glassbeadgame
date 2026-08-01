import { castaliaConceptById } from "@/content/castalia/concepts";
import { facetById } from "@/content/castalia/facets";
import { INTENTION_LABELS, type ThreadOutcomeResolution } from "@/domain/outcomes";
import {
  documentedReading,
  openThreadReading,
  unresolvedReading,
  type Reading,
} from "../reading";

/**
 * WHAT THE PLAYER ACTUALLY SAID, IN THE ORDER THEY SAID IT.
 *
 * The conclusion is the only place a whole web can be reviewed, and it did not
 * list the threads. Six readings and a five-sentence annotation described the
 * shape of the session without naming a single thing in it, so a player who had
 * lost a note in the margin — which, until this pass, happened roughly seven
 * seconds after every outcome — had nowhere left to go.
 *
 * IT IS NOT A SCORECARD, AND THE TYPES MAKE THAT DIFFICULT.
 *
 * There is no total, no count per kind, no ordering by anything but the order
 * the player wove, and no field here that could be summed. A documented
 * relation, an Open Thread and an unresolved thread are the same shape and are
 * set by the same component; they differ in what they say, never in how much
 * room they are given (CAV-006). A list of what you said is a record, not a
 * reward — the test of that is that nothing on it improves by being longer.
 *
 * The register is derived, never stored: `resolveSessionOutcomes` replays the
 * canonical log, so this is a reading of the Game that was actually played.
 */
export interface ThreadReading extends Reading {
  readonly threadId: string;
  /** The reading the player composed: "Fibonacci Sequence · Echo · Counterpoint". */
  readonly reading: string;
}

const conceptName = (id: string): string =>
  castaliaConceptById.get(id)?.name ?? id;

function entryFor(outcome: ThreadOutcomeResolution): ThreadReading {
  /*
   * The pair is stored exactly as the player committed it — attended first,
   * candidate second — so this reads back in the direction they drew it.
   */
  const at = {
    threadId: String(outcome.threadId),
    reading: [
      conceptName(String(outcome.pair[0])),
      INTENTION_LABELS[outcome.intention],
      conceptName(String(outcome.pair[1])),
    ].join(" · "),
  };

  switch (outcome.kind) {
    case "documented":
      return {
        ...documentedReading(
          outcome.relation,
          outcome.relation.evidence,
          outcome.stance
        ),
        ...at,
      };
    case "open-thread": {
      const facet = facetById.get(outcome.facet)?.name ?? String(outcome.facet);
      return { ...openThreadReading(outcome.question, facet), ...at };
    }
    case "unresolved":
      return { ...unresolvedReading(outcome.statement), ...at };
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

/** Every committed thread, read back in the order it was woven. */
export function threadRegister(
  outcomes: readonly ThreadOutcomeResolution[]
): readonly ThreadReading[] {
  return Object.freeze(outcomes.map(entryFor));
}
