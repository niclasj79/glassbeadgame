import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pointer layer, driven through its real public surface.
 *
 * `threading.ts` is where the primary verb lives, and the failures these tests
 * cover were only ever visible from *outside* it — the draft that stayed
 * `inactive` after a full press-drag-release, the weave released into nothing
 * that produced no sound, no motion and no message. So the handlers are called
 * exactly as the canvas and the sigil plate call them, against the real
 * interpretation singleton and the real stores, with the DOM and the audio bus
 * stubbed and time under the test's control.
 */
vi.mock("@/audio/sfx", () => ({
  hoverPing: vi.fn(),
  selectTick: vi.fn(),
  latchTick: vi.fn(),
  cancelGliss: vi.fn(),
  setAimTension: vi.fn(),
}));

import * as THREE from "three";
import { cancelGliss, hoverPing, latchTick } from "@/audio/sfx";
import type { RelationIntention } from "@/domain/events";
import { toConceptId } from "@/domain/ids";
import { cueBus } from "@/runtime/cues";
import { productionInterpretation } from "@/runtime/interpretation";
import { startSession } from "@/runtime/session";
import { domainSessionStore } from "@/state/domainSession";
import { interpretationDraftStore } from "@/state/interactionDraft";
import {
  focusPresentationStore,
  interpretationPresentationStore,
  readFocusView,
} from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import { arcPoint, intentionArcMid } from "./curves";
import { DWELL_CLOSE_GRACE_MS, DWELL_OPEN_MS, SIGHT_SETTLE_MS } from "./dwell";
import { frameState, initFramePositions } from "./frameState";
import { threadCurves, writeThreadCurve } from "./threadPicking";
import {
  advancePointerFrame,
  beadPointerHandlers,
  handleArenaMiss,
  handleKeyDown,
  handlePointerMove,
  handlePointerUp,
  handleWindowBlur,
  sigilControlId,
  sigilHandlers,
  threadingEnv,
  type SigilKeyEvent,
  type SigilPointerEvent,
} from "./threading";

interface PointerInit {
  readonly pointerId?: number;
  readonly pointerType?: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly target?: unknown;
}

function threeEvent(init: PointerInit) {
  return {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? "mouse",
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
    pointerType: init.pointerType ?? "mouse",
    clientX: init.clientX,
    clientY: init.clientY,
    target: init.target ?? null,
  } as unknown as PointerEvent;
}

/** A sigil station's box on the page, as the plate lays it out. */
const SIGIL_BOX = Object.freeze({ left: 600, top: 300, right: 648, bottom: 348 });
const ON_SIGIL = Object.freeze({ clientX: 624, clientY: 324 });
const OFF_SIGIL = Object.freeze({ clientX: 760, clientY: 520 });

function sigilPointer(
  init: Partial<Omit<SigilPointerEvent, "currentTarget" | "stopPropagation">> &
    Readonly<{ clientX: number; clientY: number }>
): SigilPointerEvent {
  return {
    pointerId: init.pointerId ?? 7,
    pointerType: init.pointerType ?? "mouse",
    button: init.button ?? 0,
    clientX: init.clientX,
    clientY: init.clientY,
    pressure: init.pressure ?? 0.5,
    currentTarget: {
      setPointerCapture: () => undefined,
      getBoundingClientRect: () => SIGIL_BOX,
    },
    stopPropagation: () => undefined,
  };
}

function key(name: string, repeat = false): SigilKeyEvent {
  return { key: name, repeat, preventDefault: () => undefined };
}

const escape = (repeat = false) =>
  ({ key: "Escape", repeat }) as unknown as KeyboardEvent;

const draft = () => interpretationDraftStore.getState().draft;
const committedThreads = () => domainSessionStore.getState().session?.threads ?? [];

let beadIds: readonly string[] = [];
/** Which sigil control the keyboard last moved focus to. */
let focusedControl: string | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  focusedControl = null;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      elementFromPoint: () => null,
      getElementById: (id: string) => ({
        focus: () => {
          focusedControl = id;
        },
      }),
    },
  });
  // Resolved at call time, so the fake timers installed above own them.
  Object.assign(globalThis.window as unknown as Record<string, unknown>, {
    innerWidth: 1280,
    innerHeight: 800,
    setTimeout: (callback: () => void, delayMs?: number) =>
      globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle: ReturnType<typeof setTimeout>) =>
      globalThis.clearTimeout(handle),
  });

  vi.clearAllMocks();
  const started = startSession(["mathematics", "music", "art"], { seed: 7 });
  beadIds = started.session.conceptIds.map(String);
  // A plausible layout: the handlers read positions from here to find what
  // the lens covers. Spacing is chosen so that no bead sits inside another's
  // sight radius, which is what makes a sighting assertable.
  const positions = new Float32Array(beadIds.length * 3);
  for (let index = 0; index < beadIds.length; index += 1) {
    positions[index * 3] = index * 2;
    positions[index * 3 + 1] = (index % 3) * 0.4;
  }
  initFramePositions([...beadIds], positions);
  frameState.lens.active = false;
});

