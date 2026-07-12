import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { resolveAttempt, detectNewMotifs, consecrateComponent } from "@/game/rules";
import { ARENA_RADIUS } from "@/game/layout";
import { connectionByPair } from "@/content/connections";
import { pairKey } from "@/content/types";
import { smoothstep } from "@/lib/utils";
import { isCoarsePointer } from "@/lib/device";
import {
  hoverPing,
  selectTick,
  cancelGliss,
  setSilkActive,
  stopSympathy,
  consecrationChime,
} from "@/audio/sfx";
import { currentTheme } from "@/themes/useTheme";
import { presentationNow, testMode } from "@/runtime/testMode";
import { frameState, beadPosition, emitBurst } from "./frameState";

/**
 * THE one pointer file. Both gestures resolve through the same path:
 *   press bead → drag ≥ 6px → threading (release commits/cancels)
 *   press bead → release < 6px → sticky threading (next click commits/cancels)
 * Commit lands on the current snap candidate; Escape always cancels.
 */

const DRAG_THRESHOLD_PX = 6;
const SNAP_RADIUS = 0.78;
/** Within this world-distance of the aim, an undiscovered luminous partner
 *  begins to shimmer and hum. */
const SYMPATHY_RADIUS = 2.2;

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  /** Touch only: pending long-press-to-inspect timer. */
  pressTimer: number | null;
  pressedBeadId: string | null;
}

const gesture: GestureState = {
  pointerId: -1,
  startX: 0,
  startY: 0,
  pressTimer: null,
  pressedBeadId: null,
};

/** Hold a bead still this long (touch) and it opens for reading instead. */
const LONG_PRESS_MS = 600;

function clearPressTimer() {
  if (gesture.pressTimer !== null) {
    window.clearTimeout(gesture.pressTimer);
    gesture.pressTimer = null;
  }
}

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
const vSymp = new THREE.Vector3();

/** Smoothed pointer speed (px per event, decayed by the frame bridge) —
 *  drives the silk-shimmer texture while a thread is drawn. */
export const pointerMotion = { speed: 0, lastX: 0, lastY: 0 };

function setCursor(cursor: string) {
  if (threadingEnv.dom) threadingEnv.dom.style.cursor = cursor;
}

function interactionMode() {
  return useStore.getState().session?.interaction.mode ?? "idle";
}

function markActive() {
  frameState.idleSince = presentationNow();
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

  // Magnetize the nearest bead within the snap radius; simultaneously find
  // the sympathetic candidate — the nearest bead that would complete an
  // undiscovered luminous connection with the origin. The ear hears it
  // before the eye can name it.
  const session = useStore.getState().session;
  const fromId = session?.interaction.fromId;
  const rendered = frameState.rendered;
  let bestId: string | null = null;
  let bestDist = SNAP_RADIUS;
  let sympId: string | null = null;
  let sympDist = SYMPATHY_RADIUS;
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
    if (fromId && dist < sympDist) {
      const key = pairKey(fromId, id);
      if (
        connectionByPair.has(key) &&
        !session?.threads.some((th) => th.id === key)
      ) {
        sympDist = dist;
        sympId = id;
      }
    }
  }
  frameState.snapId = bestId;

  if (sympId !== null) {
    const j = frameState.beadIndex.get(sympId)!;
    vSymp.set(rendered[j * 3], rendered[j * 3 + 1], rendered[j * 3 + 2]);
    vSymp.project(camera);
    frameState.sympathy = {
      id: sympId,
      strength: 1 - smoothstep(0.4, SYMPATHY_RADIUS, sympDist),
      panX: Math.max(-1, Math.min(1, vSymp.x)),
    };
  } else {
    frameState.sympathy = null;
  }
}

function beginThreading(sticky: boolean) {
  useStore.getState().setInteraction({ mode: "threading", sticky });
  setCursor("crosshair");
  setSilkActive(true);
}

