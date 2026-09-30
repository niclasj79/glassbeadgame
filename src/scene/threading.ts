import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { cancelGliss, hoverPing, latchTick, selectTick } from "@/audio/sfx";
import {
  RELATION_INTENTIONS,
  type InputModality,
  type RelationIntention,
} from "@/domain/events";
import { toConceptId, toThreadId } from "@/domain/ids";
import { isCoarsePointer } from "@/lib/device";
import {
  productionInterpretation,
  type GesturePoint,
} from "@/runtime/interpretation";
import { presentationNow } from "@/runtime/testMode";
import { interpretationDraftStore } from "@/state/interactionDraft";
import {
  focusPresentationStore,
  readFocusView,
} from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import {
  DWELL_TIMING,
  SIGHT_TIMING,
  createSettler,
  type SettleTimers,
} from "./dwell";
import { frameState } from "./frameState";
import {
  nearestThreadAt,
  pickRadiusFor,
  projectThreadCurves,
  threadCurves,
} from "./threadPicking";

/**
 * THE POINTER AND KEY LAYER OF THE FOCUS VIEW (I-015 … I-020).
 *
 * Everything a hand does to the world arrives here and leaves as a call on the
 * production interpretation — never as a rule of its own. The interpretation
 * decides what a press means at each stage; this decides only which bead,
 * which sigil or which strand the hand is on, and *when* a look has lasted
 * long enough to count.
 *
 *   roaming   a pointer resting on a bead dwells: its card opens (I-015); a
 *             click on a woven strand reopens it (I-019)
 *   focus     the pointer is a lens: the renderer sees what it covers at once,
 *             the card and the cue only once it has settled (I-017, I-018);
 *             its path is the weave's approach (I-020)
 *   any       a press on a bead is the act — attend, lock, re-lock (I-016)
 *   locked    a sigil hovered is heard; pressed and held, it weaves; released
 *             over itself, it commits (I-016, I-020)
 *
 * Escape and an unambiguous background click step back one stage (I-010,
 * I-011); neither ever touches the durable log.
 */

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 600;
/**
 * How far from the pointer the lens still sights a bead (I-017). The lens is a
 * disc, not a crosshair: nothing here asks for aim.
 */
const MOUSE_SIGHT_RADIUS_PX = 64;
const TOUCH_SIGHT_RADIUS_PX = 88;
/**
 * How far past a sigil's edge a release still counts as over it. Less than
 * half the clearance the plate keeps between two stations
 * (`framing.CONTROL_CLEARANCE`), so a slipping finger is forgiven and a
 * release can never be counted over a neighbouring sigil.
 */
const RELEASE_SLOP_PX = 8;

type GestureMode = "idle" | "tap";

interface PointerPosition {
  readonly clientX: number;
  readonly clientY: number;
  readonly pressure?: number;
}

interface GestureState {
  pointerId: number;
  pointerType: string;
  mode: GestureMode;
  startX: number;
  startY: number;
  pressedBeadId: string | null;
  pressTimer: number | null;
  moved: boolean;
  longPressed: boolean;
}

const gesture: GestureState = {
  pointerId: -1,
  pointerType: "mouse",
  mode: "idle",
  startX: 0,
  startY: 0,
  pressedBeadId: null,
  pressTimer: null,
  moved: false,
  longPressed: false,
};

export const threadingEnv = {
  camera: null as THREE.Camera | null,
  dom: null as HTMLCanvasElement | null,
  controls: null as { enabled: boolean } | null,
};

const cameraPosition = new THREE.Vector3();
const candidatePosition = new THREE.Vector3();
const projected = new THREE.Vector3();
const cameraSpace = new THREE.Vector3();
let ignoreArenaMissUntil = 0;
/** The woven strand under a roaming pointer, for the cursor only. */
let hoveredThreadId: string | null = null;

function inputModality(pointerType: string): InputModality {
  if (pointerType === "touch") return "touch";
  if (pointerType === "pen") return "pen";
  return "mouse";
}

