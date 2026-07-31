/**
 * THE CAPTIONED PATH — the same information, in words.
 *
 * VERTICAL-SLICE-SPEC §22 requires "captions or textual equivalents for critical
 * audio meaning". `src/runtime/captions` already turns *cues* into prose: what
 * happened, and how firmly the Game stands behind it. This file does the other
 * half, which nothing else can do, because nothing else knows it: what the music
 * is actually doing.
 *
 * The two are complementary and both are needed. A caption that says "Echo —
 * shares a form" tells a muted player the meaning. It does not tell them that
 * Counterpoint answered Fibonacci's figure a fifth higher, half a phrase later,
 * in its own body — which is the thing a hearing player receives, and which is
 * the whole reason the grammar was built. So this module reads the plan, not the
 * cue, and describes the transformation itself.
 *
 * Copy rules, enforced by tests:
 *  - never praise the player;
 *  - never assert a fact the plan did not carry — no influence, no history, no
 *    interpretation, only what is sounding;
 *  - always say whether the phrase closes, because that is the distinction
 *    CAV-006 rests on and it is the hardest thing to hear;
 *  - short enough to be spoken over the moment it describes.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type { RelationIntention } from "@/domain/events";
import type { MotifRegister, TimbreId } from "@/content/castalia/schema";
import type { AttentionSpacePlan } from "./attention";
import type { AttunementPlan } from "./attunement";
import type { ConclusionAudioPlan } from "./conclusion";
import { pitchClass } from "./mode";
import type { VoicePlan } from "./plan";

export interface AudioNames {
  /** Player-facing concept name. Falls back to the id rather than to silence. */
  readonly conceptName: (id: string) => string;
}

/** Interval names as a listener would hear them, not as a theorist writes them. */
const INTERVAL_NAME: readonly string[] = Object.freeze([
  "the same pitch",
  "a semitone",
  "a whole tone",
  "a minor third",
  "a major third",
  "a fourth",
  "a tritone",
  "a fifth",
  "a minor sixth",
  "a major sixth",
  "a minor seventh",
  "a major seventh",
]);

export function intervalPhrase(semitones: number): string {
  const octaves = Math.floor(Math.abs(semitones) / 12);
  const name = INTERVAL_NAME[pitchClass(semitones)];
  if (octaves === 0) return name;
  if (pitchClass(semitones) === 0) {
    return octaves === 1 ? "an octave" : `${octaves} octaves`;
  }
  return octaves === 1 ? `a compound ${name.replace(/^an? /, "")}` : name;
}

const TIMBRE_PHRASE: Readonly<Record<TimbreId, string>> = Object.freeze({
  glass: "glass",
  gut: "gut string",
  reed: "reed",
  metal: "struck metal",
  wood: "wood",
  voice: "voice",
});

const REGISTER_PHRASE: Readonly<Record<MotifRegister, string>> = Object.freeze({
  sub: "the lowest register",
  low: "a low register",
  mid: "the middle register",
  high: "a high register",
  air: "the top of the range",
});

/** What each grammar does, in one clause. Matches the accepted vocabulary (I-007). */
export const GRAMMAR_PHRASE: Readonly<Record<RelationIntention, string>> =
  Object.freeze({
    echo: "one figure answered by the same figure in another voice",
    passage: "one figure crossing into the other",
    tension: "two pitches held against each other",
    ground: "one pitch held still beneath the other",
  });

const nameOf = (id: string | null, names: AudioNames): string =>
  id === null ? "the score" : names.conceptName(id);

function describeEcho(plan: VoicePlan, names: AudioNames): string {
  const [a, b] = plan.meta.conceptIds;
  const answer = plan.notes.find((note) => note.role === "answer");
  const interval = plan.meta.interval ?? 0;
  const body = answer ? TIMBRE_PHRASE[answer.timbre] : "another body";
  const close = plan.meta.resolves
    ? "The two entries settle on one pitch."
    : "The answer stops on an unsettled pitch and stays there.";
  return `Echo. ${nameOf(a, names)}'s figure returns in ${nameOf(b, names)}'s ${body}, ${intervalPhrase(interval)} higher and entering later, with the same rhythm. ${close}`;
}

function describePassage(plan: VoicePlan, names: AudioNames): string {
  const [a, b] = plan.meta.conceptIds;
  const first = plan.notes[0];
  const last = [...plan.notes]
    .filter((note) => note.role !== "residue")
    .sort((left, right) => left.atSeconds - right.atSeconds)
    .pop();
  const from = first ? TIMBRE_PHRASE[first.timbre] : "one body";
  const to = last ? TIMBRE_PHRASE[last.timbre] : "another body";
  const registerMove =
    first && last && first.register !== last.register
      ? ` and from ${REGISTER_PHRASE[first.register]} to ${REGISTER_PHRASE[last.register]}`
      : "";
  const close = plan.meta.resolves
    ? "The line arrives."
    : "The line stops short of arriving.";
  return `Passage. One line begins as ${nameOf(a, names)} and ends as ${nameOf(b, names)}, changing from ${from} to ${to}${registerMove}. ${close}`;
}

