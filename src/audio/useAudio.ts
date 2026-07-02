import { useEffect } from "react";
import { useStore } from "@/state/store";
import { audio } from "./engine";
import { ambient } from "./ambient";
import { discoveryChord, faintDyad, setAimTension, conclusionCadence } from "./sfx";
import { noteForConcept } from "./theory";
import { conceptById } from "@/content/concepts";

/**
 * The single React↔audio contact point. Mounted once in App; drives the
 * engine from store subscriptions. High-frequency events (hover) bypass this
 * and call sfx directly from the pointer layer.
 */
export function AudioBridge(): null {
  const muted = useStore((s) => s.settings.muted);

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  // Unlock on the first gesture anywhere (autoplay policy).
  useEffect(() => {
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
    const unsubs = [
      // Ambient lifecycle follows the phase.
      useStore.subscribe(
        (s) => s.phase,
        (phase) => {
          if (phase === "arena") ambient.start();
          else if (phase === "title" || phase === "setup") ambient.stop();
          // conclusion: the ambient continues under the mandala.
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
    .map((id) => conceptById.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => noteForConcept(c));
}
