import type { GestureProfile, RelationIntention } from "../events";
import { accreteWeb, buildTopology } from "../graph/buildTopology";
import type { SessionTopology, WebAccretionStep } from "../graph/types";
import type { ConceptId, ThreadId } from "../ids";
import type { CommittedThreadV1, SessionStateV1 } from "../model/sessionState";
import { detectMotifs } from "../motifs/detectMotifs";
import type { MotifDetection } from "../motifs/types";
import type { RelationLookup } from "../outcomes/lookup";
import {
  INTENTION_LABELS,
  capitalise,
  clamp01,
  facultyLabel,
  formatList,
  quantise,
} from "../outcomes/prose";
import { resolveSessionOutcomes } from "../outcomes/resolveThreadOutcome";
import type { ThreadOutcomeResolution } from "../outcomes/types";
import {
  MOTIF_REGISTERS,
  type ConceptMotif,
  type MotifRegister,
} from "@/content/castalia/schema";
import type {
  CameraHint,
  CameraHintKind,
  ConclusionPerformance,
  EnsembleStructure,
  IntentionTransformation,
  PerformanceClimax,
  PerformanceEnsemble,
  PerformanceEntry,
  PerformanceVoice,
  PhrasingProfile,
  UnresolvedVoice,
} from "./types";

// ── Tuning constants ─────────────────────────────────────────────────────────
//
// These shape the *rendering* of the performance. None of them decides what the
// performance says: no threshold here can promote a thread, demote an outcome,
// or place the climax. That comes from the web.

const BEATS_PER_BAR = 4;
const BASE_ENTRY_BEATS = 6;
/** CAV-006: a weak outcome is quiet and short. Never dim, never grey. */
const UNRESOLVED_BEATS_FACTOR = 0.5;
const UNRESOLVED_DYNAMIC = 0.35;
const ENSEMBLE_BEATS = 8;
const CODA_BEATS = 4;
/** CAV-007: instability persists but its amplitude settles within ~12 seconds. */
const TENSION_DECAY_SECONDS = 12;
const TENSION_FLOOR_GAIN = 0.08;

const TRANSFORMATIONS: Readonly<Record<RelationIntention, IntentionTransformation>> =
  Object.freeze({
    echo: "imitation",
    passage: "translation",
    tension: "displacement",
    ground: "foundation",
  });

const CAMERA_BY_INTENTION: Readonly<Record<RelationIntention, CameraHintKind>> =
  Object.freeze({
    echo: "answer",
    passage: "traverse",
    tension: "hold",
    ground: "settle",
  });

function shiftRegister(register: MotifRegister, steps: number): MotifRegister {
  const index = MOTIF_REGISTERS.indexOf(register);
  const next = Math.min(
    MOTIF_REGISTERS.length - 1,
    Math.max(0, (index < 0 ? 2 : index) + steps)
  );
  return MOTIF_REGISTERS[next] as MotifRegister;
}

function beatsToSeconds(beats: number, secondsPerBeat: number): number {
  return quantise(beats * secondsPerBeat);
}

/** Quarter-beat grid: fine enough to phrase, coarse enough to stay legible. */
function quantiseBeats(beats: number): number {
  return Math.round(beats * 4) / 4;
}

// ── Gesture → phrasing ───────────────────────────────────────────────────────

function normalised(value: number | undefined, scale: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0.5;
  return quantise(clamp01(value / scale));
}

/**
 * I-009 made explicit: a modality that cannot report a geometric field gets a
 * neutral 0.5, not a zero. A keyboard weave phrases differently from a swept
 * pointer; it does not phrase worse.
 */
export function phrasingOf(gesture: GestureProfile): PhrasingProfile {
  return Object.freeze({
    modality: gesture.inputModality,
    attack: normalised(gesture.averageSpeedViewportPerSecond, 1.5),
    legato: normalised(gesture.curvature, 1),
    rubato: normalised(gesture.speedVariance, 0.5),
    weight: gesture.pressure === undefined ? 0.5 : quantise(clamp01(gesture.pressure)),
    breadth: normalised(gesture.pathLengthViewport, 1.5),
  });
}

