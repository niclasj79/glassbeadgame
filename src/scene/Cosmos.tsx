import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { useCurrentTheme } from "@/themes/useTheme";
import { conceptById } from "@/content/concepts";
import { fibonacciSpherePositions, lensPlanePositions } from "@/game/layout";
import { frameState, initFramePositions, setMorphTargets } from "./frameState";
import { Backdrop } from "./Backdrop";
import { Lattice } from "./Lattice";
import { LensAxes } from "./LensAxes";
import { Bursts } from "./Bursts";
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
  const lensView = useStore((s) => s.lensView);

  // A new session lays the beads out on the sphere.
  useEffect(() => {
    if (beadIds && beadIds.length > 0) {
      initFramePositions(beadIds, fibonacciSpherePositions(beadIds.length));
    }
  }, [beadIds]);

  // The Lens morphs between the sphere and one of three transcendental
  // planes — the triptych folds a different axis away in each view.
  useEffect(() => {
    if (!beadIds || beadIds.length === 0) return;
    const reduced = useStore.getState().settings.reducedMotion;
    const targets = lensActive
      ? lensPlanePositions(
          beadIds.map((id) => conceptById.get(id)!),
          lensView
        )
      : fibonacciSpherePositions(beadIds.length);
    if (reduced) {
      frameState.positions = targets.slice();
      frameState.targets = targets.slice();
      frameState.morphActive = false;
    } else {
      setMorphTargets(targets);
    }
  }, [lensActive, lensView, beadIds]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20); // clamp hitches so damps never jump

    // Global time dilation (the reveal's slow-motion).
    const k = 1 - Math.exp(-dt / 0.35);
    frameState.timeScale += (frameState.timeScaleTarget - frameState.timeScale) * k;
    frameState.clock += dt * frameState.timeScale;

    // The Breath: phase integrates dilated time, so it slows with reveals
    // and stays phase-continuous. Depth eases toward its context target.
    frameState.breathPhase += dt * frameState.timeScale * Math.PI * 2 * 0.1;
    const st = useStore.getState();
    const depthTarget = st.settings.reducedMotion
      ? 0
      : st.session?.interaction.mode === "reveal"
        ? 0.25
        : 1;
    frameState.breathDepth += (depthTarget - frameState.breathDepth) * Math.min(1, dt * 2);

    // The stage awakens with each luminous find.
    const sess = st.session;
    const awakeTarget =
      sess && sess.curatedAvailable > 0
        ? Math.min(
            1,
            sess.discoveries.filter((d) => d.kind === "curated").length /
              sess.curatedAvailable
          )
        : 0;
    frameState.awakening +=
      (awakeTarget - frameState.awakening) * Math.min(1, dt * 0.8);

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

  const theme = useCurrentTheme();

  return (
    <>
      <color attach="background" args={["#06090f"]} />
      <fog
        key={theme.id}
        attach="fog"
        args={[theme.fog.color, theme.fog.near, theme.fog.far]}
      />

      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} color="#dfe6ff" />
      <pointLight position={[-6, -3, -4]} intensity={26} color="#7c5cff" />
      <pointLight position={[6, -2, 5]} intensity={14} color="#2dd4ee" />

      <Backdrop />
      <Lattice />
      <LensAxes />
      <Beads />
      <Threads />
      <Bursts />
      <ThreadPreview />
      <ThreadingDriver />
      <CameraRig />
      <Effects />
    </>
  );
}
