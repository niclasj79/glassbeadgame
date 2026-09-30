import { describeCue, type CaptionContext, type CueCaption } from "@/runtime/captions";
import type { CueType, PresentationCue } from "@/runtime/cues";

/**
 * THE WORLD'S VOICE, IN TEXT.
 *
 * `src/runtime/captions/describeCue.ts` has turned cues into prose since the
 * slice was written and, until this file existed, nothing in the application
 * called it — `grep -rn "runtime/captions" src/` outside its own directory
 * returned tests and two comments. The consequence was not subtle: a screen
 * reader player finished a whole Game without once being told whether a
 * relation was documented, contested, or a reading the Game offers. That is the
 * single distinction the entire content model exists to preserve.
 *
 * TWO REGIONS, NOT ONE. `InterpretationControls` already owns a polite live
 * region, and it announces the mechanics of the player's own input: "Attention
 * set. Find a second bead." / "Pair held. Choose how you read them…" /
 * "Reopened for reading." / "Thread committed." This module deliberately
 * carries only what the *world* answers — a sighted bead and what it shares,
 * outcomes, motifs, attunement, the conclusion — because two regions changing
 * in the same tick is how a screen reader ends up dropping one of them, and
 * `describeCue`'s attention, lock, reading, reopening and thread captions
 * restate what the other region has already said. What no region said before
 * is the epistemic status, and that is what this one is for.
 *
 * THE FOCUS VIEW'S NEW MOMENTS, ONE BY ONE (M2-012).
 *
 *  - `attention.sighted` is the world answering: the bead under the lens, and
 *    the facets it shares with the attended bead, which no other region says.
 *    It is carried, always politely — a sweep of the lens is looking, and
 *    looking must never interrupt. Only settled sightings are published, and
 *    the gap re-opening is not captioned at all.
 *  - `pair.locked`, `reading.previewed` (a chosen reading) and
 *    `thread.reopened` are the player's own acts, and the controls' region
 *    announces each in the same tick; they stay there.
 *  - A reading merely hovered on a sigil is a pointer's glance over four
 *    targets in quick succession; captioning each would chatter. The column
 *    names the reading being heard in text, and the keyboard's route to the
 *    same preview — focusing a sigil, which chooses it — is announced by the
 *    controls' region.
 */

/**
 * A STUDY'S TWO ANSWERS (STUDIES-SPEC §5–§7).
 *
 * *Solved* and *not yet* are the world answering what the player composed, so
 * they are spoken here like every other answer, in `describeCue`'s words:
 * "Solved: <brief>." and "Not yet — it can be done with these beads." Neither
 * may interrupt — *not yet* never interrupts, by specification, and a solved
 * moment is a recognition, not an alarm — so both are held polite. And both
 * are said again when they are given again (`SAID_AGAIN`): a second *not yet*
 * has the same words and, being ephemeral, the same cue id as the first, and
 * it is still a second answer. The margin's line and the plate are what the
 * eye reads of them; this is what the ear is told, once per answer.
 *
 * The two cue types are added to `CuePayloadMap` by the Study runtime. They
 * are named here as strings so this table does not depend on the order the
 * two halves of M9-001 land in; nothing but the names is assumed.
 */
const STUDY_ANSWERS = Object.freeze([
  "study.solved",
  "study.not-yet",
]) as readonly string[] as readonly CueType[];

/**
 * Cues whose caption is the world answering rather than the player's own action
 * being echoed back. Every one of them carries information no other surface
 * states in words.
 */
export const WORLD_VOICE_CUES: ReadonlySet<CueType> = new Set<CueType>([
  "attention.sighted",
  "outcome.documented",
  "outcome.open-thread",
  "outcome.unresolved",
  "motif.completed",
  "attunement.changed",
  "conclusion.perform",
  ...STUDY_ANSWERS,
]);

/**
 * Cues that may never reach the assertive region, whatever `describeCue` says
 * of them: they arrive as fast as a lens can sweep, and an assertive region
 * interrupts whatever the reader was saying for every one. A Study's answers
 * join them because neither may interrupt at all.
 */
export const NEVER_ASSERTIVE: ReadonlySet<CueType> = new Set<CueType>([
  "attention.sighted",
  ...STUDY_ANSWERS,
]);

/**
 * Answers that are said again when they are given again, even in the same
 * words. Every other caption is set exactly as it always was: a region whose
 * words do not change says nothing new.
 */
export const SAID_AGAIN: ReadonlySet<CueType> = new Set<CueType>(STUDY_ANSWERS);

/**
 * A LOCAL CORRECTION, AND WHY IT IS HERE.
 *
 * `describeCue` composes a documented caption as
 * `${title}. ${EVIDENCE_PHRASE[evidence]} ${RECEPTION_PHRASE[reception]}`, and
 * `RECEPTION_PHRASE` is written entirely in the record's voice: "The record runs
 * along your reading." For the twelve `interpretive` relations in the pack there
 * is no record to run along, and saying so invents an authority the Game does
 * not hold — the exact failure CAV-009 and product law 8 exist to prevent, and
 * one the domain (`resolveThreadOutcome.documentedStatement`) and the margin
 * (`marginaliaNote.ts`) both already avoid.
 *
 * `src/runtime/captions/**` is not this block's to edit, and shipping the raw
 * caption would put a false claim into a screen reader's ear. So the record
 * clause is replaced here, in the Game's own voice, using the same three
 * sentences the margin uses. **This belongs in `describeCue.ts`**: condition
 * `RECEPTION_PHRASE` on the evidence class there and delete `READING_PHRASE`
 * and `correctInterpretive` from this file.
 */
const READING_PHRASE: Readonly<Record<string, string>> = Object.freeze({
  confirmed: "The Game reads it the same way.",
  refined: "The Game reads it slightly differently.",
  complicated: "The Game reads it across yours. Both are readings.",
});

/** The record sentences `describeCue` emits, which an interpretive relation may not carry. */
const RECORD_PHRASE: Readonly<Record<string, string>> = Object.freeze({
  confirmed: "The record runs along your reading.",
  refined: "The record narrows your reading.",
  complicated: "The record runs across your reading; it still stands.",
});

function correctInterpretive(
  caption: CueCaption,
  cue: PresentationCue
): CueCaption {
  if (cue.type !== "outcome.documented") return caption;
  if (cue.payload.evidence !== "interpretive") return caption;
  const reception = cue.payload.reception;
  const record = RECORD_PHRASE[reception];
  const reading = READING_PHRASE[reception];
  if (record === undefined || reading === undefined) return caption;
  if (!caption.text.includes(record)) return caption;
  return { ...caption, text: caption.text.split(record).join(reading) };
}

/**
 * The caption for a cue, or null when this region has nothing to say about it.
 * Never invents text: everything spoken here comes from `describeCue`, with the
 * one documented substitution above.
 */
export function worldVoiceCaption(
  cue: PresentationCue,
  context: CaptionContext
): CueCaption | null {
  if (!WORLD_VOICE_CUES.has(cue.type)) return null;
  const caption = describeCue(cue, context);
  if (caption === null) return null;
  const corrected = correctInterpretive(caption, cue);
  return NEVER_ASSERTIVE.has(cue.type) && corrected.urgency !== "polite"
    ? { ...corrected, urgency: "polite" }
    : corrected;
}
