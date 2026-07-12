import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { frameState } from "./frameState";
import { arcMid } from "./curves";
import { presentationNow } from "@/runtime/testMode";

const vStart = new THREE.Vector3();
const vEnd = new THREE.Vector3();
const vMid = new THREE.Vector3();

/**
 * The spent-Insight moment: a ghost thread of marching light arcs between
 * the two beads holding an undiscovered luminous connection — showing
 * where, never what — then dissolves.
 */
export function Illumination() {
  const ref = useRef<Line2>(null);
  const [active, setActive] = useState(false);

  // Poll cheaply for activation (set imperatively by the HUD handler).
  useEffect(() => {
    const t = setInterval(() => {
      const ill = frameState.illumination;
      setActive(!!ill && presentationNow() < ill.until);
    }, 150);
    return () => clearInterval(t);
  }, []);

  useFrame((_, dt) => {
    const line = ref.current;
    const ill = frameState.illumination;
    if (!line || !ill) return;
    const ia = frameState.beadIndex.get(ill.a);
    const ib = frameState.beadIndex.get(ill.b);
    if (ia === undefined || ib === undefined) return;
    const r = frameState.rendered;
    vStart.set(r[ia * 3], r[ia * 3 + 1], r[ia * 3 + 2]);
    vEnd.set(r[ib * 3], r[ib * 3 + 1], r[ib * 3 + 2]);
    arcMid(vStart, vEnd, vMid);
    (line as unknown as {
      setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void;
    }).setPoints(vStart, vEnd, vMid);

    const remaining = (ill.until - presentationNow()) / 1000;
    const mat = line.material as unknown as { dashOffset: number; opacity: number };
    mat.dashOffset -= dt * 2.2; // hurried marching — a whisper, not a claim
    const fadeIn = Math.min(1, (4 - remaining) * 2.5);
    const fadeOut = Math.min(1, remaining * 1.2);
    mat.opacity = 0.5 * Math.max(0, Math.min(fadeIn, fadeOut));
  });

  if (!active) return null;

  return (
    <QuadraticBezierLine
      ref={ref as never}
      start={[0, 0, 0]}
      end={[0, 0, 0.001]}
      lineWidth={1.4}
      color="#ffe9b0"
      dashed
      dashSize={0.1}
      gapSize={0.14}
      transparent
      opacity={0}
      toneMapped={false}
      depthWrite={false}
    />
  );
}
