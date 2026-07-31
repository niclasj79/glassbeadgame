/**
 * THE CONCEPT MOTIF RENDERER
 *
 * CAV-008 resolved concept musical identity toward the composed end: each of the
 * twenty-four beads owns an authored `ConceptMotif` — a real contour, an aligned
 * rhythm, a register, an articulation, and a timbre body. That data lives in
 * `src/content/castalia/concepts.ts` and is read here, never written.
 *
 * This file turns one motif into scheduled voices. The whole design goal is
 * *recognisability*: a player should be able to learn Fibonacci by ear. Three
 * things carry that, and none of them may be randomised —
 *
 *  1. the contour, rendered at exact interval ratios through the world mode;
 *  2. the rhythm, rendered on one shared grid so a motif keeps its gait;
 *  3. the articulation, which decides envelope shape rather than being decoration.
 *
 * Gesture phrasing may bend timing and weight, and does so deterministically
 * from the plan id. It may never change which notes sound (I-009: gesture
 * changes articulation and phrasing, never intellectual validity — and it never
 * changes identity either, or the motif stops being learnable).
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type {
  ConceptMotif,
  MotifArticulation,
  MotifRegister,
  TimbreId,
} from "@/content/castalia/schema";
import { hashString } from "@/lib/utils";
import { clampLifetimeSeconds } from "./comfort";
import { degreeFrequency, type WorldMode } from "./mode";
import type { AudioVoiceRole, PlannedNote, VoiceEnvelope } from "./plan";

/** A concept and the motif it owns. The pair travels together everywhere. */
export interface MotifSource {
  readonly conceptId: string;
  readonly motif: ConceptMotif;
}

/**
 * Gesture, normalised. Structurally the subset of the domain's `PhrasingProfile`
 * that audio actually uses; declared locally so `src/domain/performance` and
 * `src/audio` stay independently editable.
 *
 * Neutral is 0.5 for every field, never 0. A keyboard weave supplies no path
 * length; that is an absence of information, not a weak gesture (I-009).
 */
export interface AudioPhrasing {
  /** Sharpness of onset. 1 = immediate, 0 = drawn. */
  readonly attack: number;
  /** Connectedness. 1 = notes overlap, 0 = notes detach. */
  readonly legato: number;
  /** Elasticity of timing. 1 = markedly elastic, 0 = metronomic. */
  readonly rubato: number;
  /** Body. Scales level within a narrow band. */
  readonly weight: number;
  /** Span. Scales the rhythmic unit within a narrow band. */
  readonly breadth: number;
}

export const NEUTRAL_PHRASING: AudioPhrasing = Object.freeze({
  attack: 0.5,
  legato: 0.5,
  rubato: 0.5,
  weight: 0.5,
  breadth: 0.5,
});

/**
 * Articulation → envelope shape, as fractions of the note's rhythmic length.
 * `tail` extends the note past its slot: a rung bell overlaps what follows, a
 * struck one does not. This table is the single reason six articulations are
 * distinguishable by ear.
 */
export const ARTICULATION_SHAPE: Readonly<
  Record<
    MotifArticulation,
    { readonly attack: number; readonly hold: number; readonly release: number }
  >
> = Object.freeze({
  /** Immediate onset, almost no body, quick fall. */
  struck: Object.freeze({ attack: 0.004, hold: 0.06, release: 0.9 }),
  /** Immediate onset, short body, a plucked string's decay. */
  plucked: Object.freeze({ attack: 0.008, hold: 0.1, release: 0.75 }),
  /** The bow takes hold: an audible approach and a full body. */
  bowed: Object.freeze({ attack: 0.3, hold: 0.55, release: 0.5 }),
  /** Air first, then tone; falls away rather than stopping. */
  breathed: Object.freeze({ attack: 0.38, hold: 0.42, release: 0.8 }),
  /** Slow in, slow out, and it overlaps whatever follows. */
  sustained: Object.freeze({ attack: 0.45, hold: 0.85, release: 1.15 }),
  /** Struck and left to ring far past its slot. */
  rung: Object.freeze({ attack: 0.005, hold: 0.08, release: 1.9 }),
});

const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

/** Deterministic 0–1 from a string. Replaces every `Math.random()` in phrasing. */
export function deterministicUnit(seed: string): number {
  return hashString(seed) / 4294967296;
}

/**
 * The rhythmic unit *after* gesture has bent it.
 *
 * Breadth stretches a motif's gait a little. Everything that has to land on the
 * grid must therefore be measured in this unit rather than the nominal one —
 * the review found Echo's stagger computed in nominal units and then laid
 * alongside a subject rendered in phrased ones, which put the imitation off the
 * grid under every gesture except the neutral one.
 */
export function phrasedUnitSeconds(
  unitSeconds: number,
  phrasing: AudioPhrasing = NEUTRAL_PHRASING
): number {
  return unitSeconds * (0.85 + clamp01(phrasing.breadth) * 0.3);
}

/**
 * Envelope for one note. Articulation sets the shape; phrasing bends it inside
 * bounds tight enough that a motif keeps its identity under any gesture.
 */
