import type { CuratedConnection } from "../types";
import { artConnections } from "./art";
import { historyConnections } from "./history";
import { mathematicsConnections } from "./mathematics";
import { musicConnections } from "./music";
import { philosophyConnections } from "./philosophy";
import { physicsConnections } from "./physics";

/**
 * The curated knowledge graph — the heart of the Game.
 * Filed per lexicographically-first discipline of each pair; merged here.
 */
export const connections: CuratedConnection[] = [
  ...artConnections,
  ...historyConnections,
  ...mathematicsConnections,
  ...musicConnections,
  ...philosophyConnections,
  ...physicsConnections,
];

export const connectionByPair = new Map<string, CuratedConnection>(
  connections.map((c) => [c.id, c])
);
