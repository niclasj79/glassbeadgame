import { accreteWeb, buildTopology } from "../graph/buildTopology";
import type { SessionTopology } from "../graph/types";
import type { ConceptId } from "../ids";
import type { SessionStateV1 } from "../model/sessionState";
import { detectMotifs } from "../motifs/detectMotifs";
import type { MotifDetection } from "../motifs/types";
import type { RelationLookup } from "../outcomes/lookup";
import {
  capitalise,
  clamp01,
  compareStrings,
  countWord,
  facultyLabel,
  formatList,
  pluralise,
  quantise,
} from "../outcomes/prose";
import {
  outcomeIsInterpretiveReading,
  outcomeSpeaksForTheRecord,
  resolveSessionOutcomes,
} from "../outcomes/resolveThreadOutcome";
import type { ThreadOutcomeResolution } from "../outcomes/types";
import { FACULTY_IDS, type FacetId, type FacultyId } from "@/content/castalia/schema";
import {
  PORTRAIT_DIMENSION_IDS,
  type Portrait,
  type PortraitDimension,
  type PortraitDimensionId,
} from "./types";

const LABELS: Readonly<Record<PortraitDimensionId, string>> = Object.freeze({
  range: "Range",
  depth: "Depth",
  tension: "Tension",
  coherence: "Coherence",
  openness: "Openness",
  return: "Return",
});

interface PortraitInputs {
  readonly state: SessionStateV1;
  readonly lookup: RelationLookup;
  readonly topology: SessionTopology;
  readonly outcomes: readonly ThreadOutcomeResolution[];
  readonly motifs: readonly MotifDetection[];
}

const dimension = (
  id: PortraitDimensionId,
  value: number,
  phrase: string,
  evidence: readonly string[]
): PortraitDimension =>
  Object.freeze({
    id,
    label: LABELS[id],
    value: quantise(clamp01(value)),
    phrase,
    evidence: Object.freeze([...evidence]),
  });

function facetCarriers(
  inputs: PortraitInputs
): ReadonlyMap<FacetId, readonly ConceptId[]> {
  const carriers = new Map<FacetId, ConceptId[]>();
  for (const conceptId of inputs.topology.wovenConceptIds) {
    for (const facet of inputs.lookup.conceptFacets(conceptId)) {
      const found = carriers.get(facet);
      if (found === undefined) carriers.set(facet, [conceptId]);
      else found.push(conceptId);
    }
  }
  return carriers;
}

// ── Range ────────────────────────────────────────────────────────────────────

function buildRange(inputs: PortraitInputs): PortraitDimension {
  const { topology, lookup } = inputs;
  const spread = topology.facultySpread;
  const sessionByFaculty = {} as Record<FacultyId, number>;
  for (const faculty of FACULTY_IDS) sessionByFaculty[faculty] = 0;
  for (const conceptId of topology.conceptIds) {
    sessionByFaculty[lookup.conceptFaculty(conceptId)] += 1;
  }

  const reach =
    topology.conceptIds.length === 0
      ? 0
      : topology.wovenConceptIds.length / topology.conceptIds.length;
  const value = 0.5 * spread.spread + 0.3 * reach + 0.2 * spread.crossingShare;

  const present = spread.presentFaculties.map(facultyLabel);
  const absent = FACULTY_IDS.filter(
    (faculty) => sessionByFaculty[faculty] > 0 && spread.wovenByFaculty[faculty] === 0
  ).map(facultyLabel);

  let phrase: string;
  if (topology.wovenConceptIds.length === 0) {
    phrase = "No faculty has been drawn on yet.";
  } else if (absent.length === 0) {
    // "Sound all answered" is what a one-item list does to a quantifier that
    // presumes several. A session confined to one faculty gets the singular.
    phrase =
      present.length === 1
        ? `${present[0]} answered, and it was the only faculty asked.`
        : `${formatList(present)} all answered.`;
  } else {
    phrase = `${formatList(present)} answered; ${formatList(absent)} stayed silent.`;
  }

  // "One of your one thread crossed between faculties" is the same defect in
  // the denominator: at one thread the fraction is not a fraction.
  if (topology.threadCount === 1) {
    phrase +=
      spread.crossingThreadCount === 1
        ? " Your one thread crossed between faculties."
        : " Your one thread stayed inside a single faculty.";
  } else if (topology.threadCount > 1) {
    phrase += ` ${capitalise(countWord(spread.crossingThreadCount))} of your ${countWord(
      topology.threadCount
    )} threads crossed between faculties.`;
  }

  /*
   * "Sound: 2 of 4 woven" names a maximum and how far short of it you fell,
   * which is a completion meter however carefully the header disclaims one
   * (ADR-010). The fact is worth keeping — it is checkable, and it is the only
   * place the portrait says which beads answered — so the line states both parts
   * of the partition instead of a part over a whole.
   */
  const evidence = FACULTY_IDS.filter((faculty) => sessionByFaculty[faculty] > 0).map(
    (faculty) => {
      const wovenHere = spread.wovenByFaculty[faculty];
      const dark = sessionByFaculty[faculty] - wovenHere;
      return `${facultyLabel(faculty)}: ${wovenHere} woven, ${
        dark === 0 ? "none" : dark
      } left dark`;
    }
  );

  return dimension("range", value, phrase, evidence);
}

