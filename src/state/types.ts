import type { DisciplineId } from "@/content/types";

/**
 * `setup` is unreachable: the pre-game discipline picker left with the legacy
 * draw and the title now opens straight into the arena. The member stays in the
 * union only because `src/audio/useAudio.ts` and `src/scene/CameraRig.tsx`
 * still branch on it, and neither may be edited from here.
 */
export type Phase = "title" | "threshold" | "arena" | "conclusion";

export type ArenaMode = "idle" | "pressed" | "threading" | "reveal" | "concluding";

/**
 * THE LEGACY PRESENTATION PROJECTION
 *
 * Everything below `Settings` is a *view*, not a source of truth. The canonical
 * session is the replayed event log in `state/domainSession`; these shapes exist
 * only because the scene still reads `useStore().session` for bead ids, quality
 * and framing.
 *
 * ── `threads`, `discoveries`, `motifs`, `score`: dead, and now unread ────────
 *
 * Nothing has written to these four since the legacy scoring model left with
 * `addThread`, `addDiscovery`, `consecrateThreads` and `spendInsight`. They are
 * published empty by `applySessionStart`, and until recently five live
 * subscribers read them and therefore did nothing at all: the ambient choir
 * (`ambient.addThreadVoice`), the completed-motif ensemble
 * (`ambient.addMotifPattern`), the discovery chord and faint dyad, the bed's
 * swell (`audio.setAmbientIntensity`), and `scene/MotifMarks`. Every one of
 * those has been cut over to the canonical session or deleted outright.
 *
 * What still touches them, and what a deletion would therefore have to change
 * in one commit — recorded here because it spans files this module may not
 * reach on its own:
 *
 *   src/state/store.ts                     `applySessionStart` copies all four
 *   src/runtime/session/startSession.ts    builds the projection literal
 *   src/scene/ThreadingDriver.tsx          `testSnapshot` reports score,
 *                                          threads and discoveries
 *   src/runtime/testMode.ts                `TestSessionSnapshot` declares them
 *   tests/browser/deterministic-mode.spec  asserts all three are empty/zero
 *   src/scene/Membranes.tsx                reads `session.threads`; the module
 *                                          has no importer at all and should
 *                                          go with them
 *
 * `MotifAward` in particular now has no reader anywhere outside this file.
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

/**
 * Retired. `motifId` names the prototype's three families; the domain has
 * detected `dialectic`, `canon` and `bridge` for a long time
 * (`domain/motifs/types.ts`), so even a populated `motifs` array would have
 * fallen through every branch that switched on this. The world's persistent
 * marks are `scene/motifMarkPlan.ts` now, and the ensemble voices are seated
 * from `SessionStateV1.completedMotifs`.
 */
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
