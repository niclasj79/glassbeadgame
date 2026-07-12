import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { DisciplineId } from "@/content/types";
import type { SharedProgress } from "@/game/progress";
import { drawSession } from "@/game/session";
import { pickIlluminationTarget, CONSECRATION_POINTS } from "@/game/rules";
import type { LensView } from "@/game/layout";
import { unlockIdsFor } from "@/game/progress";
import { utcDateKey } from "@/lib/daily";
import { themeForSession } from "@/themes";
import { initialQualityTier, prefersReducedMotion, type QualityTier } from "@/lib/device";
import { gameNow } from "@/runtime/testMode";
import type {
  CodexEntry,
  Discovery,
  Interaction,
  MotifAward,
  Phase,
  SessionMemory,
  SessionState,
  Settings,
  Thread,
} from "./types";

interface GBGState {
  phase: Phase;
  lensActive: boolean;
  /** Which plane of the Lens triptych is showing (1 Good×True, 2 Good×Beautiful, 3 True×Beautiful). */
  lensView: LensView;
  codexOpen: boolean;
  settings: Settings;
  session: SessionState | null;
  codex: Record<string, CodexEntry>;
  sessionArchive: SessionMemory[];
  lifetimeStats: { sessions: number; totalScore: number };
  focusedBeadId: string | null;
  /** A bead pinned open for reading (touch long-press); shows immediately. */
  pinnedInspectId: string | null;
  /** Great Web milestones earned — persisted once earned, never revoked. */
  unlocks: string[];
  /** The last completed Daily Draw. */
  lastDaily: { date: string; score: number } | null;

  goToSetup: () => void;
  returnToTitle: () => void;
  beginSession: (picks: DisciplineId[], opts?: { seed?: number; daily?: boolean }) => void;
  setLens: (on: boolean) => void;
  /** The Lens is a triptych: off → Good×True → Good×Beautiful → True×Beautiful → off. */
  cycleLens: () => void;
  setCodexOpen: (open: boolean) => void;
  setFocusedBead: (id: string | null) => void;
  setPinnedInspect: (id: string | null) => void;
  setMuted: (muted: boolean) => void;
  setBinaural: (on: boolean) => void;
  setQualityTier: (tier: QualityTier) => void;
  markHintSeen: (id: string) => void;
  mergeProgress: (progress: SharedProgress) => void;
  resetProgress: () => void;

  setInteraction: (partial: Partial<Interaction>) => void;
  addThread: (thread: Thread) => void;
  /** Returns the finalized discovery (newToCodex resolved against the codex). */
  addDiscovery: (discovery: Discovery, motifs: MotifAward[]) => Discovery;
  /** Spends one Insight; returns the pair the Game illuminates, or null. */
  spendInsight: () => [string, string] | null;
  /** Marks threads as consecrated by a motif and scores the elevation. */
  consecrateThreads: (threadIds: string[], motifId: MotifAward["motifId"]) => void;
  concludeSession: () => void;
  finishConcluding: () => void;
}

const idleInteraction = (): Interaction => ({
  mode: "idle",
  fromId: null,
  sticky: false,
  reveal: null,
});

/** What survives across sessions: the codex, lifetime stats, and taste settings. */
interface PersistedSlice {
  codex: GBGState["codex"];
  sessionArchive: GBGState["sessionArchive"];
  lifetimeStats: GBGState["lifetimeStats"];
  unlocks: GBGState["unlocks"];
  lastDaily: GBGState["lastDaily"];
  settings: Pick<Settings, "muted" | "binaural" | "hintsSeen">;
}

const MAX_SESSION_ARCHIVE = 12;

