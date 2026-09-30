import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pointer layer, driven through its real public surface.
 *
 * `threading.ts` is where the primary verb lives, and the two failures these
 * tests cover were only ever visible from *outside* it — the draft that stayed
 * `inactive` after a full press-drag-release, and the weave released into
 * nothing that produced no sound, no motion, and no message. So the handlers
 * are called exactly as the canvas calls them, against the real interpretation
 * singleton and the real stores, with the DOM and the audio bus stubbed.
 */
vi.mock("@/audio/sfx", () => ({
  hoverPing: vi.fn(),
  selectTick: vi.fn(),
  latchTick: vi.fn(),
  cancelGliss: vi.fn(),
  setSilkActive: vi.fn(),
  updateSilk: vi.fn(),
  setAimTension: vi.fn(),
}));

import * as THREE from "three";
import { cancelGliss, hoverPing, latchTick, setSilkActive } from "@/audio/sfx";
import { toConceptId } from "@/domain/ids";
import { cueBus } from "@/runtime/cues";
import { productionInterpretation } from "@/runtime/interpretation";
import { startSession } from "@/runtime/session";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { useStore } from "@/state/store";
import { frameState, initFramePositions } from "./frameState";
import {
  advanceRecoil,
  beadPointerHandlers,
  handlePointerMove,
  handlePointerUp,
  handleWindowBlur,
  threadingEnv,
} from "./threading";

interface PointerInit {
  readonly pointerId?: number;
  readonly clientX: number;
  readonly clientY: number;
}

function threeEvent(init: PointerInit) {
  return {
    pointerId: init.pointerId ?? 1,
    pointerType: "mouse",
    clientX: init.clientX,
    clientY: init.clientY,
    stopPropagation: () => undefined,
    nativeEvent: { preventDefault: () => undefined },
  } as unknown as Parameters<
    ReturnType<typeof beadPointerHandlers>["onPointerDown"]
  >[0];
}

function domEvent(init: PointerInit): PointerEvent {
  return {
    pointerId: init.pointerId ?? 1,
    pointerType: "mouse",
    clientX: init.clientX,
    clientY: init.clientY,
  } as unknown as PointerEvent;
}

let beadIds: readonly string[] = [];

beforeEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { elementFromPoint: () => null },
  });
  Object.assign(globalThis.window as unknown as Record<string, unknown>, {
    innerWidth: 1280,
    innerHeight: 800,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });

  vi.clearAllMocks();
  const started = startSession(["mathematics", "music", "art"], { seed: 7 });
  beadIds = started.session.conceptIds.map(String);
  // A plausible layout: the handlers read positions from here to place the aim
  // and to find a snap candidate. Spacing is chosen so that no bead sits inside
  // another's snap radius, which is what makes a latch transition assertable.
  const positions = new Float32Array(beadIds.length * 3);
  for (let index = 0; index < beadIds.length; index += 1) {
    positions[index * 3] = index * 2;
    positions[index * 3 + 1] = (index % 3) * 0.4;
  }
  initFramePositions([...beadIds], positions);
});

afterEach(() => {
  // The gesture state machine is module-level, exactly as the canvas holds it;
  // a test that leaves a pointer down would silently disable the next one.
  handleWindowBlur();
  productionInterpretation.reset();
});

