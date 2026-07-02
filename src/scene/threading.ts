import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { resolveAttempt, detectNewMotifs } from "@/game/rules";
import { ARENA_RADIUS } from "@/game/layout";
import { hoverPing, selectTick, cancelGliss } from "@/audio/sfx";
import { frameState } from "./frameState";

/**
 * THE one pointer file. Both gestures resolve through the same path:
 *   press bead → drag ≥ 6px → threading (release commits/cancels)
 *   press bead → release < 6px → sticky threading (next click commits/cancels)
 * Commit lands on the current snap candidate; Escape always cancels.
 */

const DRAG_THRESHOLD_PX = 6;
const SNAP_RADIUS = 0.78;

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
}

const gesture: GestureState = {
  pointerId: -1,
  startX: 0,
  startY: 0,
};

/** Wired by ThreadingDriver once the scene exists. */
export const threadingEnv = {
  camera: null as THREE.Camera | null,
  dom: null as HTMLElement | null,
  controls: null as { enabled: boolean } | null,
};

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const vRay = new THREE.Vector3();
const vAim = new THREE.Vector3();

function setCursor(cursor: string) {
  if (threadingEnv.dom) threadingEnv.dom.style.cursor = cursor;
}

function interactionMode() {
  return useStore.getState().session?.interaction.mode ?? "idle";
}

function markActive() {
  frameState.idleSince = performance.now();
}

/** Ray → arena-sphere aim point; falls back to the silhouette when the ray misses. */
function updateAim(clientX: number, clientY: number) {
  const { camera, dom } = threadingEnv;
  if (!camera || !dom) return;
  const rect = dom.getBoundingClientRect();
  ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  const ray = raycaster.ray;
  const t = -ray.origin.dot(ray.direction);
  vRay.copy(ray.origin).addScaledVector(ray.direction, t);
  const d2 = vRay.lengthSq();
  const r2 = ARENA_RADIUS * ARENA_RADIUS;
  if (d2 <= r2) {
    const dt = Math.sqrt(r2 - d2);
    vAim.copy(ray.origin).addScaledVector(ray.direction, t - dt);
  } else {
    vAim.copy(vRay).normalize().multiplyScalar(ARENA_RADIUS);
  }
  frameState.aim.x = vAim.x;
  frameState.aim.y = vAim.y;
  frameState.aim.z = vAim.z;
  frameState.aim.active = true;

  // Magnetize the nearest bead within the snap radius.
  const fromId = useStore.getState().session?.interaction.fromId;
  const rendered = frameState.rendered;
  let bestId: string | null = null;
  let bestDist = SNAP_RADIUS;
  for (const [id, i] of frameState.beadIndex) {
    if (id === fromId) continue;
    const dx = rendered[i * 3] - vAim.x;
    const dy = rendered[i * 3 + 1] - vAim.y;
    const dz = rendered[i * 3 + 2] - vAim.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }
  frameState.snapId = bestId;
}

function beginThreading(sticky: boolean) {
  useStore.getState().setInteraction({ mode: "threading", sticky });
  setCursor("crosshair");
}

function endGesture(opts?: { keepControlsLocked?: boolean }) {
  const { dom, controls } = threadingEnv;
  if (controls && !opts?.keepControlsLocked) controls.enabled = true;
  if (dom && gesture.pointerId >= 0) {
    try {
      dom.releasePointerCapture(gesture.pointerId);
    } catch {
      /* pointer may already be gone */
    }
  }
  gesture.pointerId = -1;
  frameState.aim.active = false;
  frameState.snapId = null;
  setCursor("");
}

function cancelGesture() {
  const st = useStore.getState();
  if (st.session && st.session.interaction.mode !== "idle") {
    if (st.session.interaction.mode === "threading") cancelGliss();
    st.setInteraction({ mode: "idle", fromId: null, sticky: false });
  }
  endGesture();
}

const REVEAL_TIME_SCALE = 0.15;