function endGesture(opts?: { keepControlsLocked?: boolean }) {
  clearPressTimer();
  gesture.pressedBeadId = null;
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
  frameState.sympathy = null;
  setSilkActive(false);
  stopSympathy();
  pointerMotion.speed = 0;
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
    // Already woven — flash the existing thread instead of committing.
    frameState.pulseThreadId = key;
    frameState.pulseAt = presentationNow();
    return cancelGesture();
  }

  const priorFaints = session.discoveries.filter((d) => d.kind === "faint").length;
  const { thread, discovery } = resolveAttempt(fromId, toId, priorFaints);
  const motifs = detectNewMotifs(session, thread);
  st.addThread(thread);
  const finalized = st.addDiscovery(discovery, motifs);

  // A completed motif consecrates the faint strands of its web — they rise
  // to a silvered state between faint and luminous, and sing for it.
  if (motifs.length > 0) {
    const after = useStore.getState().session;
    if (after) {
      const toConsecrate = consecrateComponent(after.threads, thread.id);
      if (toConsecrate.length > 0) {
        st.consecrateThreads(toConsecrate, motifs[0].motifId);
        consecrationChime(toConsecrate.length);
      }
    }
  }

  // The world answers the weave: particles at the joining point, a flare
  // through the stars, a breath of impact in the lens.
  const pa = beadPosition(fromId);
  const pb = beadPosition(toId);
  if (pa && pb) {
    const mid: [number, number, number] = [
      (pa[0] + pb[0]) / 2,
      (pa[1] + pb[1]) / 2,
      (pa[2] + pb[2]) / 2,
    ];
    const world = currentTheme();
    if (finalized.kind === "curated") {
      emitBurst(mid, world.burst.color, 26 + finalized.tier * 8, 1.2);
      emitBurst(mid, world.burst.secondary, 14, 0.7);
      frameState.flare = 1;
      if (!st.settings.reducedMotion) frameState.kick = 1;
    } else {
      emitBurst(mid, world.faintThread, 10, 0.6);
    }
  }

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
  if (!testMode.enabled) return;
  commit(fromId, toId);
}

/** Ends the reveal moment: restores time, input, idle state — and drifts
 *  the orbit target home so the arena is centered again. */
export function dismissReveal() {
  const st = useStore.getState();
  if (st.session?.interaction.mode !== "reveal") return;
  st.setInteraction({ mode: "idle", reveal: null });
  frameState.timeScaleTarget = 1;
  frameState.idleSince = presentationNow();
  frameState.recenter = true;
  if (threadingEnv.controls) threadingEnv.controls.enabled = true;
}

// ── Bead-mesh handlers (attached to each bead's hit proxy) ────────────────

export function beadPointerHandlers(id: string) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (useStore.getState().phase !== "arena") return;
      frameState.hoveredId = id;
      useStore.getState().setFocusedBead(id);
      hoverPing(id);
      if (interactionMode() === "idle") setCursor("pointer");
    },
    onPointerOut: () => {
      if (frameState.hoveredId === id) frameState.hoveredId = null;
      const st = useStore.getState();
      if (st.focusedBeadId === id && st.session?.interaction.fromId !== id) {
        st.setFocusedBead(null);
      }
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
      gesture.pressedBeadId = id;
      if (dom) {
        try {
          dom.setPointerCapture(e.pointerId);
        } catch {
          /* capture is best-effort */
        }
      }
      st.setInteraction({ mode: "pressed", fromId: id, sticky: false });
      st.setFocusedBead(id);
      st.setPinnedInspect(null); // a new gesture always closes any open card
      selectTick(id);

      // Touch has no hover, so it gets its own doorway to contemplation:
      // hold the bead still and it opens for reading instead of weaving.
      clearPressTimer();
      if (isCoarsePointer()) {
        gesture.pressTimer = window.setTimeout(() => {
          gesture.pressTimer = null;
          const now = useStore.getState();
          if (
            now.session?.interaction.mode === "pressed" &&
            gesture.pressedBeadId === id
          ) {
            now.setInteraction({ mode: "idle", fromId: null, sticky: false });
            endGesture();
            now.setPinnedInspect(id);
            hoverPing(id);
          }
        }, LONG_PRESS_MS);
      }
    },
  };
}

// ── Global listeners (window-level, installed by ThreadingDriver) ─────────

export function handlePointerMove(e: PointerEvent) {
  // Feed the silk: instantaneous pointer speed, exponentially smoothed.
  const dx = e.clientX - pointerMotion.lastX;
  const dy = e.clientY - pointerMotion.lastY;
  pointerMotion.lastX = e.clientX;
  pointerMotion.lastY = e.clientY;
  const inst = Math.min(80, Math.hypot(dx, dy));
  pointerMotion.speed += (inst - pointerMotion.speed) * 0.3;

  const mode = interactionMode();
  if (mode === "pressed") {
    const dist = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY);
    if (dist >= DRAG_THRESHOLD_PX) {
      clearPressTimer(); // moving means weaving, not reading
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
    clearPressTimer(); // released before the long-press: weaving it is
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
