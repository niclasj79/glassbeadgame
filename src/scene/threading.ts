import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  cancelGliss,
  hoverPing,
  latchTick,
  selectTick,
  setSilkActive,
  updateSilk,
} from "@/audio/sfx";
import {
  RELATION_INTENTIONS,
  type ConceptPair,
  type InputModality,
  type RelationIntention,
} from "@/domain/events";
import { toConceptId } from "@/domain/ids";
import { isCoarsePointer } from "@/lib/device";
import { cueBus, planCandidateLatched } from "@/runtime/cues";
import { productionInterpretation } from "@/runtime/interpretation";
import { presentationNow } from "@/runtime/testMode";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { useStore } from "@/state/store";
import { frameState } from "./frameState";

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 600;
const MOUSE_SNAP_RADIUS_PX = 48;
const TOUCH_SNAP_RADIUS_PX = 72;

/**
 * How long the ribbon takes to fall back into the bead it left.
 *
 * A weave released onto nothing used to be *completely* silent: the capture was
 * discarded, the preview vanished between two frames, and the player was given
 * no evidence that the game had even seen the gesture. The recoil is the
 * refusal, said in the material the player was already holding — the ink runs
 * back down the thread — and it is short enough that it reads as a spring
 * rather than as a wait.
 */
const RECOIL_SECONDS = 0.26;
/** Time constant of the fall-back ease, in seconds. */
const RECOIL_TAU = 0.075;

type GestureMode = "idle" | "tap" | "load" | "aim";

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
  sourceBeadId: string | null;
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
  sourceBeadId: null,
  pressTimer: null,
  moved: false,
  longPressed: false,
};

export const threadingEnv = {
  camera: null as THREE.Camera | null,
  dom: null as HTMLCanvasElement | null,
  controls: null as { enabled: boolean } | null,
};

const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane();
const cameraDirection = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const sourcePosition = new THREE.Vector3();
const candidatePosition = new THREE.Vector3();
const projected = new THREE.Vector3();
const cameraSpace = new THREE.Vector3();
const freeAim = new THREE.Vector3();
let ignoreArenaMissUntil = 0;
let loadHoverElement: HTMLElement | null = null;
let lastMoveX = 0;
let lastMoveY = 0;
let smoothedSpeed = 0;

/**
 * A released weave falling back to its source. While this is live the capture
 * is deliberately still open, so `ThreadPreview` keeps drawing the same ribbon
 * with the same material — the recoil is the existing preview being pulled
 * home, not a second thing drawn on top of it.
 */
let recoil: { sourceId: string; remaining: number } | null = null;

function inputModality(pointerType: string): InputModality {
  if (pointerType === "touch") return "touch";
  if (pointerType === "pen") return "pen";
  return "mouse";
}

