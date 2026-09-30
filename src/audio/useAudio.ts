import { useEffect } from "react";
import { useStore } from "@/state/store";
import { domainSessionStore } from "@/state/domainSession";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { cueBus } from "@/runtime/cues";
import { MOTIF_KINDS, type MotifKind } from "@/domain/motifs";
import type { SessionStateV1 } from "@/domain/model";
import { frameState } from "@/scene/frameState";
import { audio } from "./engine";
import { ambient } from "./ambient";
import { setAimTension } from "./sfx";
import { compositionReach } from "./reach";
import {
  attachAudioDirector,
  audioDirector,
  onThreadVoice,
  stopSemanticAudio,
} from "./productionAudio";
import { testMode } from "@/runtime/testMode";

/**
 * The single React↔audio contact point. Mounted once in App; drives the engine
 * from the canonical session, and attaches the audio director to the cue bus.
 *
 * ── What changed here, and why it was a blocker ─────────────────────────────
 *
 * Every subscription in this file used to read `useStore().session` — the
 * legacy presentation projection. That projection publishes `threads`,
 * `discoveries`, `motifs` and `score` EMPTY and nothing has written to them
 * since the legacy scoring model was removed, so all five subscribers were
 * no-ops: the choir never gained a voice, a completed motif never took its seat,
 * the aim tension never hummed (it was gated on `session.interaction.mode`,
 * which nothing sets to `"threading"`), and the bed's swell was driven by a
 * score that is always zero. Nothing the player wove reached the ambient bed.
 *
 * They now read the canonical session — the replayed event log in
 * `state/domainSession` — and the composition's own presentation store. The
 * choir follows committed threads, the ensemble follows completed motifs, the
 * aim tension follows the weaving gesture, and the bed follows *reach* rather
 * than a number: ADR-010 replaced the score with the portrait, so the room may
 * not get louder as points accumulate (`audio/reach.ts`).
 *
 * The two halves of this file remain different in kind. Store subscriptions
 * carry the *ambient bed*, which is texture. The cue subscription carries the
 * *semantic layer*, and only a cue may say what a moment meant (ADR-009).
 *
 * High-frequency events (hover) bypass this and call sfx directly from the
 * pointer layer.
 */

const EMPTY_THREAD_IDS: readonly string[] = Object.freeze([]);

/** A motif family the ensemble knows, or nothing. Never a guess. */
function asMotifKind(value: string): MotifKind | null {
  return (MOTIF_KINDS as readonly string[]).includes(value)
    ? (value as MotifKind)
    : null;
}

/** Seat every voice the canonical session already contains. Idempotent. */
function seatSession(session: SessionStateV1 | null): void {
  if (!session) return;
  for (const thread of session.threads) {
    ambient.addThreadVoice(
      String(thread.id),
      String(thread.pair[0]),
      String(thread.pair[1])
    );
  }
  for (const motif of session.completedMotifs) {
    const kind = asMotifKind(String(motif.motifKindId));
    if (kind === null) continue;
    ambient.addMotifPattern(
      String(motif.completionId),
      kind,
      motif.conceptIds.map((id) => String(id))
    );
  }
  audio.setAmbientReach(
    compositionReach({
      conceptCount: session.conceptIds.length,
      pairs: session.threads.map(
        (thread) => [String(thread.pair[0]), String(thread.pair[1])] as const
      ),
    })
  );
}

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

  /**
   * THE LIGHT ON THE STRAND.
   *
   * The director knows, on the audio clock, which thread is sounding and for
   * how long. `frameState.pulses` is the one channel the scene reads that on,
   * and `scene/Threads.tsx` is the consumer: a relation lights while its own
   * voice speaks, so the music and the picture are the same event rather than
   * two approximations of it (ARCHITECTURE §10).
   */
  useEffect(() => {
    if (testMode.enabled) return;
    return onThreadVoice((light) => {
      frameState.pulses.push({
        threadId: light.threadId,
        atAudioTime: light.atSeconds,
        duration: light.durationSeconds,
        // The relation grammar always states subject then answer, so a
        // director-published voice never reads from the far end. Only the
        // choir alternates, and it writes its own pulses.
        flip: false,
      });
      if (frameState.pulses.length > 24) {
        frameState.pulses.splice(0, frameState.pulses.length - 24);
      }
    });
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
    let seatedThreadIds: readonly string[] = EMPTY_THREAD_IDS;

    const unsubs = [
      // Ambient + binaural lifecycle follow the phase.
      useStore.subscribe(
        (s) => s.phase,
        (phase) => {
          if (phase === "arena") {
            ambient.start();
            // Re-seat the canonical session's existing voices — a mid-session
            // reload, or a replayed event log, arrives with threads already
            // committed and they must be audible without being re-woven.
            const session = domainSessionStore.getState().session;
            seatSession(session);
            seatedThreadIds = (session?.threads ?? []).map((thread) =>
              String(thread.id)
            );
            if (useStore.getState().settings.binaural) audio.startBinaural();
          } else if (phase === "title" || phase === "threshold") {
            ambient.stop();
            ambient.clearSpace();
            audio.stopBinaural();
            stopSemanticAudio();
            seatedThreadIds = EMPTY_THREAD_IDS;
          }
          /*
           * conclusion: the bed keeps sounding *under the performance* and is
           * then brought to an end by the director, which is the only thing
           * that knows when the coda speaks (`AudioSink.concludeAt`). This
           * branch deliberately does not stop it here: cutting the loop the
           * moment the phase changes would silence the room before the
           * performance had played a note, and stopping it at some guessed
           * delay afterwards would put the ending anywhere but on the last
           * sound. The loop ends where the music ends, or not at all.
           */
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

      /**
       * The canonical session: every woven thread joins the choir, every
       * completed motif takes a permanent seat, and the bed follows how far the
       * composition reaches. One subscription, because all three are the same
       * fact — the shape of what the player has built.
       */
      domainSessionStore.subscribe((state) => {
        const session = state.session;
        if (session === null) {
          seatedThreadIds = EMPTY_THREAD_IDS;
          return;
        }
        const ids = session.threads.map((thread) => String(thread.id));
        const seated = new Set(seatedThreadIds);
        // A replay replaces the whole log at once, so this must be a set
        // difference and not a length comparison.
        const isNew = ids.length !== seatedThreadIds.length || ids.some((id) => !seated.has(id));
        if (isNew) seatSession(session);
        seatedThreadIds = ids;
      }),

      /**
       * The aim tension hums only while a gesture is actually being made. It
       * used to be gated on `session.interaction.mode === "threading"`, and
       * nothing has set that mode since the legacy controller left, so it never
       * once sounded. The weaving flag is the composition's own statement that
       * a gesture is in flight.
       *
       * The cancel gliss is not fired from here. The pointer layer
       * (`scene/threading.ts`) plays it when a held gesture is cancelled, at
       * the moment of cancelling, because it is a response to the hand and not
       * to the presentation state this subscription reads.
       */
      interpretationPresentationStore.subscribe((state, previous) => {
        if (state.weaving !== previous.weaving) setAimTension(state.weaving);
      }),
    ];
    return () => {
      unsubs.forEach((u) => u());
      setAimTension(false);
    };
  }, []);

  return null;
}
