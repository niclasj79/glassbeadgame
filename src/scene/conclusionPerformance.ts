import {
  ARENA_FOV,
  MAX_ELEVATION,
  maxTargetOffset,
  wrapAngle,
  type CameraPhrase,
  type OrbitPose,
} from "./framing";
import { createStore } from "zustand/vanilla";

/**
 * THE CONCLUSION, PERFORMED BY THE SCENE (VERTICAL-SLICE-SPEC §14).
 *
 * `domain/performance/compileConclusion.ts` has always compiled the concluded
 * event log into an ordered `CameraHint[]` — answer, traverse, hold, settle,
 * gather, widen, rest — each carrying the sentence that justifies it, plus the
 * climax the web's own weight located. Until this module existed those hints
 * had **no consumer anywhere**: `grep -rn CameraHint src/` returned the
 * compiler, the type file and the barrel. The scene sent the conclusion to one
 * fixed crown pose and never moved it again, so §14's "topology variables shape
 * camera, density, orchestration, and climax" and "the climax belongs to the
 * player's web" were compiled in full and performed by nothing.
 *
 * This is the scene's half: the hints turned into camera poses, and the times
 * at which each thread relights, on the clock the reading already uses.
 *
 * WHY THE LOGIC LIVES HERE AND NOT IN `CameraRig.tsx`.
 *
 * Importing the rig into a node suite pulls the renderer, the post-processing
 * stack and a GPU probe (see `cameraHold.test.ts`), so anything expressed there
 * can only be guarded by reading the source back as text. A performance is a
 * *sequence over time* — the one thing a regex cannot check. Everything with a
 * law in it is therefore pure and stateful-by-construction here, and the two
 * components that own it are glue: `CameraRig` gives the driver a frame and a
 * world sample, `Threads` asks which strands have arrived.
 *
 * THREE THINGS THIS IS NOT.
 *
 *  - **Not a cutscene.** `interrupt()` ends the performance for good, and the
 *    rig calls it the instant the player touches the orbit. A player who takes
 *    the camera keeps it; the remaining hints are dropped rather than queued.
 *    (Measured on the running build, that touch does not reach the canvas while
 *    the reading is up — see the note in `CameraRig`. The law is here and the
 *    rig honours it; the surface that swallows the press is elsewhere.)
 *  - **Not a ranking.** Every hint is performed identically whatever the
 *    outcome kind behind it was, and no strand lights brighter, sooner or
 *    longer for having been documented (CAV-006). `widen` answers the climax
 *    because §14 says the climax shapes the camera — it widens the frame onto
 *    the whole web, which is the opposite of pointing at one thread.
 *  - **Not a second compilation.** Nothing here decides *when* anything
 *    happens. Every time comes from the compiler, and the fallback for a thread
 *    the compiler dropped is the same one the register uses.
 */

/* ────────────────────────────────────────────────────────────────────── *
 * 1. THE PERFORMANCE, AS THE SCENE NEEDS IT
 * ────────────────────────────────────────────────────────────────────── */

/**
 * ONE HINT, ONE PHRASE — and the closed vocabulary of both.
 *
 * The camera's phrases are a closed set (`framing.CAMERA_PHRASES`), and each
 * hint kind is answered by the phrase whose *duration* already means what the
 * hint means: a breath for a hold, a dwell for an answer, the two-beat crown
 * for rest. Nothing invents a new motion character for the conclusion.
 *
 * This table is also the list of hints the scene knows how to perform, so the
 * two cannot drift: a kind with no phrase is a kind that is not performed.
 */
const PHRASE_BY_KIND = Object.freeze({
  answer: "dwell",
  traverse: "lean",
  hold: "breath",
  settle: "settle",
  gather: "settle",
  widen: "release",
  rest: "crown",
} as const satisfies Readonly<Record<string, CameraPhrase>>);

export type SceneHintKind = keyof typeof PHRASE_BY_KIND;