function normalizedPoint(position: PointerPosition) {
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

function setAimToBead(id: string): void {
  const index = frameState.beadIndex.get(id);
  if (index === undefined) return;
  const rendered = frameState.rendered;
  frameState.aim.x = rendered[index * 3];
  frameState.aim.y = rendered[index * 3 + 1];
  frameState.aim.z = rendered[index * 3 + 2];
  frameState.aim.active = true;
}

function updateAim(position: PointerPosition): void {
  const camera = threadingEnv.camera;
  const dom = threadingEnv.dom;
  const sourceId = gesture.sourceBeadId;
  if (!camera || !dom || !sourceId) return;
  const sourceIndex = frameState.beadIndex.get(sourceId);
  if (sourceIndex === undefined) return;

  const rect = dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  ndc.set(
    ((position.clientX - rect.left) / rect.width) * 2 - 1,
    -((position.clientY - rect.top) / rect.height) * 2 + 1
  );
  camera.updateMatrixWorld();
  raycaster.setFromCamera(ndc, camera);

  const rendered = frameState.rendered;
  sourcePosition.set(
    rendered[sourceIndex * 3],
    rendered[sourceIndex * 3 + 1],
    rendered[sourceIndex * 3 + 2]
  );
  camera.getWorldDirection(cameraDirection);
  aimPlane.setFromNormalAndCoplanarPoint(cameraDirection, sourcePosition);
  if (raycaster.ray.intersectPlane(aimPlane, freeAim)) {
    frameState.aim.x = freeAim.x;
    frameState.aim.y = freeAim.y;
    frameState.aim.z = freeAim.z;
  }
  frameState.aim.active = true;

  camera.getWorldPosition(cameraPosition);
  const radius =
    gesture.pointerType === "touch" || gesture.pointerType === "pen"
      ? TOUCH_SNAP_RADIUS_PX
      : MOUSE_SNAP_RADIUS_PX;
  let nearestId: string | null = null;
  let nearestScreenDistance = radius;
  let nearestCameraDistance = Number.POSITIVE_INFINITY;

  for (const [id, index] of frameState.beadIndex) {
    if (id === sourceId) continue;
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

  if (nearestId !== frameState.snapId) {
    frameState.snapId = nearestId;
    if (nearestId) {
      useStore.getState().setFocusedBead(nearestId);
      // Its own sound, not hover's (see sfx.latchTick) …
      latchTick(nearestId);
      // … and its own staged moment. `planCandidateLatched` was exported,
      // tested and never once published, so the scene, the camera and the
      // haptics channel had no idea the aim had acquired its other end.
      const draft = interpretationDraftStore.getState().draft;
      if (draft.stage === "armed") {
        const pair: ConceptPair = [
          draft.attendedConceptId,
          toConceptId(nearestId),
        ];
        cueBus.publish(
          planCandidateLatched({ pair, intention: draft.intention })
        );
      }
    }
  }
}

function intentionElementAtPoint(
  position: PointerPosition
): HTMLElement | null {
  return (
    document
    .elementFromPoint(position.clientX, position.clientY)
      ?.closest<HTMLElement>("[data-world-intention]") ?? null
  );
}

function updateLoadHover(position: PointerPosition): void {
  const next = intentionElementAtPoint(position);
  if (next === loadHoverElement) return;
  if (loadHoverElement) loadHoverElement.dataset.directHover = "false";
  loadHoverElement = next;
  if (loadHoverElement) loadHoverElement.dataset.directHover = "true";
}

function clearLoadHover(): void {
  if (loadHoverElement) loadHoverElement.dataset.directHover = "false";
  loadHoverElement = null;
}

function intentionAtPoint(position: PointerPosition): RelationIntention | null {
  const element = intentionElementAtPoint(position);
  const value = element?.dataset.worldIntention;
  return (RELATION_INTENTIONS as readonly string[]).includes(value ?? "")
    ? (value as RelationIntention)
    : null;
}

function clearPressTimer(): void {
  if (gesture.pressTimer !== null) window.clearTimeout(gesture.pressTimer);
  gesture.pressTimer = null;
}

/**
 * THE POINTER SAYS WHAT IS UNDER IT.
 *
 * A canvas has no elements, so nothing tells a browser to change the cursor: it
 * has to be said, in the one place that knows a bead is under the pointer. The
 * hover branch set it, and `endGesture` then blanked it unconditionally — so
 * the first press on a bead took the one cue the arena had and did not give it
 * back until the pointer left the bead and came back. This restores it from
 * what the frame actually says is hovered, which is also true after a release.
 */
function refreshCursor(): void {
  const dom = threadingEnv.dom;
  if (!dom) return;
  dom.style.cursor = frameState.hoveredId === null ? "" : "pointer";
}

/**
 * HANDING THE SIGHTLINE BACK TAKES A MOMENT LONGER THAN LETTING GO.
 *
 * `CameraRig` abandons a queued camera phrase from its *frame* callback, and
 * only while the controls are disabled — "the plate opens in the pose the
 * camera already has, not by moving the world out from under the finger and
 * then moving it back". The phrase in question is queued by a React commit, and
 * a commit driven from a canvas pointer event is not a discrete React event: it
 * is flushed at default priority, one or two frames after the hand let go.
 * Traced on the running build, clicking a bead: attention landed at 12 ms, the
 * controls came back on the next animation frame, and the attend lean was
 * queued at 28 ms — after the hold had ended, so nothing dropped it. The plate
 * opened 2.3 s later, which is the whole of B2 wearing a different hat.
 *
 * So the hold is counted in *frames of the world*, not in callbacks of the
 * browser, and it outlives the release by enough of them for the commit to have
 * landed and been refused. A tenth of a second in which the orbit is still
 * held: unmeasurable by a hand, decisive for the plate.
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
 * Begin the fall-back. The capture stays open on purpose: `ThreadPreview`
 * renders while the draft is armed *and* the presentation store says a weave is
 * in flight, so closing it here would delete the ribbon on the same frame the
 * refusal was supposed to be legible in.
 */
function beginRecoil(sourceId: string): void {
  recoil = { sourceId, remaining: RECOIL_SECONDS };
}

/**
 * End it — either because the ribbon arrived home, or because the player did
 * something else and no longer cares. Idempotent: every abort path calls it.
 */
export function finishRecoil(): void {
  if (!recoil) return;
  recoil = null;
  frameState.aim.active = false;
  if (productionInterpretation.isWeaving()) {
    productionInterpretation.cancelWeave();
  }
}

/**
 * THE POINTER LAYER'S FRAME TICK.
 *
 * Driven from the scene's frame loop rather than from a timer, so the ribbon
 * falls at the rate the world is actually being drawn at — and so a controlled
 * test clock cannot strand it half way home. The camera hold is counted here
 * too, and for the same reason: it is a promise about *frames*, and only the
 * frame loop knows when one has happened.
 */
export function advanceRecoil(dt: number): void {
  advanceCameraHold();
  const active = recoil;
  if (!active) return;
  const index = frameState.beadIndex.get(active.sourceId);
  active.remaining -= dt;
  if (index === undefined || active.remaining <= 0) {
    finishRecoil();
    return;
  }
  const rendered = frameState.rendered;
  const k = 1 - Math.exp(-dt / RECOIL_TAU);
  frameState.aim.x += (rendered[index * 3] - frameState.aim.x) * k;
  frameState.aim.y += (rendered[index * 3 + 1] - frameState.aim.y) * k;
  frameState.aim.z += (rendered[index * 3 + 2] - frameState.aim.z) * k;
  frameState.aim.active = true;
}

export const isRecoiling = (): boolean => recoil !== null;

function endGesture(): void {
  const suppressMiss =
    gesture.mode === "aim" ||
    gesture.mode === "load" ||
    gesture.moved;
  clearPressTimer();
  clearLoadHover();
  setSilkActive(false);
  smoothedSpeed = 0;
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
  gesture.sourceBeadId = null;
  gesture.moved = false;
  gesture.longPressed = false;
  // A recoil owns the aim point until it lands; clearing it here would snap the
  // ribbon out of existence on the frame the fall-back begins.
  if (!recoil) frameState.aim.active = false;
  frameState.snapId = null;
  if (suppressMiss) ignoreArenaMissUntil = performance.now() + 250;
  refreshCursor();
}

function cancelActiveGesture(): void {
  if (recoil) {
    finishRecoil();
    endGesture();
    return;
  }
  if (productionInterpretation.isWeaving()) {
    // Makes true a claim `useAudio.ts` has carried since the prototype: "the
    // cancel gliss is fired directly by threading.cancelGesture". It was not.
    cancelGliss();
    productionInterpretation.cancelWeave();
  }
  endGesture();
}

function beginGesture(
  event: ThreeEvent<PointerEvent>,
  id: string,
  mode: GestureMode,
  sourceBeadId: string | null
): void {
  gesture.pointerId = event.pointerId;
  gesture.pointerType = event.pointerType || "mouse";
  gesture.mode = mode;
  gesture.startX = event.clientX;
  gesture.startY = event.clientY;
  gesture.pressedBeadId = id;
  gesture.sourceBeadId = sourceBeadId;
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
      if (frameState.snapId !== id) hoverPing(id);
      refreshCursor();
    },
    /**
     * An enter event can be missed — a bead that grows under a still pointer,
     * a canvas that mounts beneath one, a capture that swallowed the crossing —
     * and the cursor is the only thing on this canvas that says a bead is a
     * thing you may touch. Saying it again on every move over the bead costs a
     * string comparison and closes every one of those holes.
     */
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      if (gesture.mode !== "idle") return;
      if (useStore.getState().phase !== "arena") return;
      event.stopPropagation();
      if (frameState.hoveredId !== id) {
        frameState.hoveredId = id;
        useStore.getState().setFocusedBead(id);
      }
      refreshCursor();
    },
    onPointerOut: () => {
      if (frameState.hoveredId === id) frameState.hoveredId = null;
      if (
        frameState.snapId !== id &&
        useStore.getState().focusedBeadId === id
      ) {
        useStore.getState().setFocusedBead(null);
      }
      refreshCursor();
    },
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      const state = useStore.getState();
      if (state.phase !== "arena" || !state.session || state.lensActive) return;
      event.stopPropagation();
      // The player has moved on: land the ribbon immediately rather than making
      // them wait out an animation that was only ever an explanation.
      if (recoil) finishRecoil();
      if (gesture.mode !== "idle" || productionInterpretation.isWeaving()) {
        event.nativeEvent.preventDefault();
        return;
      }
      frameState.idleSince = presentationNow();
      lastMoveX = event.clientX;
      lastMoveY = event.clientY;
      smoothedSpeed = 0;
      state.setFocusedBead(id);
      productionInterpretation.closeInspection();
      selectTick(id);

      const draft = interpretationDraftStore.getState().draft;
      const attendedId =
        draft.stage === "inactive" ? null : String(draft.attendedConceptId);
      if (draft.stage === "armed") {
        const sourceId = String(draft.attendedConceptId);
        beginGesture(event, id, "aim", sourceId);
        setAimToBead(sourceId);
        try {
          productionInterpretation.beginDirectionalWeave(
            inputModality(event.pointerType),
            normalizedPoint(event)
          );
          updateAim(event);
          // The drawn thread has a texture under the finger while it is being
          // drawn, and silence when the hand is still.
          setSilkActive(true);
        } catch (error) {
          endGesture();
          throw error;
        }
        return;
      }
      /**
       * THE PRESS *IS* THE ATTENDING.
       *
       * Attention used to be set on the way back up, and only if the hand had
       * not moved. Timed on the running build with a fresh profile: a click at
       * T+20.6 s set attention, the live region said "Attention set. Choose an
       * intention." — and no intention affordance appeared on screen for about
       * three and a half seconds, because the attend phrase re-frames the
       * camera and the plate waits for the pose. The player was asked to choose
       * with nothing to choose from.
       *
       * Setting it on the way down closes that window completely, and it does
       * it with the world's existing law rather than a special case: a gesture
       * holds the sightline for its whole duration (`beginGesture` disables the
       * controls), a held camera is a settled camera, and the plate opens in
       * the pose the camera already has — around the bead under the finger,
       * within a frame of the press, where it will stay. The same press then
       * continues straight into the plate's four stations as a `load`, which is
       * the gesture an attended bead already supported: a player who pulls is
       * handed the missing step mid-motion, in the world's own material,
       * without a word of instruction. A player who lets go simply keeps the
       * open plate, which is still an answer and still progress.
       */
      beginGesture(event, id, "tap", attendedId);
      productionInterpretation.activateConcept(toConceptId(id));
      const opened = interpretationDraftStore.getState().draft;
      if (
        opened.stage === "attending" &&
        String(opened.attendedConceptId) === id
      ) {
        gesture.mode = "load";
        gesture.sourceBeadId = id;
      }
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
  if (event.pointerId !== gesture.pointerId || !gesture.pressedBeadId) return;
  const crossed =
    Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >=
    DRAG_THRESHOLD_PX;
  if (crossed) {
    gesture.moved = true;
    clearPressTimer();
  }

  const step = Math.hypot(event.clientX - lastMoveX, event.clientY - lastMoveY);
  lastMoveX = event.clientX;
  lastMoveY = event.clientY;
  smoothedSpeed += (step - smoothedSpeed) * 0.35;

  if (gesture.mode === "aim") {
    productionInterpretation.updateWeave(normalizedPoint(event));
    updateAim(event);
    updateSilk(smoothedSpeed);
  } else if (gesture.mode === "load") {
    updateLoadHover(event);
  }
}

