import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useStore } from "@/state/store";
import { initialQualityTier } from "@/lib/device";
import { Cosmos } from "./Cosmos";
import { testMode } from "@/runtime/testMode";
import { handleArenaMiss } from "./threading";

/**
 * The one persistent WebGL canvas. Every screen renders above it; phase
 * changes are camera moves, never context churn. Handles the two ways a
 * GPU betrays you: context loss (overlay + remount on restore) and
 * sustained frame drops (quality-tier demotion).
 */
export function ArenaCanvas() {
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const setQualityTier = useStore((s) => s.setQualityTier);

  const handleCreated = useCallback((state: { gl: { domElement: HTMLCanvasElement; setClearColor: (c: string) => void } }) => {
    state.gl.setClearColor("#06090f");
    glRef.current = state.gl.domElement;
  }, []);

  useEffect(() => {
    const el = glRef.current;
    if (!el) return;
    const onLost = (e: Event) => {
      e.preventDefault(); // allow the browser to attempt a restore
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
      setCanvasKey((k) => k + 1); // full remount rebuilds all GPU resources
    };
    el.addEventListener("webglcontextlost", onLost);
    el.addEventListener("webglcontextrestored", onRestored);
    return () => {
      el.removeEventListener("webglcontextlost", onLost);
      el.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [canvasKey, contextLost]);

  const ceilingTier = useRef(initialQualityTier());

  const demote = useCallback(() => {
    const tier = useStore.getState().settings.qualityTier;
    if (tier === "high") setQualityTier("base");
    else if (tier === "base") setQualityTier("potato");
  }, [setQualityTier]);

  // Demotion is no longer a one-way trapdoor: sustained good frames climb
  // back up, capped at what this device started with.
  const promote = useCallback(() => {
    const tier = useStore.getState().settings.qualityTier;
    const ceiling = ceilingTier.current;
    if (tier === "potato") setQualityTier(ceiling === "potato" ? "potato" : "base");
    else if (tier === "base" && ceiling === "high") setQualityTier("high");
  }, [setQualityTier]);

  const settle = useCallback(() => {
    // Oscillating between tiers: settle at base and stop flip-flopping.
    setQualityTier(ceilingTier.current === "potato" ? "potato" : "base");
  }, [setQualityTier]);

  const cosmos = (
    <Suspense fallback={null}>
      <Cosmos />
    </Suspense>
  );

  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        key={canvasKey}
        dpr={testMode.enabled ? 1 : [1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
        }}
        camera={{ fov: 42, near: 0.1, far: 160, position: [0, 0.5, 13.8] }}
        onCreated={handleCreated}
        onPointerMissed={handleArenaMiss}
      >
        {testMode.enabled ? (
          cosmos
        ) : (
          <PerformanceMonitor
            onDecline={demote}
            onIncline={promote}
            flipflops={4}
            onFallback={settle}
          >
            {cosmos}
          </PerformanceMonitor>
        )}
      </Canvas>

      {contextLost && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-void/90">
          <div className="text-center">
            <p className="font-display text-2xl italic text-bright">The cosmos flickered.</p>
            <p className="mt-2 font-ui text-sm text-dim">
              The graphics context was lost — restoring the beads…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