/**
 * A structural subset of `ConclusionPerformance`, declared rather than
 * imported — the same discipline `audio/conclusion.ts` and
 * `ui/screens/conclusionReveal.ts` follow, so the scene and the compiler stay
 * independently editable while the field names are still checked structurally
 * at the one place a real performance is narrowed.
 */
export interface PerformedCameraHint {
  readonly atSeconds: number;
  readonly kind: SceneHintKind;
  readonly conceptIds: readonly string[];
  readonly threadId: string | null;
  /** Why the camera is being asked to do this. Carried, never printed. */
  readonly reason: string;
}

export interface PerformedThreadEntry {
  readonly threadId: string;
  /** Creation order. The performance follows it exactly. */
  readonly order: number;
  readonly atSeconds: number;
  readonly durationSeconds: number;
}

export interface ScenePerformance {
  readonly sessionId: string;
  readonly secondsPerBeat: number;
  readonly totalSeconds: number;
  readonly camera: readonly PerformedCameraHint[];
  readonly entries: readonly PerformedThreadEntry[];
}

/**
 * Narrow the cue payload, which the cue contract types as `unknown` precisely
 * so a director cannot pretend to know more than it has been handed.
 *
 * The shape check is deliberately the same *depth* as `audio/director`'s
 * `isPerformanceScore`, which narrows this identical payload: the fields the
 * directors index into, and no further. The payload is our own compiler's
 * output crossing our own bus, so a deep field-by-field audit here would be
 * ceremony — but the two things this module *divides and compares with*, the
 * beat and the hint times, are checked, because a NaN in either is a
 * performance that never comes due.
 *
 * Returns null when there is nothing to perform. SILENCE BEATS FABRICATED
 * SIGNIFICANCE: a performance the scene cannot read leaves the conclusion
 * exactly as it was before this module existed rather than inventing a move.
 */
export function readScenePerformance(value: unknown): ScenePerformance | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<ScenePerformance>;
  if (typeof raw.sessionId !== "string" || raw.sessionId.length === 0) {
    return null;
  }
  const secondsPerBeat = raw.secondsPerBeat;
  if (typeof secondsPerBeat !== "number" || !(secondsPerBeat > 0)) return null;
  if (!Array.isArray(raw.camera) || !Array.isArray(raw.entries)) return null;

  /*
   * The compiler already sorts, on beats. Sorting on seconds here is not a
   * second opinion about the order — it is the guarantee the driver's cursor
   * depends on, stated where the cursor can rely on it. Copies, because a
   * director may not reorder the record it was handed.
   */
  const camera = raw.camera
    .filter((hint) => Number.isFinite(hint?.atSeconds) && hint.kind in PHRASE_BY_KIND)
    .sort((a, b) => a.atSeconds - b.atSeconds);
  if (camera.length === 0) return null;

  return {
    sessionId: raw.sessionId,
    secondsPerBeat,
    totalSeconds: Number(raw.totalSeconds) || 0,
    camera,
    entries: [...raw.entries].sort((a, b) => a.order - b.order),
  };
}

/* ────────────────────────────────────────────────────────────────────── *
 * 2. THE RUNNING PERFORMANCE — one copy, read by the rig and the strands
 * ────────────────────────────────────────────────────────────────────── */

export interface RunningConclusion {
  readonly performance: ScenePerformance;
  /** `presentationNow()` at the moment the cue was delivered. */
  readonly startedAtMs: number;
}

export interface ConclusionPerformanceState {
  readonly running: RunningConclusion | null;
}

/**
 * The camera director subscribes to the cue and writes here; the strands read.
 * A plain vanilla store rather than a second subscription so that the two halves
 * of one performance cannot start on two different milliseconds — which is
 * exactly the failure ADR-009's single bus exists to prevent, reintroduced one
 * level down.
 */
export const conclusionPerformanceStore =
  createStore<ConclusionPerformanceState>(() => ({ running: null }));

export function beginConclusionPerformance(
  performance: ScenePerformance,
  startedAtMs: number
): void {
  conclusionPerformanceStore.setState({ running: { performance, startedAtMs } });
}

