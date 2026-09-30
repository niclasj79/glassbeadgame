import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Pass } from "postprocessing";
import { cueBus } from "@/runtime/cues";
import { useStore } from "@/state/store";
import { useCurrentTheme } from "@/themes/useTheme";
import type { FocusFog } from "./focusFogPass";

/**
 * THE FOCUS FOG'S PLACE IN THE CHAIN (I-017)
 *
 * The fog is one full-screen pass standing *before* the bloom (the reasons are
 * in `focusFogPass.ts`), and it must never become the composer's last pass: a
 * disabled last pass would leave nothing rendering to the screen. The
 * composer takes its passes in the order its children were mounted, and
 * re-appends a replaced child at the end — so the fog's place is held by one
 * pass object that is mounted with the composer and never replaced.
 *
 * That place-holder is all the first download carries. The fog itself — the
 * effect, its shader and its clock — is fetched after the first paint, because
 * nothing in it is needed until a bead is attended, and the first download is
 * a budget the project defends with dynamic imports rather than with a larger
 * number (`scripts/bundle-budgets.json`). Until it arrives the slot is switched
 * off, and a disabled pass the composer skips outright.
 */
class FocusFogSlot extends Pass {
  private inner: Pass | null = null;
  private size: [number, number] = [1, 1];
  private prepared: [THREE.WebGLRenderer, boolean, number] | null = null;

  constructor() {
    super("FocusFogSlot");
    this.enabled = false;
    this.needsSwap = true;
  }

  /** Seat the fog's own pass, prepared exactly as the composer prepared this one. */
  seat(inner: Pass): void {
    this.inner = inner;
    if (this.prepared) inner.initialize(...this.prepared);
    inner.setSize(this.size[0], this.size[1]);
  }

  override initialize(
    renderer: THREE.WebGLRenderer,
    alpha: boolean,
    frameBufferType: number
  ): void {
    this.prepared = [renderer, alpha, frameBufferType];
    this.inner?.initialize(renderer, alpha, frameBufferType);
  }

  override setSize(width: number, height: number): void {
    this.size = [width, height];
    this.inner?.setSize(width, height);
  }

  override render(
    renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget | null,
    outputBuffer: THREE.WebGLRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean
  ): void {
    this.inner?.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
  }
}

/**
 * The fog as a pass of the arena's composer. Mount it *before* the bloom; the
 * slot it renders is created once and kept for the composer's life.
 */
export function FocusFogPass() {
  const camera = useThree((state) => state.camera);
  const tier = useStore((state) => state.settings.qualityTier);
  const reducedMotion = useStore((state) => state.settings.reducedMotion);
  const theme = useCurrentTheme();
  const [slot] = useState(() => new FocusFogSlot());
  const [fog, setFog] = useState<FocusFog | null>(null);

  const made = useRef<FocusFog | null>(null);
  useEffect(() => {
    let alive = true;
    void import("./focusFogPass").then(({ createFocusFog }) => {
      if (!alive) return;
      const fog = createFocusFog(slot);
      slot.seat(fog.pass);
      made.current = fog;
      setFog(fog);
    });
    return () => {
      alive = false;
      // The pass we made is ours to dispose. Not the slot: it is mounted with
      // `dispose={null}`, which the renderer applies as a property, so by the
      // time this runs `slot.dispose` is null and calling it threw during the
      // arena's teardown.
      made.current?.pass.dispose();
      made.current = null;
    };
  }, [slot]);
  useEffect(() => {
    fog?.configure({ camera, tier, reducedMotion, ground: theme.palette.ground });
  }, [fog, camera, tier, reducedMotion, theme]);
  useEffect(() => {
    if (!fog) return undefined;
    return cueBus.subscribe("scene", (cue, plan) => {
      if (cue.type === "thread.woven") fog.liftOver(plan.duration);
    });
  }, [fog]);
  useFrame((_, rawDt) => fog?.advance(Math.min(rawDt, 1 / 20)));
  return <primitive object={slot} dispose={null} />;
}
