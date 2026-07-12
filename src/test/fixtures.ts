import { pairKey } from "@/content/types";
import type { SessionState, Thread } from "@/state/types";

export function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    seed: 42,
    disciplines: ["mathematics", "music"],
    beadIds: [],
    threads: [],
    discoveries: [],
    motifs: [],
    score: 0,
    startedAt: 0,
    interaction: { mode: "idle", fromId: null, sticky: false, reveal: null },
    curatedAvailable: 0,
    insight: 1,
    illuminationsUsed: 0,
    themeId: "castalia",
    ...overrides,
  };
}

export function makeThread(
  a: string,
  b: string,
  kind: Thread["kind"] = "faint",
  tier: Thread["tier"] = kind === "curated" ? 1 : 0
): Thread {
  return { id: pairKey(a, b), a, b, kind, tier, createdAt: 0 };
}
