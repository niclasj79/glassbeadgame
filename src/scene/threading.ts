import type { ThreeEvent } from "@react-three/fiber";
import type * as THREE from "three";
import { selectTick, hoverPing } from "@/audio/sfx";
import { toConceptId } from "@/domain/ids";
import { productionInterpretation } from "@/runtime/interpretation";
import { presentationNow } from "@/runtime/testMode";
import { isCoarsePointer } from "@/lib/device";
import { useStore } from "@/state/store";
import { frameState } from "./frameState";

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 600;

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  pressedBeadId: string | null;
  pressTimer: number | null;
  moved: boolean;
  longPressed: boolean;
}

const gesture: GestureState = {
  pointerId: -1,
  startX: 0,
  startY: 0,
  pressedBeadId: null,
  pressTimer: null,
  moved: false,
  longPressed: false,
};

export const threadingEnv = {
  camera: null as THREE.Camera | null,
  dom: null as HTMLElement | null,
  controls: null as { enabled: boolean } | null,
};

function clearPressTimer(): void {
  if (gesture.pressTimer !== null) window.clearTimeout(gesture.pressTimer);
  gesture.pressTimer = null;
}

function endGesture(): void {
  clearPressTimer();
  if (threadingEnv.controls) threadingEnv.controls.enabled = true;
  if (threadingEnv.dom && gesture.pointerId >= 0) {
    try {
      threadingEnv.dom.releasePointerCapture(gesture.pointerId);
    } catch {
      // Pointer capture is best effort.
    }
  }
  gesture.pointerId = -1;
  gesture.pressedBeadId = null;
  gesture.moved = false;
  gesture.longPressed = false;
  if (threadingEnv.dom) threadingEnv.dom.style.cursor = "";
}

export function beadPointerHandlers(id: string) {
  return {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (useStore.getState().phase !== "arena") return;
      frameState.hoveredId = id;
      useStore.getState().setFocusedBead(id);
      hoverPing(id);
      if (threadingEnv.dom) threadingEnv.dom.style.cursor = "pointer";
    },
    onPointerOut: () => {
      if (frameState.hoveredId === id) frameState.hoveredId = null;
      if (useStore.getState().focusedBeadId === id) {
        useStore.getState().setFocusedBead(null);
      }
      if (threadingEnv.dom) threadingEnv.dom.style.cursor = "";
    },
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      const state = useStore.getState();
      if (state.phase !== "arena" || !state.session || state.lensActive) return;
      event.stopPropagation();
      frameState.idleSince = presentationNow();
      gesture.pointerId = event.pointerId;
      gesture.startX = event.clientX;
      gesture.startY = event.clientY;
      gesture.pressedBeadId = id;
      gesture.moved = false;
      gesture.longPressed = false;
      state.setFocusedBead(id);
      productionInterpretation.closeInspection();
      selectTick(id);
      if (threadingEnv.controls) threadingEnv.controls.enabled = false;
      try {
        threadingEnv.dom?.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best effort.
      }
      if (isCoarsePointer()) {
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
}

export function handlePointerUp(event: PointerEvent): void {
  if (event.pointerId !== gesture.pointerId || !gesture.pressedBeadId) return;
  const beadId = gesture.pressedBeadId;
  const activate = !gesture.moved && !gesture.longPressed;
  endGesture();
  if (activate) productionInterpretation.activateConcept(toConceptId(beadId));
}

export function handlePointerCancel(event: PointerEvent): void {
  if (event.pointerId === gesture.pointerId) endGesture();
}

export function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (useStore.getState().pinnedInspectId) {
    productionInterpretation.closeInspection();
    return;
  }
  if (productionInterpretation.isWeaving()) productionInterpretation.cancelWeave();
  else productionInterpretation.cancel();
}
