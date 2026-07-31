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

/**
 * The coda's length is earned, not fixed.
 *
 * A flat cap of five made a twelve-thread web with three motifs, two components
 * and an Open Thread say no more than a two-thread web — the later true
 * sentences were composed and then dropped on the floor.
 *
 * The budget now grows with the web, from the old cap upward: `BASE_SENTENCES`
 * is a floor rather than a ceiling, so no session says less than it used to,
 * and `MAX_SENTENCES` is simply the number of fragments that can exist at all.
 * The budget is still only a ceiling — a fragment is added only when the web
 * gives it something to name — so a larger budget can never pad a quiet web.
 */
const MIN_SENTENCES = 3;
const BASE_SENTENCES = 5;
const MAX_SENTENCES = 9;

function sentenceBudget(inputs: AnnotationInputs): number {
  const earned = 2 + Math.ceil(inputs.topology.threadCount / 2);
  return Math.min(MAX_SENTENCES, Math.max(BASE_SENTENCES, earned));
}

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

  /*
   * "Everything" is only true when there is one figure. In a fragmented web the
   * centre is the centre of its own piece, and the coda goes on to say in the
   * same breath that the work stands in several pieces — so the unqualified
   * claim would be contradicted by the paragraph containing it.
   */
  const scope =
    inputs.topology.componentCount > 1
      ? "became the point its own figure turned on"
      : "became the point everything turned on";

  return {
    text: `${inputs.lookup.conceptName(centre.conceptId)} ${scope}, carrying ${countWord(
      centre.threadCount
    )} ${pluralise(centre.threadCount, "thread", "threads")} out into ${facultyPhrase(
      centre.neighbourFaculties
    )}.`,
    conceptIds: [centre.conceptId, ...centre.neighbourIds],
    threadIds: centre.threadIds,
  };
}

/**
 * The one thread or concept a crossing hangs on, read two ways.
 *
 * `whole` states it of the web, which is only honest when the web is one
 * figure. `inside` states it of the figure the bridge actually sits in, which
 * is the only true form when the web is in pieces — the bridge detector
 * confines itself to a single component, so a bridge in a fragmented web never
 * spans "the regions you opened", only two regions of one of them.
 */
interface BridgeReading {
  readonly whole: string;
  readonly inside: string;
  readonly conceptIds: readonly ConceptId[];
  readonly threadIds: readonly ThreadId[];
}

function readBridge(
  inputs: AnnotationInputs,
  bridge: MotifDetection | undefined
): BridgeReading | null {
  if (bridge === undefined) return null;

  if (bridge.focusThreadId !== null) {
    const edge = inputs.topology.edges.find(
      (entry) => entry.threadId === bridge.focusThreadId
    );
    if (edge !== undefined) {
      const aName = inputs.lookup.conceptName(edge.pair[0]);
      const bName = inputs.lookup.conceptName(edge.pair[1]);
      const label = INTENTION_LABELS[edge.intention];
      return {
        whole: `A single ${label} between ${aName} and ${bName} is all that holds those two regions together; cut it and they come apart.`,
        inside: `a single ${label} between ${aName} and ${bName} holds one of those figures together on its own`,
        conceptIds: [edge.pair[0], edge.pair[1]],
        threadIds: [edge.threadId],
      };
    }
  }
  if (bridge.focusConceptId !== null) {
    const name = inputs.lookup.conceptName(bridge.focusConceptId);
    return {
      whole: `${name} is standing in the only doorway between the regions you opened.`,
      inside: `${name} is standing in the only doorway inside one of them`,
      conceptIds: [bridge.focusConceptId],
      threadIds: bridge.threadIds,
    };
  }
  return null;
}

/**
 * Where the web is held together — or where it is not, and what remains.
 *
 * Fragmentation is reported first because it is the larger fact: telling a
 * player which single thread carries a crossing, while quietly omitting that
 * their work stands in three unconnected pieces, would be true and misleading.
 *
 * The two claims used to be independent candidates deduped by exact string
 * equality, which is no defence at all against a *factual* contradiction: one
 * coda said "nothing you wove crosses between them" and then, three sentences
 * later, that a concept stood "in the only doorway between the regions you
 * opened". They are now mutually exclusive by construction. When the web is
 * fragmented the crossing sentence absorbs the bridge and relocates it inside a
 * single figure, and `bridgeConsumed` stops it being offered a second time.
 */
interface CrossingReading {
  readonly fragment: Fragment | null;
  readonly bridgeConsumed: boolean;
}

function crossingFragment(
  inputs: AnnotationInputs,
  bridge: MotifDetection | undefined
): CrossingReading {
  const reading = readBridge(inputs, bridge);

  if (inputs.topology.componentCount > 1) {
    const opening = `The work stands in ${countWord(
      inputs.topology.componentCount
    )} separate figures, and nothing you wove crosses between them`;
    if (reading !== null) {
      return {
        fragment: {
          text: `${opening}; ${reading.inside}.`,
          conceptIds: [...inputs.topology.wovenConceptIds, ...reading.conceptIds],
          threadIds: reading.threadIds,
        },
        bridgeConsumed: true,
      };
    }
    return {
      fragment: {
        text: `${opening}.`,
        conceptIds: inputs.topology.wovenConceptIds,
      },
      bridgeConsumed: false,
    };
  }

  if (reading !== null) {
    return {
      fragment: {
        text: reading.whole,
        conceptIds: reading.conceptIds,
        threadIds: reading.threadIds,
      },
      bridgeConsumed: true,
    };
  }

  const crossings = inputs.topology.facultySpread.crossingThreadCount;
  if (crossings >= 2) {
    return {
      fragment: {
        text: `${facultyPhrase(
          inputs.topology.facultySpread.presentFaculties
        )} meet in ${countWord(crossings)} places rather than one, so no single thread is load-bearing.`,
        conceptIds: inputs.topology.wovenConceptIds,
      },
      bridgeConsumed: false,
    };
  }
  return { fragment: null, bridgeConsumed: false };
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
  // "One bead stayed dark, including X" names the whole of a one-item list as
  // though it were a sample of it. At one, the bead is simply named.
  const named = inputs.lookup.conceptName(untouched[0] as ConceptId);
  return {
    text:
      untouched.length === 1
        ? `One bead stayed dark: ${named}.`
        : `${capitalise(countWord(untouched.length))} beads stayed dark, including ${named}.`,
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
          )} in the arena and no thread joins ${pluralise(
            count,
            "it",
            "any of them"
          )}, so there is nothing yet to say about the shape of this Game.`,
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

  const bridge = inputs.motifs.find((motif) => motif.kind === "bridge");
  const crossing = crossingFragment(inputs, bridge);
  const standaloneBridge = crossing.bridgeConsumed ? null : readBridge(inputs, bridge);

  const candidates: readonly (Fragment | null)[] = [
    centreFragment(inputs),
    crossing.fragment,
    tensionFragment(inputs),
    openQuestionFragment(inputs),
    recurrenceFragment(inputs),
    standaloneBridge === null
      ? null
      : {
          text: standaloneBridge.whole,
          conceptIds: standaloneBridge.conceptIds,
          threadIds: standaloneBridge.threadIds,
        },
    orderFragment(inputs),
    untouchedFragment(inputs),
  ];

  const budget = sentenceBudget(inputs);
  for (const candidate of candidates) {
    if (chosen.length >= budget) break;
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