export function envelopeFor(
  articulation: MotifArticulation,
  lengthSeconds: number,
  phrasing: AudioPhrasing = NEUTRAL_PHRASING
): VoiceEnvelope {
  const shape = ARTICULATION_SHAPE[articulation];
  const length = Math.max(0.05, lengthSeconds);
  // A sharp gesture halves the approach; a drawn one doubles it. Percussive
  // articulations barely move, because a struck note with a slow attack is no
  // longer a struck note.
  const attackScale = 1.5 - clamp01(phrasing.attack);
  const legatoScale = 0.75 + clamp01(phrasing.legato) * 0.7;
  const attack = Math.min(length * 0.6, shape.attack * length * attackScale + 0.002);
  const hold = shape.hold * length * legatoScale;
  const release = shape.release * length * legatoScale;
  const total = clampLifetimeSeconds(attack + hold + release);
  const scale = total > 0 && attack + hold + release > total
    ? total / (attack + hold + release)
    : 1;
  return Object.freeze({
    attack: Number((attack * scale).toFixed(5)),
    hold: Number((hold * scale).toFixed(5)),
    release: Number((release * scale).toFixed(5)),
  });
}

/** Total rhythmic units a motif occupies. */
export function motifUnits(motif: ConceptMotif): number {
  let total = 0;
  for (let i = 0; i < motif.degrees.length; i++) {
    total += Math.max(1, motif.rhythm[i] ?? 1);
  }
  return total;
}

export interface RenderMotifOptions {
  readonly mode: WorldMode;
  /** Plan-relative start, in seconds. */
  readonly at: number;
  /** Length of one rhythm unit — a sixteenth of the world's phrase slot. */
  readonly unitSeconds: number;
  readonly gain: number;
  readonly role: AudioVoiceRole;
  /** Stable prefix for voice ids. Also seeds deterministic phrasing. */
  readonly idPrefix: string;
  /** Override the authored timbre — this is how Echo lends B's body to A. */
  readonly timbre?: TimbreId;
  readonly register?: MotifRegister;
  readonly articulation?: MotifArticulation;
  /** Semitones added to every degree. */
  readonly transpose?: number;
  readonly phrasing?: AudioPhrasing;
  readonly detuneCents?: number;
  readonly floorGain?: number;
  /**
   * Replace the final degree so the line ends unresolved. The caller supplies
   * the degree, because "unresolved" is a mode question, not a motif question.
   */
  readonly finalDegree?: number;
  /** Marks every note as not closing. Captions and shaders both read this. */
  readonly openEnded?: boolean;
  /** Marks every note as part of a deliberately tense simultaneity (CAV-007). */
  readonly tense?: boolean;
}

/**
 * Render a motif into notes.
 *
 * The rhythm array is authored in sixteenths of a phrase slot and is aligned to
 * `degrees` index-for-index; a missing entry counts as one unit rather than
 * throwing, because a content defect should degrade to a shorter note and not
 * to a silent session.
 */
export function renderMotif(
  source: MotifSource,
  options: RenderMotifOptions
): readonly PlannedNote[] {
  const { motif } = source;
  const phrasing = options.phrasing ?? NEUTRAL_PHRASING;
  const timbre = options.timbre ?? motif.timbre;
  const register = options.register ?? motif.register;
  const articulation = options.articulation ?? motif.articulation;
  const transpose = options.transpose ?? 0;
  const openEnded = options.openEnded ?? false;

  // Breadth stretches the gait a little; bounded so a motif stays recognisable.
  const unit = phrasedUnitSeconds(options.unitSeconds, phrasing);
  // Weight moves level inside a narrow band. It never silences and never shouts.
  const gain = options.gain * (0.82 + clamp01(phrasing.weight) * 0.36);
  const rubato = clamp01(phrasing.rubato);

  const notes: PlannedNote[] = [];
  let cursor = options.at;

  for (let index = 0; index < motif.degrees.length; index++) {
    const units = Math.max(1, motif.rhythm[index] ?? 1);
    const length = unit * units;
    const isLast = index === motif.degrees.length - 1;
    const degree =
      (isLast && options.finalDegree !== undefined
        ? options.finalDegree
        : motif.degrees[index]) + transpose;

    // Deterministic micro-timing: same plan, same push, every replay. Bounded
    // to a twelfth of a unit so the grid never actually breaks.
    const sway =
      (deterministicUnit(`${options.idPrefix}:${index}`) - 0.5) *
      rubato *
      unit *
      0.16;

    notes.push(
      Object.freeze({
        id: `${options.idPrefix}:${index}`,
        conceptId: source.conceptId,
        role: options.role,
        timbre,
        articulation,
        register,
        degree,
        frequency: degreeFrequency(options.mode, degree, register),
        detuneCents: options.detuneCents ?? 0,
        atSeconds: Number(Math.max(0, cursor + sway).toFixed(5)),
        envelope: envelopeFor(articulation, length, phrasing),
        gain: Number(gain.toFixed(5)),
        floorGain: options.floorGain ?? 0,
        openEnded: openEnded && isLast,
        tense: options.tense ?? false,
      })
    );
    cursor += length;
  }

  return Object.freeze(notes);
}

/** Seconds a rendered motif occupies on the grid, ignoring release tails. */
export function motifSpanSeconds(
  motif: ConceptMotif,
  unitSeconds: number,
  phrasing: AudioPhrasing = NEUTRAL_PHRASING
): number {
  return motifUnits(motif) * phrasedUnitSeconds(unitSeconds, phrasing);
}

/**
 * The degree that identifies a motif — its first, which is the one a listener
 * anchors to. Used wherever a whole concept must be represented by one pitch.
 */
export function anchorDegree(motif: ConceptMotif): number {
  return motif.degrees[0] ?? 0;
}
