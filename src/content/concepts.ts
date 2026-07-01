import type { Concept } from "./types";

/**
 * The ninety beads of the Game — fifteen per discipline.
 * Populated in M1 from v1's conceptData + conceptDescriptions (ported verbatim),
 * enriched with transcendental coordinates, pitch degrees, and keywords.
 */
export const concepts: Concept[] = [];

export const conceptById = new Map<string, Concept>(concepts.map((c) => [c.id, c]));
