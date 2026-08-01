/**
 * THE CASTALIA CONTENT PACK — SCHEMA
 *
 * The game IS this data. Everything downstream — outcome resolution, motif
 * detection, the cue planner, bead shaders, concept motifs, the conclusion
 * compiler — reads these types and nothing else. Authored data is validated at
 * build time and at every persistence boundary (ADR-007).
 *
 * Two rules govern every field here:
 *
 *  1. Intellectual honesty is structural, not editorial. A relation cannot be
 *     authored without declaring what kind of claim it makes and how well that
 *     claim is evidenced. There is no field in which a fabricated influence can
 *     hide, because `relationType` forces the author to say whether they are
 *     asserting transmission or noticing a correspondence.
 *
 *  2. Silence beats pseudo-profundity. A pair with nothing credible to say
 *     produces no DocumentedRelation at all; it falls through to an Open Thread
 *     or to an honest unresolved state. Authoring nothing is always available.
 */
import type { RelationIntention } from "@/domain/events";

// ─── Faculties ──────────────────────────────────────────────────────────────

/**
 * The slice reframes disciplines as faculties of thought (VERTICAL-SLICE-SPEC
 * §3). Note that `faculty` in the legacy progression code means "a fully
 * discovered discipline"; these are unrelated and the legacy usage is being
 * removed with the legacy content pack.
 */
export const FACULTY_IDS = ["measure", "sound", "matter", "image"] as const;
export type FacultyId = (typeof FACULTY_IDS)[number];

export interface Faculty {
  readonly id: FacultyId;
  /** Player-facing name. */
  readonly name: string;
  /** One line of orientation, shown at most once. */
  readonly gloss: string;
  /**
   * Faculties are legible without color: each owns a construction geometry that
   * its beads' internal figures are drawn with, and a distinct instrument body.
   */
  readonly geometry: SigilFamily;
  /** Ink hue. Never the sole carrier of meaning (VERTICAL-SLICE-SPEC §19). */
  readonly ink: string;
  /** The faculty's quadrant on the armillary, in turns [0,1). */
  readonly bearing: number;
}

// ─── Facets ─────────────────────────────────────────────────────────────────

/**
 * A facet is a normalized structural property two concepts can genuinely share.
 * Facets — not authored endpoint lists — are what make resonance perceptible
 * before commitment (CAV-003), what Open Threads are built from, and what the
 * Canon motif detects recurring across the web.
 */
export interface Facet {
  readonly id: FacetId;
  readonly name: string;
  /** Player-facing, ≤ 110 chars. Appears in Open Thread questions. */
  readonly gloss: string;
}

export type FacetId = string & { readonly __brand: "FacetId" };
export const toFacetId = (value: string): FacetId => value as FacetId;

// ─── Concepts ───────────────────────────────────────────────────────────────

/**
 * Granularity rule (VERTICAL-SLICE-SPEC §4, director decision CAV-005): a slice
 * concept must be specific enough to have perceptible structure. Whole fields
 * ("mathematics") and whole eras ("the Renaissance") are forbidden.
 */
export const CONCEPT_KINDS = [
  "theorem",
  "technique",
  "work",
  "phenomenon",
  "instrument",
  "formation",
  "pattern",
  "idea",
] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

export interface CastaliaConcept {
  readonly id: string;
  readonly name: string;
  readonly faculty: FacultyId;
  readonly kind: ConceptKind;
  /** The bead's caption. ≤ 72 chars, no trailing period. */
  readonly caption: string;
  /** Inspection text. 2–4 sentences, concrete, no mystification. */
  readonly description: string;
  /** 2–4 facets. These drive resonance, Open Threads, and Canon detection. */
  readonly facets: readonly FacetId[];
  /** Where the idea sits in time, for the manuscript margin. */
  readonly era: string;
  readonly motif: ConceptMotif;
  readonly sigil: ConceptSigil;
  readonly standing: TranscendentalStanding;
}

