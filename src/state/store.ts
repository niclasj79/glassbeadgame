import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { DisciplineId } from "@/content/types";
import { drawSession } from "@/game/session";
import { initialQualityTier, prefersReducedMotion, type QualityTier } from "@/lib/device";
import type {
  CodexEntry,
  Discovery,
  Interaction,
  MotifAward,
  Phase,
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
  lifetimeStats: { sessions: number; totalScore: number };

  goToSetup: () => void;
  returnToTitle: () => void;
  beginSession: (picks: DisciplineId[]) => void;
  setLens: (on: boolean) => void;
  setCodexOpen: (open: boolean) => void;
  setMuted: (muted: boolean) => void;
  setQualityTier: (tier: QualityTier) => void;
  markHintSeen: (id: string) => void;

  setInteraction: (partial: Partial<Interaction>) => void;
  addThread: (thread: Thread) => void;
  /** Returns the finalized discovery (newToCodex resolved against the codex). */
  addDiscovery: (discovery: Discovery, motifs: MotifAward[]) => Discovery;
  concludeSession: () => void;
  finishConcluding: () => void;
}

const idleInteraction = (): Interaction => ({
  mode: "idle",
  fromId: null,
  sticky: false,
  reveal: null,
});

export const useStore = create<GBGState>()(
  subscribeWithSelector((set, get) => ({
    phase: "title",
    lensActive: false,
    codexOpen: false,
    settings: {
      muted: false,
      qualityTier: initialQualityTier(),
      reducedMotion: prefersReducedMotion(),
      hintsSeen: {},
    },
    session: null,
    codex: {},
    lifetimeStats: { sessions: 0, totalScore: 0 },

    goToSetup: () => set({ phase: "setup" }),

    returnToTitle: () =>
      set({ phase: "title", session: null, lensActive: false, codexOpen: false }),

    beginSession: (picks) => {
      const draw = drawSession(picks);
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
      };
      set({ phase: "arena", session, lensActive: false });
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

    setMuted: (muted) => set((st) => ({ settings: { ...st.settings, muted } })),

    setQualityTier: (qualityTier) =>
      set((st) => ({ settings: { ...st.settings, qualityTier } })),

    markHintSeen: (id) =>
      set((st) => ({
        settings: { ...st.settings, hintsSeen: { ...st.settings.hintsSeen, [id]: true } },
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
      set({
        codex,
        session: {
          ...s,
          discoveries: [...s.discoveries, finalized],
          motifs: [...s.motifs, ...motifs],
          score: s.score + finalized.points + motifPoints,
        },
      });
      return finalized;
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
      set((st) => ({
        phase: "conclusion",
        session: { ...s, interaction: idleInteraction() },
        lifetimeStats: {
          sessions: st.lifetimeStats.sessions + 1,
          totalScore: st.lifetimeStats.totalScore + s.score,
        },
      }));
    },
  }))
);
