import type { DisciplineId } from "@/content/types";

export type Phase = "title" | "setup" | "arena" | "conclusion";

export type ArenaMode = "idle" | "pressed" | "threading" | "reveal" | "concluding";

export interface Thread {
  /** pairKey of the two concept ids. */
  id: string;
  a: string;
  b: string;
  kind: "curated" | "faint";
  /** 0 = faint, 1–3 = curated tier. */
  tier: 0 | 1 | 2 | 3;
  createdAt: number;
}

export interface Discovery {
  /** pairKey; equals the curated connection id when kind is curated. */
  id: string;
  a: string;
  b: string;
  kind: "curated" | "faint";
  tier: 0 | 1 | 2 | 3;
  title: string;
  insight: string;
  quote?: { text: string; source: string };
  /** First time this curated connection was ever found (across all sessions). */
  newToCodex: boolean;
  points: number;
}

export interface MotifAward {
  motifId: "triad" | "symposium" | "fugue";
  name: string;
  points: number;
  at: number;
}

export interface Interaction {
  mode: ArenaMode;
  /** Bead the current gesture originates from. */
  fromId: string | null;
  /** Sticky (tap-tap) threading vs drag threading. */
  sticky: boolean;
  /** Set while a reveal card is on screen. */
  reveal: Discovery | null;
}

export interface SessionState {
  seed: number;
  disciplines: DisciplineId[];
  beadIds: string[];
  threads: Thread[];
  discoveries: Discovery[];
  motifs: MotifAward[];
  score: number;
  startedAt: number;
  interaction: Interaction;
  /** Curated connections hidden among this draw's beads — the session's arc. */
  curatedAvailable: number;
  /** Set when this session is the shared daily draw. */
  daily?: boolean;
}

export interface SessionMemory {
  id: string;
  seed: number;
  endedAt: number;
  disciplines: DisciplineId[];
  beadIds: string[];
  threads: Thread[];
  discoveries: Discovery[];
  motifs: MotifAward[];
  score: number;
}

export interface Settings {
  muted: boolean;
  /** The theta-band binaural bed — headphone magic, honest off-switch. */
  binaural: boolean;
  qualityTier: "high" | "base" | "potato";
  reducedMotion: boolean;
  hintsSeen: Record<string, boolean>;
}

export interface CodexEntry {
  firstFoundAt: number;
  count: number;
}