function normalizedPoint(position: PointerPosition): GesturePoint {
  const rect = threadingEnv.dom?.getBoundingClientRect();
  const width = rect?.width ?? window.innerWidth;
  const height = rect?.height ?? window.innerHeight;
  const left = rect?.left ?? 0;
  const top = rect?.top ?? 0;
  return {
    xViewport: THREE.MathUtils.clamp((position.clientX - left) / width, 0, 1),
    yViewport: THREE.MathUtils.clamp((position.clientY - top) / height, 0, 1),
    ...(position.pressure === undefined
      ? {}
      : { pressure: THREE.MathUtils.clamp(position.pressure, 0, 1) }),
  };
}

/* ────────────────────────────────────────────────────────────────────── *
 * LOOKS THAT SETTLE — the dwell and the lens (dwell.ts)
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Real time on both sides: the settle is scheduled with the browser's timer
 * and measured with its clock, so the two cannot disagree. (The deterministic
 * test clock only moves when a test moves it; a timer measured against it
 * would wait for ever.)
 */
const settleTimers: SettleTimers = {
  set: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clear: (handle) => window.clearTimeout(handle),
};
const settleClock = (): number => performance.now();

const dwellShown = (): string | null => {
  const id = focusPresentationStore.getState().dwellConceptId;
  return id === null ? null : String(id);
};

const sightShown = (): string | null => {
  const id = focusPresentationStore.getState().sightedConceptId;
  return id === null ? null : String(id);
};

/** A roaming bead's card, opened by resting on it (I-015). */
const dwellLook = createSettler<string>({
  timing: DWELL_TIMING,
  now: settleClock,
  timers: settleTimers,
  read: dwellShown,
  write: (id) =>
    productionInterpretation.dwell(id === null ? null : toConceptId(id)),
});

/** The bead the lens has settled on — the card in the gap and its cue (I-018). */
const sightLook = createSettler<string>({
  timing: SIGHT_TIMING,
  now: settleClock,
  timers: settleTimers,
  read: sightShown,
  write: (id) => {
    productionInterpretation.sight(id === null ? null : toConceptId(id));
    // The lens has caught a bead: its own articulation, said once, when the
    // sighting settles — never for every bead a sweep passes over, and never
    // hover's ping (see sfx.latchTick).
    if (id !== null && sightShown() === id) latchTick(id);
  },
});

/** Nothing attended, no pair held, no thread reopened. */
function isRoaming(): boolean {
  return readFocusView().mode === "roaming";
}

/** Attending and not weaving: the pointer is a lens (I-017). */
function lensIsUp(): boolean {
  return (
    interpretationDraftStore.getState().draft.stage === "attending" &&
    !productionInterpretation.isHolding()
  );
}

/**
 * The bead nearest the pointer on screen, within the lens's radius — or none.
 * Nearer to the camera wins a tie, so the bead you can see is the one sighted.
 */
function nearestBeadAt(
  position: PointerPosition,
  pointerType: string,
  excludeId: string | null
): string | null {
  const camera = threadingEnv.camera;
  const dom = threadingEnv.dom;
  if (!camera || !dom) return null;
  const rect = dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  camera.updateMatrixWorld();
  camera.getWorldPosition(cameraPosition);
  const radius =
    pointerType === "touch" || pointerType === "pen"
      ? TOUCH_SIGHT_RADIUS_PX
      : MOUSE_SIGHT_RADIUS_PX;
  const rendered = frameState.rendered;
  let nearestId: string | null = null;
  let nearestScreenDistance = radius;
  let nearestCameraDistance = Number.POSITIVE_INFINITY;

  for (const [id, index] of frameState.beadIndex) {
    if (id === excludeId) continue;
    candidatePosition.set(
      rendered[index * 3],
      rendered[index * 3 + 1],
      rendered[index * 3 + 2]
    );
    cameraSpace.copy(candidatePosition).applyMatrix4(camera.matrixWorldInverse);
    if (cameraSpace.z >= 0) continue;
    projected.copy(candidatePosition).project(camera);
    if (
      projected.z < -1 ||
      projected.z > 1 ||
      Math.abs(projected.x) > 1.08 ||
      Math.abs(projected.y) > 1.08
    ) {
      continue;
    }
    const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
    const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
    const screenDistance = Math.hypot(
      position.clientX - screenX,
      position.clientY - screenY
    );
    const distanceToCamera = candidatePosition.distanceToSquared(cameraPosition);
    if (
      screenDistance < nearestScreenDistance ||
      (Math.abs(screenDistance - nearestScreenDistance) < 0.5 &&
        distanceToCamera < nearestCameraDistance)
    ) {
      nearestId = id;
      nearestScreenDistance = screenDistance;
      nearestCameraDistance = distanceToCamera;
    }
  }
  return nearestId;
}

