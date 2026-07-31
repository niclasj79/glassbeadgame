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
import { ambient } from "./ambient";
import { createAudioDirector, type AudioDirector, type AudioSink } from "./director";
import { audio } from "./engine";
import { CASTALIA_MODE } from "./mode";
import { createLookaheadScheduler } from "./scheduler";

export const semanticScheduler = createLookaheadScheduler();

/**
 * The production sink.
 *
 * `quantize()` defers to the ambient engine's grid, so a relation lands in time
 * with the piece rather than wherever the pointer happened to be released — the
 * same behaviour the prototype's discovery chord already had, extended to
 * everything the semantic layer plays.
 */
const sink: AudioSink = {
  now: () => audio.now(),
  quantize: () => ambient.quantize(),
  play: (plan, atSeconds) => {
    audio.ensure();
    semanticScheduler.start();
    semanticScheduler.schedule(plan, atSeconds);
  },
  setSpace: (density, bed) => ambient.setSpace(density, bed),
  activeVoiceCount: () => ambient.activeVoiceCount(),
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

/** Stop the semantic scheduler and drop everything pending. */
export function stopSemanticAudio(): void {
  semanticScheduler.stop();
  audioDirector.reset();
}