// ── Depth ────────────────────────────────────────────────────────────────────

function buildDepth(inputs: PortraitInputs): PortraitDimension {
  const { topology, outcomes, lookup } = inputs;
  const total = outcomes.length;
  /*
   * "Documented" is two different claims wearing one word. `outcome.kind` is
   * "documented" the moment an authored relation exists, whatever its evidence
   * class, so counting it directly told a player they had "met documented
   * material" where the Game had only offered a reading of its own. The two are
   * counted apart for the prose and together for the value: they differ in
   * resolution, never in reward (CAV-006), and a reading that scored lower than
   * a record would teach the player to prefer one kind of truth.
   */
  const record = outcomes.filter(outcomeSpeaksForTheRecord).length;
  const reading = outcomes.filter(outcomeIsInterpretiveReading).length;
  const authored = record + reading;
  const open = outcomes.filter((outcome) => outcome.kind === "open-thread").length;
  const unresolved = outcomes.filter((outcome) => outcome.kind === "unresolved").length;

  const wovenCount = topology.wovenConceptIds.length;
  const revisited = topology.nodes.filter((node) => node.threadCount >= 2).length;
  const authoredShare = total === 0 ? 0 : authored / total;
  const revisitShare = wovenCount === 0 ? 0 : revisited / wovenCount;
  const reach = clamp01((topology.maxDegree - 1) / 3);
  const value = 0.45 * authoredShare + 0.35 * revisitShare + 0.2 * reach;

  if (total === 0) {
    return dimension("depth", 0, "Nothing has been gone into yet.", []);
  }

  // Each clause is stated only when it happened. Composing all three
  // unconditionally produced "none found nothing to stand on" — a double
  // negative that says the opposite of what the web did. Generated prose has to
  // read correctly at zero, because zero is the common case early in a session.
  //
  // One is the other boundary: "one of your one thread met documented material"
  // is a fraction whose denominator is not plural, so the single thread is
  // reported as itself rather than as a share of itself.
  let phrase: string;
  if (total === 1) {
    phrase =
      record === 1
        ? "Your one thread met documented material."
        : reading === 1
          ? "Your one thread met a reading the Game offers rather than a record."
          : open === 1
            ? "Your one thread opened a question rather than meeting documented material."
            : "Your one thread found nothing documented to stand on.";
  } else {
    const clauses: string[] = [
      `${capitalise(countWord(record))} of your ${countWord(
        total
      )} threads met documented material`,
    ];
    if (reading > 0) {
      /*
       * No "rather than a record" here. The clause is often preceded by "None of
       * your N threads met documented material", and a contrast hanging off a
       * negated quantifier attaches to nothing — the same defect the property
       * sweep already forbids in Return's zero case. The leading clause carries
       * the contrast; this one only has to name what was met.
       */
      clauses.push(`${countWord(reading)} met a reading the Game offers`);
    }
    if (open > 0) {
      clauses.push(
        `${countWord(open)} ${open === 1 ? "opened a question" : "opened questions"}`
      );
    }
    if (unresolved > 0) {
      clauses.push(`${countWord(unresolved)} found nothing to stand on`);
    }
    phrase = `${
      clauses.length === 1
        ? clauses[0]
        : `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`
    }.`;
  }

  const deepest = [...topology.nodes]
    .filter((node) => node.threadCount >= 2)
    .sort((a, b) => b.threadCount - a.threadCount)[0];
  if (deepest !== undefined) {
    const times =
      deepest.threadCount === 2 ? "twice" : `${countWord(deepest.threadCount)} times`;
    phrase += ` You returned to ${lookup.conceptName(deepest.conceptId)} ${times}.`;
  }

  return dimension("depth", value, phrase, [
    `${record} documented, ${reading} read by the Game, ${open} open, ${unresolved} unresolved`,
    `${revisited} woven ${pluralise(
      revisited,
      "concept carries",
      "concepts carry"
    )} more than one thread, ${wovenCount - revisited} ${pluralise(
      wovenCount - revisited,
      "carries",
      "carry"
    )} one`,
  ]);
}

