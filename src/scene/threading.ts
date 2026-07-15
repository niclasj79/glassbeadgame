import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { hoverPing, selectTick } from "@/audio/sfx";
import {
  RELATION_INTENTIONS,
  type InputModality,
  type RelationIntention,
} from "@/domain/events";
import { toConceptId } from "@/domain/ids";
import { isCoarsePointer } from "@/lib/device";
import { productionInterpretation } from "@/runtime/interpretation";
import { presentationNow } from "@/runtime/testMode";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { useStore } from "@/state/store";
import { frameState } from "./frameState";

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 600;
const MOUSE_SNAP_RADIUS_PX = 48;
const TOUCH_SNAP_RADIUS_PX = 72;

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
      hoverPing(nearestId);
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

function endGesture(): void {
  const suppressMiss =
    gesture.mode === "aim" ||
    gesture.mode === "load" ||
    gesture.moved;
  clearPressTimer();
  clearLoadHover();
  if (threadingEnv.controls) threadingEnv.controls.enabled = true;
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
  frameState.aim.active = false;
  frameState.snapId = null;
  if (suppressMiss) ignoreArenaMissUntil = performance.now() + 250;
  if (threadingEnv.dom) threadingEnv.dom.style.cursor = "";
}

function cancelActiveGesture(): void {
  if (productionInterpretation.isWeaving()) {
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
      if (threadingEnv.dom) threadingEnv.dom.style.cursor = "pointer";
    },
    onPointerOut: () => {
      if (frameState.hoveredId === id) frameState.hoveredId = null;
      if (
        frameState.snapId !== id &&
        useStore.getState().focusedBeadId === id
      ) {
        useStore.getState().setFocusedBead(null);
      }
      if (threadingEnv.dom) threadingEnv.dom.style.cursor = "";
    },
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      const state = useStore.getState();
      if (state.phase !== "arena" || !state.session || state.lensActive) return;
      event.stopPropagation();
      if (gesture.mode !== "idle" || productionInterpretation.isWeaving()) {
        event.nativeEvent.preventDefault();
        return;
      }
      frameState.idleSince = presentationNow();
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
        } catch (error) {
          endGesture();
          throw error;
        }
        return;
      }
      const mode =
        draft.stage === "attending" && id === attendedId ? "load" : "tap";
      beginGesture(event, id, mode, attendedId);
      if (
        (mode === "tap" || mode === "load") &&
        (event.pointerType === "touch" || isCoarsePointer())
      ) {
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
  if (
    Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >=
    DRAG_THRESHOLD_PX
  ) {
    gesture.moved = true;
    clearPressTimer();
  }
  if (gesture.mode === "aim") {
    productionInterpretation.updateWeave(normalizedPoint(event));
    updateAim(event);
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
