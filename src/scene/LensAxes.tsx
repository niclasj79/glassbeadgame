import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import interWoff from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import { useStore } from "@/state/store";
import { LENS_EXTENT } from "@/game/layout";

const AXES = [
  { dir: [1, 0, 0], label: "Beautiful", color: "#fb7185" },
  { dir: [0, 1, 0], label: "True", color: "#60a5fa" },
  { dir: [0, 0, 1], label: "Good", color: "#fbbf24" },
] as const;

/**
 * The transcendental axes, visible only through the Lens:
 * Beauty spans, Truth rises, Good advances.
 */
export function LensAxes() {
  const lensActive = useStore((s) => s.lensActive);
  const group = useRef<THREE.Group>(null);
  const opacity = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = lensActive ? 1 : 0;
    opacity.current += (target - opacity.current) * Math.min(1, dt * 4);
    const o = opacity.current;
    g.visible = o > 0.01;
    g.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as
        | (THREE.Material & { opacity: number })
        | undefined;
      if (mat && "opacity" in mat) {
        const base = (obj.userData.baseOpacity as number | undefined) ?? 1;
        mat.transparent = true;
        mat.opacity = base * o;
      }
    });
  });

  const ext = LENS_EXTENT * 1.15;

  return (
    <group ref={group} visible={false}>
      {AXES.map(({ dir, label, color }) => {
        const end = new THREE.Vector3(...dir).multiplyScalar(ext);
        const start = end.clone().multiplyScalar(-1);
        return (
          <group key={label}>
            <Line
              points={[start.toArray(), end.toArray()]}
              color={color}
              transparent
              opacity={0.35}
              lineWidth={1.2}
              dashed
              dashSize={0.14}
              gapSize={0.08}
              userData={{ baseOpacity: 0.35 }}
            />
            <Billboard position={end.clone().multiplyScalar(1.12).toArray()}>
              <Text
                font={interWoff}
                fontSize={0.16}
                letterSpacing={0.18}
                color={color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.008}
                outlineColor="#06090f"
                userData={{ baseOpacity: 1 }}
              >
                {label.toUpperCase()}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
