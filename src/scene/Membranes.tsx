import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { Thread } from "@/state/types";
import { frameState } from "./frameState";

/**
 * Triad membranes — when three beads close a triangle, a faint iridescent
 * film stretches across it, breathing with the shared pulse. The web stops
 * being lines and starts being surface.
 */

function findTriangles(threads: Thread[]): [string, string, string][] {
  const adj = new Map<string, Set<string>>();
  for (const t of threads) {
    if (!adj.has(t.a)) adj.set(t.a, new Set());
    if (!adj.has(t.b)) adj.set(t.b, new Set());
    adj.get(t.a)!.add(t.b);
    adj.get(t.b)!.add(t.a);
  }
  const nodes = [...adj.keys()].sort();
  const out: [string, string, string][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (!adj.get(nodes[i])!.has(nodes[j])) continue;
      for (let k = j + 1; k < nodes.length; k++) {
        if (adj.get(nodes[i])!.has(nodes[k]) && adj.get(nodes[j])!.has(nodes[k])) {
          out.push([nodes[i], nodes[j], nodes[k]]);
        }
      }
    }
  }
  return out;
}

function Membrane({ ids }: { ids: [string, string, string] }) {
  const mesh = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    const colors = new Float32Array(9);
    ids.forEach((id, i) => {
      const disc = disciplineById.get(conceptById.get(id)?.discipline ?? "mathematics");
      const c = new THREE.Color(disc?.color ?? "#8888aa");
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    return { geometry: geo, material: mat };
  }, [ids]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const r = frameState.rendered;
    let ok = true;
    ids.forEach((id, i) => {
      const idx = frameState.beadIndex.get(id);
      if (idx === undefined) {
        ok = false;
        return;
      }
      pos.setXYZ(i, r[idx * 3], r[idx * 3 + 1], r[idx * 3 + 2]);
    });
    if (!ok) return;
    pos.needsUpdate = true;
    material.opacity =
      0.06 + 0.03 * Math.sin(frameState.breathPhase) * frameState.breathDepth;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-1}
    />
  );
}

export function Membranes() {
  const threads = useStore((s) => s.session?.threads ?? null);
  const triangles = useMemo(() => (threads ? findTriangles(threads) : []), [threads]);
  if (triangles.length === 0) return null;
  return (
    <group>
      {triangles.map((t) => (
        <Membrane key={t.join("+")} ids={t} />
      ))}
    </group>
  );
}