/** The lens is down: nothing is being sighted, and nothing may settle late. */
function putLensDown(): void {
  frameState.lens.active = false;
  frameState.snapId = null;
  sightLook.reset();
}

/**
 * THE LENS (I-017). While a bead is attended the pointer is a lens. Its
 * position is written to the frame (never to a store), and the bead nearest
 * under it is caught *at once* for the renderer — that is looking, and it must
 * answer the hand. The card in the gap and the sighting's cue wait until the
 * lens has stayed (`SIGHT_SETTLE_MS`), so a sweep across the arena reads as a
 * sweep and not as a column flipping through cards. Every move is also a
 * sample of the weave's approach (I-020).
 */
function updateLens(event: PointerEvent): void {
  const draft = interpretationDraftStore.getState().draft;
  if (
    draft.stage !== "attending" ||
    productionInterpretation.isHolding() ||
    useStore.getState().phase !== "arena"
  ) {
    if (frameState.lens.active || frameState.snapId !== null) putLensDown();
    return;
  }
  const point = normalizedPoint(event);
  frameState.lens.x = point.xViewport;
  frameState.lens.y = point.yViewport;
  frameState.lens.active = true;
  productionInterpretation.recordApproach(point, inputModality(event.pointerType));
  const nearest = nearestBeadAt(
    event,
    event.pointerType || "mouse",
    String(draft.attendedConceptId)
  );
  frameState.snapId = nearest;
  sightLook.observe(nearest);
}

/**
 * A roaming pointer resting on a bead opens its card (I-015). Touch has no
 * hover, so a finger never dwells: its ways to a card are the long press and
 * the details control, as they always were.
 */
function noteDwell(id: string | null, pointerType: string | undefined): void {
  if (pointerType === "touch") return;
  if (useStore.getState().phase !== "arena" || !isRoaming()) {
    dwellLook.reset();
    return;
  }
  dwellLook.observe(id);
}

/* ────────────────────────────────────────────────────────────────────── *
 * WOVEN STRANDS — picking one to reopen (threadPicking.ts, I-019)
 * ────────────────────────────────────────────────────────────────────── */

/** The committed strand passing nearest a point on the page, within reach. */
function threadAt(
  clientX: number,
  clientY: number,
  pointerType: string | undefined
): string | null {
  const camera = threadingEnv.camera;
  const dom = threadingEnv.dom;
  if (!camera || !dom || threadCurves.size === 0) return null;
  const rect = dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  camera.updateMatrixWorld();
  return nearestThreadAt(
    { x: clientX - rect.left, y: clientY - rect.top },
    projectThreadCurves(camera, rect.width, rect.height),
    pickRadiusFor(pointerType)
  );
}

/**
 * A woven strand says it can be touched the only way a canvas can: by the
 * cursor. Only while roaming — the one state a strand can be reopened from —
 * and only over the arena itself, never through the column.
 */
function updateThreadHover(event: PointerEvent): void {
  const next =
    threadCurves.size > 0 &&
    threadingEnv.dom !== null &&
    event.target === threadingEnv.dom &&
    event.pointerType !== "touch" &&
    gesture.mode === "idle" &&
    useStore.getState().phase === "arena" &&
    isRoaming()
      ? threadAt(event.clientX, event.clientY, event.pointerType)
      : null;
  if (next === hoveredThreadId) return;
  hoveredThreadId = next;
  refreshCursor();
}

