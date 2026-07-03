import { mulberry32, pick } from "@/lib/utils";
import { dailySeed } from "@/lib/daily";

export interface Epigraph {
  text: string;
  source: string;
  /** Unlock id gating this line; undefined = always available. */
  unlock?: string;
}

/**
 * The title's epigraph pool. Milestones in the Great Web unlock further
 * voices; the day's seed chooses among what the player has earned.
 */
export const EPIGRAPHS: Epigraph[] = [
  {
    text: "The Glass Bead Game is thus a mode of playing with the total contents and values of our culture.",
    source: "Hermann Hesse",
  },
  {
    text: "The hidden harmony is better than the obvious.",
    source: "Heraclitus",
    unlock: "first-triad",
  },
  {
    text: "There is geometry in the humming of the strings, there is music in the spacing of the spheres.",
    source: "attributed to Pythagoras",
    unlock: "faculty",
  },
  {
    text: "To see a World in a Grain of Sand, and a Heaven in a Wild Flower.",
    source: "William Blake, Auguries of Innocence",
    unlock: "the-hundred",
  },
];

export function epigraphForToday(unlocks: string[]): Epigraph {
  const available = EPIGRAPHS.filter(
    (e) =>
      !e.unlock ||
      unlocks.includes(e.unlock) ||
      (e.unlock === "faculty" && unlocks.some((u) => u.startsWith("faculty-")))
  );
  const rng = mulberry32(dailySeed() ^ 0x51f15eed);
  return pick(available, rng);
}
