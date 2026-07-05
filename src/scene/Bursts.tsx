import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "@/lib/utils";
import { frameState } from "./frameState";
import { getHaloTexture } from "./textures";

/**
 * One pooled particle system for every impact in the game — discoveries,
 * faints, illuminations, the concluding bloom. 256 sprites, one draw call,
 * spawned from frameState.bursts and integrated here.
 */
const POOL = 256;
const LIFE_S = 1.5;

export function Bursts() {
  const points = useRef<THREE.Points>(null);
  const rng = useMemo(() => mulberry32(0xb0057), []);

  const state = useMemo(() => {
    const positions = new Float32Array(POOL * 3);
    const colors = new Float32Array(POOL * 3);
    const velocities = new Float32Array(POOL * 3);
    const baseColors = new Float32Array(POOL * 3);
    const life = new Float32Array(POOL); // 0 = dead
    positions.fill(9999); // parked far away
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { positions, colors, velocities, baseColors, life, geometry, cursor: 0 };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20) * Math.max(0.35, frameState.timeScale);
    const { positions, colors, velocities, baseColors, life, geometry } = state;

    // Spawn pending bursts into the ring.
    while (frameState.bursts.length > 0) {
      const b = frameState.bursts.shift()!;
      const c = new THREE.Color(b.color);
      for (let n = 0; n < b.count; n++) {
        const i = state.cursor;
        state.cursor = (state.cursor + 1) % POOL;
        // Random unit direction (gaussian-ish via three uniforms).
        let dx = rng() * 2 - 1;
        let dy = rng() * 2 - 1;
        let dz = rng() * 2 - 1;
        const len = Math.hypot(dx, dy, dz) || 1;
        const speed = b.speed * (0.35 + rng() * 0.85);
        dx = (dx / len) * speed;
        dy = (dy / len) * speed;
        dz = (dz / len) * speed;
        positions[i * 3] = b.x;
        positions[i * 3 + 1] = b.y;
        positions[i * 3 + 2] = b.z;
        velocities[i * 3] = dx;
        velocities[i * 3 + 1] = dy;
        velocities[i * 3 + 2] = dz;
        const warm = 0.75 + rng() * 0.5;
        baseColors[i * 3] = c.r * warm;
        baseColors[i * 3 + 1] = c.g * warm;
        baseColors[i * 3 + 2] = c.b * warm;
        life[i] = 1;
      }
    }

    // Integrate the living.
    for (let i = 0; i < POOL; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt / LIFE_S;
      if (life[i] <= 0) {
        life[i] = 0;
        positions[i * 3] = 9999;
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
        continue;
      }
      const damp = Math.pow(0.14, dt); // gentle drag
      velocities[i * 3] *= damp;
      velocities[i * 3 + 1] *= damp;
      velocities[i * 3 + 2] *= damp;
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt + 0.06 * dt; // ember lift
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      const fade = life[i] * life[i]; // quadratic out — additive reads as dimming
      colors[i * 3] = baseColors[i * 3] * fade;
      colors[i * 3 + 1] = baseColors[i * 3 + 1] * fade;
      colors[i * 3 + 2] = baseColors[i * 3 + 2] * fade;
    }
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={points} geometry={state.geometry} frustumCulled={false} renderOrder={2}>
      <pointsMaterial
        map={getHaloTexture()}
        size={0.16}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

