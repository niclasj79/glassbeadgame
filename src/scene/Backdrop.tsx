import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { mulberry32 } from "@/lib/utils";
import { frameState } from "./frameState";
import { makeRadialTexture } from "./textures";

const STAR_COUNT = 3000;

function Starfield() {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const rng = mulberry32(0x5eed);
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const palette = [
      new THREE.Color("#cdd6ff"),
      new THREE.Color("#ffffff"),
      new THREE.Color("#ffe9d2"),
      new THREE.Color("#9fb4ff"),
    ];
    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform direction via normalized gaussian triple.
      let x = 0,
        y = 0,
        z = 0,
        len = 0;
      do {
        x = rng() * 2 - 1;
        y = rng() * 2 - 1;
        z = rng() * 2 - 1;
        len = Math.hypot(x, y, z);
      } while (len < 0.05 || len > 1);
      const r = 28 + rng() * 42;
      positions[i * 3] = (x / len) * r;
      positions[i * 3 + 1] = (y / len) * r;
      positions[i * 3 + 2] = (z / len) * r;
      const c = palette[Math.floor(rng() * palette.length)];
      const dimmed = 0.35 + rng() * 0.65;
      colors[i * 3] = c.r * dimmed;
      colors[i * 3 + 1] = c.g * dimmed;
      colors[i * 3 + 2] = c.b * dimmed;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.0045 * frameState.timeScale;
  });

  return (
    <points ref={ref} geometry={geometry} renderOrder={-3}>
      <pointsMaterial
        size={0.085}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
}

interface NebulaPlaneProps {
  color: string;
  position: [number, number, number];
  scale: number;
  drift: number;
}

function NebulaPlane({ color, position, scale, drift }: NebulaPlaneProps) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => makeRadialTexture(color, "rgba(6,9,15,0)"), [color]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.z = frameState.clock * drift;
  });

  return (
    <mesh ref={ref} position={position} scale={scale} renderOrder={-2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.62}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Deep space: stars, three breathing nebulae, and near dust motes. */
export function Backdrop() {
  return (
    <group>
      <Starfield />
      <NebulaPlane color="rgba(96,60,190,0.13)" position={[-9, 4, -34]} scale={46} drift={0.012} />
      <NebulaPlane color="rgba(38,70,190,0.11)" position={[11, -5, -40]} scale={54} drift={-0.008} />
      <NebulaPlane color="rgba(24,132,150,0.07)" position={[3, 9, -46]} scale={40} drift={0.006} />
      <Sparkles count={90} scale={10} size={2} speed={0.22} opacity={0.35} color="#8ea8ff" />
    </group>
  );
}
