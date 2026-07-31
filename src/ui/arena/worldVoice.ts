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
 * set. Choose an intention." / "Thread committed." This module deliberately
 * carries only what the *world* answers — outcomes, motifs, attunement, the
 * conclusion — because two regions changing in the same tick is how a screen
 * reader ends up dropping one of them, and `describeCue`'s attention, intention
 * and thread captions restate what the other region has already said. What no
 * region said before is the epistemic status, and that is what this one is for.
 */

/**
 * Cues whose caption is the world answering rather than the player's own action
 * being echoed back. Every one of them carries information no other surface
 * states in words.
 */
export const WORLD_VOICE_CUES: ReadonlySet<CueType> = new Set<CueType>([
  "outcome.documented",
  "outcome.open-thread",
  "outcome.unresolved",
  "motif.completed",
  "attunement.changed",
  "conclusion.perform",
]);

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
  return caption === null ? null : correctInterpretive(caption, cue);
}