afterEach(() => {
  // The gesture state machine is module-level, exactly as the canvas holds it;
  // a test that leaves a pointer down would silently disable the next one.
  handleWindowBlur();
  productionInterpretation.reset();
  threadCurves.clear();
  vi.useRealTimers();
});

/**
 * The lens needs a camera and a canvas to find what it covers (I-017).
 */
function withCamera<T>(
  run: (screenPointOf: (id: string) => { clientX: number; clientY: number }) => T
): T {
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

/** Press and release a bead: the press is the act (I-016). */
function tap(id: string, pointerId = 1, at = { clientX: 400, clientY: 400 }): void {
  beadPointerHandlers(id).onPointerDown(threeEvent({ pointerId, ...at }));
  handlePointerUp(domEvent({ pointerId, ...at }));
}

/** Attend the first bead and lock the second. */
function lockPair(): readonly [string, string] {
  const [first, second] = beadIds;
  tap(first, 1);
  tap(second, 2, { clientX: 500, clientY: 400 });
  expect(draft()).toMatchObject({
    stage: "locked",
    pair: [toConceptId(first), toConceptId(second)],
  });
  return [first, second];
}

/** Press a reading's sigil and release it over itself. */
function weave(intention: RelationIntention): void {
  const hands = sigilHandlers(intention);
  hands.onPointerDown(sigilPointer(ON_SIGIL));
  vi.advanceTimersByTime(120);
  hands.onPointerUp(sigilPointer(ON_SIGIL));
}

describe("threading — the primary verb", () => {
  /**
   * GAP-B3. Verified live before the fix: press Fibonacci, drag toward
   * Counterpoint, release, and the result was draft stage "inactive", zero
   * threads, the unchanged message "Choose a bead to Attend.", and
   * `failureMessage` null. The most natural gesture a hand makes with two
   * spheres did nothing at all and explained nothing.
   */
  it("opens the attended bead when a press is dragged", () => {
    const source = beadIds[0];
    expect(draft().stage).toBe("inactive");

    beadPointerHandlers(source).onPointerDown(
      threeEvent({ clientX: 400, clientY: 400 })
    );
    handlePointerMove(domEvent({ clientX: 460, clientY: 430 }));

    expect(draft()).toMatchObject({
      stage: "attending",
      attendedConceptId: toConceptId(source),
    });

    handlePointerUp(domEvent({ clientX: 460, clientY: 430 }));

    // Releasing away from where it began keeps attention rather than throwing
    // it away: still an answer, still progress, never a punishment.
    expect(draft().stage).toBe("attending");
  });

  it("still treats a press without movement as a plain tap", () => {
    const source = beadIds[0];
    beadPointerHandlers(source).onPointerDown(
      threeEvent({ clientX: 400, clientY: 400 })
    );
    handlePointerUp(domEvent({ clientX: 401, clientY: 400 }));
    expect(draft()).toMatchObject({
      stage: "attending",
      attendedConceptId: toConceptId(source),
    });
  });

  /**
   * B2. Timed on an earlier build: a click set attention on the way *up*, the
   * attend phrase re-framed the camera, and for about three and a half seconds
   * nothing on the screen answered. The press is the attending.
   */
  it("opens the bead on the way down, before the hand comes back up", () => {
    const source = beadIds[0];
    expect(draft().stage).toBe("inactive");

    beadPointerHandlers(source).onPointerDown(
      threeEvent({ clientX: 400, clientY: 400 })
    );

    // No move, no release: the world has already answered.
    expect(draft()).toMatchObject({
      stage: "attending",
      attendedConceptId: toConceptId(source),
    });

    handlePointerUp(domEvent({ clientX: 400, clientY: 400 }));
    expect(draft().stage).toBe("attending");
  });

  /**
   * …and the other half of the same defect. `CameraRig` abandons a queued
   * camera phrase only from a *frame* callback and only while the controls are
   * held. The commit that queues the pose is flushed at default priority —
   * traced at 28 ms, well after a click has ended — so handing the controls
   * back on release let the world lean away from what it had just opened.
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
      for (let frame = 0; frame < 3; frame += 1) advancePointerFrame();
      expect(controls.enabled).toBe(false);
      for (let frame = 0; frame < 8; frame += 1) advancePointerFrame();
      expect(controls.enabled).toBe(true);
    } finally {
      threadingEnv.controls = null;
    }
  });

  it("locks the second bead on a press, and replaces it on another", () => {
    const [first, , third] = beadIds;
    lockPair();

    tap(third, 3, { clientX: 600, clientY: 400 });
    expect(draft()).toMatchObject({
      stage: "locked",
      pair: [toConceptId(first), toConceptId(third)],
    });
    // Nothing provisional reaches the log.
    expect(committedThreads()).toHaveLength(0);
  });

  it("puts the lens down and leaves the draft alone when no bead is attended", () => {
    handlePointerMove(domEvent({ clientX: 10, clientY: 10 }));
    expect(frameState.lens.active).toBe(false);
    expect(frameState.snapId).toBeNull();
    expect(draft().stage).toBe("inactive");
    expect(cancelGliss).not.toHaveBeenCalled();
  });
});

describe("dwell — a roaming bead's card (I-015)", () => {
  const dwelt = () => focusPresentationStore.getState().dwellConceptId;

  it("opens after the pointer has rested on a bead, and closes after the grace", () => {
    const bead = beadIds[0];
    const handlers = beadPointerHandlers(bead);
    handlers.onPointerOver(threeEvent({ clientX: 400, clientY: 400 }));

    vi.advanceTimersByTime(DWELL_OPEN_MS - 1);
    expect(dwelt()).toBeNull();
    // Every move over the same bead reports it again; none restarts the wait.
    handlers.onPointerMove(threeEvent({ clientX: 402, clientY: 401 }));
    vi.advanceTimersByTime(1);
    expect(dwelt()).toBe(toConceptId(bead));
    expect(readFocusView().column.top).toEqual({
      kind: "bead",
      conceptId: toConceptId(bead),
      role: "dwell",
    });

    handlers.onPointerOut(threeEvent({ clientX: 470, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_CLOSE_GRACE_MS - 1);
    expect(dwelt()).toBe(toConceptId(bead));
    vi.advanceTimersByTime(1);
    expect(dwelt()).toBeNull();
    // A look records nothing.
    expect(committedThreads()).toHaveLength(0);
    expect(draft().stage).toBe("inactive");
  });

  it("keeps the card when the pointer slips off and back inside the grace", () => {
    const bead = beadIds[0];
    const handlers = beadPointerHandlers(bead);
    handlers.onPointerOver(threeEvent({ clientX: 400, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_OPEN_MS);
    handlers.onPointerOut(threeEvent({ clientX: 470, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_CLOSE_GRACE_MS - 50);
    handlers.onPointerOver(threeEvent({ clientX: 401, clientY: 400 }));
    vi.advanceTimersByTime(2_000);
    expect(dwelt()).toBe(toConceptId(bead));
  });

  it("restarts the whole wait on another bead, closing the first on the grace", () => {
    const [first, second] = beadIds;
    beadPointerHandlers(first).onPointerOver(threeEvent({ clientX: 400, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_OPEN_MS);
    expect(dwelt()).toBe(toConceptId(first));

    beadPointerHandlers(first).onPointerOut(threeEvent({ clientX: 470, clientY: 400 }));
    beadPointerHandlers(second).onPointerOver(threeEvent({ clientX: 471, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_CLOSE_GRACE_MS);
    expect(dwelt()).toBeNull();
    vi.advanceTimersByTime(DWELL_OPEN_MS - DWELL_CLOSE_GRACE_MS - 1);
    expect(dwelt()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(dwelt()).toBe(toConceptId(second));
  });

  it("never dwells for a finger, which has no hover", () => {
    beadPointerHandlers(beadIds[0]).onPointerOver(
      threeEvent({ pointerType: "touch", clientX: 400, clientY: 400 })
    );
    vi.advanceTimersByTime(DWELL_OPEN_MS * 3);
    expect(dwelt()).toBeNull();
  });

  it("does not open a card after a press, nor while a bead is attended", () => {
    const [first, second] = beadIds;
    beadPointerHandlers(first).onPointerOver(threeEvent({ clientX: 400, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_OPEN_MS - 100);
    // The press is a decision, and it lands before the look would have.
    tap(first);
    vi.advanceTimersByTime(DWELL_OPEN_MS * 2);
    expect(dwelt()).toBeNull();

    beadPointerHandlers(second).onPointerOver(threeEvent({ clientX: 470, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_OPEN_MS * 2);
    expect(dwelt()).toBeNull();
    expect(draft().stage).toBe("attending");
  });

  it("starts a fresh wait when the player steps back to roaming", () => {
    const bead = beadIds[0];
    const handlers = beadPointerHandlers(bead);
    handlers.onPointerOver(threeEvent({ clientX: 400, clientY: 400 }));
    tap(bead);
    vi.advanceTimersByTime(5_000);
    productionInterpretation.cancel();
    advancePointerFrame();
    expect(draft().stage).toBe("inactive");

    // Resting on the same bead since long ago does not count: the look
    // begins again with the next move.
    handlers.onPointerMove(threeEvent({ clientX: 401, clientY: 400 }));
    vi.advanceTimersByTime(DWELL_OPEN_MS - 1);
    expect(dwelt()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(dwelt()).toBe(toConceptId(bead));
  });
});

describe("the lens — sighting that settles (I-017, I-018)", () => {
  /**
   * While a bead is attended the pointer sights the nearest bead within its
   * disc. The renderer sees it at once; the card, the cue and the catch wait
   * until the lens has stayed, and the catch is its own sound, never hover's.
   */
  it("sights the nearest bead once the lens has settled, with its own sound and staged moment", () => {
    withCamera((screenPointOf) => {
      const staged: string[] = [];
      const detach = cueBus.subscribe("scene", (cue) => staged.push(cue.type));
      const [source, target] = beadIds;

      tap(source, 1, screenPointOf(source));
      expect(draft().stage).toBe("attending");

      handlePointerMove(domEvent(screenPointOf(target)));

      // At once: the lens, and the bead it covers, for the renderer.
      expect(frameState.lens.active).toBe(true);
      expect(frameState.snapId).toBe(target);
      // Not yet: the card, the cue and the catch.
      expect(focusPresentationStore.getState().sightedConceptId).toBeNull();
      expect(latchTick).not.toHaveBeenCalled();
      expect(staged).not.toContain("attention.sighted");

      vi.advanceTimersByTime(SIGHT_SETTLE_MS);

      expect(focusPresentationStore.getState().sightedConceptId).toBe(
        toConceptId(target)
      );
      expect(latchTick).toHaveBeenCalledWith(target);
      expect(hoverPing).not.toHaveBeenCalled();
      expect(staged).toContain("attention.sighted");
      expect(readFocusView().column.second).toEqual({
        kind: "bead",
        conceptId: toConceptId(target),
        role: "sighted",
      });
      detach();
    });
  });

  it("settles on the last bead of a sweep, and only on that one", () => {
    withCamera((screenPointOf) => {
      const staged: string[] = [];
      const detach = cueBus.subscribe("scene", (cue) => staged.push(cue.type));
      const [source, b1, b2, b3] = beadIds;
      tap(source, 1, screenPointOf(source));

      for (const bead of [b1, b2, b3]) {
        handlePointerMove(domEvent(screenPointOf(bead)));
        expect(frameState.snapId).toBe(bead);
        vi.advanceTimersByTime(SIGHT_SETTLE_MS - 100);
      }
      vi.advanceTimersByTime(100);

      expect(focusPresentationStore.getState().sightedConceptId).toBe(
        toConceptId(b3)
      );
      expect(latchTick).toHaveBeenCalledTimes(1);
      expect(latchTick).toHaveBeenCalledWith(b3);
      expect(staged.filter((type) => type === "attention.sighted")).toHaveLength(1);
      detach();
    });
  });

  it("opens the gap again only after the lens has been off every bead as long", () => {
    withCamera((screenPointOf) => {
      const [source, target] = beadIds;
      tap(source, 1, screenPointOf(source));
      handlePointerMove(domEvent(screenPointOf(target)));
      vi.advanceTimersByTime(SIGHT_SETTLE_MS);

      handlePointerMove(domEvent({ clientX: 40, clientY: 40 }));
      expect(frameState.snapId).toBeNull();
      vi.advanceTimersByTime(SIGHT_SETTLE_MS - 1);
      expect(focusPresentationStore.getState().sightedConceptId).toBe(
        toConceptId(target)
      );
      vi.advanceTimersByTime(1);
      expect(focusPresentationStore.getState().sightedConceptId).toBeNull();
      expect(readFocusView().column.second).toEqual({ kind: "gap" });
    });
  });

  it("puts the lens down the frame a Lock happens, and nothing settles after it", () => {
    withCamera((screenPointOf) => {
      const [source, target] = beadIds;
      tap(source, 1, screenPointOf(source));
      handlePointerMove(domEvent(screenPointOf(target)));
      expect(frameState.lens.active).toBe(true);

      // Locked before the sighting settled.
      tap(target, 2, screenPointOf(target));
      advancePointerFrame();
      expect(frameState.lens.active).toBe(false);
      expect(frameState.snapId).toBeNull();
      vi.advanceTimersByTime(SIGHT_SETTLE_MS * 4);
      expect(latchTick).not.toHaveBeenCalled();
      expect(draft().stage).toBe("locked");
    });
  });

  it("keeps the lens path as the weave's approach (I-020)", () => {
    withCamera((screenPointOf) => {
      const [source, target] = beadIds;
      tap(source, 1, screenPointOf(source));
      const from = screenPointOf(source);
      const to = screenPointOf(target);
      for (let step = 1; step <= 6; step += 1) {
        vi.advanceTimersByTime(16);
        handlePointerMove(
          domEvent({
            clientX: from.clientX + ((to.clientX - from.clientX) * step) / 6,
            clientY: from.clientY + ((to.clientY - from.clientY) * step) / 6 + (step % 2) * 9,
          })
        );
      }
      vi.advanceTimersByTime(16);
      tap(target, 2, to);
      weave("echo");

      const [thread] = committedThreads();
      expect(thread.gesture.inputModality).toBe("mouse");
      // The geometry is the sweep's — at least the ground it covered from the
      // first sample to the last, and more, because it zig-zagged — …
      const covered = Math.hypot(
        ((to.clientX - from.clientX) * 5) / 6 / 1280,
        ((to.clientY - from.clientY) * 5) / 6 / 800
      );
      expect(thread.gesture.pathLengthViewport).toBeGreaterThan(covered);
      expect(thread.gesture.curvature).toBeGreaterThan(0);
      // … and the duration is the hold's.
      expect(thread.gesture.durationMs).toBe(120);
      // A mouse does not measure pressure; none is recorded for it.
      expect(thread.gesture.pressure).toBeUndefined();
    });
  });
});

describe("the sigils — hear, hold, weave (I-016)", () => {
  it("hears a reading on hover without choosing it, and forgets it on leaving", () => {
    lockPair();
    const passage = sigilHandlers("passage");
    passage.onPointerEnter(sigilPointer(ON_SIGIL));
    expect(focusPresentationStore.getState().previewIntention).toBe("passage");
    expect(readFocusView().previewIntention).toBe("passage");
    expect(draft().stage).toBe("locked");

    passage.onPointerLeave(sigilPointer(OFF_SIGIL));
    expect(focusPresentationStore.getState().previewIntention).toBeNull();
  });

  it("hears nothing from a finger arriving, because a finger's arrival is a press", () => {
    lockPair();
    sigilHandlers("tension").onPointerEnter(sigilPointer({ ...ON_SIGIL, pointerType: "touch" }));
    expect(focusPresentationStore.getState().previewIntention).toBeNull();
  });

  it("chooses on the press and begins the hold; release over the sigil weaves", () => {
    const [first, second] = lockPair();
    const echo = sigilHandlers("echo");
    echo.onPointerDown(sigilPointer(ON_SIGIL));

    expect(draft()).toMatchObject({ stage: "reading", intention: "echo" });
    expect(productionInterpretation.isHolding()).toBe(true);
    expect(interpretationPresentationStore.getState().weaving).toBe(true);
    expect(committedThreads()).toHaveLength(0);

    vi.advanceTimersByTime(400);
    echo.onPointerUp(sigilPointer(ON_SIGIL));

    const threads = committedThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0].intention).toBe("echo");
    expect(threads[0].pair.map(String)).toEqual([first, second]);
    expect(threads[0].gesture.durationMs).toBe(400);
    expect(draft().stage).toBe("inactive");
    expect(productionInterpretation.isHolding()).toBe(false);
  });

  it("treats a quick click as a short hold, and weaves", () => {
    lockPair();
    const ground = sigilHandlers("ground");
    ground.onPointerDown(sigilPointer(ON_SIGIL));
    ground.onPointerUp(sigilPointer(ON_SIGIL));
    expect(committedThreads()).toHaveLength(1);
    expect(committedThreads()[0].intention).toBe("ground");
  });

  it("records a finger's pressure, where a finger reports one", () => {
    lockPair();
    const tension = sigilHandlers("tension");
    tension.onPointerDown(sigilPointer({ ...ON_SIGIL, pointerType: "touch", pressure: 0.8 }));
    vi.advanceTimersByTime(200);
    tension.onPointerUp(sigilPointer({ ...ON_SIGIL, pointerType: "touch", pressure: 0.6 }));
    const [thread] = committedThreads();
    expect(thread.gesture.inputModality).toBe("touch");
    expect(thread.gesture.pressure).toBeCloseTo(0.7, 5);
  });

  it("abandons the hold when released elsewhere, and keeps the reading", () => {
    lockPair();
    const passage = sigilHandlers("passage");
    passage.onPointerDown(sigilPointer(ON_SIGIL));
    passage.onPointerUp(sigilPointer(OFF_SIGIL));

    expect(committedThreads()).toHaveLength(0);
    expect(productionInterpretation.isHolding()).toBe(false);
    expect(draft()).toMatchObject({ stage: "reading", intention: "passage" });
    // Heard and refused, never silent.
    expect(cancelGliss).toHaveBeenCalledTimes(1);
  });

  it("abandons the hold when the pointer is cancelled or its capture is lost", () => {
    lockPair();
    const echo = sigilHandlers("echo");
    echo.onPointerDown(sigilPointer(ON_SIGIL));
    echo.onPointerCancel(sigilPointer(ON_SIGIL));
    expect(productionInterpretation.isHolding()).toBe(false);
    expect(draft()).toMatchObject({ stage: "reading", intention: "echo" });

    echo.onPointerDown(sigilPointer(ON_SIGIL));
    echo.onLostPointerCapture(sigilPointer(ON_SIGIL));
    expect(productionInterpretation.isHolding()).toBe(false);
    expect(committedThreads()).toHaveLength(0);
  });

  it("lets only the hand that pressed release the hold", () => {
    lockPair();
    const echo = sigilHandlers("echo");
    echo.onPointerDown(sigilPointer({ ...ON_SIGIL, pointerId: 7 }));
    // A second finger lifted anywhere does not end the first finger's hold …
    echo.onPointerUp(sigilPointer({ ...OFF_SIGIL, pointerId: 8 }));
    expect(productionInterpretation.isHolding()).toBe(true);
    // … nor does a second press begin another …
    sigilHandlers("ground").onPointerDown(sigilPointer({ ...ON_SIGIL, pointerId: 8 }));
    expect(draft()).toMatchObject({ stage: "reading", intention: "echo" });
    // … nor does a key lifted that never began one.
    echo.onKeyUp(key("Enter"));
    expect(productionInterpretation.isHolding()).toBe(true);

    echo.onPointerUp(sigilPointer({ ...ON_SIGIL, pointerId: 7 }));
    expect(committedThreads()).toHaveLength(1);
    expect(committedThreads()[0].intention).toBe("echo");
  });

  it("does not let a hold ended elsewhere stand in the way of the next", () => {
    lockPair();
    const echo = sigilHandlers("echo");
    echo.onKeyDown(key("Enter"));
    // The accessible mirror's Step back lets the hold go without this layer.
    productionInterpretation.cancel();
    expect(productionInterpretation.isHolding()).toBe(false);

    const passage = sigilHandlers("passage");
    passage.onPointerDown(sigilPointer(ON_SIGIL));
    expect(productionInterpretation.isHolding()).toBe(true);
    // The Enter that began the abandoned hold, lifted now, weaves nothing.
    echo.onKeyUp(key("Enter"));
    expect(committedThreads()).toHaveLength(0);
    passage.onPointerUp(sigilPointer(ON_SIGIL));
    expect(committedThreads()[0].intention).toBe("passage");
  });

  it("ignores a secondary button, and a sigil pressed with no pair held", () => {
    lockPair();
    sigilHandlers("echo").onPointerDown(sigilPointer({ ...ON_SIGIL, button: 2 }));
    expect(productionInterpretation.isHolding()).toBe(false);
    expect(draft().stage).toBe("locked");

    productionInterpretation.cancel();
    expect(draft().stage).toBe("attending");
    expect(() =>
      sigilHandlers("echo").onPointerDown(sigilPointer(ON_SIGIL))
    ).not.toThrow();
    expect(productionInterpretation.isHolding()).toBe(false);
  });

  it("keeps a click on the plate from reaching the arena behind it", () => {
    lockPair();
    let stopped = 0;
    const click = (detail: number) => ({
      detail,
      stopPropagation: () => {
        stopped += 1;
      },
    });
    // A pointer's click is the end of a hold, not a choice …
    sigilHandlers("tension").onClick(click(1));
    expect(draft().stage).toBe("locked");
    // … an assistive technology's activation carries no coordinates, and chooses.
    sigilHandlers("tension").onClick(click(0));
    expect(draft()).toMatchObject({ stage: "reading", intention: "tension" });
    expect(stopped).toBe(2);
  });
});