/**
 * WHERE THE GAME READS A CONCEPT ON CASTALIA'S OWN THREE AXES.
 *
 * True, Beautiful and Good are the frame Hesse's Castalia is built on, and the
 * Lens exists to rearrange the arena along them. They are the one place in this
 * pack where the Game says something it cannot cite.
 *
 * So they are declared, loudly, as what they are: **a reading the Game offers,
 * never a measurement of the concept.** Prime Numbers does not possess a
 * quantity of truth. What this records is where the Game would place it if
 * asked, and the Lens says so on screen every time it opens — the same
 * distinction the content model already draws between a record and a reading,
 * applied to the one arrangement that could not be sourced.
 *
 * Read them as: how far the idea is a claim about what *is* (`truth`); how far
 * it is valued for its form (`beauty`); how far it concerns what should be made
 * or done (`good`). Each in [-1, 1]. A player who disagrees with a position is
 * having exactly the argument the Lens is for.
 */
export interface TranscendentalStanding {
  readonly truth: number;
  readonly beauty: number;
  readonly good: number;
}

// ─── Musical identity ───────────────────────────────────────────────────────

/**
 * Director decision CAV-008: concept musical identity is authored as
 * deterministic composed data through the slice — a real motif, not a single
 * note and not a recorded asset. `playVoice()` remains the one place a note is
 * born, so recordings can replace synthesis later without touching content.
 */
export interface ConceptMotif {
  /**
   * Scale degrees relative to the world's mode, as a contour. Negative values
   * descend below the tonic. 2–5 entries — a motif, not a melody.
   */
  readonly degrees: readonly number[];
  /** Relative durations aligned to `degrees`, in sixteenths of a phrase slot. */
  readonly rhythm: readonly number[];
  readonly register: MotifRegister;
  readonly articulation: MotifArticulation;
  readonly timbre: TimbreId;
}

export const MOTIF_REGISTERS = ["sub", "low", "mid", "high", "air"] as const;
export type MotifRegister = (typeof MOTIF_REGISTERS)[number];

export const MOTIF_ARTICULATIONS = [
  "struck",
  "plucked",
  "bowed",
  "breathed",
  "sustained",
  "rung",
] as const;
export type MotifArticulation = (typeof MOTIF_ARTICULATIONS)[number];

export const TIMBRE_IDS = [
  "glass",
  "gut",
  "reed",
  "metal",
  "wood",
  "voice",
] as const;
export type TimbreId = (typeof TIMBRE_IDS)[number];

// ─── Visual identity ────────────────────────────────────────────────────────

/**
 * Every bead contains a recognizable internal figure (VERTICAL-SLICE-SPEC §17)
 * drawn as an illuminated diagram inside optical glass. These parameters drive
 * one procedural shader; they are deliberately few, because a concept should be
 * identifiable by its figure at a glance rather than by reading a caption.
 */
export const SIGIL_FAMILIES = [
  "spiral",
  "lattice",
  "wave",
  "orbit",
  "fold",
  "ray",
  "grid",
  "branch",
  "vessel",
  "arc",
] as const;
export type SigilFamily = (typeof SIGIL_FAMILIES)[number];

export interface ConceptSigil {
  readonly family: SigilFamily;
  /** Rotational order of the figure, 1–12. 1 means no rotational symmetry. */
  readonly symmetry: number;
  /** How much of the bead's interior the figure fills, 0–1. */
  readonly density: number;
  /** Departure from ideal construction, 0–1. Ink behaves, or it does not. */
  readonly turbulence: number;
  /** Whether the figure is inscribed in gold leaf rather than ink. */
  readonly gilded: boolean;
}

// ─── Evidence ───────────────────────────────────────────────────────────────

/**
 * Evidence class answers "how well is this claim supported?" and is deliberately
 * independent of conceptual depth, rarity, and aesthetic intensity
 * (ARCHITECTURE §12). A merely `interpretive` relation may be the most beautiful
 * thing in the web; it simply must not pretend to be `established`.
 */