export const useStore = create<GBGState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
    phase: "title",
    lensActive: false,
    lensView: 1 as LensView,
    codexOpen: false,
    settings: {
      muted: false,
      binaural: true,
      qualityTier: initialQualityTier(),
      reducedMotion: prefersReducedMotion(),
      hintsSeen: {},
    },
    session: null,
    codex: {},
    sessionArchive: [],
    unlocks: [],
    lastDaily: null,
    lifetimeStats: { sessions: 0, totalScore: 0 },
    focusedBeadId: null,
    pinnedInspectId: null,

    goToSetup: () => set({ phase: "setup" }),

    returnToTitle: () =>
      set({
        phase: "title",
        session: null,
        lensActive: false,
        codexOpen: false,
        focusedBeadId: null,
        pinnedInspectId: null,
      }),

    beginSession: (picks, opts) => {
      const draw = drawSession(picks, opts?.seed);
      const session: SessionState = {
        seed: draw.seed,
        disciplines: draw.disciplines,
        beadIds: draw.beadIds,
        threads: [],
        discoveries: [],
        motifs: [],
        score: 0,
        startedAt: gameNow(),
        interaction: idleInteraction(),
        curatedAvailable: draw.curatedAvailable,
        insight: 1, // the Magister's gift — one illumination to learn the mechanic
        illuminationsUsed: 0,
        daily: opts?.daily,
        themeId: themeForSession(draw.seed, opts?.daily).id,
      };
      set({ phase: "arena", session, lensActive: false, focusedBeadId: null, pinnedInspectId: null });
    },

    setLens: (on) => {
      const s = get().session;
      if (s && s.interaction.mode !== "idle") {
        // Entering the lens always cancels an in-flight gesture.
        set({ session: { ...s, interaction: idleInteraction() } });
      }
      set({ lensActive: on, lensView: 1 as LensView });
    },

    cycleLens: () => {
      const st = get();
      if (st.session && st.session.interaction.mode !== "idle") {
        set({ session: { ...st.session, interaction: idleInteraction() } });
      }
      if (!st.lensActive) {
        set({ lensActive: true, lensView: 1 as LensView });
      } else if (st.lensView < 3) {
        set({ lensView: (st.lensView + 1) as LensView });
      } else {
        set({ lensActive: false, lensView: 1 as LensView });
      }
    },

    setCodexOpen: (open) => set({ codexOpen: open }),

    setFocusedBead: (focusedBeadId) => set({ focusedBeadId }),

    setPinnedInspect: (pinnedInspectId) => set({ pinnedInspectId }),

    setMuted: (muted) => set((st) => ({ settings: { ...st.settings, muted } })),

    setBinaural: (binaural) => set((st) => ({ settings: { ...st.settings, binaural } })),

    setQualityTier: (qualityTier) =>
      set((st) => ({ settings: { ...st.settings, qualityTier } })),

    markHintSeen: (id) =>
      set((st) => ({
        settings: { ...st.settings, hintsSeen: { ...st.settings.hintsSeen, [id]: true } },
      })),

    mergeProgress: (progress) =>
      set((st) => {
        const codex = { ...st.codex };
        for (const [id, incoming] of Object.entries(progress.codex)) {
          const existing = codex[id];
          codex[id] = existing
            ? {
                firstFoundAt: Math.min(existing.firstFoundAt, incoming.firstFoundAt),
                count: Math.max(existing.count, incoming.count),
              }
            : incoming;
        }

        const hintsSeen = { ...st.settings.hintsSeen };
        for (const [id, seen] of Object.entries(progress.hintsSeen)) {
          if (seen) hintsSeen[id] = true;
        }

        return {
          codex,
          lifetimeStats: {
            sessions: Math.max(st.lifetimeStats.sessions, progress.lifetimeStats.sessions),
            totalScore: Math.max(st.lifetimeStats.totalScore, progress.lifetimeStats.totalScore),
          },
          settings: { ...st.settings, hintsSeen },
        };
      }),

    resetProgress: () =>
      set((st) => ({
        phase: "title",
        session: null,
        codex: {},
        sessionArchive: [],
        codexOpen: false,
        lensActive: false,
        focusedBeadId: null,
        lifetimeStats: { sessions: 0, totalScore: 0 },
        unlocks: [],
        lastDaily: null,
        settings: { ...st.settings, hintsSeen: {} },
      })),

    setInteraction: (partial) => {
      const s = get().session;
      if (!s) return;
      set({ session: { ...s, interaction: { ...s.interaction, ...partial } } });
    },

    addThread: (thread) => {
      const s = get().session;
      if (!s || s.threads.some((t) => t.id === thread.id)) return;
      set({ session: { ...s, threads: [...s.threads, thread] } });
    },

    addDiscovery: (discovery, motifs) => {
      const s = get().session;
      if (!s) return discovery;
      const codex = { ...get().codex };
      let finalized = discovery;
      if (discovery.kind === "curated") {
        const prev = codex[discovery.id];
        finalized = { ...discovery, newToCodex: !prev };
        codex[discovery.id] = prev
          ? { ...prev, count: prev.count + 1 }
          : { firstFoundAt: gameNow(), count: 1 };
      }
      const motifPoints = motifs.reduce((sum, m) => sum + m.points, 0);
      // Insight accrues from what deserves it: luminous finds and motifs.
      const earnedInsight = (finalized.kind === "curated" ? 1 : 0) + motifs.length;
      // Milestones only ever accumulate (a shared continue-URL may not
      // carry every historical unlock; never revoke).
      const unlocks =
        finalized.kind === "curated"
          ? [...new Set([...get().unlocks, ...unlockIdsFor(codex)])]
          : get().unlocks;
      set({
        codex,
        unlocks,
        session: {
          ...s,
          discoveries: [...s.discoveries, finalized],
          motifs: [...s.motifs, ...motifs],
          score: s.score + finalized.points + motifPoints,
          insight: s.insight + earnedInsight,
        },
      });
      return finalized;
    },

    consecrateThreads: (threadIds, motifId) => {
      const s = get().session;
      if (!s || threadIds.length === 0) return;
      const ids = new Set(threadIds);
      set({
        session: {
          ...s,
          threads: s.threads.map((t) =>
            ids.has(t.id) && !t.consecratedBy ? { ...t, consecratedBy: motifId } : t
          ),
          score: s.score + threadIds.length * CONSECRATION_POINTS,
        },
      });
    },

    spendInsight: () => {
      const s = get().session;
      if (!s || s.insight <= 0) return null;
      const target = pickIlluminationTarget(s);
      if (!target) return null;
      set({
        session: {
          ...s,
          insight: s.insight - 1,
          illuminationsUsed: s.illuminationsUsed + 1,
        },
      });
      return target;
    },

    concludeSession: () => {
      const s = get().session;
      if (!s) return;
      set({
        lensActive: false,
        session: { ...s, interaction: { ...idleInteraction(), mode: "concluding" } },
      });
    },

    finishConcluding: () => {
      const s = get().session;
      if (!s) return;
      const memory: SessionMemory = {
        id: `${s.seed}-${gameNow()}`,
        seed: s.seed,
        endedAt: gameNow(),
        disciplines: s.disciplines,
        beadIds: s.beadIds,
        threads: s.threads,
        discoveries: s.discoveries,
        motifs: s.motifs,
        score: s.score,
      };
      set((st) => ({
        phase: "conclusion",
        session: { ...s, interaction: idleInteraction() },
        focusedBeadId: null,
        sessionArchive:
          s.discoveries.length > 0 || s.threads.length > 0
            ? [memory, ...st.sessionArchive].slice(0, MAX_SESSION_ARCHIVE)
            : st.sessionArchive,
        lifetimeStats: {
          sessions: st.lifetimeStats.sessions + 1,
          totalScore: st.lifetimeStats.totalScore + s.score,
        },
        lastDaily: s.daily
          ? { date: utcDateKey(), score: s.score }
          : st.lastDaily,
      }));
    },
      }),
      {
        name: "gbg.v1",
        version: 1,
        partialize: (s): PersistedSlice => ({
          codex: s.codex,
          sessionArchive: s.sessionArchive,
          lifetimeStats: s.lifetimeStats,
          unlocks: s.unlocks,
          lastDaily: s.lastDaily,
          settings: {
            muted: s.settings.muted,
            binaural: s.settings.binaural,
            hintsSeen: s.settings.hintsSeen,
          },
        }),
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<PersistedSlice>;
          return {
            ...current,
            codex: p.codex ?? current.codex,
            sessionArchive: p.sessionArchive ?? current.sessionArchive,
            lifetimeStats: p.lifetimeStats ?? current.lifetimeStats,
            unlocks: p.unlocks ?? current.unlocks,
            lastDaily: p.lastDaily ?? current.lastDaily,
            settings: {
              ...current.settings, // qualityTier/reducedMotion stay device-derived
              muted: p.settings?.muted ?? current.settings.muted,
              binaural: p.settings?.binaural ?? current.settings.binaural,
              hintsSeen: p.settings?.hintsSeen ?? current.settings.hintsSeen,
            },
          };
        },
      }
    )
  )
);
