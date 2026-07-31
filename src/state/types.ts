import type { DisciplineId } from "@/content/types";

/**
 * `setup` is unreachable: the pre-game discipline picker left with the legacy
 * draw and the title now opens straight into the arena. The member stays in the
 * union only because `src/audio/useAudio.ts` and `src/scene/CameraRig.tsx`
 * still branch on it, and neither may be edited from here.
 */
export type Phase = "title" | "setup" | "arena" | "conclusion";

export type ArenaMode = "idle" | "pressed" | "threading" | "reveal" | "concluding";

/**
 * THE LEGACY PRESENTATION PROJECTION
 *
 * Everything below `Settings` is a *view*, not a source of truth. The canonical
 * session is the replayed event log in `state/domainSession`; these shapes exist
 * only because the scene and the audio engine still read
 * `useStore().session` for bead ids, quality, framing and the ambient bed.
 *
 * Nothing writes to `threads`, `discoveries`, `motifs` or `score` any more —
 * the actions that did (`addThread`, `addDiscovery`, `consecrateThreads`,
 * `spendInsight`) left with the legacy scoring model. They stay declared, and
 * are published empty by `applySessionStart`, because `src/scene/**` and
 * `src/audio/**` still read them defensively and cannot be edited here.
 */

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
  /** pairKey of the two concept ids. */
  id: string;
  a: string;
  b: string;
  kind: "curated" | "faint";
  tier: 0 | 1 | 2 | 3;
  points: number;
}

export interface MotifAward {
  motifId: "triad" | "symposium" | "fugue";
  at: number;
  /** The beads that formed the motif — its persistent mark lives on them. */
  beads?: string[];
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
  /** Legacy counters. Published as zero and never incremented. */
  curatedAvailable: number;
  insight: number;
  illuminationsUsed: number;
  /** Set when this session was started as the shared daily draw. */
  daily?: boolean;
  /** The world this session opens into (themes registry id). */
  themeId: string;
}

/** Prepared, non-persisted compatibility view for the legacy presentation store. */
export interface SessionStartProjection {
  readonly seed: number;
  readonly disciplines: readonly DisciplineId[];
  readonly beadIds: readonly string[];
  readonly threads: readonly Thread[];
  readonly discoveries: readonly Discovery[];
  readonly motifs: readonly MotifAward[];
  readonly score: number;
  readonly startedAt: number;
  readonly interaction: Readonly<Interaction>;
  readonly curatedAvailable: number;
  readonly insight: number;
  readonly illuminationsUsed: number;
  readonly daily?: boolean;
  readonly themeId: string;
}

export interface Settings {
  muted: boolean;
  /** The theta-band binaural bed — headphone magic, honest off-switch. */
  binaural: boolean;
  qualityTier: "high" | "base" | "potato";
  reducedMotion: boolean;
  hintsSeen: Record<string, boolean>;
}