describe("the sigils from the keyboard — a radiogroup (I-009, I-016)", () => {
  it("weaves on Enter held and released, with the keyboard's own profile", () => {
    withCamera((screenPointOf) => {
      const [source, target] = beadIds;
      tap(source, 1, screenPointOf(source));
      // A mouse sweep exists; a keyboard hold must not borrow it.
      for (let step = 0; step < 4; step += 1) {
        vi.advanceTimersByTime(16);
        handlePointerMove(domEvent({ clientX: 300 + step * 40, clientY: 380 }));
      }
      tap(target, 2, screenPointOf(target));

      const echo = sigilHandlers("echo");
      echo.onKeyDown(key("Enter"));
      expect(draft()).toMatchObject({ stage: "reading", intention: "echo" });
      expect(productionInterpretation.isHolding()).toBe(true);
      // Auto-repeat is the same key still held, not a second press.
      echo.onKeyDown(key("Enter", true));
      vi.advanceTimersByTime(650);
      echo.onKeyUp(key("Enter"));

      const [thread] = committedThreads();
      expect(thread.intention).toBe("echo");
      expect(thread.gesture.inputModality).toBe("keyboard");
      expect(thread.gesture.durationMs).toBe(650);
      expect(thread.gesture.pathLengthViewport).toBeUndefined();
      expect(thread.gesture.curvature).toBeUndefined();
    });
  });

  it("moves focus with the arrows, Home and End, and chooses as it goes", () => {
    lockPair();
    sigilHandlers("echo").onKeyDown(key("ArrowRight"));
    expect(focusedControl).toBe(sigilControlId("passage"));
    expect(draft()).toMatchObject({ stage: "reading", intention: "passage" });

    sigilHandlers("passage").onKeyDown(key("ArrowDown"));
    expect(focusedControl).toBe(sigilControlId("tension"));
    expect(draft()).toMatchObject({ intention: "tension" });

    // The ring has no ends: it wraps both ways.
    sigilHandlers("echo").onKeyDown(key("ArrowLeft"));
    expect(focusedControl).toBe(sigilControlId("ground"));
    sigilHandlers("ground").onKeyDown(key("ArrowRight"));
    expect(focusedControl).toBe(sigilControlId("echo"));
    sigilHandlers("echo").onKeyDown(key("ArrowUp"));
    expect(focusedControl).toBe(sigilControlId("ground"));

    sigilHandlers("ground").onKeyDown(key("Home"));
    expect(focusedControl).toBe(sigilControlId("echo"));
    expect(draft()).toMatchObject({ intention: "echo" });
    sigilHandlers("echo").onKeyDown(key("End"));
    expect(focusedControl).toBe(sigilControlId("ground"));
    expect(draft()).toMatchObject({ intention: "ground" });

    // Choosing is not weaving.
    expect(productionInterpretation.isHolding()).toBe(false);
    expect(committedThreads()).toHaveLength(0);
  });

  it("chooses on Space without moving or weaving", () => {
    lockPair();
    sigilHandlers("tension").onKeyDown(key(" "));
    expect(draft()).toMatchObject({ stage: "reading", intention: "tension" });
    expect(focusedControl).toBeNull();
    expect(productionInterpretation.isHolding()).toBe(false);
  });

  it("will not change the reading under a hold in progress", () => {
    lockPair();
    const echo = sigilHandlers("echo");
    echo.onKeyDown(key("Enter"));
    echo.onKeyDown(key("ArrowRight"));
    echo.onKeyDown(key(" "));
    expect(focusedControl).toBeNull();
    expect(draft()).toMatchObject({ stage: "reading", intention: "echo" });
    echo.onKeyUp(key("Enter"));
    expect(committedThreads()[0].intention).toBe("echo");
  });

  it("gives every sigil the same hands, in a fixed order", () => {
    lockPair();
    // No sigil is special: each chooses itself, and only itself.
    for (const intention of ["echo", "passage", "tension", "ground"] as const) {
      sigilHandlers(intention).onKeyDown(key(" "));
      expect(draft()).toMatchObject({ stage: "reading", intention });
    }
  });
});

