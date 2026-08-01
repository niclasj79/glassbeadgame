/**
 * THE WORLD'S SUBSCRIPTION, IN ONE PLACE.
 *
 * `planCues.ts` declares `scene`, `camera` and `haptics` on nearly every plan.
 * Attaching them one at a time, from wherever happened to be convenient, is how
 * two of the three ended up declared and unsubscribed for the whole life of the
 * campaign. One call takes all three, and one returned function detaches all
 * three, so a channel cannot be forgotten by omission.
 *
 * The bus dispatches per channel, so each director gets its own listener: a
 * single listener registered on two channels would answer every cue twice.
 */
import type { CueBus } from "../cues";
import type { HapticsDirector } from "./createHapticsDirector";
import type { SceneDirector } from "./createSceneDirector";

export interface WorldDirectors {
  readonly scene: SceneDirector;
  readonly haptics: HapticsDirector;
}

/** Subscribe the world's three channels. Returns one unsubscribe for all. */
export function attachWorldDirectors(
  bus: CueBus,
  directors: WorldDirectors
): () => void {
  const detachers = [
    bus.subscribe("scene", (cue) => directors.scene.handleScene(cue)),
    bus.subscribe("camera", (cue) => directors.scene.handleCamera(cue)),
    bus.subscribe("haptics", (cue) => directors.haptics.handleCue(cue)),
  ];
  return () => {
    for (const detach of detachers) detach();
  };
}
