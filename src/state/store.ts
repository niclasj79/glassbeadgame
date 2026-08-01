import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { LensView } from "@/game/layout";
import { initialQualityTier, prefersReducedMotion, type QualityTier } from "@/lib/device";
import type {
  Interaction,
  Phase,
  SessionState,
  SessionStartProjection,
  Settings,
} from "./types";

/**
 * THE PRESENTATION STORE
 *
 * What is left after the legacy progression was removed. This store owns no
 * game rules: the canonical session is the replayed event log in
 * `state/domainSession`, outcomes are resolved by `src/domain/**`, and the
 * conclusion is compiled from that log.
 *
 * Everything here is either a phase flag, a device/taste setting, or the
 * compatibility projection the scene and the audio engine read for bead ids,
 * framing and the ambient bed. Score, Insight, the Codex, ranks, the session
 * archive, lifetime totals, milestone unlocks and the daily record are gone —
 * ADR-010 replaces the score with the portrait, and none of them had a
 * consumer left once the legacy corpus was deleted.
 *
 * Only `settings` is persisted. There is no durable progression to carry.
 */
interface GBGState {
  phase: Phase;
  lensActive: boolean;
  /** Which plane of the Lens triptych is showing (1 Good×True, 2 Good×Beautiful, 3 True×Beautiful). */
  lensView: LensView;
  settings: Settings;
  session: SessionState | null;
  focusedBeadId: string | null;
  /** A bead pinned open for reading (touch long-press); shows immediately. */
  pinnedInspectId: string | null;

  returnToTitle: () => void;
  applySessionStart: (projection: SessionStartProjection) => void;
  /** The Lens is a triptych: off → Good×True → Good×Beautiful → True×Beautiful → off. */
  cycleLens: () => void;
  setFocusedBead: (id: string | null) => void;
  setPinnedInspect: (id: string | null) => void;
  setMuted: (muted: boolean) => void;
  setBinaural: (on: boolean) => void;
  setQualityTier: (tier: QualityTier) => void;
  markHintSeen: (id: string) => void;
  /** Moves the phase to the conclusion. The durable record is the event log. */
  finishConcluding: () => void;
}

const idleInteraction = (): Interaction => ({
  mode: "idle",
  fromId: null,
  sticky: false,
  reveal: null,
});

/** What survives across sessions: taste settings, and nothing else. */
interface PersistedSlice {
  settings: Pick<Settings, "muted" | "binaural" | "hintsSeen">;
}

export const useStore = create<GBGState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        phase: "title",
        lensActive: false,
        lensView: 1 as LensView,
        settings: {
          muted: false,
          binaural: true,
          qualityTier: initialQualityTier(),
          reducedMotion: prefersReducedMotion(),
          hintsSeen: {},
        },
        session: null,
        focusedBeadId: null,
        pinnedInspectId: null,

        returnToTitle: () =>
          set({
            phase: "title",
            session: null,
            lensActive: false,
            focusedBeadId: null,
            pinnedInspectId: null,
          }),

        applySessionStart: (projection) => {
          const session: SessionState = {
            ...projection,
            disciplines: [...projection.disciplines],
            beadIds: [...projection.beadIds],
            threads: projection.threads.map((thread) => ({ ...thread })),
            discoveries: projection.discoveries.map((discovery) => ({ ...discovery })),
            motifs: projection.motifs.map((motif) => ({
              ...motif,
              beads: motif.beads ? [...motif.beads] : undefined,
            })),
            interaction: { ...projection.interaction },
          };
          set({
            phase: "arena",
            session,
            lensActive: false,
            focusedBeadId: null,
            pinnedInspectId: null,
          });
        },

        cycleLens: () => {
          const st = get();
          if (st.session && st.session.interaction.mode !== "idle") {
            // Entering the lens always cancels an in-flight gesture.
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

        finishConcluding: () => {
          const s = get().session;
          if (!s) return;
          set({
            phase: "conclusion",
            session: { ...s, interaction: idleInteraction() },
            lensActive: false,
            focusedBeadId: null,
            pinnedInspectId: null,
          });
        },
      }),
      {
        name: "gbg.v1",
        version: 1,
        partialize: (s): PersistedSlice => ({
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