describe("threading — the primary verb", () => {
  /**
   * GAP-B3. Verified live before the fix: press Fibonacci, drag toward
   * Counterpoint, release with nothing armed, and the result was draft stage
   * "inactive", zero threads, the unchanged message "Choose a bead to Attend.",
   * and `failureMessage` null. The most natural gesture a hand makes with two
   * spheres did nothing at all and explained nothing.
   */
  it("opens the attended bead when an unarmed press is dragged", () => {
    const source = beadIds[0];
    expect(interpretationDraftStore.getState().draft.stage).toBe("inactive");

    beadPointerHandlers(source).onPointerDown(
      threeEvent({ clientX: 400, clientY: 400 })
    );
    handlePointerMove(domEvent({ clientX: 460, clientY: 430 }));

    // The plate is open around the bead under the finger, mid-gesture, so the
    // same drag can continue straight into one of its four verbs.
    expect(interpretationDraftStore.getState().draft).toMatchObject({
      stage: "attending",
      attendedConceptId: toConceptId(source),
    });

    handlePointerUp(domEvent({ clientX: 460, clientY: 430 }));

    // Releasing away from a station keeps attention rather than throwing it
    // away: still an answer, still progress, never a punishment.
    expect(interpretationDraftStore.getState().draft.stage).toBe("attending");
  });

  it("still treats a press without movement as a plain tap", () => {
    const source = beadIds[0];
    beadPointerHandlers(source).onPointerDown(
      threeEvent({ clientX: 400, clientY: 400 })
    );
    handlePointerUp(domEvent({ clientX: 401, clientY: 400 }));
    expect(interpretationDraftStore.getState().draft).toMatchObject({
      stage: "attending",
      attendedConceptId: toConceptId(source),
    });
  });

  /**
   * B2. Timed on the running build with a fresh profile and no test mode: a
   * click at T+20.6 s set attention and the live region said "Attention set.
   * Choose an intention." — and no intention affordance appeared on screen for
   * about three and a half seconds, because attention was set on the way *up*,
   * the attend phrase then re-framed the camera, and the plate waits for the
   * pose. The press is the attending, and the press is what the plate opens in
   * the pose of.
   */
  it("opens the bead on the way down, before the hand comes back up", () => {
    const source = beadIds[0];
    expect(interpretationDraftStore.getState().draft.stage).toBe("inactive");

    beadPointerHandlers(source).onPointerDown(
      threeEvent({ clientX: 400, clientY: 400 })
    );

    // No move, no release: the world has already answered.
    expect(interpretationDraftStore.getState().draft).toMatchObject({
      stage: "attending",
      attendedConceptId: toConceptId(source),
    });

    handlePointerUp(domEvent({ clientX: 400, clientY: 400 }));
    expect(interpretationDraftStore.getState().draft.stage).toBe("attending");
  });

  /**
   * …and the other half of the same defect. `CameraRig` abandons a queued
   * camera phrase only from a *frame* callback and only while the controls are
   * held. The commit that queues the attend lean is flushed at default priority
   * — traced at 28 ms, well after a click has ended — so handing the controls
   * back on release let the world lean away from the plate it had just opened.
   */
  it("keeps the sightline held for frames after the hand lets go", () => {
    const controls = { enabled: true };
    threadingEnv.controls = controls;
    try {
      const source = beadIds[0];
      beadPointerHandlers(source).onPointerDown(
        threeEvent({ clientX: 400, clientY: 400 })
      );
      expect(controls.enabled).toBe(false);

      handlePointerUp(domEvent({ clientX: 400, clientY: 400 }));
      // Released — and still held, because the pose has not been refused yet.
      expect(controls.enabled).toBe(false);

      // Several frames of the world, which is the unit the promise is made in.
      for (let frame = 0; frame < 3; frame += 1) advanceRecoil(1 / 60);
      expect(controls.enabled).toBe(false);
      for (let frame = 0; frame < 8; frame += 1) advanceRecoil(1 / 60);
      expect(controls.enabled).toBe(true);
    } finally {
      threadingEnv.controls = null;
    }
  });

  /**
   * The lens (I-017). While a bead is attended the pointer sights the nearest
   * bead within its disc: its own sound (never hover's), its own staged moment,
   * the lens position written to the frame, and the path kept as the weave's
   * approach (I-020).
   */
  function withCamera<T>(run: (screenPointOf: (id: string) => { clientX: number; clientY: number }) => T): T {
    const camera = new THREE.PerspectiveCamera(50, 1280 / 800, 0.1, 200);
    camera.position.set(0, 0, 24);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    threadingEnv.camera = camera;
    threadingEnv.dom = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
      setPointerCapture: () => undefined,
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
      style: {} as CSSStyleDeclaration,
    } as unknown as HTMLCanvasElement;
    const screenPointOf = (id: string) => {
      const index = frameState.beadIndex.get(id)!;
      const point = new THREE.Vector3(
        frameState.rendered[index * 3],
        frameState.rendered[index * 3 + 1],
        frameState.rendered[index * 3 + 2]
      ).project(camera);
      return {
        clientX: ((point.x + 1) / 2) * 1280,
        clientY: ((1 - point.y) / 2) * 800,
      };
    };
    try {
      return run(screenPointOf);
    } finally {
      threadingEnv.camera = null;
      threadingEnv.dom = null;
    }
  }

  it("sights the nearest bead under the lens with its own sound and staged moment", () => {
    withCamera((screenPointOf) => {
      const staged: string[] = [];
      const detach = cueBus.subscribe("scene", (cue) => staged.push(cue.type));
      const source = beadIds[0];
      const target = beadIds[1];

      beadPointerHandlers(source).onPointerDown(threeEvent(screenPointOf(source)));
      handlePointerUp(domEvent(screenPointOf(source)));
      expect(interpretationDraftStore.getState().draft.stage).toBe("attending");

      handlePointerMove(domEvent(screenPointOf(target)));

      expect(frameState.snapId).toBe(target);
      expect(frameState.lens.active).toBe(true);
      expect(latchTick).toHaveBeenCalledWith(target);
      expect(hoverPing).not.toHaveBeenCalled();
      expect(staged).toContain("attention.sighted");
      detach();
    });
  });

  it("locks the second bead on a press, and replaces it on another", () => {
    const [first, second, third] = beadIds;
    beadPointerHandlers(first).onPointerDown(threeEvent({ clientX: 400, clientY: 400 }));
    handlePointerUp(domEvent({ clientX: 400, clientY: 400 }));

    beadPointerHandlers(second).onPointerDown(
      threeEvent({ pointerId: 2, clientX: 500, clientY: 400 })
    );
    handlePointerUp(domEvent({ pointerId: 2, clientX: 500, clientY: 400 }));
    expect(interpretationDraftStore.getState().draft).toMatchObject({
      stage: "locked",
      pair: [toConceptId(first), toConceptId(second)],
    });

    beadPointerHandlers(third).onPointerDown(
      threeEvent({ pointerId: 3, clientX: 600, clientY: 400 })
    );
    handlePointerUp(domEvent({ pointerId: 3, clientX: 600, clientY: 400 }));
    expect(interpretationDraftStore.getState().draft).toMatchObject({
      stage: "locked",
      pair: [toConceptId(first), toConceptId(third)],
    });
    // Nothing provisional reaches the log.
    expect(useStore.getState().session?.threads ?? []).toHaveLength(0);
  });

  it("puts the lens down and leaves the draft alone when no bead is attended", () => {
    handlePointerMove(domEvent({ clientX: 10, clientY: 10 }));
    expect(frameState.lens.active).toBe(false);
    expect(interpretationDraftStore.getState().draft.stage).toBe("inactive");
    expect(cancelGliss).not.toHaveBeenCalled();
    expect(setSilkActive).not.toHaveBeenCalledWith(true);
  });
});
