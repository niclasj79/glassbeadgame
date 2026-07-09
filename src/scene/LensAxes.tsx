import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import interWoff from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import { useStore } from "@/state/store";
import { LENS_EXTENT, LENS_VIEWS } from "@/game/layout";

const AXIS_COLORS: Record<string, string> = {
  Good: "#fbbf24",
  True: "#60a5fa",
  Beautiful: "#fb7185",
};

/**
 * The visible pair of transcendental axes for the current Lens view.
 * The third axis is folded away — it simply is not drawn.
 */
export function LensAxes() {
  const lensActive = useStore((s) => s.lensActive);
  const lensView = useStore((s) => s.lensView);
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

  const view = LENS_VIEWS[lensView - 1] ?? LENS_VIEWS[0];
  const ext = LENS_EXTENT * 1.15;

  const axes = [
    { label: view.xAxis, dir: new THREE.Vector3(1, 0, 0) },
    { label: view.yAxis, dir: new THREE.Vector3(0, 1, 0) },
  ];

  return (
    <group ref={group} visible={false}>
      {axes.map(({ label, dir }) => {
        const color = AXIS_COLORS[label] ?? "#9aa2ff";
        const end = dir.clone().multiplyScalar(ext);
        const start = end.clone().multiplyScalar(-1);
        return (
          <group key={`${view.id}-${label}`}>
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
