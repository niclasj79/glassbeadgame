import { connections } from "@/content/connections";

export interface Rank {
  name: string;
  threshold: number;
}

/** Castalian ascent, driven by lifetime distinct curated discoveries. */
export const RANKS: Rank[] = [
  { name: "Novice", threshold: 0 },
  { name: "Student", threshold: 6 },
  { name: "Scholar", threshold: 18 },
  { name: "Lector", threshold: 40 },
  { name: "Magister Ludi", threshold: 75 },
];

export function totalConnections(): number {
  return connections.length;
}

export function rankFor(codexCount: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (codexCount >= r.threshold) current = r;
  }
  return current;
}

export function nextRank(codexCount: number): Rank | null {
  for (const r of RANKS) {
    if (codexCount < r.threshold) return r;
  }
  return null;
}

/** 0..1 progress from the current rank toward the next (1 at Magister Ludi). */
export function rankProgress(codexCount: number): number {
  const current = rankFor(codexCount);
  const next = nextRank(codexCount);
  if (!next) return 1;
  return (codexCount - current.threshold) / (next.threshold - current.threshold);
}