function clearPressTimer(): void {
  if (gesture.pressTimer !== null) window.clearTimeout(gesture.pressTimer);
  gesture.pressTimer = null;
}

/**
 * THE POINTER SAYS WHAT IS UNDER IT.
 *
 * A canvas has no elements, so nothing tells a browser to change the cursor: it
 * has to be said, in the one place that knows a bead — or a woven strand — is
 * under the pointer. It is restored from what the frame actually says is
 * hovered, which is also true after a release.
 */
function refreshCursor(): void {
  const dom = threadingEnv.dom;
  if (!dom) return;
  dom.style.cursor =
    frameState.hoveredId !== null || hoveredThreadId !== null ? "pointer" : "";
}

/**
 * HANDING THE SIGHTLINE BACK TAKES A MOMENT LONGER THAN LETTING GO.
 *
 * `CameraRig` abandons a queued camera phrase from its *frame* callback, and
 * only while the controls are disabled. The phrase in question is queued by a
 * React commit, and a commit driven from a canvas pointer event is not a
 * discrete React event: it is flushed at default priority, one or two frames
 * after the hand let go. Traced on the running build, clicking a bead:
 * attention landed at 12 ms, the controls came back on the next animation
 * frame, and the attend lean was queued at 28 ms — after the hold had ended,
 * so nothing dropped it.
 *
 * So the hold is counted in *frames of the world*, not in callbacks of the
 * browser, and it outlives the release by enough of them for the commit to have
 * landed. A tenth of a second in which the orbit is still held: unmeasurable by
 * a hand, decisive for the pose.
 */
const POSE_HOLD_FRAMES = 8;
let cameraHoldFrames = 0;

function releaseCameraHold(): void {
  if (!threadingEnv.controls) return;
  cameraHoldFrames = POSE_HOLD_FRAMES;
}

function advanceCameraHold(): void {
  if (cameraHoldFrames <= 0) return;
  cameraHoldFrames -= 1;
  if (cameraHoldFrames > 0) return;
  const controls = threadingEnv.controls;
  // A new gesture may already own the sightline; it will release it in turn.
  if (controls && gesture.mode === "idle") controls.enabled = true;
}

/**
 * Whether a hand on a bead holds the sightline — pressing now, or in the few
 * frames after its release. A held camera reports itself settled, so anything
 * waiting for a pose (the sigil plate) must not take the hold for the pose.
 */
export const isSightlineHeld = (): boolean =>
  gesture.mode !== "idle" || cameraHoldFrames > 0;

/**
 * THE POINTER LAYER'S FRAME TICK.
 *
 * Driven from the scene's frame loop rather than from a timer, because the
 * camera hold is a promise about *frames*. It also puts the lens down, and
 * forgets a dwell in progress, the moment the focus view stops asking for
 * them — a keyboard Lock, a Cancel, a commit — rather than on the next move of
 * a hand that may not move again.
 */
export function advancePointerFrame(): void {
  advanceCameraHold();
  const draft = interpretationDraftStore.getState().draft;
  if (
    (frameState.lens.active || frameState.snapId !== null) &&
    (draft.stage !== "attending" || productionInterpretation.isHolding())
  ) {
    putLensDown();
  }
  if (
    dwellLook.observed() !== null &&
    (draft.stage !== "inactive" || focusPresentationStore.getState().reopened !== null)
  ) {
    dwellLook.reset();
  }
}

function endGesture(): void {
  const suppressMiss = gesture.moved;
  clearPressTimer();
  releaseCameraHold();
  if (threadingEnv.dom && gesture.pointerId >= 0) {
    try {
      if (threadingEnv.dom.hasPointerCapture(gesture.pointerId)) {
        threadingEnv.dom.releasePointerCapture(gesture.pointerId);
      }
    } catch {
      // Pointer capture is best effort.
    }
  }
  gesture.pointerId = -1;
  gesture.pointerType = "mouse";
  gesture.mode = "idle";
  gesture.pressedBeadId = null;
  gesture.moved = false;
  gesture.longPressed = false;
  if (suppressMiss) ignoreArenaMissUntil = performance.now() + 250;
  refreshCursor();
}

