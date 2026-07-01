import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Cosmos } from "./Cosmos";

/**
 * The one persistent WebGL canvas. Every screen of the app renders above it;
 * phase changes are camera moves, never context churn.
 */
export function ArenaCanvas() {
  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
        }}
        camera={{ fov: 42, near: 0.1, far: 160, position: [0, 0.5, 13.8] }}
        onCreated={({ gl }) => {
          gl.setClearColor("#06090f");
        }}
      >
        <Suspense fallback={null}>
          <Cosmos />
        </Suspense>
      </Canvas>
    </div>
  );
}