// ── Voice construction ───────────────────────────────────────────────────────

interface VoiceDraft {
  readonly conceptId: ConceptId;
  readonly role: PerformanceVoice["role"];
  readonly motif: ConceptMotif;
  readonly degrees: readonly number[];
  readonly rhythm: readonly number[];
  readonly register: MotifRegister;
  readonly offsetBeats: number;
  readonly openEnded: boolean;
}

function transposeTo(
  source: readonly number[],
  destinationRoot: number
): readonly number[] {
  const root = source[0] ?? 0;
  return source.map((degree) => degree - root + destinationRoot);
}

function rotate(values: readonly number[], by: number): readonly number[] {
  if (values.length === 0) return values;
  const shift = ((by % values.length) + values.length) % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
}

/**
 * The semantic core of the score: each intention transforms the pair's authored
 * motifs according to the relation grammar in VERTICAL-SLICE-SPEC §11, and the
 * documented direction (when the pack records one) decides which concept is the
 * source.
 */
function draftVoices(
  thread: CommittedThreadV1,
  outcome: ThreadOutcomeResolution,
  lookup: RelationLookup,
  phrasing: PhrasingProfile
): readonly VoiceDraft[] {
  const [a, b] = thread.pair;
  const motifA = lookup.conceptMotif(a);
  const motifB = lookup.conceptMotif(b);
  const openEnded = outcome.kind === "open-thread";

  // A documented direction overrides pair order; otherwise the attended bead
  // is the source, because that is the bead the player reached out from.
  const direction =
    outcome.kind === "documented" ? (outcome.relation.direction ?? null) : null;
  const sourceIsFirst = direction === null ? true : direction[0] === a;
  const source = sourceIsFirst ? a : b;
  const destination = sourceIsFirst ? b : a;
  const sourceMotif = sourceIsFirst ? motifA : motifB;
  const destinationMotif = sourceIsFirst ? motifB : motifA;

  const stagger = quantiseBeats(1 * (0.6 + 0.8 * phrasing.rubato));

  switch (thread.intention) {
    case "echo":
      return [
        {
          conceptId: a,
          role: "subject",
          motif: motifA,
          degrees: motifA.degrees,
          rhythm: motifA.rhythm,
          register: motifA.register,
          offsetBeats: 0,
          openEnded: false,
        },
        {
          conceptId: b,
          role: "answer",
          motif: motifB,
          // Imitation: its own contour, taking the subject's rhythm so the two
          // are heard as one form restated rather than as two ideas at once.
          degrees: motifB.degrees,
          rhythm: motifA.rhythm,
          register: motifB.register,
          offsetBeats: stagger,
          openEnded,
        },
      ];

    case "passage":
      return [
        {
          conceptId: source,
          role: "subject",
          motif: sourceMotif,
          degrees: sourceMotif.degrees,
          rhythm: sourceMotif.rhythm,
          register: sourceMotif.register,
          offsetBeats: 0,
          openEnded: false,
        },
        {
          conceptId: destination,
          role: "answer",
          motif: destinationMotif,
          // Translation: the source's contour arrives in the destination's
          // body — its rhythm, register, articulation, and timbre.
          degrees: transposeTo(sourceMotif.degrees, destinationMotif.degrees[0] ?? 0),
          rhythm: destinationMotif.rhythm,
          register: destinationMotif.register,
          offsetBeats: stagger,
          openEnded,
        },
      ];

    case "tension":
      return [
        {
          conceptId: a,
          role: "subject",
          motif: motifA,
          degrees: motifA.degrees,
          rhythm: motifA.rhythm,
          register: motifA.register,
          offsetBeats: 0,
          openEnded: true,
        },
        {
          conceptId: b,
          role: "answer",
          motif: motifB,
          /*
           * Displacement in pitch and in phase; nothing resolves it here. The
           * phase displacement lives in `offsetBeats`, which works for any
           * motif; rotating the rhythm additionally displaces the internal
           * accents of an uneven figure, and is correctly a no-op for an even
           * one, where the entry offset already carries the whole shift.
           */
          degrees: motifB.degrees.map((degree) => degree + 1),
          rhythm: rotate(motifB.rhythm, 1),
          register: motifB.register,
          offsetBeats: quantiseBeats(stagger / 2),
          openEnded: true,
        },
      ];

    case "ground":
      return [
        {
          conceptId: source,
          role: "ground",
          motif: sourceMotif,
          // A pedal: one degree, one long duration, one register lower.
          degrees: [sourceMotif.degrees[0] ?? 0],
          rhythm: [sourceMotif.rhythm.reduce((sum, value) => sum + value, 0)],
          register: shiftRegister(sourceMotif.register, -1),
          offsetBeats: 0,
          openEnded: false,
        },
        {
          conceptId: destination,
          role: "subject",
          motif: destinationMotif,
          degrees: destinationMotif.degrees,
          rhythm: destinationMotif.rhythm,
          register: destinationMotif.register,
          offsetBeats: stagger,
          openEnded,
        },
      ];

    default: {
      const exhaustive: never = thread.intention;
      return exhaustive;
    }
  }
}