// ── Tension ──────────────────────────────────────────────────────────────────

function buildTension(inputs: PortraitInputs): PortraitDimension {
  const { topology, lookup, motifs } = inputs;
  const tensions = topology.edges.filter((edge) => edge.intention === "tension");

  if (tensions.length === 0) {
    return dimension(
      "tension",
      0,
      "You declared no Tension; nothing in this web was set against anything else.",
      []
    );
  }

  const first = tensions[0];
  const dialectics = motifs.filter((motif) => motif.kind === "dialectic");
  const holdingDialectic =
    first === undefined
      ? undefined
      // Must match the Dialectic's *focus* thread, not any thread it contains:
      // threadIds also holds the support threads, so a Tension that merely
      // participates in someone else's Dialectic would be reported as held by
      // that Dialectic's focus — which lets a pole take hold of its own
      // opposition. compileConclusion already matches on focusThreadId.
      : dialectics.find((motif) => motif.focusThreadId === first.threadId);

  let phrase = `You set ${lookup.conceptName(first?.pair[0] as ConceptId)} against ${lookup.conceptName(
    first?.pair[1] as ConceptId
  )}`;
  if (tensions.length > 1) {
    phrase += `, and ${countWord(tensions.length - 1)} further ${pluralise(
      tensions.length - 1,
      "opposition",
      "oppositions"
    )} besides`;
  }
  if (holdingDialectic?.focusConceptId != null) {
    phrase += `; ${lookup.conceptName(holdingDialectic.focusConceptId)} took hold of it.`;
  } else {
    phrase += "; nothing in the web has taken hold of it, and it is still ringing.";
  }

  return dimension("tension", topology.tensionLoad, phrase, [
    `${tensions.length} ${pluralise(
      tensions.length,
      "thread",
      "threads"
    )} declared as Tension, ${topology.threadCount - tensions.length} otherwise`,
    `${dialectics.length} Dialectic ${pluralise(dialectics.length, "motif", "motifs")} completed`,
  ]);
}

// ── Coherence ────────────────────────────────────────────────────────────────

function buildCoherence(inputs: PortraitInputs): PortraitDimension {
  const { topology } = inputs;
  const { componentCount, circuitRank } = topology;

  if (componentCount === 0) {
    return dimension("coherence", 0, "Nothing is joined to anything yet.", []);
  }

  const closing =
    circuitRank === 0
      ? ", branching outward without ever closing a loop"
      : `, closed by ${countWord(circuitRank)} ${pluralise(circuitRank, "loop", "loops")}`;

  const phrase =
    componentCount === 1
      ? `Everything you wove hangs together as one figure${closing}.`
      : `Your work stands as ${countWord(componentCount)} separate figures${closing}.`;

  return dimension("coherence", topology.coherence, phrase, [
    `${componentCount} ${pluralise(componentCount, "component", "components")} over ${topology.wovenConceptIds.length} woven concepts`,
    `${circuitRank} independent ${pluralise(circuitRank, "cycle", "cycles")}`,
  ]);
}

// ── Openness ─────────────────────────────────────────────────────────────────

function buildOpenness(inputs: PortraitInputs): PortraitDimension {
  const { topology, outcomes, lookup } = inputs;
  const total = outcomes.length;
  const openThreads = outcomes.filter((outcome) => outcome.kind === "open-thread");
  const unresolved = outcomes.filter((outcome) => outcome.kind === "unresolved");
  const untouched = topology.untouchedConceptIds.length;

  const openShare = total === 0 ? 0 : openThreads.length / total;
  const unresolvedShare = total === 0 ? 0 : unresolved.length / total;
  const value = 0.5 * openShare + 0.2 * unresolvedShare + 0.3 * topology.openness;

  const sentences: string[] = [];
  const first = openThreads[0];
  if (first !== undefined && first.kind === "open-thread") {
    sentences.push(
      `${capitalise(countWord(openThreads.length))} Open ${pluralise(
        openThreads.length,
        "Thread is",
        "Threads are"
      )} still standing; ${pluralise(
        openThreads.length,
        "it asks",
        "the first asks"
      )} after ${lookup.facetName(first.facet)} in ${lookup.conceptName(
        first.pair[0]
      )} and ${lookup.conceptName(first.pair[1])}.`
    );
  } else if (total > 0) {
    sentences.push("No Open Thread was left standing.");
  }
  if (unresolved.length > 0) {
    sentences.push(
      `${capitalise(countWord(unresolved.length))} ${pluralise(
        unresolved.length,
        "thread",
        "threads"
      )} found no ground at all, and the Game said so.`
    );
  }
  if (untouched > 0) {
    sentences.push(
      `${capitalise(countWord(untouched))} ${pluralise(
        untouched,
        "bead was",
        "beads were"
      )} never taken up.`
    );
  }
  if (sentences.length === 0) sentences.push("Nothing here is left open.");

  return dimension("openness", value, sentences.join(" "), [
    `${openThreads.length} Open ${pluralise(openThreads.length, "Thread", "Threads")}`,
    `${unresolved.length} unresolved ${pluralise(unresolved.length, "thread", "threads")}`,
    `${untouched} untouched ${pluralise(untouched, "bead", "beads")}`,
  ]);
}

