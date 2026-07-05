import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { fibonacciSpherePositions, ARENA_RADIUS } from "@/game/layout";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";

function circlePoints(radius: number, segments = 96): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
  }
  return pts;
}

/**
 * "The board" - a faint Fibonacci dot-shell and three great circles.
 * Present but never loud; it breathes very slowly.
 */
export function Lattice() {
  const group = useRef<THREE.Group>(null);
  const theme = useCurrentTheme();

  const dotsGeometry = useMemo(() => {
    const positions = fibonacciSpherePositions(140, ARENA_RADIUS);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  const circle = useMemo(() => circlePoints(ARENA_RADIUS), []);
  const latticeColor = theme.latticeColor;

  useFrame(() => {
    if (!group.current) return;
    // Synced to the shared Breath - one pulse across light and sound.
    // The board itself lifts as the weave completes.
    const breath =
      (0.78 + 0.22 * Math.sin(frameState.breathPhase) * frameState.breathDepth) *
      (1 + 0.35 * frameState.awakening);
    group.current.traverse((obj) => {
      const base = obj.userData.baseOpacity;
      if (typeof base !== "number") return;
      const mat = (obj as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && "opacity" in mat) {
        mat.opacity = base * breath;
      }
    });
  });

  return (
    <group ref={group}>
      <points geometry={dotsGeometry} userData={{ baseOpacity: 0.4 }}>
        <pointsMaterial
          size={0.028}
          sizeAttenuation
          color={latticeColor}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </points>
      <Line
        points={circle}
        color={latticeColor}
        transparent
        opacity={0.16}
        lineWidth={1}
        userData={{ baseOpacity: 0.16 }}
      />
      <Line
        points={circle}
        rotation={[Math.PI / 2, 0, 0]}
        color={latticeColor}
        transparent
        opacity={0.16}
        lineWidth={1}
        userData={{ baseOpacity: 0.16 }}
      />
      <Line
        points={circle}
        rotation={[0, Math.PI / 2, 0]}
        color={latticeColor}
        transparent
        opacity={0.16}
        lineWidth={1}
        userData={{ baseOpacity: 0.16 }}
      />
    </group>
  );
}
