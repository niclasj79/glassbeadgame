import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { DisciplineId } from "@/content/types";
import type { SharedProgress } from "@/game/progress";
import { drawSession } from "@/game/session";
import { pickIlluminationTarget } from "@/game/rules";
import { initialQualityTier, prefersReducedMotion, type QualityTier } from "@/lib/device";
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
  codexOpen: boolean;
  settings: Settings;
  session: SessionState | null;
  codex: Record<string, CodexEntry>;
  sessionArchive: SessionMemory[];
  lifetimeStats: { sessions: number; totalScore: number };
  focusedBeadId: string | null;

  goToSetup: () => void;
  returnToTitle: () => void;
  beginSession: (picks: DisciplineId[], opts?: { seed?: number; daily?: boolean }) => void;
  setLens: (on: boolean) => void;
  setCodexOpen: (open: boolean) => void;
  setFocusedBead: (id: string | null) => void;
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
  settings: Pick<Settings, "muted" | "binaural" | "hintsSeen">;
}

const MAX_SESSION_ARCHIVE = 12;

export const useStore = create<GBGState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
    phase: "title",
    lensActive: false,
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
    lifetimeStats: { sessions: 0, totalScore: 0 },
    focusedBeadId: null,

    goToSetup: () => set({ phase: "setup" }),

    returnToTitle: () =>
      set({
        phase: "title",
        session: null,
        lensActive: false,
        codexOpen: false,
        focusedBeadId: null,
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
        startedAt: Date.now(),
        interaction: idleInteraction(),
        curatedAvailable: draw.curatedAvailable,
        insight: 1, // the Magister's gift — one illumination to learn the mechanic
        illuminationsUsed: 0,
        daily: opts?.daily,
      };
      set({ phase: "arena", session, lensActive: false, focusedBeadId: null });
    },

    setLens: (on) => {
      const s = get().session;
      if (s && s.interaction.mode !== "idle") {
        // Entering the lens always cancels an in-flight gesture.
        set({ session: { ...s, interaction: idleInteraction() } });
      }
      set({ lensActive: on });
    },

    setCodexOpen: (open) => set({ codexOpen: open }),

    setFocusedBead: (focusedBeadId) => set({ focusedBeadId }),

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
          : { firstFoundAt: Date.now(), count: 1 };
      }
      const motifPoints = motifs.reduce((sum, m) => sum + m.points, 0);
      // Insight accrues from what deserves it: luminous finds and motifs.
      const earnedInsight = (finalized.kind === "curated" ? 1 : 0) + motifs.length;
      set({
        codex,
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
        id: `${s.seed}-${Date.now()}`,
        seed: s.seed,
        endedAt: Date.now(),
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