function realiseVoice(
  draft: VoiceDraft,
  entryBeat: number,
  entryBeats: number,
  gain: number,
  secondsPerBeat: number
): PerformanceVoice {
  const atBeat = quantiseBeats(entryBeat + draft.offsetBeats);
  const durationBeats = quantiseBeats(Math.max(1, entryBeats - draft.offsetBeats));
  return Object.freeze({
    conceptId: draft.conceptId,
    role: draft.role,
    degrees: Object.freeze([...draft.degrees]),
    rhythm: Object.freeze([...draft.rhythm]),
    register: draft.register,
    articulation:
      draft.role === "ground" ? "sustained" : draft.motif.articulation,
    timbre: draft.motif.timbre,
    atBeat,
    atSeconds: beatsToSeconds(atBeat, secondsPerBeat),
    durationBeats,
    durationSeconds: beatsToSeconds(durationBeats, secondsPerBeat),
    gain: quantise(clamp01(gain)),
    openEnded: draft.openEnded,
  });
}

// ── Climax ───────────────────────────────────────────────────────────────────

interface WeightBreakdown {
  readonly weight: number;
  readonly clauses: readonly string[];
}

/**
 * The weight of a moment, measured in the finished web.
 *
 * Nothing here is a threshold. The heaviest entry is the climax whatever its
 * absolute weight, so a quiet four-thread session has a climax in exactly the
 * same way an eleven-thread session does — its own.
 */
function weighEntry(
  thread: CommittedThreadV1,
  topology: SessionTopology,
  step: WebAccretionStep | undefined,
  motifs: readonly MotifDetection[],
  lookup: RelationLookup
): WeightBreakdown {
  const clauses: string[] = [];
  const nodeA = topology.nodes.find((node) => node.conceptId === thread.pair[0]);
  const nodeB = topology.nodes.find((node) => node.conceptId === thread.pair[1]);
  const centrality = Math.max(nodeA?.centrality ?? 0, nodeB?.centrality ?? 0);

  const completed = motifs.filter(
    (motif) =>
      motif.threadIds.includes(thread.id) &&
      motif.completedAtSequence === thread.sequence
  );
  if (completed.length > 0) {
    clauses.push(
      `it completed ${formatList(
        completed.map((motif) => `the ${capitalise(motif.kind)}`)
      )}`
    );
  }

  const edge = topology.edges.find((entry) => entry.threadId === thread.id);
  if (edge?.isGraphBridge === true) clauses.push("it is the web's only crossing");
  if (step?.closedCycle === true) clauses.push("it closed the web back on itself");
  else if (step?.joinedComponents === true) clauses.push("it joined two regions");
  if (edge?.isFacultyCrossing === true) {
    clauses.push(
      `it carries ${facultyLabel(lookup.conceptFaculty(thread.pair[0]))} into ${facultyLabel(
        lookup.conceptFaculty(thread.pair[1])
      )}`
    );
  }

  const weight =
    0.3 * centrality +
    0.25 * (completed.length > 0 ? 1 : 0) +
    0.15 * (edge?.isGraphBridge === true ? 1 : 0) +
    0.15 * (step?.closedCycle === true || step?.joinedComponents === true ? 1 : 0) +
    0.15 * (edge?.isFacultyCrossing === true ? 1 : 0);

  return { weight: quantise(clamp01(weight)), clauses };
}