function describeTension(plan: VoicePlan, names: AudioNames): string {
  const [a, b] = plan.meta.conceptIds;
  const interval = plan.meta.interval ?? 13;
  const hz = plan.meta.beatingHz ?? 0;
  const rate = hz > 0 ? `, beating ${hz.toFixed(1)} times a second` : "";
  return `Tension. ${nameOf(a, names)} and ${nameOf(b, names)} hold ${intervalPhrase(interval)} against each other${rate}. It thins to a low floor and does not resolve.`;
}

function describeGround(plan: VoicePlan, names: AudioNames): string {
  const [base, above] = plan.meta.conceptIds;
  const pedal = plan.notes.find((note) => note.role === "pedal");
  const where = pedal ? REGISTER_PHRASE[pedal.register] : "a low register";
  const close = plan.meta.resolves
    ? "The motif above closes over it."
    : "The motif above ends unsettled; the base does not move.";
  return `Ground. ${nameOf(base, names)} holds one unchanging pitch in ${where} while ${nameOf(above, names)}'s figure continues above it. ${close}`;
}

/**
 * One sentence describing what a plan is doing musically. Returns null only for
 * a plan with nothing to say — never for a plan that made a sound.
 */
export function describeVoicePlan(
  plan: VoicePlan,
  names: AudioNames
): string | null {
  switch (plan.intention) {
    case "echo":
      return describeEcho(plan, names);
    case "passage":
      return describePassage(plan, names);
    case "tension":
      return describeTension(plan, names);
    case "ground":
      return describeGround(plan, names);
    default:
      break;
  }
  // Two plans deliberately say nothing here. A weave landing and an armed
  // intention are already captioned by `src/runtime/captions` from the cue
  // itself, in the player's vocabulary; describing them a second time in
  // musical terms would turn the caption track into noise, and a caption track
  // that can be ignored is not an accessible path.
  if (plan.meta.grammar === "landing" || plan.meta.grammar.startsWith("armed:")) {
    return null;
  }
  if (plan.kind === "attention") {
    const [id] = plan.meta.conceptIds;
    return `${nameOf(id ?? null, names)}'s figure is sounding on its own.`;
  }
  if (plan.kind === "ensemble") {
    const names_ = plan.meta.conceptIds.map((id) => names.conceptName(id));
    return names_.length === 0
      ? null
      : `An ensemble enters: ${names_.join(", ")}.`;
  }
  return null;
}

export function describeAttentionSpace(
  plan: AttentionSpacePlan,
  names: AudioNames
): string {
  const [id] = plan.foreground.meta.conceptIds;
  const how =
    plan.spaceMode === "call-and-response"
      ? "The score answers in turn, leaving silence between statements"
      : "The score thins out";
  return `${how}. ${nameOf(id ?? null, names)}'s figure sounds in front of it.`;
}

export function describeAttunement(
  plan: AttunementPlan,
  names: AudioNames
): string {
  if (plan.channels.length === 0) {
    return "Attunement. Nothing is woven yet, so there is nothing to sound one at a time.";
  }
  const listed = plan.channels
    .map((channel) => {
      const [a, b] = channel.plan.meta.conceptIds;
      return `${names.conceptName(a)} and ${names.conceptName(b)}`;
    })
    .join("; then ");
  return `Attunement. Each thread sounds on its own, in the order you wove them: ${listed}.`;
}

export function describeConclusion(
  plan: ConclusionAudioPlan,
  names: AudioNames
): string {
  const entries = plan.sections.filter((section) => section.kind === "entry");
  const unresolved = plan.sections.filter(
    (section) => section.kind === "unresolved"
  );
  const ensembles = plan.sections.filter(
    (section) => section.kind === "ensemble"
  );
  const parts = [
    `The web is performed in the order you made it: ${entries.length} ${entries.length === 1 ? "thread" : "threads"}.`,
  ];
  if (ensembles.length > 0) {
    parts.push(
      `${ensembles.length} completed ${ensembles.length === 1 ? "motif enters" : "motifs enter"} as an ensemble.`
    );
  }
  if (unresolved.length > 0) {
    const named = unresolved
      .map((section) => {
        const [a, b] = section.plan.meta.conceptIds;
        return `${names.conceptName(a)} and ${names.conceptName(b)}`;
      })
      .join("; ");
    parts.push(`Still unresolved, and left so: ${named}.`);
  }
  return parts.join(" ");
}