describe("reopening a woven thread (I-019)", () => {
  /** Weave the first pair as Echo and register its strand as the ribbon would. */
  function wovenStrand(camera: THREE.Camera): { threadId: string; x: number; y: number } {
    lockPair();
    weave("echo");
    const [thread] = committedThreads();
    const [a, b] = thread.pair.map(String);
    const at = (id: string) => {
      const index = frameState.beadIndex.get(id)!;
      return new THREE.Vector3(
        frameState.rendered[index * 3],
        frameState.rendered[index * 3 + 1],
        frameState.rendered[index * 3 + 2]
      );
    };
    const start = at(a);
    const end = at(b);
    const middle = intentionArcMid(start, end, thread.intention, new THREE.Vector3());
    writeThreadCurve(String(thread.id), start, middle, end);
    const onScreen = arcPoint(start, middle, end, 0.5, new THREE.Vector3()).project(camera);
    return {
      threadId: String(thread.id),
      x: ((onScreen.x + 1) / 2) * 1280,
      y: ((1 - onScreen.y) / 2) * 800,
    };
  }

  const click = (x: number, y: number, pointerType = "mouse") => ({
    type: "click",
    button: 0,
    clientX: x,
    clientY: y,
    pointerType,
  });

  it("reopens the strand under a roaming click, and changes nothing durable", () => {
    withCamera(() => {
      const strand = wovenStrand(threadingEnv.camera!);
      const eventsBefore = domainSessionStore.getState().eventLog?.events.length;

      handleArenaMiss(click(strand.x + 6, strand.y - 5));

      expect(focusPresentationStore.getState().reopened?.threadId).toBe(strand.threadId);
      const view = readFocusView();
      expect(view.mode).toBe("held");
      expect(view.reopenedThreadId).toBe(strand.threadId);
      expect(domainSessionStore.getState().eventLog?.events.length).toBe(eventsBefore);
    });
  });

  it("gives a finger a wider reach than a cursor", () => {
    withCamera(() => {
      const strand = wovenStrand(threadingEnv.camera!);
      handleArenaMiss(click(strand.x, strand.y + 18));
      expect(focusPresentationStore.getState().reopened).toBeNull();
      handleArenaMiss(click(strand.x, strand.y + 18, "touch"));
      expect(focusPresentationStore.getState().reopened?.threadId).toBe(strand.threadId);
    });
  });

  it("reopens nothing for a click beside every strand", () => {
    withCamera(() => {
      const strand = wovenStrand(threadingEnv.camera!);
      handleArenaMiss(click(strand.x, strand.y + 120));
      expect(focusPresentationStore.getState().reopened).toBeNull();
      expect(readFocusView().mode).toBe("roaming");
    });
  });

  it("only reopens while roaming: attending, the same click steps back (I-011)", () => {
    withCamera((screenPointOf) => {
      const strand = wovenStrand(threadingEnv.camera!);
      tap(beadIds[3], 4, screenPointOf(beadIds[3]));
      expect(draft().stage).toBe("attending");
      handleArenaMiss(click(strand.x, strand.y));
      expect(draft().stage).toBe("inactive");
      expect(focusPresentationStore.getState().reopened).toBeNull();
    });
  });

  it("never reopens on a secondary click, which is Cancel's", () => {
    withCamera(() => {
      const strand = wovenStrand(threadingEnv.camera!);
      handleArenaMiss({ ...click(strand.x, strand.y), type: "contextmenu", button: 2 });
      expect(focusPresentationStore.getState().reopened).toBeNull();
    });
  });

  it("says a strand can be touched with the cursor, only while roaming", () => {
    withCamera((screenPointOf) => {
      const strand = wovenStrand(threadingEnv.camera!);
      const dom = threadingEnv.dom!;
      handlePointerMove(domEvent({ clientX: strand.x, clientY: strand.y + 4, target: dom }));
      expect(dom.style.cursor).toBe("pointer");
      handlePointerMove(domEvent({ clientX: strand.x, clientY: strand.y + 90, target: dom }));
      expect(dom.style.cursor).toBe("");

      // Attending, the pointer is a lens, and a strand is not a thing to press.
      tap(beadIds[3], 4, screenPointOf(beadIds[3]));
      handlePointerMove(domEvent({ clientX: strand.x, clientY: strand.y + 4, target: dom }));
      expect(dom.style.cursor).toBe("");
    });
  });

  it("returns to the arena on Escape", () => {
    withCamera(() => {
      const strand = wovenStrand(threadingEnv.camera!);
      handleArenaMiss(click(strand.x, strand.y));
      expect(readFocusView().mode).toBe("held");
      handleKeyDown(escape());
      expect(focusPresentationStore.getState().reopened).toBeNull();
      expect(readFocusView().mode).toBe("roaming");
      expect(committedThreads()).toHaveLength(1);
    });
  });
});

