import type { RelationIntention } from "../events";
import type { RelationType } from "@/content/castalia/schema";

/**
 * Shared prose primitives.
 *
 * Everything the Game says about a session is assembled from these plus real
 * session data. There is deliberately no adjective table, no praise vocabulary,
 * and no band-indexed fragment list here: a sentence that could be produced
 * without looking at the web is a sentence this game must not say.
 */

/** Player-facing intention names (I-007). */
export const INTENTION_LABELS: Readonly<Record<RelationIntention, string>> =
  Object.freeze({
    echo: "Echo",
    passage: "Passage",
    tension: "Tension",
    ground: "Ground",
  });

/** First-use phrases accepted in I-007. */
export const INTENTION_PHRASES: Readonly<Record<RelationIntention, string>> =
  Object.freeze({
    echo: "shares a form",
    passage: "carries or transforms",
    tension: "opposes or complicates",
    ground: "supports or embodies",
  });

/**
 * Neutral descriptions of the authored relation types. These name the claim
 * being made; none of them praises, ranks, or asserts more than the type does.
 */
export const RELATION_TYPE_GLOSS: Readonly<Record<RelationType, string>> =
  Object.freeze({
    "structural-correspondence": "a structural correspondence",
    "historical-transmission": "a documented transmission",
    "formal-ground": "a formal ground",
    "material-ground": "a material ground",
    opposition: "an opposition",
    instantiation: "an instantiation",
    reframing: "a reframing",
  });

/**
 * Faculty ids are single lower-case words, so the player-facing label is a pure
 * string transform rather than a second copy of authored content. If a faculty
 * ever needs a name that is not its capitalised id, this becomes a lookup member.
 */
export function facultyLabel(id: string): string {
  if (id.length === 0) return id;
  return `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}

/** "a", "a and b", "a, b, and c" — Oxford comma, deterministic. */
export function formatList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] as string;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** English count words up to twelve; numerals beyond. Keeps prose readable. */
const COUNT_WORDS: readonly string[] = Object.freeze([
  "none",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
]);

export function countWord(value: number): string {
  const index = Math.trunc(value);
  if (index >= 0 && index < COUNT_WORDS.length) {
    return COUNT_WORDS[index] as string;
  }
  return String(index);
}

export function pluralise(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function capitalise(value: string): string {
  if (value.length === 0) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/** Deterministic, locale-independent string ordering. */
export function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Six decimal places — enough for presentation, immune to float drift. */
export function quantise(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1e6) / 1e6;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