/* ────────────────────────────────────────────────────────────────────── *
 * THE WEAVE'S HOLD, FROM THE SIGIL'S SIDE (I-016, I-020)
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Who began the hold in progress. The interpretation knows only *that* a hold
 * is open; the release has to come from the same hand — the same pointer, or
 * the keyboard's Enter — or a key lifted during a pointer's hold would weave
 * it, and a second finger lifted elsewhere would abandon it.
 */
type SigilHold =
  | Readonly<{ kind: "pointer"; pointerId: number }>
  | Readonly<{ kind: "keyboard" }>;
let sigilHold: SigilHold | null = null;

/**
 * A weave let go of into nothing: the hold is abandoned, the chosen reading
 * stays held, and the downward gliss says the gesture was heard and refused.
 */
function abandonHold(): void {
  sigilHold = null;
  if (!productionInterpretation.isHolding()) return;
  cancelGliss();
  productionInterpretation.cancelHold();
}

function cancelActiveGesture(): void {
  abandonHold();
  if (gesture.mode !== "idle") endGesture();
}

function beginGesture(
  event: ThreeEvent<PointerEvent>,
  id: string,
  mode: GestureMode
): void {
  gesture.pointerId = event.pointerId;
  gesture.pointerType = event.pointerType || "mouse";
  gesture.mode = mode;
  gesture.startX = event.clientX;
  gesture.startY = event.clientY;
  gesture.pressedBeadId = id;
  gesture.moved = false;
  gesture.longPressed = false;
  cameraHoldFrames = 0;
  if (threadingEnv.controls) threadingEnv.controls.enabled = false;
  try {
    threadingEnv.dom?.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best effort.
  }
}

export const isSceneGestureActive = (): boolean => gesture.mode !== "idle";

export function beadPointerHandlers(id: string) {
  return {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (useStore.getState().phase !== "arena") return;
      frameState.hoveredId = id;
      useStore.getState().setFocusedBead(id);
      // While a bead is attended the pointer is a lens, and the lens has its
      // own voice — the settled sighting's catch. Hover's ping on top of it
      // would say the same bead twice, and say it on every bead a sweep
      // crosses.
      if (!lensIsUp() && frameState.snapId !== id) hoverPing(id);
      noteDwell(id, event.pointerType);
      refreshCursor();
    },
    /**
     * An enter event can be missed — a bead that grows under a still pointer,
     * a canvas that mounts beneath one, a capture that swallowed the crossing —
     * and the cursor is the only thing on this canvas that says a bead is a
     * thing you may touch. Saying it again on every move over the bead costs a
     * string comparison and closes every one of those holes. The same move is
     * what a dwell rests on.
     */
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      if (gesture.mode !== "idle") return;
      if (useStore.getState().phase !== "arena") return;
      event.stopPropagation();
      if (frameState.hoveredId !== id) {
        frameState.hoveredId = id;
        useStore.getState().setFocusedBead(id);
      }
      noteDwell(id, event.pointerType);
      refreshCursor();
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      if (frameState.hoveredId === id) frameState.hoveredId = null;
      if (
        frameState.snapId !== id &&
        useStore.getState().focusedBeadId === id
      ) {
        useStore.getState().setFocusedBead(null);
      }
      // Leaving this bead — the one being dwelt on, or the one whose card is
      // open. Arriving on the next one says so itself.
      if (dwellLook.observed() === id || dwellShown() === id) {
        noteDwell(null, event.pointerType);
      }
      refreshCursor();
    },
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      const state = useStore.getState();
      if (state.phase !== "arena" || !state.session || state.lensActive) return;
      event.stopPropagation();
      if (gesture.mode !== "idle" || productionInterpretation.isHolding()) {
        event.nativeEvent.preventDefault();
        return;
      }
      frameState.idleSince = presentationNow();
      state.setFocusedBead(id);
      productionInterpretation.closeInspection();
      // A press is a decision, and a decision is not a look: nothing waiting
      // on the dwell may open a card after it.
      dwellLook.reset();
      selectTick(id);

      /**
       * THE PRESS *IS* THE ACT (I-016). Roaming, it attends; attending, it
       * locks the second bead; with a pair held, it replaces the second bead.
       * Setting it on the way down means the camera is held by the gesture
       * while the new pose is composed, so the world never moves out from
       * under the finger and then back. The release only hands the sightline
       * back.
       */
      beginGesture(event, id, "tap");
      productionInterpretation.activateConcept(toConceptId(id));
      // A finger held still on a bead asks for the bead itself. The press has
      // already opened it; this adds the reading, and never a weave.
      if (event.pointerType === "touch" || isCoarsePointer()) {
        gesture.pressTimer = window.setTimeout(() => {
          gesture.pressTimer = null;
          if (gesture.pressedBeadId !== id || gesture.moved) return;
          gesture.longPressed = true;
          productionInterpretation.inspect(toConceptId(id));
          hoverPing(id);
        }, LONG_PRESS_MS);
      }
    },
  };
}

