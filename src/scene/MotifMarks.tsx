import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { useStore } from "@/state/store";
import type { MotifAward } from "@/state/types";
import { frameState } from "./frameState";
import { getHaloTexture } from "./textures";

/**
 * Persistent audiovisual marks for the session's completed motifs.
 * The triad already lives as a membrane; here the symposium earns its
 * slowly turning circle, and the fugue its comet forever walking the
 * subject's path. Their voices live in the ambient engine.
 */

const vCentroid = new THREE.Vector3();
const vTmp = new THREE.Vector3();

function circlePoints(segments = 64): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([Math.cos(a), 0, Math.sin(a)]);
  }
  return pts;
}

/** The Symposium's mark: a golden circle slowly turning about the council. */
function SymposiumRing({ beads }: { beads: string[] }) {
  const group = useRef<THREE.Group>(null);
  const line = useRef<Line2>(null);
  const points = useMemo(() => circlePoints(), []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Centroid + spread of the council, followed softly.
    const r = frameState.rendered;
    vCentroid.set(0, 0, 0);
    let n = 0;
    for (const id of beads) {
      const i = frameState.beadIndex.get(id);
      if (i === undefined) continue;
      vCentroid.x += r[i * 3];
      vCentroid.y += r[i * 3 + 1];
      vCentroid.z += r[i * 3 + 2];
      n++;
    }
    if (n === 0) return;
    vCentroid.multiplyScalar(1 / n);
    let maxD = 0.6;
    for (const id of beads) {
      const i = frameState.beadIndex.get(id);
      if (i === undefined) continue;
      vTmp.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]).sub(vCentroid);
      maxD = Math.max(maxD, vTmp.length());
    }
    g.position.lerp(vCentroid, Math.min(1, dt * 3));
    const scale = maxD * 1.18;
    g.scale.setScalar(g.scale.x + (scale - g.scale.x) * Math.min(1, dt * 3));
    g.rotation.y += dt * 0.12 * frameState.timeScale;

    const mat = line.current?.material as unknown as { opacity: number } | undefined;
    if (mat) {
      mat.opacity =
        0.16 +
        0.06 * Math.sin(frameState.breathPhase) * frameState.breathDepth;
    }
  });

  return (
    <group ref={group}>
      <Line
        ref={line as never}
        points={points}
        color="#e8c877"
        transparent
        opacity={0.16}
        lineWidth={1.1}
        dashed
        dashSize={0.09}
        gapSize={0.05}
        toneMapped={false}
        depthWrite={false}
      />
    </group>
  );
}

/** The Fugue's mark: a comet forever walking the subject's path. */
function FugueComet({ beads }: { beads: string[] }) {
  const head = useRef<THREE.Sprite>(null);
  const trail = useRef<(THREE.Sprite | null)[]>([]);
  const progress = useRef(0);

  const materials = useMemo(() => {
    const make = (opacity: number, scale: number) => ({
      material: new THREE.SpriteMaterial({
        map: getHaloTexture(),
        color: new THREE.Color("#bfe3ff"),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      scale,
    });
    return [make(0.75, 0.11), make(0.4, 0.085), make(0.2, 0.065), make(0.09, 0.05)];
  }, []);

  useFrame((_, dt) => {
    if (beads.length < 2) return;
    // Ping-pong along the path, easing at the turns like a phrase breathing.
    progress.current += dt * frameState.timeScale * 0.16;
    const cycle = progress.current % 2;
    const t = cycle < 1 ? cycle : 2 - cycle;
    const eased = t * t * (3 - 2 * t);

    const place = (sprite: THREE.Sprite | null, offset: number) => {
      if (!sprite) return;
      const tt = Math.max(0, Math.min(1, eased - offset));
      const scaled = tt * (beads.length - 1);
      const seg = Math.min(beads.length - 2, Math.floor(scaled));
      const frac = scaled - seg;
      const ia = frameState.beadIndex.get(beads[seg]);
      const ib = frameState.beadIndex.get(beads[seg + 1]);
      if (ia === undefined || ib === undefined) return;
      const r = frameState.rendered;
      sprite.position.set(
        r[ia * 3] + (r[ib * 3] - r[ia * 3]) * frac,
        r[ia * 3 + 1] + (r[ib * 3 + 1] - r[ia * 3 + 1]) * frac,
        r[ia * 3 + 2] + (r[ib * 3 + 2] - r[ia * 3 + 2]) * frac
      );
    };

    place(head.current, 0);
    trail.current.forEach((s, i) => place(s, (i + 1) * 0.02));
  });

  return (
    <group>
      <sprite ref={head} material={materials[0].material} scale={materials[0].scale} />
      {materials.slice(1).map((m, i) => (
        <sprite
          key={i}
          ref={(el) => (trail.current[i] = el)}
          material={m.material}
          scale={m.scale}
        />
      ))}
    </group>
  );
}

export function MotifMarks() {
  const motifs = useStore((s) => s.session?.motifs ?? null);
  if (!motifs || motifs.length === 0) return null;
  const symposium = motifs.find(
    (m): m is MotifAward & { beads: string[] } =>
      m.motifId === "symposium" && !!m.beads && m.beads.length >= 3
  );
  const fugue = motifs.find(
    (m): m is MotifAward & { beads: string[] } =>
      m.motifId === "fugue" && !!m.beads && m.beads.length >= 2
  );
  return (
    <group>
      {symposium && <SymposiumRing beads={symposium.beads} />}
      {fugue && <FugueComet beads={fugue.beads} />}
    </group>
  );
}
