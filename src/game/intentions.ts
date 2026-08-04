import type { RelationIntention } from "@/domain/events";

/**
 * THE FOUR VERBS, AS THE PLAYER MEETS THEM.
 *
 * This used to live inside `scene/IntentionConstellation.tsx`, which was fine
 * while the plate was the only surface that named them. It stopped being fine
 * the moment the threshold screen had to introduce them before the arena
 * exists: a DOM screen importing an R3F component would have pulled three.js
 * into the first load and crossed a layer to do it.
 *
 * So the *content* lives here and the *geometry* stays with the plate. Which
 * engraved station a verb stands on is a fact about the instrument; what the
 * verb is called and what it means is a fact about the game, and the screen
 * that introduces it and the plate that offers it must not be able to drift
 * apart.
 *
 * The glyphs are string literals on purpose. A previous revision put an escape
 * sequence in JSX text and shipped the literal characters `&#215;` to the screen.
 */
export interface IntentionVocabulary {
  readonly intention: RelationIntention;
  readonly icon: string;
  readonly label: string;
  /**
   * What the player is claiming by choosing it. Deliberately a verb phrase and
   * deliberately hedged — "shares a form" is something a player can mean;
   * "is derived from" would be a claim of influence the content model reserves
   * for one relation type with a source behind it.
   */
  readonly description: string;
}

export const INTENTION_VOCABULARY: readonly IntentionVocabulary[] = Object.freeze([
  Object.freeze({
    intention: "echo" as const,
    icon: "◌",
    label: "Echo",
    description: "shares a form",
  }),
  Object.freeze({
    intention: "passage" as const,
    icon: "→",
    label: "Passage",
    description: "carries or transforms",
  }),
  Object.freeze({
    intention: "tension" as const,
    icon: "≋",
    label: "Tension",
    description: "opposes or complicates",
  }),
  Object.freeze({
    intention: "ground" as const,
    icon: "□",
    label: "Ground",
    description: "supports or embodies",
  }),
]);

export const intentionVocabularyOf = (
  intention: RelationIntention
): IntentionVocabulary => {
  const found = INTENTION_VOCABULARY.find((entry) => entry.intention === intention);
  if (found === undefined) throw new Error(`no vocabulary for intention ${intention}`);
  return found;
};
