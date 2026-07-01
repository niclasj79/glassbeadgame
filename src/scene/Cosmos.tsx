import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { fibonacciSpherePositions, tbgPositions } from "@/game/layout";
import { frameState, initFramePositions, setMorphTargets } from "./frameState";
import { Backdrop } from "./Backdrop";
import { Lattice } from "./Lattice";
import { Beads } from "./Beads";
import { Threads } from "./Threads";
import { ThreadPreview } from "./ThreadPreview";
import { ThreadingDriver } from "./ThreadingDriver";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";

/** Scene root: composition + the global frame-loop bookkeeping. */
export function Cosmos() {
  const beadIds = useStore((s) => s.session?.beadIds ?? null);
  const lensActive = useStore((s) => s.lensActive);

  // A new session lays the beads out on the sphere.
  useEffect(() => {
    if (beadIds && beadIds.length > 0) {
      initFramePositions(beadIds, fibonacciSpherePositions(beadIds.length));
    }
  }, [beadIds]);

  // The lens morphs between sphere-lattice and transcendental axis space.
  useEffect(() => {
    if (!beadIds || beadIds.length === 0) return;
    const reduced = useStore.getState().settings.reducedMotion;
    const targets = lensActive
      ? tbgPositions(beadIds.map((id) => conceptById.get(id)!))
      : fibonacciSpherePositions(beadIds.length);
    if (reduced) {
      frameState.positions = targets.slice();
      frameState.targets = targets.slice();
      frameState.morphActive = false;
    } else {
      setMorphTargets(targets);
    }
  }, [lensActive, beadIds]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20); // clamp hitches so damps never jump

    // Global time dilation (the reveal's slow-motion).
    const k = 1 - Math.exp(-dt / 0.35);
    frameState.timeScale += (frameState.timeScaleTarget - frameState.timeScale) * k;
    frameState.clock += dt * frameState.timeScale;

    // Layout morph toward targets.
    if (frameState.morphActive) {
      const { positions, targets } = frameState;
      const km = 1 - Math.exp(-dt / 0.45);
      let maxDelta = 0;
      for (let i = 0; i < positions.length; i++) {
        const d = targets[i] - positions[i];
        positions[i] += d * km;
        const abs = Math.abs(d);
        if (abs > maxDelta) maxDelta = abs;
      }
      if (maxDelta < 0.004) {
        positions.set(targets);
        frameState.morphActive = false;
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#06090f"]} />
      <fog attach="fog" args={["#06090f", 18, 90]} />

      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} color="#dfe6ff" />
      <pointLight position={[-6, -3, -4]} intensity={26} color="#7c5cff" />
      <pointLight position={[6, -2, 5]} intensity={14} color="#2dd4ee" />

      <Backdrop />
      <Lattice />
      <Beads />
      <Threads />
      <ThreadPreview />
      <ThreadingDriver />
      <CameraRig />
      <Effects />
    </>
  );
}
