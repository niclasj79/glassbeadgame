import type { CuratedConnection } from "../types";

/**
 * The curated knowledge graph — the heart of the Game.
 * Populated from M3 onward, filed per lexicographically-first discipline:
 * mathematics.ts, music.ts, philosophy.ts, physics.ts, art.ts, history.ts.
 */
export const connections: CuratedConnection[] = [];

export const connectionByPair = new Map<string, CuratedConnection>(
  connections.map((c) => [c.id, c])
);