/**
 * The running performance, but only if it is *this* session's.
 *
 * There is deliberately no way to clear it. A finished performance is filtered
 * out by identity the moment a new Game is drawn, which is remount-safe in a way
 * an explicit teardown is not: a canvas that loses its GL context mid-conclusion
 * rebuilds and picks the performance back up where it had reached, instead of
 * finding that its own unmount had thrown the reading's other half away.
 *
 * A player who concludes and immediately starts another Game would otherwise be
 * given the last Game's camera moves over the new arena, and its threads would
 * be held dark waiting for times that belong to a session that has ended.
 */
export function runningConclusionFor(
  running: RunningConclusion | null,
  sessionId: string | null
): RunningConclusion | null {
  if (running === null || sessionId === null) return null;
  return running.performance.sessionId === sessionId ? running : null;
}

/* ────────────────────────────────────────────────────────────────────── *
 * 3. WHEN EACH STRAND RELIGHTS
 * ────────────────────────────────────────────────────────────────────── */

/**
 * A floor under the beat, so a pathological tempo cannot collapse the fallback
 * to zero. `compileConclusion` keeps the tempo between 50 and 70 bpm, so this
 * never binds in practice; it exists so the function is total. Same constant,
 * same reason, as `conclusionReveal.ts`.
 */
const MIN_BEAT_SECONDS = 0.2;

/**
 * When each thread relights, in creation order, on the compiler's own times.
 *
 * The web is rebuilt in front of the player in the order they made it, and a
 * strand arrives at the same second its voice enters and its line reaches the
 * register — one moment in three media rather than three approximations of it.
 *
 * A thread the compiler has no entry for — it drops an outcome it cannot
 * resolve — is carried on the beat after the last voice, which is exactly what
 * the register does with the same case. Nothing may withhold a strand the
 * player wove, and nothing may reward one for having been documented: the map
 * is built from creation order and compiled times alone, and never reads an
 * outcome (CAV-006).
 */
export function threadLightingTimes(
  performance: ScenePerformance,
  threadIds: readonly string[]
): ReadonlyMap<string, number> {
  const beat = Math.max(MIN_BEAT_SECONDS, performance.secondsPerBeat);
  const byThread = new Map<string, PerformedThreadEntry>();
  for (const entry of performance.entries) {
    // An entry with no readable time is an entry that could never come due, and
    // a strand held for a time that never comes is a strand withheld.
    if (!Number.isFinite(entry.atSeconds)) continue;
    if (!byThread.has(entry.threadId)) byThread.set(entry.threadId, entry);
  }
  const times = new Map<string, number>();
  let voicesEnd = 0;
  for (const threadId of threadIds) {
    const entry = byThread.get(threadId);
    const at = entry ? entry.atSeconds : voicesEnd + beat;
    times.set(threadId, at);
    const ends = at + (entry ? entry.durationSeconds || 0 : 0);
    if (ends > voicesEnd) voicesEnd = ends;
  }
  return times;
}

/* ────────────────────────────────────────────────────────────────────── *
 * 4. A HINT, TURNED INTO A POSE
 * ────────────────────────────────────────────────────────────────────── */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const ORIGIN: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });

export interface PerformedFocus {
  /** Centroid of the beads this hint names. The arena's centre when it names none. */
  readonly centre: Vec3;
  /** Furthest named bead from that centroid. 0 for one bead, or none. */
  readonly spread: number;
  /** How many of the named beads the world could actually place. */
  readonly count: number;
  /** Unit axis through the pair, when exactly two were placed. */
  readonly axis: Vec3 | null;
}