export const EVIDENCE_CLASSES = [
  /** Standard, uncontroversial content of the field; found in any reference. */
  "established",
  /** A specific documented instance, tied to a named work, score, or record. */
  "attested",
  /** Specialists actively disagree. The disagreement must be stated. */
  "contested",
  /**
   * A structural reading the Game offers as an interpretation. Asserts no
   * historical influence and no factual claim beyond the structures compared.
   */
  "interpretive",
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/**
 * Relation type is the underlying, authored classification — separate from the
 * player's declared intention, which is their reading (CAV-001). The Game may
 * confirm, refine, or complicate that reading; it never scores it as wrong.
 *
 * `historical-transmission` is the only type that asserts influence, and the
 * validator requires it to carry at least one non-`interpretive` source. This
 * is the structural guarantee that the Game cannot invent influence.
 */
export const RELATION_TYPES = [
  "structural-correspondence",
  "historical-transmission",
  "formal-ground",
  "material-ground",
  "opposition",
  "instantiation",
  "reframing",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const SOURCE_KINDS = [
  "book",
  "article",
  "reference",
  "score",
  "primary",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface Source {
  readonly id: string;
  /** Full human-readable citation, shown verbatim in the Codex. */
  readonly citation: string;
  readonly kind: SourceKind;
  /** Chapter, page, bar numbers, catalogue number — where to actually look. */
  readonly locator?: string;
}

/**
 * How well a documented relation supports each of the four player intentions.
 * CAV-002: never promise all four. An `unsupported` reading is not a failure —
 * it becomes a specific Open Thread that names what is missing.
 */
export const INTENTION_FITS = ["primary", "supported", "partial", "unsupported"] as const;
export type IntentionFit = (typeof INTENTION_FITS)[number];

export interface DocumentedRelation {
  readonly id: string;
  /** Sorted concept ids. Canonical id is these two joined with '~'. */
  readonly pair: readonly [string, string];
  /** ≤ 56 chars. Names the relation, never praises the player. */
  readonly title: string;
  readonly relationType: RelationType;
  readonly evidence: EvidenceClass;
  /**
   * Exactly one intention is `primary`; the rest are graded honestly. Every
   * intention must appear, so an author cannot quietly omit an awkward reading.
   */
  readonly fit: Readonly<Record<RelationIntention, IntentionFit>>;
  /** 2–3 sentences. At least one concrete mechanism, work, person, or date. */
  readonly insight: string;
  /** Facets both concepts genuinely carry. Must be a subset of both. */
  readonly sharedFacets: readonly FacetId[];
  /** Required for `historical-transmission`: [from, to]. Forbidden otherwise. */
  readonly direction?: readonly [string, string];
  /**
   * The honest complication. Required for `contested`, and strongly encouraged
   * everywhere else — a relation that admits nothing is usually overstated.
   */
  readonly counterpoint?: string;
  readonly sources: readonly string[];
}

// ─── Open Threads ───────────────────────────────────────────────────────────

/**
 * An Open Thread is what an interpretable but undocumented pairing becomes. It
 * is built from a facet the two concepts actually share plus the intention the
 * player declared — so the question it asks is specific to *their* reading and
 * could not have been written in advance for a generic pair.
 *
 * Templates receive `{a}`, `{b}`, and `{facet}`. Copy must be a question the
 * player could genuinely pursue, never praise and never invented influence.
 */
export interface OpenThreadPrompt {
  readonly id: string;
  readonly intention: RelationIntention;
  /** Restrict to a facet, or leave undefined for the intention's fallback. */
  readonly facet?: FacetId;
  /** Contains `{a}` and `{b}`; may contain `{facet}`. Ends with '?'. */
  readonly question: string;
}

// ─── Pack ───────────────────────────────────────────────────────────────────

export interface CastaliaPack {
  readonly version: string;
  readonly faculties: readonly Faculty[];
  readonly facets: readonly Facet[];
  readonly concepts: readonly CastaliaConcept[];
  readonly sources: readonly Source[];
  readonly relations: readonly DocumentedRelation[];
  readonly openThreads: readonly OpenThreadPrompt[];
}

/** Canonical unordered-pair key for a documented relation. */
export const relationKey = (a: string, b: string): string =>
  a < b ? `${a}~${b}` : `${b}~${a}`;