export function handlePointerMove(event: PointerEvent): void {
  updateLens(event);
  updateThreadHover(event);
  if (event.pointerId !== gesture.pointerId || !gesture.pressedBeadId) return;
  const crossed =
    Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >=
    DRAG_THRESHOLD_PX;
  if (crossed) {
    gesture.moved = true;
    clearPressTimer();
  }
}

export function handlePointerUp(event: PointerEvent): void {
  if (event.pointerId !== gesture.pointerId || !gesture.pressedBeadId) return;
  endGesture();
}

export function handlePointerCancel(event: PointerEvent): void {
  if (event.pointerId === gesture.pointerId) cancelActiveGesture();
}

/**
 * The window has lost the player's hand: whatever it was holding is let go,
 * no look still in progress may land after it has gone, and the next click is
 * judged on its own rather than as the tail of a drag that ended before.
 */
export function handleWindowBlur(): void {
  if (gesture.mode !== "idle" || productionInterpretation.isHolding()) {
    cancelActiveGesture();
  }
  sigilHold = null;
  ignoreArenaMissUntil = 0;
  dwellLook.reset();
  sightLook.reset();
}

/** The click R3F reports when nothing interactive was under it. */
export interface ArenaMissEvent {
  readonly type: string;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
  /** Present when the browser dispatches clicks as pointer events. */
  readonly pointerType?: string;
}

/**
 * A click on no bead (R3F's `onPointerMissed`).
 *
 * Roaming, a primary click that lands on a woven strand reopens it (I-019) —
 * a strand has no hit geometry, so the miss is the only way a click on one
 * ever arrives. Anything else is the background, and an unambiguous click on
 * the background steps back one stage (I-011): a drag that ended here, a
 * gesture or a hold in progress is not unambiguous.
 */
export function handleArenaMiss(event?: ArenaMissEvent): void {
  if (
    useStore.getState().phase !== "arena" ||
    isSceneGestureActive() ||
    productionInterpretation.isHolding() ||
    performance.now() < ignoreArenaMissUntil
  ) {
    return;
  }
  if (
    event !== undefined &&
    event.type === "click" &&
    event.button === 0 &&
    isRoaming()
  ) {
    const threadId = threadAt(
      event.clientX,
      event.clientY,
      event.pointerType ?? (isCoarsePointer() ? "touch" : "mouse")
    );
    if (threadId !== null) {
      productionInterpretation.reopenThread(toThreadId(threadId));
      hoveredThreadId = null;
      refreshCursor();
      return;
    }
  }
  productionInterpretation.cancel();
}

/**
 * ESCAPE — ONE STEP BACK PER PRESS (I-010 as adapted by I-016, I-019).
 *
 * A hold first (the chosen reading stays held), then an open inspection, then
 * one stage of the draft — reading → locked → attending → roaming — or a
 * reopened thread back to the arena. A key held down auto-repeats, and a
 * repeat is not a second decision.
 */