export function focusFrom(points: readonly Vec3[]): PerformedFocus {
  const count = points.length;
  if (count === 0) return { centre: ORIGIN, spread: 0, count: 0, axis: null };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
    z += point.z;
  }
  const centre = { x: x / count, y: y / count, z: z / count };
  let spread = 0;
  for (const point of points) {
    spread = Math.max(
      spread,
      Math.hypot(point.x - centre.x, point.y - centre.y, point.z - centre.z)
    );
  }
  // An axis only means something for a pair: it is the line the Echo is
  // restated across and the line the Passage runs along.
  let axis: Vec3 | null = null;
  if (count === 2) {
    const to = {
      x: points[1].x - points[0].x,
      y: points[1].y - points[0].y,
      z: points[1].z - points[0].z,
    };
    const length = Math.hypot(to.x, to.y, to.z);
    if (length > 1e-6) {
      axis = { x: to.x / length, y: to.y / length, z: to.z / length };
    }
  }
  return { centre, spread, count, axis };
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/** Half the vertical field of view, as a tangent. The arena's lens, once. */
const TAN_HALF_FOV = Math.tan((ARENA_FOV * Math.PI) / 360);

/** Air left round whatever the hint named, so it never touches the frame edge. */
const FOCUS_AIR = 1.15;

/**
 * The crown is the one pose that deliberately leaves the level (see
 * `CameraRig`, "the concluding cinematic"), so it is not bounded by
 * `MAX_ELEVATION` — but it is held just off the pole, because an exactly
 * vertical sightline has no defined up vector and the horizon spins on it.
 */
export const CROWN_ELEVATION = Math.PI / 2 - 0.0015;

/** Level-bounded: a composing move may never throw the horizon out of frame. */
function level(elevation: number): number {
  return clamp(elevation, -MAX_ELEVATION, MAX_ELEVATION);
}

function azimuthOf(at: Vec3): number {
  return Math.atan2(at.x, at.z);
}

function elevationOf(at: Vec3): number {
  const length = Math.hypot(at.x, at.y, at.z);
  return length < 1e-6 ? 0 : Math.asin(clamp(at.y / length, -1, 1));
}

/**
 * The nearer of two opposite stations, expressed near `from`.
 *
 * Every station the pair's axis offers has an antipode that frames it
 * identically, so the camera always takes the short way round. A performance
 * that swung a hundred and eighty degrees to arrive at the same picture would
 * be motion for its own sake, and the comfort bound is not something to spend
 * on a move that shows nothing new.
 */
function nearerStation(base: number, from: number): number {
  const direct = from + wrapAngle(base - from);
  const opposite = from + wrapAngle(base + Math.PI - from);
  return Math.abs(direct - from) <= Math.abs(opposite - from) ? direct : opposite;
}

export interface PerformedPose {
  readonly distance: number;
  readonly azimuth: number;
  readonly elevation: number;
  readonly target: Vec3;
  readonly phrase: CameraPhrase;
  /** The hint this pose answers, carried for anything that wants to say why. */
  readonly kind: SceneHintKind;
  readonly reason: string;
}

export interface PerformedPoseRequest {
  readonly hint: PerformedCameraHint;
  readonly focus: PerformedFocus;
  /** Furthest bead in the whole web from the arena's centre. */
  readonly webRadius: number;
  /** Where the camera is now. Every pose is stated relative to it. */
  readonly from: OrbitPose;
  readonly minDistance: number;
  readonly maxDistance: number;
}

/**
 * Tension holds. The camera does not travel; it draws one short breath inward
 * and stays displaced, which is what `displacement` means in the compiler and
 * what the grammar draws on the strand itself.
 */
const HOLD_BREATH = 0.97;

