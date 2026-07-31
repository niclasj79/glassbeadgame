import { useEffect } from "react";
import { useStore } from "@/state/store";
import { cueBus } from "@/runtime/cues";
import { audio } from "./engine";
import { ambient } from "./ambient";
import { discoveryChord, faintDyad, setAimTension, conclusionCadence } from "./sfx";
import { beadVoice } from "./theory";
import { attachAudioDirector, audioDirector, stopSemanticAudio } from "./productionAudio";
import { testMode } from "@/runtime/testMode";

/**
 * The single React↔audio contact point. Mounted once in App; drives the engine
 * from store subscriptions, and attaches the audio director to the cue bus.
 *
 * The two halves are deliberately different in kind. Store subscriptions drive
 * the *legacy* prototype paths, which are being retired. The cue subscription
 * drives the semantic layer, and it is the only one that will remain: a cue
 * carries meaning plus timing, so audio, scene, and camera cannot disagree about
 * when a moment happened (ADR-009).
 *
 * High-frequency events (hover) bypass this and call sfx directly from the
 * pointer layer.
 */
export function AudioBridge(): null {
  const muted = useStore((s) => s.settings.muted);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);

  useEffect(() => {
    if (testMode.enabled) return;
    audio.setMuted(muted);
  }, [muted]);

  /**
   * Intensity, and the two accessible paths.
   *
   * Muted is not "audio off" as far as the director is concerned — it is the
   * captioned path, and captions keep being emitted for every plan. Reduced
   * motion carries reduced audio intensity with it, per CAV-007: thinner,
   * slower-beating, gentler onsets, with the Tension still present.
   */
  useEffect(() => {
    audioDirector.setIntensity(
      muted ? "silent" : reducedMotion ? "reduced" : "full"
    );
  }, [muted, reducedMotion]);

  /** The semantic layer's only subscription. */
  useEffect(() => {
    if (testMode.enabled) return;
    const detach = attachAudioDirector(cueBus);
    return () => {
      detach();
      stopSemanticAudio();
    };
  }, []);

  // Unlock on the first gesture anywhere (autoplay policy).
  useEffect(() => {
    if (testMode.enabled) return;
    const unlock = () => {
      audio.ensure();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (testMode.enabled) return;
    const unsubs = [
      // Ambient + binaural lifecycle follow the phase.
      useStore.subscribe(
        (s) => s.phase,
        (phase) => {
          if (phase === "arena") {
            ambient.start();
            // Re-seat the session's existing voices (e.g. after a reveal
            // detour or a mid-session reload).
            const sess = useStore.getState().session;
            for (const t of sess?.threads ?? []) ambient.addThreadVoice(t.id, t.a, t.b);
            for (const m of sess?.motifs ?? []) {
              if (m.beads) ambient.addMotifPattern(m.motifId, m.beads);
            }
            if (useStore.getState().settings.binaural) audio.startBinaural();
          } else if (phase === "title" || phase === "setup") {
            ambient.stop();
            ambient.clearSpace();
            audio.stopBinaural();
            stopSemanticAudio();
          }
          // conclusion: ambient and bed continue under the mandala.
        }
      ),

      // The binaural switch takes effect immediately, mid-session.
      useStore.subscribe(
        (s) => s.settings.binaural,
        (on) => {
          const inCosmos =
            useStore.getState().phase === "arena" ||
            useStore.getState().phase === "conclusion";
          if (on && inCosmos) audio.startBinaural();
          else if (!on) audio.stopBinaural();
        }
      ),

      // Each woven thread joins the choir.
      useStore.subscribe(
        (s) => s.session?.threads.length ?? 0,
        (n, prev) => {
          if (n > prev) {
            const threads = useStore.getState().session?.threads;
            const t = threads?.[threads.length - 1];
            if (t) ambient.addThreadVoice(t.id, t.a, t.b);
          }
        }
      ),

      // Each completed motif takes a permanent seat in the ensemble.
      useStore.subscribe(
        (s) => s.session?.motifs.length ?? 0,
        (n, prev) => {
          if (n > prev) {
            const motifs = useStore.getState().session?.motifs;
            const m = motifs?.[motifs.length - 1];
            if (m?.beads) ambient.addMotifPattern(m.motifId, m.beads);
          }
        }
      ),

      // Discoveries sound by kind.
      useStore.subscribe(
        (s) => s.session?.discoveries.length ?? 0,
        (n, prev) => {
          if (n > prev) {
            const ds = useStore.getState().session?.discoveries;
            const d = ds?.[ds.length - 1];
            if (!d) return;
            if (d.kind === "curated") discoveryChord(d);
            else faintDyad(d);
          }
        }
      ),

      // Aim tension hums only while a thread is being aimed.
      // (The cancel gliss is fired directly by threading.cancelGesture.)
      useStore.subscribe(
        (s) => s.session?.interaction.mode ?? "idle",
        (mode) => {
          setAimTension(mode === "threading");
          if (mode === "concluding") conclusionCadence(sessionPitches());
        }
      ),

      // The web's growth swells the ambient floor.
      useStore.subscribe(
        (s) => s.session?.score ?? 0,
        (score) => audio.setAmbientIntensity(score)
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  return null;
}

/** Conclusion helper: all identity pitches of the session's discoveries. */
export function sessionPitches(): number[] {
  const s = useStore.getState().session;
  if (!s) return [];
  const ids = new Set<string>();
  for (const d of s.discoveries) {
    ids.add(d.a);
    ids.add(d.b);
  }
  return [...ids]
    .map((id) => beadVoice(id))
    .filter((v): v is NonNullable<typeof v> => !!v)
    .map((v) => v.freq);
}