export function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.repeat) return;
  if (gesture.mode !== "idle" || productionInterpretation.isHolding()) {
    cancelActiveGesture();
    return;
  }
  if (useStore.getState().pinnedInspectId) {
    productionInterpretation.closeInspection();
    return;
  }
  productionInterpretation.cancel();
}

/** The DOM id of a reading's sigil — one spelling, shared by the plate and the keyboard. */
export const sigilControlId = (intention: RelationIntention): string =>
  `intention-control-${intention}`;

/** What a sigil's pointer handlers need of the element they are on. */
export interface SigilTarget {
  setPointerCapture(pointerId: number): void;
  getBoundingClientRect(): Readonly<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
}

export interface SigilPointerEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pressure: number;
  readonly currentTarget: SigilTarget;
  stopPropagation(): void;
}

export interface SigilKeyEvent {
  readonly key: string;
  readonly repeat: boolean;
  preventDefault(): void;
}

export interface SigilClickEvent {
  readonly detail: number;
  stopPropagation(): void;
}

export interface SigilHandlers {
  readonly onPointerEnter: (event: SigilPointerEvent) => void;
  readonly onPointerLeave: (event: SigilPointerEvent) => void;
  readonly onPointerDown: (event: SigilPointerEvent) => void;
  readonly onPointerMove: (event: SigilPointerEvent) => void;
  readonly onPointerUp: (event: SigilPointerEvent) => void;
  readonly onPointerCancel: (event: SigilPointerEvent) => void;
  readonly onLostPointerCapture: (event: SigilPointerEvent) => void;
  readonly onKeyDown: (event: SigilKeyEvent) => void;
  readonly onKeyUp: (event: SigilKeyEvent) => void;
  readonly onClick: (event: SigilClickEvent) => void;
}

/**
 * Where the hand is, as the gesture profile measures it: the same
 * viewport-normalised frame as the lens path. Pressure only from a device that
 * measures it — a mouse reports 0.5 for any held button, which is a
 * placeholder rather than a measurement, and the profile must not record a
 * fabricated one (I-020: "pointer pressure where available").
 */
function sigilPoint(event: SigilPointerEvent): GesturePoint {
  const measured = event.pointerType === "pen" || event.pointerType === "touch";
  return normalizedPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    ...(measured ? { pressure: event.pressure } : {}),
  });
}

function releasedOver(target: SigilTarget, clientX: number, clientY: number): boolean {
  const rect = target.getBoundingClientRect();
  return (
    clientX >= rect.left - RELEASE_SLOP_PX &&
    clientX <= rect.right + RELEASE_SLOP_PX &&
    clientY >= rect.top - RELEASE_SLOP_PX &&
    clientY <= rect.bottom + RELEASE_SLOP_PX
  );
}

function pairIsHeld(): boolean {
  const stage = interpretationDraftStore.getState().draft.stage;
  return stage === "locked" || stage === "reading";
}

function isHeldBy(event: SigilPointerEvent): boolean {
  return sigilHold?.kind === "pointer" && sigilHold.pointerId === event.pointerId;
}

/**
 * The keyboard reaches a reading: focus moves to its sigil, and — because a
 * radiogroup's selection follows its focus — the reading is chosen, and heard,
 * as the keyboard arrives on it (I-016).
 */
function moveToSigil(intention: RelationIntention): void {
  document.getElementById(sigilControlId(intention))?.focus();
  productionInterpretation.chooseReading(intention);
}

function sigilAfterKey(
  key: string,
  intention: RelationIntention
): RelationIntention | null {
  const order = RELATION_INTENTIONS;
  const index = order.indexOf(intention);
  if (key === "ArrowRight" || key === "ArrowDown") {
    return order[(index + 1) % order.length];
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return order[(index - 1 + order.length) % order.length];
  }
  if (key === "Home") return order[0];
  if (key === "End") return order[order.length - 1];
  return null;
}