export function performedPose(request: PerformedPoseRequest): PerformedPose {
  const { hint, focus, from, minDistance, maxDistance } = request;
  const webRadius = Math.max(request.webRadius, 1e-3);

  /** Distance at which something of this half-span fits the frame with air. */
  const fit = (halfSpan: number, scale = 1): number =>
    clamp(
      ((Math.max(0, halfSpan) + FOCUS_AIR) / TAN_HALF_FOV) * scale,
      minDistance,
      maxDistance
    );

  const focusAzimuth = focus.count === 0 ? from.azimuth : azimuthOf(focus.centre);
  const focusElevation =
    focus.count === 0 ? from.elevation : elevationOf(focus.centre);
  const axisAzimuth = focus.axis === null ? focusAzimuth : azimuthOf(focus.axis);

  /*
   * The default is the composing pose every kind starts from: framed on what
   * the hint named, from where the camera already stands. Each case below then
   * states only what it means *differently*, which is the whole of the
   * vocabulary in seven lines.
   */
  let distanceTo = fit(focus.spread);
  let azimuth = from.azimuth;
  let elevation = level(focusElevation);
  let aimAt: Vec3 = focus.centre;

  switch (hint.kind) {
    /*
     * ECHO. The answer restates the subject: the camera comes round until the
     * two stand *apart* on the frame — square to the axis between them — so the
     * restatement is something the eye can see happening across a gap.
     */
    case "answer":
      azimuth = nearerStation(axisAzimuth + Math.PI / 2, from.azimuth);
      elevation = level(from.elevation * 0.4 + focusElevation * 0.6);
      break;

    /*
     * PASSAGE. Something crosses from one body into another, so the camera
     * stands *along* that crossing and lets it run into depth, one beat of
     * travel to get there.
     */
    case "traverse":
      azimuth = nearerStation(axisAzimuth, from.azimuth);
      elevation = level(from.elevation * 0.5 + focusElevation * 0.5);
      distanceTo = fit(focus.spread, 1.15);
      break;

    /*
     * TENSION. Displaced, and it stays so. The one hint that does not travel:
     * the level, the station and very nearly the distance are the ones the
     * camera already had.
     */
    case "hold":
      elevation = from.elevation;
      distanceTo = clamp(from.distance * HOLD_BREATH, minDistance, maxDistance);
      break;

    /*
     * GROUND. One voice becomes a pedal beneath the other, and the camera goes
     * under with it — the level drops toward the lower of where it is and where
     * the ground lies, without turning.
     */
    case "settle":
      elevation = level(Math.min(from.elevation, focusElevation) - 0.18);
      distanceTo = fit(focus.spread, 1.1);
      break;

    /*
     * An ensemble: several voices have become one structure. The camera stands
     * where all of them are on one side of it and takes them in together.
     */
    case "gather":
      azimuth = nearerStation(focusAzimuth, from.azimuth);
      elevation = level(focusElevation * 0.55 + 0.12);
      break;

    /*
     * THE CLIMAX (§14: "the climax belongs to the player's web"). The heaviest
     * moment is answered by *widening onto the whole web* rather than by
     * pointing at the thread that carries it. Marking that thread would print a
     * best one, which is the number ADR-010 removed wearing a different hat.
     */
    case "widen":
      elevation = level(from.elevation + 0.22);
      distanceTo = fit(webRadius);
      aimAt = ORIGIN;
      break;

    /*
     * REST. The crown, which is where the concluding rise has always ended and
     * where it still ends — now as the last hint of a performance rather than
     * as the only thing the conclusion ever did.
     *
     * The compiler names the pair the ending is made of on this hint, so the
     * aim leans onto them by whatever room the instrument has left at crown
     * height: the last thing seen and the last thing heard are the same two
     * beads. It is a lean and not a pan — the whole web has to stay in the
     * frame it is being crowned in.
     */
    case "rest":
      elevation = CROWN_ELEVATION;
      distanceTo = clamp(webRadius * 2.6 + 3, minDistance, maxDistance);
      break;
  }

  /*
   * The aim may only leave the arena's centre by the room the instrument has
   * left over at this distance (`framing.maxTargetOffset`). Panning further
   * drags the armillary out of frame, and a conclusion that loses the web is
   * not a reading of it.
   */
  const offset = maxTargetOffset(distanceTo);
  const reach = Math.hypot(aimAt.x, aimAt.y, aimAt.z);
  const lean = reach > offset && reach > 1e-6 ? offset / reach : 1;

  return {
    distance: distanceTo,
    azimuth,
    elevation,
    target:
      lean === 1
        ? aimAt
        : { x: aimAt.x * lean, y: aimAt.y * lean, z: aimAt.z * lean },
    phrase: PHRASE_BY_KIND[hint.kind],
    kind: hint.kind,
    reason: hint.reason,
  };
}

