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
  /** True while a layout morph (lens toggle) is in flight; threads re-sample curves. */
  morphActive: false,
  /** Last user interaction with the camera or beads (performance.now()). */
  idleSince: 0,
  /** World-space pointer aim point while threading (set by the threading driver). */
  aim: { x: 0, y: 0, z: 0, active: false },
  hoveredId: null as string | null,
  /** Bead currently magnetized as the thread's landing candidate. */
  snapId: null as string | null,
  /** Thread to flash (duplicate weave attempt) + when the flash began. */
  pulseThreadId: null as string | null,
  pulseAt: 0,
  /** Final rendered position per bead (positions + bob), written by Beads each frame. */
  rendered: new Float32Array(0),
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
  frameState.idleSince = performance.now();
}

export function setMorphTargets(targets: Float32Array): void {
  frameState.targets = targets.slice();
  frameState.morphActive = true;
}

export function beadPosition(id: string): [number, number, number] | null {
  const i = frameState.beadIndex.get(id);
  if (i === undefined) return null;
  const p = frameState.positions;
  return [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
}
