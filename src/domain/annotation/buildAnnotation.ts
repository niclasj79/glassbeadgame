import { accreteWeb, buildTopology } from "../graph/buildTopology";
import type { SessionTopology } from "../graph/types";
import type { ConceptId, ThreadId } from "../ids";
import type { SessionStateV1 } from "../model/sessionState";
import { detectMotifs } from "../motifs/detectMotifs";
import type { MotifDetection } from "../motifs/types";
import type { RelationLookup } from "../outcomes/lookup";
import {
  INTENTION_LABELS,
  capitalise,
  compareStrings,
  countWord,
  facultyLabel,
  formatList,
  pluralise,
} from "../outcomes/prose";
import { resolveSessionOutcomes } from "../outcomes/resolveThreadOutcome";
import type { ThreadOutcomeResolution } from "../outcomes/types";
import { FACULTY_IDS, type FacetId, type FacultyId } from "@/content/castalia/schema";
import type { Annotation, AnnotationReferences } from "./types";

interface Fragment {
  readonly text: string;
  readonly conceptIds?: readonly ConceptId[];
  readonly threadIds?: readonly ThreadId[];
  readonly facetIds?: readonly FacetId[];
}

interface AnnotationInputs {
  readonly state: SessionStateV1;
  readonly lookup: RelationLookup;
  readonly topology: SessionTopology;
  readonly outcomes: readonly ThreadOutcomeResolution[];
  readonly motifs: readonly MotifDetection[];
}

const MAX_SENTENCES = 5;
const MIN_SENTENCES = 3;

function facultyPhrase(faculties: readonly FacultyId[]): string {
  return formatList(faculties.map(facultyLabel));
}

/** How the web began: the first thread, as the player read it and as it answered. */
function openingFragment(inputs: AnnotationInputs): Fragment | null {
  const first = inputs.outcomes[0];
  if (first === undefined) return null;

  const aName = inputs.lookup.conceptName(first.pair[0]);
  const bName = inputs.lookup.conceptName(first.pair[1]);
  const opening = `You opened with ${aName} and ${bName}, read as ${INTENTION_LABELS[first.intention]}`;

  if (first.kind === "documented") {
    return {
      text: `${opening}, and Castalia had a record to set beside it: ${first.relation.title}.`,
      conceptIds: [first.pair[0], first.pair[1]],
      threadIds: [first.threadId],
    };
  }
  if (first.kind === "open-thread") {
    return {
      text: `${opening}, and Castalia could answer only with a question about ${inputs.lookup.facetName(first.facet)}.`,
      conceptIds: [first.pair[0], first.pair[1]],
      threadIds: [first.threadId],
      facetIds: [first.facet],
    };
  }
  return {
    text: `${opening}, and Castalia had nothing documented to set beside it.`,
    conceptIds: [first.pair[0], first.pair[1]],
    threadIds: [first.threadId],
  };
}

/** What the web turned around. */
function centreFragment(inputs: AnnotationInputs): Fragment | null {
  const candidates = [...inputs.topology.nodes]
    .filter((node) => node.degree >= 2)
    .sort((a, b) => {
      if (b.centrality !== a.centrality) return b.centrality - a.centrality;
      return b.threadCount - a.threadCount;
    });
  const centre = candidates[0];
  if (centre === undefined) return null;

  return {
    text: `${inputs.lookup.conceptName(centre.conceptId)} became the point everything turned on, carrying ${countWord(
      centre.threadCount
    )} ${pluralise(centre.threadCount, "thread", "threads")} out into ${facultyPhrase(
      centre.neighbourFaculties
    )}.`,
    conceptIds: [centre.conceptId, ...centre.neighbourIds],
    threadIds: centre.threadIds,
  };
}

/**
 * Where the web is held together — or where it is not.
 *
 * Fragmentation is reported first because it is the larger fact: telling a
 * player which single thread carries a crossing, while quietly omitting that
 * their work stands in three unconnected pieces, would be true and misleading.
 */
function crossingFragment(inputs: AnnotationInputs): Fragment | null {
  if (inputs.topology.componentCount > 1) {
    return {
      text: `The work stands in ${countWord(
        inputs.topology.componentCount
      )} separate figures, and nothing you wove crosses between them.`,
      conceptIds: inputs.topology.wovenConceptIds,
    };
  }

  const bridge = inputs.motifs.find((motif) => motif.kind === "bridge");
  const bridgeSentence = bridgeFragment(inputs, bridge);
  if (bridgeSentence !== null) return bridgeSentence;

  const crossings = inputs.topology.facultySpread.crossingThreadCount;
  if (crossings >= 2) {
    return {
      text: `${facultyPhrase(
        inputs.topology.facultySpread.presentFaculties
      )} meet in ${countWord(crossings)} places rather than one, so no single thread is load-bearing.`,
      conceptIds: inputs.topology.wovenConceptIds,
    };
  }
  return null;
}