// ── Return ───────────────────────────────────────────────────────────────────

function buildReturn(inputs: PortraitInputs): PortraitDimension {
  const { state, topology, lookup } = inputs;
  const steps = accreteWeb(state, lookup);
  const total = steps.length;

  if (total === 0) {
    return dimension("return", 0, "There is nothing to return to yet.", []);
  }

  const closing = steps.filter((step) => step.bothEndpointsAlreadyWoven).length;
  const carriers = facetCarriers(inputs);
  const recurring = [...carriers.entries()].filter(([, ids]) => ids.length >= 2);
  const recurrence =
    carriers.size === 0 ? 0 : recurring.length / carriers.size;
  const value = 0.6 * (closing / total) + 0.4 * recurrence;

  const strongest = [...carriers.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return compareStrings(a[0], b[0]);
  })[0];

  /*
   * "None of your seven threads closed back into what you had already made
   * rather than reaching outward" is not a proposition: under the negation the
   * contrastive clause has nothing left to attach to, and the sentence stops
   * short of saying what the web did instead. Zero is its own sentence, and it
   * states the positive fact — every thread reached outward. See buildDepth: a
   * dimension that reads correctly only above zero is a dimension that reads
   * incorrectly for most of a session.
   *
   * One is the other boundary. The first thread can never close back — nothing
   * is woven when it is drawn — so a one-thread web is always the zero case,
   * and telling it "none of your one thread" would compound both defects.
   */
  let phrase: string;
  if (closing === 0) {
    phrase =
      total === 1
        ? "Your one thread reached outward; there was nothing yet for it to close back into."
        : `Every one of your ${countWord(
            total
          )} threads reached outward, and none closed back into what you had already made.`;
  } else {
    phrase = `${capitalise(countWord(closing))} of your ${countWord(total)} ${pluralise(
      total,
      "thread",
      "threads"
    )} closed back into what you had already made rather than reaching outward.`;
  }
  if (strongest !== undefined && strongest[1].length >= 2) {
    phrase += ` ${lookup.facetName(strongest[0])} came back in ${countWord(
      strongest[1].length
    )} of your beads.`;
  }

  return dimension("return", value, phrase, [
    `${closing} ${pluralise(
      closing,
      "thread",
      "threads"
    )} joined two already-woven concepts, ${total - closing} reached outward`,
    `${recurring.length} ${pluralise(
      recurring.length,
      "facet appears",
      "facets appear"
    )} in more than one woven concept, ${carriers.size - recurring.length} in only one`,
    `${topology.circuitRank} independent ${pluralise(topology.circuitRank, "cycle", "cycles")}`,
  ]);
}

/**
 * Build the six-dimension portrait of a session.
 *
 * Pure, total, and stable under replay: the portrait is a function of the
 * reduced state and the content pack alone. Nothing here reads a clock, a
 * random source, or presentation state.
 */
export function buildPortrait(
  state: SessionStateV1,
  lookup: RelationLookup
): Portrait {
  const inputs: PortraitInputs = {
    state,
    lookup,
    topology: buildTopology(state, lookup),
    outcomes: resolveSessionOutcomes(state, lookup),
    motifs: detectMotifs(state, lookup),
  };

  const dimensions: readonly PortraitDimension[] = Object.freeze([
    buildRange(inputs),
    buildDepth(inputs),
    buildTension(inputs),
    buildCoherence(inputs),
    buildOpenness(inputs),
    buildReturn(inputs),
  ]);

  const byId = {} as Record<PortraitDimensionId, PortraitDimension>;
  for (const id of PORTRAIT_DIMENSION_IDS) {
    const found = dimensions.find((entry) => entry.id === id);
    if (found === undefined) {
      throw new Error(`portrait is missing the ${id} dimension`);
    }
    byId[id] = found;
  }

  return Object.freeze({ dimensions, byId: Object.freeze(byId) });
}