describe("Escape — one step back per press (I-010 as adapted by I-016)", () => {
  it("lets go of a hold first, and keeps the chosen reading", () => {
    lockPair();
    sigilHandlers("tension").onPointerDown(sigilPointer(ON_SIGIL));
    handleKeyDown(escape());
    expect(productionInterpretation.isHolding()).toBe(false);
    expect(draft()).toMatchObject({ stage: "reading", intention: "tension" });
    expect(cancelGliss).toHaveBeenCalledTimes(1);
    // The release that follows weaves nothing.
    sigilHandlers("tension").onPointerUp(sigilPointer(ON_SIGIL));
    expect(committedThreads()).toHaveLength(0);
  });

  it("lets go of a keyboard hold the same way", () => {
    lockPair();
    const echo = sigilHandlers("echo");
    echo.onKeyDown(key("Enter"));
    handleKeyDown(escape());
    echo.onKeyUp(key("Enter"));
    expect(committedThreads()).toHaveLength(0);
    expect(draft()).toMatchObject({ stage: "reading", intention: "echo" });
  });

  it("then closes an open inspection, and only that", () => {
    lockPair();
    productionInterpretation.inspect(toConceptId(beadIds[0]));
    expect(useStore.getState().pinnedInspectId).toBe(beadIds[0]);
    handleKeyDown(escape());
    expect(useStore.getState().pinnedInspectId).toBeNull();
    expect(draft().stage).toBe("locked");
  });

  it("then steps back one stage at a time: Read → Lock → Attend → Roam", () => {
    lockPair();
    sigilHandlers("ground").onKeyDown(key(" "));
    expect(draft().stage).toBe("reading");
    handleKeyDown(escape());
    expect(draft().stage).toBe("locked");
    handleKeyDown(escape());
    expect(draft().stage).toBe("attending");
    handleKeyDown(escape());
    expect(draft().stage).toBe("inactive");
    // Nothing provisional ever reached the log.
    expect(committedThreads()).toHaveLength(0);
  });

  it("takes a key held down as one press, not several", () => {
    lockPair();
    handleKeyDown(escape());
    handleKeyDown(escape(true));
    handleKeyDown(escape(true));
    expect(draft().stage).toBe("attending");
  });
});