/** The one thread or concept the crossing hangs on, when there is one. */
function bridgeFragment(
  inputs: AnnotationInputs,
  bridge: MotifDetection | undefined
): Fragment | null {
  if (bridge === undefined) return null;

  if (bridge.focusThreadId !== null) {
    const edge = inputs.topology.edges.find(
      (entry) => entry.threadId === bridge.focusThreadId
    );
    if (edge !== undefined) {
      return {
        text: `A single ${INTENTION_LABELS[edge.intention]} between ${inputs.lookup.conceptName(
          edge.pair[0]
        )} and ${inputs.lookup.conceptName(
          edge.pair[1]
        )} is all that holds those two regions together; cut it and they come apart.`,
        conceptIds: [edge.pair[0], edge.pair[1]],
        threadIds: [edge.threadId],
      };
    }
  }
  if (bridge.focusConceptId !== null) {
    return {
      text: `${inputs.lookup.conceptName(
        bridge.focusConceptId
      )} is standing in the only doorway between the regions you opened.`,
      conceptIds: [bridge.focusConceptId],
      threadIds: bridge.threadIds,
    };
  }
  return null;
}

/** What kept coming back. */
function recurrenceFragment(inputs: AnnotationInputs): Fragment | null {
  const canon = inputs.motifs.find((motif) => motif.kind === "canon");
  if (canon !== null && canon !== undefined && canon.facetId !== null) {
    return {
      text: `${inputs.lookup.facetName(canon.facetId)} kept returning — through ${formatList(
        canon.conceptIds.map((conceptId) => inputs.lookup.conceptName(conceptId))
      )} — and never twice in the same shape.`,
      conceptIds: canon.conceptIds,
      threadIds: canon.threadIds,
      facetIds: [canon.facetId],
    };
  }

  const carriers = new Map<FacetId, ConceptId[]>();
  for (const conceptId of inputs.topology.wovenConceptIds) {
    for (const facet of inputs.lookup.conceptFacets(conceptId)) {
      const found = carriers.get(facet);
      if (found === undefined) carriers.set(facet, [conceptId]);
      else found.push(conceptId);
    }
  }
  const strongest = [...carriers.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return compareStrings(a[0], b[0]);
    })[0];
  if (strongest === undefined) return null;

  return {
    text: `${inputs.lookup.facetName(strongest[0])} runs quietly under ${formatList(
      strongest[1].map((conceptId) => inputs.lookup.conceptName(conceptId))
    )}, whether or not you drew a thread for it.`,
    conceptIds: strongest[1],
    facetIds: [strongest[0]],
  };
}

/** What was set against what. */
function tensionFragment(inputs: AnnotationInputs): Fragment | null {
  const tension = inputs.topology.edges.find((edge) => edge.intention === "tension");
  if (tension === undefined) return null;

  const dialectic = inputs.motifs.find(
    // See buildPortrait: focusThreadId, or a pole holds its own opposition.
    (motif) => motif.kind === "dialectic" && motif.focusThreadId === tension.threadId
  );
  const aName = inputs.lookup.conceptName(tension.pair[0]);
  const bName = inputs.lookup.conceptName(tension.pair[1]);

  if (dialectic?.focusConceptId != null) {
    return {
      text: `You set ${aName} against ${bName} and then let ${inputs.lookup.conceptName(
        dialectic.focusConceptId
      )} take hold of the argument.`,
      conceptIds: [tension.pair[0], tension.pair[1], dialectic.focusConceptId],
      threadIds: dialectic.threadIds,
    };
  }
  return {
    text: `You set ${aName} against ${bName} and left it that way; nothing here resolves it.`,
    conceptIds: [tension.pair[0], tension.pair[1]],
    threadIds: [tension.threadId],
  };
}

/** What is still being asked. */
function openQuestionFragment(inputs: AnnotationInputs): Fragment | null {
  const open = inputs.outcomes.filter((outcome) => outcome.kind === "open-thread");
  const last = open[open.length - 1];
  if (last === undefined || last.kind !== "open-thread") return null;

  return {
    text: `One question is still standing where you left it: ${last.question}`,
    conceptIds: [last.pair[0], last.pair[1]],
    threadIds: [last.threadId],
    facetIds: [last.facet],
  };
}

/** The order the web actually developed in. */
function orderFragment(inputs: AnnotationInputs): Fragment | null {
  const steps = accreteWeb(inputs.state, inputs.lookup);
  if (steps.length < 2) return null;
  const turn = steps.findIndex((step) => step.bothEndpointsAlreadyWoven);

  if (turn < 0) {
    return {
      text: `You never doubled back: every one of your ${countWord(
        steps.length
      )} threads reached for something new.`,
    };
  }
  if (turn === 0) return null;

  const step = steps[turn];
  return {
    text: `You reached outward for ${countWord(turn)} ${pluralise(
      turn,
      "thread",
      "threads"
    )} before turning back into what you had already built.`,
    threadIds: step === undefined ? [] : [step.threadId],
  };
}

