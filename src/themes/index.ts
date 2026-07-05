import { hashString } from "@/lib/utils";
import { dailySeed, utcDateKey } from "@/lib/daily";
import type { WorldTheme } from "./types";
import { castalia, tide, ember, aurora } from "./worlds";

export type { WorldTheme } from "./types";

/**
 * The world registry. To add thematic content: write one WorldTheme in
 * worlds.ts (or its own file) and add it here — it immediately enters the
 * session rotation and the daily cycle. This module stays store-free so
 * state/store.ts can import it without a cycle; React hooks live in
 * themes/useTheme.ts.
 */
export const THEMES: WorldTheme[] = [castalia, tide, ember, aurora];

const byId = new Map(THEMES.map((t) => [t.id, t]));

export const DEFAULT_THEME = castalia;

export function themeById(id: string | undefined | null): WorldTheme {
  return (id && byId.get(id)) || DEFAULT_THEME;
}

/** Which world a session opens into — deterministic, so the daily draw is
 *  the same world everywhere and a seed always replays identically. */
export function themeForSession(seed: number, daily?: boolean): WorldTheme {
  if (daily) {
    return THEMES[dailySeed(utcDateKey()) % THEMES.length];
  }
  return THEMES[hashString(`world-${seed}`) % THEMES.length];
}