function commit(fromId: string, toId: string) {
  const st = useStore.getState();
  const session = st.session;
  if (!session) return cancelGesture();

  const key = fromId < toId ? `${fromId}+${toId}` : `${toId}+${fromId}`;
  if (session.threads.some((t) => t.id === key)) {
    // Already woven — treat as a cancel.
    return cancelGesture();
  }

  const { thread, discovery } = resolveAttempt(fromId, toId);
  const motifs = detectNewMotifs(session, thread);
  st.addThread(thread);
  const finalized = st.addDiscovery(discovery, motifs);

  if (finalized.kind === "curated") {
    // The jewel moment: input locks, time dilates, the camera leans in,
    // and the insight card takes the stage. dismissReveal() unwinds it all.
    st.setInteraction({ mode: "reveal", fromId: null, sticky: false, reveal: finalized });
    if (!st.settings.reducedMotion) frameState.timeScaleTarget = REVEAL_TIME_SCALE;
    endGesture({ keepControlsLocked: true });
  } else {
    st.setInteraction({ mode: "idle", fromId: null, sticky: false });
    endGesture();
  }
}

/** Dev-only E2E seam: drives the exact same commit path as a real gesture. */
export function devCommit(fromId: string, toId: string): void {
  if (!import.meta.env.DEV) return;
  commit(fromId, toId);
}

/** Ends the reveal moment: restores time, input, and idle state. */
export function dismissReveal() {
  const st = useStore.getState();
  if (st.session?.interaction.mode !== "reveal") return;
  st.setInteraction({ mode: "idle", reveal: null });
  frameState.timeScaleTarget = 1;
  frameState.idleSince = performance.now();
  if (threadingEnv.controls) threadingEnv.controls.enabled = true;
}

// ── Bead-mesh handlers (attached to each bead's hit proxy) ────────────────

export function beadPointerHandlers(id: string) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (useStore.getState().phase !== "arena") return;
      frameState.hoveredId = id;
      hoverPing(id);
      if (interactionMode() === "idle") setCursor("pointer");
    },
    onPointerOut: () => {
      if (frameState.hoveredId === id) frameState.hoveredId = null;
      if (interactionMode() === "idle") setCursor("");
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      const st = useStore.getState();
      if (st.phase !== "arena" || !st.session) return;
      if (st.lensActive) return; // the Lens is for contemplation, not weaving
      const mode = st.session.interaction.mode;
      if (mode === "reveal" || mode === "concluding") return;
      e.stopPropagation();
      markActive();

      // A click during sticky threading is resolved by the shared pointerup.
      if (mode === "threading") return;

      const { controls, dom } = threadingEnv;
      if (controls) controls.enabled = false;
      gesture.pointerId = e.pointerId;
      gesture.startX = e.clientX;
      gesture.startY = e.clientY;
      if (dom) {
        try {
          dom.setPointerCapture(e.pointerId);
        } catch {
          /* capture is best-effort */
        }
      }
      st.setInteraction({ mode: "pressed", fromId: id, sticky: false });
      selectTick(id);
    },
  };
}

// ── Global listeners (window-level, installed by ThreadingDriver) ─────────

export function handlePointerMove(e: PointerEvent) {
  const mode = interactionMode();
  if (mode === "pressed") {
    const dist = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY);
    if (dist >= DRAG_THRESHOLD_PX) {
      beginThreading(false);
      updateAim(e.clientX, e.clientY);
    }
  } else if (mode === "threading") {
    markActive();
    updateAim(e.clientX, e.clientY);
  }
}

export function handlePointerUp(e: PointerEvent) {
  const st = useStore.getState();
  const interaction = st.session?.interaction;
  if (!interaction) return;

  if (interaction.mode === "pressed") {
    // Short press: enter sticky threading — the thread now follows the pointer,
    // and the NEXT pointerup (the second click) resolves it.
    beginThreading(true);
    updateAim(e.clientX, e.clientY);
    return;
  }

  if (interaction.mode === "threading") {
    updateAim(e.clientX, e.clientY);
    const from = interaction.fromId;
    const to = frameState.snapId;
    if (from && to && to !== from) commit(from, to);
    else cancelGesture();
  }
}

export function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && interactionMode() !== "idle") cancelGesture();
}