export function handlePointerUp(event: PointerEvent): void {
  if (event.pointerId !== gesture.pointerId || !gesture.pressedBeadId) return;
  const mode = gesture.mode;
  const beadId = gesture.pressedBeadId;
  const activate = !gesture.moved && !gesture.longPressed;
  const point = normalizedPoint(event);
  try {
    if (mode === "aim") {
      productionInterpretation.updateWeave(point);
      updateAim(event);
      const targetId = frameState.snapId;
      if (targetId) {
        productionInterpretation.commitDirectionalWeave(
          toConceptId(targetId),
          point
        );
      } else if (gesture.sourceBeadId) {
        // A weave released onto nothing. It is not an error and it costs the
        // player nothing — the armed draft is still held — but it must be
        // *answered*, or the game has ignored a deliberate gesture.
        cancelGliss();
        beginRecoil(gesture.sourceBeadId);
      } else {
        productionInterpretation.cancelWeave();
      }
    } else if (mode === "load") {
      const intention = intentionAtPoint(event);
      if (intention) productionInterpretation.armIntention(intention);
    } else if (activate) {
      productionInterpretation.activateConcept(toConceptId(beadId));
    }
  } finally {
    endGesture();
  }
}

export function handlePointerCancel(event: PointerEvent): void {
  if (event.pointerId === gesture.pointerId) cancelActiveGesture();
}

export function handleWindowBlur(): void {
  if (gesture.mode !== "idle" || productionInterpretation.isWeaving()) {
    cancelActiveGesture();
  }
}

export function handleArenaMiss(): void {
  if (
    useStore.getState().phase !== "arena" ||
    isSceneGestureActive() ||
    productionInterpretation.isWeaving() ||
    performance.now() < ignoreArenaMissUntil
  ) {
    return;
  }
  productionInterpretation.cancel();
}

export function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (gesture.mode !== "idle" || productionInterpretation.isWeaving()) {
    cancelActiveGesture();
    return;
  }
  if (useStore.getState().pinnedInspectId) {
    productionInterpretation.closeInspection();
    return;
  }
  productionInterpretation.cancel();
}