// ── Ensembles ────────────────────────────────────────────────────────────────

const ENSEMBLE_STRUCTURE_BY_KIND: Readonly<
  Record<MotifDetection["kind"], EnsembleStructure>
> = Object.freeze({
  canon: "stagger",
  dialectic: "triad",
  bridge: "span",
});

function ensembleVoices(
  motif: MotifDetection,
  atBeat: number,
  lookup: RelationLookup,
  secondsPerBeat: number
): readonly PerformanceVoice[] {
  const structure = ENSEMBLE_STRUCTURE_BY_KIND[motif.kind];
  return Object.freeze(
    motif.conceptIds.map((conceptId, index) => {
      const conceptMotif = lookup.conceptMotif(conceptId);
      const offset =
        structure === "stagger"
          ? index * 1.5
          : structure === "triad"
            ? index === motif.conceptIds.length - 1
              ? 0
              : index * 0.5
            : index * 0.75;
      const register =
        structure === "triad" && conceptId === motif.focusConceptId
          ? shiftRegister(conceptMotif.register, -1)
          : structure === "span" && conceptId === motif.focusConceptId
            ? shiftRegister(conceptMotif.register, 1)
            : conceptMotif.register;
      const voiceBeat = quantiseBeats(atBeat + offset);
      const durationBeats = quantiseBeats(Math.max(2, ENSEMBLE_BEATS - offset));

      return Object.freeze({
        conceptId,
        role: "ensemble" as const,
        degrees: Object.freeze([...conceptMotif.degrees]),
        rhythm: Object.freeze([...conceptMotif.rhythm]),
        register,
        articulation: conceptMotif.articulation,
        timbre: conceptMotif.timbre,
        atBeat: voiceBeat,
        atSeconds: beatsToSeconds(voiceBeat, secondsPerBeat),
        durationBeats,
        durationSeconds: beatsToSeconds(durationBeats, secondsPerBeat),
        gain: 0.5,
        // An ensemble is a completed structure; by definition it closes.
        openEnded: false,
      });
    })
  );
}

// ── Compilation ──────────────────────────────────────────────────────────────

/**
 * Compile the session into a performance score.
 *
 * Ordering, transformation, phrasing, density, ensembles, and the climax are
 * all read from the reduced event log. Given the same state and the same
 * content pack the output is byte-identical, which is what makes the conclusion
 * a reconstruction of the session rather than a generated impression of it.
 */
