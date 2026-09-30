/**
 * THE PRODUCTION WIRING — the only file in `src/audio` that knows about both
 * the engine and the cue bus.
 *
 * Everything above it is either pure planning or a seam. This is where the seams
 * are filled: the sink schedules real Web Audio on the real clock, the content
 * lookup is the real Castalia pack, and the director subscribes to the `audio`
 * channel of the real cue bus.
 *
 * The look-ahead scheduler runs on its own interval, but every time it stores is
 * an absolute AudioContext time, so the Web Audio clock stays authoritative and
 * a scene pulse can be aligned to a note by reading the same number.
 */
import { CASTALIA_LOOKUP } from "@/content/castalia";
import type { CueBus } from "@/runtime/cues";
import { currentTheme } from "@/themes/useTheme";
import { ambient } from "./ambient";
import { HAND_DIVISION, conductor } from "./conductor";
import {
  createAudioDirector,
  type AudioCaption,
  type AudioCaptionListener,
  type AudioDirector,
  type AudioSink,
  type ThreadVoiceListener,
} from "./director";
import { audio } from "./engine";
import { CASTALIA_MODE } from "./mode";
import { createScoreFeed, publishPlanLights } from "./planLights";
import { createLookaheadScheduler } from "./scheduler";

/**
 * The conductor's score, fed a little ahead: what the director writes far
 * ahead (Attunement, the conclusion) goes on as it nears, pumped by the semantic
 * scheduler's own loop.
 */
const scoreFeed = createScoreFeed(conductor);

export const semanticScheduler = createLookaheadScheduler({
  onTick: scoreFeed.pump,
});

/**
 * The production sink.
 *
 * `quantize()` defers to the ambient engine's grid, so a relation lands in time
 * with the piece rather than wherever the pointer happened to be released — the
 * same behaviour the prototype's discovery chord already had, extended to
 * everything the semantic layer plays. `quantizeHand()` asks the conductor for
 * the same grid's sixteenth, where the focus lane answers the hand (ADR-016).
 *
 * `slotSeconds()` is the world's slot: the grid's while the bed keeps it, the
 * world's own before the bed has started, so the director's rhythm unit is the
 * sixteenth of the world in the room and not of Castalia in every world.
 *
 * `conduct()` puts every note of every plan the director schedules on the
 * conductor, before the plan is played, muted or not — the near ones at once,
 * the far ones as they near. Muted, nothing is played and so nothing else would
 * start the scheduler's loop that brings them; conducting starts it.
 *
 * `pulseFill()` and `pulseSecondVoice()` hand the bed's pulse its highlights
 * (ADR-017): the bed decides which slot a weave's fill rolls into, and what the
 * space and the intensity leave of it.
 */
const sink: AudioSink = {
  now: () => audio.now(),
  quantize: () => ambient.quantize(),
  quantizeHand: (leadSeconds) => conductor.next(HAND_DIVISION, leadSeconds),
  slotSeconds: () => conductor.slotSeconds() || currentTheme().music.slotSeconds,
  conduct: (plan, atSeconds) => {
    publishPlanLights(scoreFeed, plan, atSeconds);
    if (scoreFeed.pending() > 0) semanticScheduler.start();
  },
  play: (plan, atSeconds) => {
    audio.ensure();
    semanticScheduler.start();
    semanticScheduler.schedule(plan, atSeconds);
  },
  retire: (planId, atSeconds, fadeSeconds) =>
    semanticScheduler.retire(planId, atSeconds, fadeSeconds),
  setSpace: (density, bed) => ambient.setSpace(density, bed),
  activeVoiceCount: () => ambient.activeVoiceCount(),
  concludeAt: (atSeconds, fadeSeconds) =>
    ambient.concludeAt(atSeconds, fadeSeconds),
  pulseFill: (atSeconds) => ambient.requestFill(atSeconds),
  pulseSecondVoice: (untilSlots) => ambient.requestSecondVoice(untilSlots),
};

export const productionSink: AudioSink = Object.freeze(sink);

export const audioDirector: AudioDirector = createAudioDirector({
  sink: productionSink,
  lookup: CASTALIA_LOOKUP,
  mode: CASTALIA_MODE,
});

/** Subscribe the director to a cue bus. Returns an unsubscribe function. */
export function attachAudioDirector(bus: CueBus): () => void {
  return bus.subscribe("audio", (cue) => audioDirector.handleCue(cue));
}

// ─── The captioned path, as a public API ────────────────────────────────────

/**
 * THE AUDIO CAPTION FEED.
 *
 * Every plan the director makes produces a caption, whether or not anything is
 * audible — the muted path is the same information leaving by a second door, not
 * a fallback that runs when sound fails. These two functions are that door, and
 * they are the whole contract: a caption surface needs nothing else from
 * `src/audio`, and in particular needs no AudioContext, no engine, and no
 * knowledge of plans.
 *
 * Usage from a React caption region:
 *
 * ```ts
 * const [caption, setCaption] = useState(lastAudioCaption);
 * useEffect(() => onAudioCaption(setCaption), []);
 * ```
 *
 * Each `AudioCaption` carries:
 *  - `text`     one or two sentences describing what the music is doing;
 *  - `planId`   stable identity, so a region can key or de-duplicate on it;
 *  - `kind`     which sort of moment produced it (`relation`, `attunement`,
 *               `conclusion`, `attention`, `ensemble`, or `system`);
 *  - `outcome`  the epistemic state — `documented`, `open-thread`,
 *               `unresolved`, or `null` where none applies (CAV-006). These are
 *               different states of knowledge and a caption surface may present
 *               them differently; it must not present them as better and worse;
 *  - `urgency`  always `polite`. Nothing the audio layer says interrupts.
 *
 * `onAudioCaption` returns its own unsubscribe. `lastAudioCaption` exists so a
 * region mounted after a moment has passed still shows it rather than a blank.
 */
export function onAudioCaption(listener: AudioCaptionListener): () => void {
  return audioDirector.onCaption(listener);
}

/** The most recent caption, or null before anything has been said. */
export function lastAudioCaption(): AudioCaption | null {
  return audioDirector.lastCaption();
}

/**
 * Subscribe to "this thread is sounding now". The scene lights the strand from
 * it; nothing else in the game may read it as a claim about the relation.
 */
export function onThreadVoice(listener: ThreadVoiceListener): () => void {
  return audioDirector.onThreadVoice(listener);
}

/** Stop the semantic scheduler and drop everything pending, heard or seen. */
export function stopSemanticAudio(): void {
  semanticScheduler.stop();
  scoreFeed.clear();
  audioDirector.reset();
}
