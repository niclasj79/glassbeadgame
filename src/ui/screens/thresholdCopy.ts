import { FACULTIES } from "@/content/castalia/faculties";
import { INTENTION_VOCABULARY } from "@/game/intentions";

/**
 * THE THRESHOLD — what is said before the door opens.
 *
 * The game used to put a player straight into a dark room holding twelve glass
 * beads, two chrome buttons and no statement of what any of it was for. The
 * only text naming the verb lived in a screen-reader live region and fired
 * *after* the first action had already been guessed, so a sighted first-timer
 * was told strictly less than a screen-reader user. The README explains the
 * game beautifully; nobody reads a README.
 *
 * WHAT THIS IS NOT. It is not a tutorial, it does not gate anything, it teaches
 * no controls, and it never appears again. There is no "skip" because there is
 * nothing to skip — it is one page, and the door is on it from the first frame.
 * A player who wants to press straight through loses nothing but the reading.
 *
 * WHY IT NAMES THE POINT AND NOT THE BUTTONS. The pieces are easy to discover
 * and the *point* is not: that no correct pairing is hidden behind any bead,
 * that nothing is scored, and that the Game's half of the bargain is honesty
 * about what you said rather than a verdict on it. A player who has not been
 * told that will reasonably assume there is an answer and go looking for it,
 * and then every silence reads as a failure instead of as the truth.
 *
 * EVERY NAME AND GLOSS IS READ FROM THE PACK. The faculties come from
 * `content/castalia/faculties.ts` and the verbs from `game/intentions.ts`, so
 * the screen that introduces them and the world that offers them cannot drift.
 * The only strings authored here are the ones about the game's stance, which
 * live nowhere else.
 */

export interface ThresholdPiece {
  readonly name: string;
  readonly gloss: string;
}

export interface ThresholdVerb {
  readonly icon: string;
  readonly label: string;
  readonly description: string;
}

export interface ThresholdAnswer {
  readonly kind: string;
  readonly sentence: string;
}

/** The four faculties, as the pack names them. */
export const THRESHOLD_FACULTIES: readonly ThresholdPiece[] = Object.freeze(
  FACULTIES.map((faculty) =>
    Object.freeze({ name: faculty.name, gloss: faculty.gloss })
  )
);

/** The four verbs, as the plate offers them. */
export const THRESHOLD_VERBS: readonly ThresholdVerb[] = Object.freeze(
  INTENTION_VOCABULARY.map((entry) =>
    Object.freeze({
      icon: entry.icon,
      label: entry.label,
      description: entry.description,
    })
  )
);

/**
 * The three things Castalia can say back, in the order of how much it is
 * claiming. Stated here because a player who meets the third one cold reads it
 * as the game being broken rather than as the game being careful.
 */
export const THRESHOLD_ANSWERS: readonly ThresholdAnswer[] = Object.freeze([
  Object.freeze({
    kind: "A documented relation",
    sentence:
      "with its sources, and how strong the evidence actually is — including when specialists disagree with each other.",
  }),
  Object.freeze({
    kind: "An open thread",
    sentence:
      "a specific question your reading raises that Castalia cannot settle. It will say so rather than guess.",
  }),
  Object.freeze({
    kind: "Near-silence",
    sentence:
      "when nothing credible connects those two ideas yet. Saying so is better than inventing something.",
  }),
]);

export const THRESHOLD_COPY = Object.freeze({
  eyebrow: "Before you enter",
  title: "Castalia",

  /** Warmth first. This is an invitation, not a briefing. */
  welcome:
    "A quiet place for noticing. Twelve ideas will be drawn for you, from four faculties of thought.",

  verbsLead:
    "Attend to one, and say how you think it meets another. Draw a thread between them, and your reading becomes glass, light, and sound.",

  answersLead: "Castalia answers honestly. There are three things it can say.",

  pointHeading: "Why bother",
  point: Object.freeze([
    "Nothing is hidden. No correct pairing waits behind a bead, and nothing you do is scored.",
    "You are not here to find answers. You are here to say something with the material — and Castalia's half of the bargain is to be truthful about what you said, including when the truth is that nobody knows.",
  ]),

  /**
   * The last thing read before the door. It is doing real work: a contemplative
   * game that a player thinks is timed is a different and much worse game.
   */
  reassurance:
    "Take your time. Nothing is timed, nothing is lost, and there is no way to fall behind.",

  enter: "Enter",
});