/** Where the arena was left. */
function untouchedFragment(inputs: AnnotationInputs): Fragment | null {
  const untouched = inputs.topology.untouchedConceptIds;
  if (untouched.length === 0) return null;
  const absent = FACULTY_IDS.filter(
    (faculty) =>
      !inputs.topology.facultySpread.presentFaculties.includes(faculty) &&
      inputs.topology.conceptIds.some(
        (conceptId) => inputs.lookup.conceptFaculty(conceptId) === faculty
      )
  );

  if (absent.length > 0) {
    return {
      text: `${capitalise(facultyPhrase(absent))} ${pluralise(
        absent.length,
        "was",
        "were"
      )} never asked, and ${countWord(untouched.length)} ${pluralise(
        untouched.length,
        "bead",
        "beads"
      )} stayed dark.`,
      conceptIds: untouched,
    };
  }
  return {
    text: `${capitalise(countWord(untouched.length))} ${pluralise(
      untouched.length,
      "bead",
      "beads"
    )} stayed dark, including ${inputs.lookup.conceptName(untouched[0] as ConceptId)}.`,
    conceptIds: untouched,
  };
}

function emptyAnnotation(inputs: AnnotationInputs): Annotation {
  const count = inputs.topology.conceptIds.length;
  const sentences =
    count === 0
      ? ["There is no session here to read."]
      : [
          `Nothing has been woven yet.`,
          `${capitalise(countWord(count))} ${pluralise(
            count,
            "bead is",
            "beads are"
          )} in the arena and no thread joins any of them, so there is nothing yet to say about the shape of this Game.`,
        ];

  return Object.freeze({
    sentences: Object.freeze(sentences),
    text: sentences.join(" "),
    references: Object.freeze({
      conceptIds: Object.freeze([]),
      threadIds: Object.freeze([]),
      facetIds: Object.freeze([]),
    }),
  });
}

function collectReferences(fragments: readonly Fragment[]): AnnotationReferences {
  const conceptIds = new Set<ConceptId>();
  const threadIds = new Set<ThreadId>();
  const facetIds = new Set<FacetId>();
  for (const fragment of fragments) {
    for (const id of fragment.conceptIds ?? []) conceptIds.add(id);
    for (const id of fragment.threadIds ?? []) threadIds.add(id);
    for (const id of fragment.facetIds ?? []) facetIds.add(id);
  }
  return Object.freeze({
    conceptIds: Object.freeze([...conceptIds]),
    threadIds: Object.freeze([...threadIds]),
    facetIds: Object.freeze([...facetIds]),
  });
}

/**
 * Compose the session's coda.
 *
 * The opening sentence is always the web's actual first thread; the remaining
 * sentences are drawn, in a fixed order of interest, from whichever structural
 * facts this particular web has. A web with no Tension gets no Tension
 * sentence; a fragmented web is told it is fragmented; a web whose crossing
 * hangs on one thread is told which thread. Two materially different webs
 * cannot produce the same text unless they are materially the same web.
 */
export function buildAnnotation(
  state: SessionStateV1,
  lookup: RelationLookup
): Annotation {
  const inputs: AnnotationInputs = {
    state,
    lookup,
    topology: buildTopology(state, lookup),
    outcomes: resolveSessionOutcomes(state, lookup),
    motifs: detectMotifs(state, lookup),
  };

  if (inputs.outcomes.length === 0) return emptyAnnotation(inputs);

  const opening = openingFragment(inputs);
  const chosen: Fragment[] = opening === null ? [] : [opening];

  const candidates: readonly (Fragment | null)[] = [
    centreFragment(inputs),
    crossingFragment(inputs),
    tensionFragment(inputs),
    openQuestionFragment(inputs),
    recurrenceFragment(inputs),
    bridgeFragment(
      inputs,
      inputs.motifs.find((motif) => motif.kind === "bridge")
    ),
    orderFragment(inputs),
    untouchedFragment(inputs),
  ];

  for (const candidate of candidates) {
    if (chosen.length >= MAX_SENTENCES) break;
    if (candidate === null) continue;
    if (chosen.some((fragment) => fragment.text === candidate.text)) continue;
    chosen.push(candidate);
  }

  /*
   * Three sentences is the floor, but only when the web has three true things
   * to say. A one-thread session gets a short coda rather than a padded one.
   */
  if (chosen.length < MIN_SENTENCES) {
    const filler = untouchedFragment(inputs);
    if (filler !== null && !chosen.some((fragment) => fragment.text === filler.text)) {
      chosen.push(filler);
    }
  }

  const sentences = Object.freeze(chosen.map((fragment) => fragment.text));
  return Object.freeze({
    sentences,
    text: sentences.join(" "),
    references: collectReferences(chosen),
  });
}