/* ────────────────────────────────────────────────────────────────────── *
 * 5. THE DRIVER
 * ────────────────────────────────────────────────────────────────────── */

/**
 * How many hints have come due by `elapsedSeconds`.
 *
 * A tab that was throttled returns to a schedule it has already passed; the
 * cursor is carried forward over every hint it missed and only the last one is
 * performed, because performing four superseded poses in one frame is four
 * poses nobody sees followed by the one that was always going to win. Same
 * reasoning, same shape, as `conclusionReveal.delayMsFor`.
 *
 * The same rule settles hints the compiler puts at the *same* second, which is
 * not an edge case: the climax's `widen` is emitted at the beat of the entry
 * that carries it, so a real session hands the scene a `hold` and a `widen` on
 * one instant. The later hint wins, and the compiler's own order therefore
 * decides — the climax supersedes the entry it belongs to, which is what §14
 * asks for.
 */
export function hintsDueThrough(
  hints: readonly PerformedCameraHint[],
  cursor: number,
  elapsedSeconds: number
): number {
  let next = Math.max(0, cursor);
  while (next < hints.length && hints[next].atSeconds <= elapsedSeconds) {
    next += 1;
  }
  return next;
}

/**
 * How long the performance keeps the camera after its last hint: two beats of
 * crown plus a little, so the final rise finishes before the arena's idle drift
 * is allowed to take the instrument back.
 */
const REST_SETTLE_SECONDS = 3;

export interface ConclusionCameraSample {
  readonly running: RunningConclusion | null;
  readonly nowMs: number;
  /** Where the camera is this frame. */
  readonly from: OrbitPose;
  /** World position of a concept, or null if the arena has not placed it. */
  readonly beadAt: (conceptId: string) => Vec3 | null;
  readonly webRadius: number;
  readonly minDistance: number;
  readonly maxDistance: number;
}

export interface ConclusionCamera {
  /** The pose to perform this frame, or null when there is nothing due. */
  readonly advance: (sample: ConclusionCameraSample) => PerformedPose | null;
  /** The player took the camera. The rest of the performance is dropped. */
  readonly interrupt: () => void;
  /** True while the performance still owns the camera. */
  readonly owns: (nowMs: number) => boolean;
}

export function createConclusionCamera(): ConclusionCamera {
  let running: RunningConclusion | null = null;
  let cursor = 0;
  let interrupted = false;
  let ownedUntilMs = 0;

  const adopt = (next: RunningConclusion | null): void => {
    running = next;
    cursor = 0;
    interrupted = false;
    ownedUntilMs =
      next === null
        ? 0
        : next.startedAtMs +
          (next.performance.camera[next.performance.camera.length - 1]
            .atSeconds +
            REST_SETTLE_SECONDS) *
            1000;
  };

  // Annotated before freezing: Object.freeze severs the contextual typing that
  // would otherwise give these parameters their types from ConclusionCamera.
  const camera: ConclusionCamera = {
    advance: (sample) => {
      if (sample.running !== running) adopt(sample.running);
      if (running === null || interrupted) return null;

      const hints = running.performance.camera;
      const elapsed = (sample.nowMs - running.startedAtMs) / 1000;
      const next = hintsDueThrough(hints, cursor, elapsed);
      if (next === cursor) return null;
      cursor = next;

      const hint = hints[next - 1];
      const points: Vec3[] = [];
      for (const conceptId of hint.conceptIds) {
        const at = sample.beadAt(conceptId);
        if (at !== null) points.push(at);
      }
      return performedPose({
        hint,
        focus: focusFrom(points),
        webRadius: sample.webRadius,
        from: sample.from,
        minDistance: sample.minDistance,
        maxDistance: sample.maxDistance,
      });
    },

    interrupt: () => {
      if (running !== null) interrupted = true;
    },

    owns: (nowMs) =>
      running !== null && !interrupted && nowMs < ownedUntilMs,
  };
  return Object.freeze(camera);
}
