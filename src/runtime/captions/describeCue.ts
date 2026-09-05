/**
 * CAPTIONS — the textual equivalent of everything the world says.
 *
 * The specification requires captions or textual equivalents for critical audio
 * meaning, and requires that relation meaning never be carried by colour alone
 * (VERTICAL-SLICE-SPEC §19, §22). Both are satisfied here, in one place, by
 * turning the same cues the scene and audio directors receive into prose.
 *
 * This is deliberately not a "screen reader mode". It is the same information,
 * always computed, always available — so a player who mutes the game on a train
 * receives the whole composition, and a player using a screen reader receives
 * exactly what a hearing player receives rather than a summary of it. A
 * second-class accessibility path would be one where the caption says "relation
 * formed" while the audio says something specific.
 *
 * Copy rules, enforced by tests:
 *  - never praise the player;
 *  - never assert a fact the outcome did not carry;
 *  - name the *epistemic status* plainly, because that is the one thing colour
 *    and sound convey least reliably;
 *  - stay short enough to be spoken over the moment it describes.
 */
import type { RelationIntention } from "@/domain/events";
import type { EvidenceClass } from "@/content/castalia/schema";
import type { IntentionReception, PresentationCue } from "../cues";

/** First-use phrases accepted in I-007. Used verbatim so the game speaks once. */
export const INTENTION_PHRASE: Readonly<Record<RelationIntention, string>> =
  Object.freeze({
    echo: "shares a form",
    passage: "carries or transforms",
    tension: "opposes or complicates",
    ground: "supports or embodies",
  });

export const INTENTION_NAME: Readonly<Record<RelationIntention, string>> =
  Object.freeze({
    echo: "Echo",
    passage: "Passage",
    tension: "Tension",
    ground: "Ground",
  });

/**
 * How firmly the Game stands behind a statement, said plainly. This is the
 * distinction the whole content model exists to preserve, so it is never
 * softened into flavour text.
 */
const EVIDENCE_PHRASE: Readonly<Record<EvidenceClass, string>> = Object.freeze({
  established: "Documented, and standard in the field.",
  attested: "Documented in a specific recorded instance.",
  contested: "Documented, but specialists disagree.",
  interpretive:
    "A reading the Game offers, not a claim about influence.",
});

/** What the record did to the player's declared reading. Never "wrong". */
const RECEPTION_PHRASE: Readonly<Record<IntentionReception, string>> =
  Object.freeze({
    confirmed: "The record runs along your reading.",
    refined: "The record narrows your reading.",
    complicated: "The record runs across your reading; it still stands.",
  });

export interface CueCaption {
  /** Spoken text. One or two sentences. */
  readonly text: string;
  /**
   * `polite` for the ordinary flow; `assertive` only where a player would
   * otherwise miss that their input did something. Nothing here interrupts.
   */
  readonly urgency: "polite" | "assertive";
}

const RESONANCE_PHRASE = Object.freeze({
  high: "strong resonance",
  medium: "some resonance",
  weak: "faint resonance",
});

function nameOf(id: string, resolve: (id: string) => string): string {
  const name = resolve(id);
  return name.length > 0 ? name : id;
}

export interface CaptionContext {
  /** Player-facing concept name. Falls back to the id rather than to silence. */
  readonly conceptName: (id: string) => string;
  readonly facetName: (id: string) => string;
}

/**
 * Returns null for cues with nothing worth saying. A caption for every frame of
 * a weave would be noise, and noise is how a caption track becomes ignorable.
 */
export function describeCue(
  cue: PresentationCue,
  context: CaptionContext
): CueCaption | null {
  switch (cue.type) {
    case "attention.enter": {
      const name = nameOf(String(cue.payload.conceptId), context.conceptName);
      // Bands are reported in words, never as a number and never as a ranking:
      // resonance suggests possibility, not correctness (CAV-004).
      const counts = { high: 0, medium: 0, weak: 0 };
      for (const candidate of cue.payload.candidates) counts[candidate.band] += 1;
      const answering = counts.high + counts.medium;
      return {
        text:
          answering === 0
            ? `Attending to ${name}. Nothing in the arena answers strongly yet.`
            : `Attending to ${name}. ${answering} ${
                answering === 1 ? "bead answers" : "beads answer"
              }, ${counts.high} with ${RESONANCE_PHRASE.high}.`,
        urgency: "polite",
      };
    }

    case "attention.clear":
      return { text: "Attention released.", urgency: "polite" };

    case "intention.armed": {
      const intention = cue.payload.intention;
      return {
        text: `${INTENTION_NAME[intention]} armed — ${INTENTION_PHRASE[intention]}. Draw toward another bead.`,
        urgency: "polite",
      };
    }

    case "candidate.latched": {
      const to = nameOf(String(cue.payload.pair[1]), context.conceptName);
      return { text: `${to} latched. Release to weave.`, urgency: "polite" };
    }

    case "thread.woven": {
      const a = nameOf(String(cue.payload.pair[0]), context.conceptName);
      const b = nameOf(String(cue.payload.pair[1]), context.conceptName);
      return {
        text: `Woven: ${a} and ${b}, as ${INTENTION_NAME[cue.payload.intention]}.`,
        urgency: "polite",
      };
    }

    case "outcome.documented": {
      const { relation, evidence, reception } = cue.payload;
      return {
        text: `${relation.title}. ${EVIDENCE_PHRASE[evidence]} ${RECEPTION_PHRASE[reception]}`,
        urgency: "polite",
      };
    }

    case "outcome.open-thread": {
      const facet = context.facetName(String(cue.payload.sharedFacet));
      // The disclosure comes first. A player must not hear the question and
      // assume the Game is asserting its premise.
      return {
        text: `An open thread. Nothing written settles this, though the two share ${facet}. ${cue.payload.question}`,
        urgency: "polite",
      };
    }

    case "outcome.unresolved":
      return { text: cue.payload.statement, urgency: "polite" };

    case "motif.completed":
      return {
        text: `A motif has formed. ${cue.payload.reason}`,
        urgency: "polite",
      };

    case "attunement.changed":
      return {
        text: cue.payload.active
          ? "Attunement. The web is sounding one thread at a time."
          : "Attunement released.",
        urgency: "polite",
      };

    case "conclusion.perform":
      return {
        text: "The Game performs itself back to you, in the order you made it.",
        urgency: "polite",
      };

    default:
      return null;
  }
}
