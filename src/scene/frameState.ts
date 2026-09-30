import type { SceneStage } from "@/runtime/scene";
import { presentationNow } from "@/runtime/testMode";
import { useStore } from "@/state/store";
import { currentTheme } from "@/themes/useTheme";

/**
 * Per-frame mutable state shared across scene components, deliberately outside
 * React: positions morph, time dilates, and idleness accrues at 60Hz — none of
 * that may touch the store.
 */
export const frameState = {
  /** Current xyz per session bead (index order = session.beadIds). */
  positions: new Float32Array(0),
  /** Morph destination xyz per bead. */
  targets: new Float32Array(0),
  beadIndex: new Map<string, number>(),
  /** Global time multiplier — eased toward 0.15 during a reveal. */
  timeScale: 1,
  timeScaleTarget: 1,
  /** Dilated elapsed time — advances by dt * timeScale; drives bobbing and drift. */
  clock: 0,
  /** The Breath: one ~0.1 Hz meditative oscillation shared by bloom, halos,
   *  lattice, and (via a throttled bridge) the ambient bus. Radians. */
  breathPhase: 0,
  /** 0..1 — eased down during reveals and to 0 under reduced motion. */
  breathDepth: 1,
  /** True while a layout morph (lens toggle) is in flight; threads re-sample curves. */
  morphActive: false,
  /** Last user interaction with the camera or beads (performance.now()). */
  idleSince: 0,
  /** World-space pointer aim point while threading (set by the threading driver). */
  aim: { x: 0, y: 0, z: 0, active: false },
  hoveredId: null as string | null,
  /**
   * The lens (I-017): where the pointer is while a bead is attended, in
   * viewport-normalised coordinates (0..1, origin top-left). Written by the
   * pointer layer, read by the fog; never a store field, because it moves at
   * the rate of the hand.
   */
  lens: { x: 0.5, y: 0.5, active: false },
  /** Bead currently magnetized as the thread's landing candidate. */
  snapId: null as string | null,
  /** Motif pulses scheduled by the ambient engine (audio-clock timestamps). */
  pulses: [] as { threadId: string; atAudioTime: number; duration: number; flip: boolean }[],
  /** Pending particle-burst spawn requests, consumed by scene/Bursts. */
  bursts: [] as {
    x: number;
    y: number;
    z: number;
    color: string;
    count: number;
    speed: number;
  }[],
  /** Starfield flare (0..1, decays) — the sky answers a discovery. */
  flare: 0,
  /** Camera FOV impact kick (0..1, decays). */
  kick: 0,
  /** The stage awakens: eased luminousFound/curatedAvailable (0..1).
   *  Nebulae brighten, the lattice lifts, the music thickens with it. */
  awakening: 0,
  /** After a reveal's camera focus, drift the orbit target home so the
   *  arena's center is the screen's center again. */
  recenter: false,
  /** Final rendered position per bead (positions + bob), written by Beads each frame. */
  rendered: new Float32Array(0),
  /**
   * False while a scripted camera transit is in flight, and from the moment a
   * new layout is published until the first frame has been drawn with it. A
   * bead's screen position is meaningless before then — it would be reported
   * from a camera that is about to be replaced — so the test adapter reports
   * such a bead as off screen rather than lying about where to click it.
   */
  cameraSettled: false,
  /**
   * Frames drawn since the current bead layout was published. Positions exist
   * in these arrays the instant the layout is computed, but nothing can be
   * pointed at until the scene has actually drawn with them — so the test
   * adapter waits for a few real frames before answering "where is this bead".
   */
  framesSinceLayout: 0,
};

export function initFramePositions(beadIds: string[], initial: Float32Array): void {
  frameState.positions = initial.slice();
  frameState.targets = initial.slice();
  frameState.rendered = initial.slice();
  frameState.snapId = null;
  frameState.beadIndex = new Map(beadIds.map((id, i) => [id, i]));
  frameState.morphActive = false;
  frameState.timeScale = 1;
  frameState.timeScaleTarget = 1;
  frameState.clock = 0;
  frameState.hoveredId = null;
  frameState.aim.active = false;
  // A previous Game's answer may not bleed into this one: the sky, the camera
  // and the particle queue all start silent.
  frameState.flare = 0;
  frameState.kick = 0;
  frameState.bursts.length = 0;
  frameState.cameraSettled = false;
  frameState.framesSinceLayout = 0;
  frameState.idleSince = presentationNow();
}

export function setMorphTargets(targets: Float32Array): void {
  frameState.targets = targets.slice();
  frameState.morphActive = true;
}

/** Queue a particle burst for scene/Bursts to spawn. */
export function emitBurst(
  at: [number, number, number],
  color: string,
  count: number,
  speed = 1.1
): void {
  frameState.bursts.push({ x: at[0], y: at[1], z: at[2], color, count, speed });
}

export function beadPosition(id: string): [number, number, number] | null {
  const i = frameState.beadIndex.get(id);
  if (i === undefined) return null;
  const p = frameState.positions;
  return [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
}

/**
 * Where a bead is actually being *drawn* — positions plus this frame's bob.
 * A burst spawned from `beadPosition` starts a visible distance from the sphere
 * it is supposed to be leaving.
 */
function renderedPosition(id: string): [number, number, number] | null {
  const i = frameState.beadIndex.get(id);
  if (i === undefined) return null;
  const r = frameState.rendered;
  if (r.length < (i + 1) * 3) return null;
  return [r[i * 3], r[i * 3 + 1], r[i * 3 + 2]];
}

/**
 * THE WORLD, AS THE SCENE DIRECTOR SEES IT.
 *
 * `runtime/scene` decides *how much* the world answers and keeps that decision
 * pure and testable; this is the only place that knows the answer is written
 * into a Float32Array, read from a theme, or throttled by a comfort setting.
 *
 * Reduced motion is honoured here rather than in the director for the same
 * reason: it is a property of this player's browser, not of the moment.
 * Brightness survives it — a flare is light, not movement — while the camera
 * impact is removed outright and particles are slowed, because those are the
 * two that are felt in the inner ear.
 */
const ATTUNED_TIME_SCALE = 0.55;

function reducedMotion(): boolean {
  return useStore.getState().settings.reducedMotion;
}

export const frameStateStage: SceneStage = Object.freeze({
  flare: (amount: number) => {
    frameState.flare = Math.min(1, frameState.flare + Math.max(0, amount));
  },

  kick: (amount: number) => {
    if (reducedMotion()) return;
    frameState.kick = Math.min(1, frameState.kick + Math.max(0, amount));
  },

  burst: (conceptId: string, count: number, speed: number) => {
    const at = renderedPosition(conceptId);
    if (!at) return;
    const gentle = reducedMotion();
    emitBurst(
      at,
      currentTheme().palette.gold,
      gentle ? Math.ceil(count * 0.5) : count,
      gentle ? speed * 0.45 : speed
    );
  },

  setAttuned: (active: boolean) => {
    // The world is held rather than decorated: time itself thins, which every
    // shader, every drift and every particle already reads through
    // `frameState.clock`. Nothing new is drawn to say Attunement is on.
    frameState.timeScaleTarget = active ? ATTUNED_TIME_SCALE : 1;
  },

  touch: () => {
    frameState.idleSince = presentationNow();
  },
});
