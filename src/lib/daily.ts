import { hashString } from "./utils";
import type { DisciplineId } from "@/content/types";

/**
 * The Daily Draw — one shared board for the whole world, no backend.
 * The UTC date seeds both the discipline pick and the bead draw, and the
 * draw itself is already deterministic, so everyone weaves the same sky.
 */

const DAILY_SETS: DisciplineId[][] = [
  ["mathematics", "music"],
  ["philosophy", "physics"],
  ["mathematics", "philosophy", "physics"],
  ["music", "art"],
  ["history", "philosophy"],
  ["mathematics", "music", "philosophy"],
  ["physics", "history"],
  ["art", "philosophy"],
  ["music", "physics"],
  ["mathematics", "art", "history"],
];

export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dailySeed(dateKey = utcDateKey()): number {
  return hashString(`gbg-daily-${dateKey}`);
}

export function dailyPicks(dateKey = utcDateKey()): DisciplineId[] {
  return DAILY_SETS[dailySeed(dateKey) % DAILY_SETS.length];
}