/**
 * ONE SIGIL'S HANDS (I-016).
 *
 *   pointer over       the reading is *heard* on the locked pair, not chosen
 *   pointer down       the reading is chosen and the hold begins (captured)
 *   released over it   the weave commits — a quick click is a short hold
 *   released elsewhere the hold is abandoned; the reading stays chosen
 *   Enter held         the keyboard's hold; released, it commits (I-009)
 *   Space, arrows      choose — a radiogroup's selection follows its focus
 *
 * All four sigils receive exactly these hands. Nothing here, and nothing the
 * plate draws, may know which reading the record prefers.
 */
export function sigilHandlers(intention: RelationIntention): SigilHandlers {
  return Object.freeze({
    onPointerEnter: (event: SigilPointerEvent) => {
      // Touch has no hover: a finger arriving is already a press, and the
      // press chooses.
      if (event.pointerType === "touch") return;
      productionInterpretation.previewReading(intention);
    },

    onPointerLeave: (event: SigilPointerEvent) => {
      if (event.pointerType === "touch") return;
      if (focusPresentationStore.getState().previewIntention !== intention) return;
      productionInterpretation.previewReading(null);
    },

    onPointerDown: (event: SigilPointerEvent) => {
      // The arena behind the plate never learns of a press on it.
      event.stopPropagation();
      // One hold at a time, and the interpretation is the judge of whether one
      // is open: a hold something else let go of is not still in the way.
      if (
        event.button !== 0 ||
        productionInterpretation.isHolding() ||
        !pairIsHeld()
      ) {
        return;
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best effort.
      }
      productionInterpretation.beginHold(
        inputModality(event.pointerType),
        sigilPoint(event),
        intention
      );
      sigilHold = Object.freeze({ kind: "pointer", pointerId: event.pointerId });
    },

    onPointerMove: (event: SigilPointerEvent) => {
      if (!isHeldBy(event) || !productionInterpretation.isHolding()) return;
      productionInterpretation.updateHold(sigilPoint(event));
    },

    onPointerUp: (event: SigilPointerEvent) => {
      event.stopPropagation();
      if (!isHeldBy(event)) return;
      if (!productionInterpretation.isHolding()) {
        // Escape, or a lost window, already let this hold go.
        sigilHold = null;
        return;
      }
      if (!releasedOver(event.currentTarget, event.clientX, event.clientY)) {
        abandonHold();
        return;
      }
      sigilHold = null;
      productionInterpretation.commitHold(sigilPoint(event));
    },

    onPointerCancel: (event: SigilPointerEvent) => {
      if (isHeldBy(event)) abandonHold();
    },

    onLostPointerCapture: (event: SigilPointerEvent) => {
      // After a release this is already over; otherwise the hand was taken
      // away without letting go, and that is not a weave.
      if (isHeldBy(event)) abandonHold();
    },

    onKeyDown: (event: SigilKeyEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.repeat || productionInterpretation.isHolding() || !pairIsHeld()) {
          return;
        }
        productionInterpretation.beginHold("keyboard", undefined, intention);
        sigilHold = Object.freeze({ kind: "keyboard" });
        return;
      }
      const next = event.key === " " ? intention : sigilAfterKey(event.key, intention);
      if (next === null) return;
      event.preventDefault();
      // A reading cannot change under a hold in progress: the hold is the
      // weave of the reading it began with.
      if (productionInterpretation.isHolding()) return;
      if (next === intention) productionInterpretation.chooseReading(intention);
      else moveToSigil(next);
    },

    onKeyUp: (event: SigilKeyEvent) => {
      if (event.key !== "Enter" || sigilHold?.kind !== "keyboard") return;
      event.preventDefault();
      sigilHold = null;
      if (productionInterpretation.isHolding()) productionInterpretation.commitHold();
    },

    onClick: (event: SigilClickEvent) => {
      // Behind the plate a click would be a background click (I-011) or a
      // strand picked (I-019); the plate is neither.
      event.stopPropagation();
      // Pointer presses weave through the hold; only a coordinate-free
      // activation — an assistive technology's — chooses here.
      if (event.detail === 0) productionInterpretation.chooseReading(intention);
    },
  });
}