export function compileConclusion(
  state: SessionStateV1,
  lookup: RelationLookup
): ConclusionPerformance {
  const topology = buildTopology(state, lookup);
  const outcomes = resolveSessionOutcomes(state, lookup);
  const motifs = detectMotifs(state, lookup);
  const steps = accreteWeb(state, lookup);

  const tempoBpm = Math.round(
    50 + 14 * topology.density + 6 * topology.tensionLoad
  );
  const secondsPerBeat = quantise(60 / tempoBpm);

  const entries: PerformanceEntry[] = [];
  let cursor = 0;

  state.threads.forEach((thread, order) => {
    const outcome = outcomes[order];
    if (outcome === undefined) return;
    const step = steps[order];
    const phrasing = phrasingOf(thread.gesture);
    const density = step?.density ?? 0;

    const isUnresolved = outcome.kind === "unresolved";
    const durationBeats = quantiseBeats(
      (BASE_ENTRY_BEATS + 2 * phrasing.breadth) *
        (isUnresolved ? UNRESOLVED_BEATS_FACTOR : 1)
    );
    // Documented and Open Thread are deliberately identical here (CAV-006).
    const dynamic = isUnresolved
      ? UNRESOLVED_DYNAMIC
      : quantise(clamp01(0.55 + 0.25 * density));
    const voiceGain = quantise(clamp01(dynamic * (0.85 + 0.3 * phrasing.weight)));

    const drafts = draftVoices(thread, outcome, lookup, phrasing);
    const { weight } = weighEntry(thread, topology, step, motifs, lookup);

    entries.push(
      Object.freeze({
        threadId: thread.id,
        order,
        sequence: thread.sequence,
        conceptIds: thread.pair,
        intention: thread.intention,
        transformation: TRANSFORMATIONS[thread.intention],
        outcomeKind: outcome.kind,
        atBeat: cursor,
        atSeconds: beatsToSeconds(cursor, secondsPerBeat),
        durationBeats,
        durationSeconds: beatsToSeconds(durationBeats, secondsPerBeat),
        voices: Object.freeze(
          drafts.map((draft) =>
            realiseVoice(draft, cursor, durationBeats, voiceGain, secondsPerBeat)
          )
        ),
        dynamic,
        density,
        phrasing,
        resolved: outcome.kind === "documented" && thread.intention !== "tension",
        weight,
      })
    );

    // A sparser web breathes more between entries; a dense one runs on.
    cursor = quantiseBeats(cursor + durationBeats + (1 - density) * 2);
  });

  const entryByThread = new Map(entries.map((entry) => [entry.threadId, entry]));

  const ensembles: PerformanceEnsemble[] = motifs.map((motif) => {
    const completing = motif.threadIds
      .map((threadId) => entryByThread.get(threadId))
      .filter((entry): entry is PerformanceEntry => entry !== undefined)
      .sort((a, b) => a.sequence - b.sequence);
    const last = completing[completing.length - 1];
    const atBeat = quantiseBeats(
      last === undefined ? 0 : last.atBeat + last.durationBeats
    );

    return Object.freeze({
      key: motif.key,
      motifKind: motif.kind,
      structure: ENSEMBLE_STRUCTURE_BY_KIND[motif.kind],
      atBeat,
      atSeconds: beatsToSeconds(atBeat, secondsPerBeat),
      durationBeats: ENSEMBLE_BEATS,
      durationSeconds: beatsToSeconds(ENSEMBLE_BEATS, secondsPerBeat),
      conceptIds: motif.conceptIds,
      threadIds: motif.threadIds,
      voices: ensembleVoices(motif, atBeat, lookup, secondsPerBeat),
      reason: motif.reason,
    });
  });

  const heldTensionThreads = new Set<ThreadId>();
  for (const motif of motifs) {
    if (motif.kind !== "dialectic" || motif.focusThreadId === null) continue;
    heldTensionThreads.add(motif.focusThreadId);
  }

  const unresolved: readonly UnresolvedVoice[] = Object.freeze(
    entries
      .filter(
        (entry) =>
          entry.intention === "tension" && !heldTensionThreads.has(entry.threadId)
      )
      .map((entry) => {
        const fromBeat = quantiseBeats(entry.atBeat + entry.durationBeats);
        return Object.freeze({
          threadId: entry.threadId,
          conceptIds: entry.conceptIds,
          fromBeat,
          fromSeconds: beatsToSeconds(fromBeat, secondsPerBeat),
          gain: entry.dynamic,
          floorGain: TENSION_FLOOR_GAIN,
          decayToFloorSeconds: TENSION_DECAY_SECONDS,
          reason: `The ${INTENTION_LABELS[entry.intention]} between ${lookup.conceptName(
            entry.conceptIds[0]
          )} and ${lookup.conceptName(
            entry.conceptIds[1]
          )} was never taken hold of, and is not resolved here.`,
        });
      })
  );

  let climax: PerformanceClimax | null = null;
  for (const entry of entries) {
    if (climax === null || entry.weight >= climax.weight) {
      const thread = state.threads[entry.order] as CommittedThreadV1;
      const { clauses } = weighEntry(
        thread,
        topology,
        steps[entry.order],
        motifs,
        lookup
      );
      climax = {
        threadId: entry.threadId,
        order: entry.order,
        atBeat: entry.atBeat,
        atSeconds: entry.atSeconds,
        weight: entry.weight,
        reason:
          clauses.length === 0
            ? `The ${INTENTION_LABELS[entry.intention]} between ${lookup.conceptName(
                entry.conceptIds[0]
              )} and ${lookup.conceptName(
                entry.conceptIds[1]
              )} carries the most of this web, quiet as it is.`
            : `The ${INTENTION_LABELS[entry.intention]} between ${lookup.conceptName(
                entry.conceptIds[0]
              )} and ${lookup.conceptName(entry.conceptIds[1])} is where the web gathers: ${formatList(clauses)}.`,
      };
    }
  }

  const lastEntry = entries[entries.length - 1];
  const lastEnsembleEnd = ensembles.reduce(
    (max, ensemble) => Math.max(max, ensemble.atBeat + ensemble.durationBeats),
    0
  );
  const totalBeats = quantiseBeats(
    Math.max(
      lastEntry === undefined ? 0 : lastEntry.atBeat + lastEntry.durationBeats,
      lastEnsembleEnd
    ) + CODA_BEATS
  );

  const camera: CameraHint[] = [];
  for (const entry of entries) {
    const step = steps[entry.order];
    camera.push(
      Object.freeze({
        atBeat: entry.atBeat,
        atSeconds: entry.atSeconds,
        kind: CAMERA_BY_INTENTION[entry.intention],
        conceptIds: Object.freeze([entry.conceptIds[0], entry.conceptIds[1]]),
        threadId: entry.threadId,
        reason:
          step?.joinedComponents === true
            ? `${INTENTION_LABELS[entry.intention]} joins two regions that were apart.`
            : `${INTENTION_LABELS[entry.intention]} between two beads already in the web.`,
      })
    );
  }
  for (const ensemble of ensembles) {
    camera.push(
      Object.freeze({
        atBeat: ensemble.atBeat,
        atSeconds: ensemble.atSeconds,
        kind: "gather",
        conceptIds: ensemble.conceptIds,
        threadId: null,
        reason: ensemble.reason,
      })
    );
  }
  if (climax !== null) {
    camera.push(
      Object.freeze({
        atBeat: climax.atBeat,
        atSeconds: climax.atSeconds,
        kind: "widen",
        conceptIds: Object.freeze([]),
        threadId: climax.threadId,
        reason: climax.reason,
      })
    );
  }
  camera.push(
    Object.freeze({
      atBeat: quantiseBeats(Math.max(0, totalBeats - CODA_BEATS)),
      atSeconds: beatsToSeconds(
        quantiseBeats(Math.max(0, totalBeats - CODA_BEATS)),
        secondsPerBeat
      ),
      kind: "rest",
      conceptIds: Object.freeze([]),
      threadId: null,
      reason:
        unresolved.length > 0
          ? "The performance ends without resolving what was left open."
          : "The performance ends.",
    })
  );
  camera.sort((a, b) => a.atBeat - b.atBeat);

  return Object.freeze({
    sessionId: state.sessionId,
    seed: state.seed,
    tempoBpm,
    beatsPerBar: BEATS_PER_BAR,
    secondsPerBeat,
    entries: Object.freeze(entries),
    ensembles: Object.freeze(ensembles),
    unresolved,
    camera: Object.freeze(camera),
    climax: climax === null ? null : Object.freeze(climax),
    totalBeats,
    totalSeconds: beatsToSeconds(totalBeats, secondsPerBeat),
  });
}
