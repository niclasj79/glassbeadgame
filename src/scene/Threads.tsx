import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { Thread } from "@/state/types";
import { frameState } from "./frameState";
import { arcMid } from "./curves";
// (useStore is also read transiently inside useFrame for the concluding lift.)

const SEGMENTS = 20; // drei's QuadraticBezierLine samples 20 segments = 21 points

const FAINT_COLOR = new THREE.Color("#565a7d");

function gradientColors(thread: Thread): [number, number, number][] {
  const out: [number, number, number][] = [];
  if (thread.kind === "faint") {
    for (let i = 0; i <= SEGMENTS; i++) out.push([FAINT_COLOR.r, FAINT_COLOR.g, FAINT_COLOR.b]);
    return out;
  }
  const ca = new THREE.Color(
    disciplineById.get(conceptById.get(thread.a)!.discipline)!.color
  );
  const cb = new THREE.Color(
    disciplineById.get(conceptById.get(thread.b)!.discipline)!.color
  );
  const white = new THREE.Color("#ffffff");
  const c = new THREE.Color();
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    c.copy(ca).lerp(cb, t);
    // A lift of white at the middle — two lights fusing.
    const fuse = 1 - Math.abs(t - 0.5) * 2;
    c.lerp(white, fuse * fuse * 0.35);
    out.push([c.r, c.g, c.b]);
  }
  return out;
}

const vStart = new THREE.Vector3();
const vEnd = new THREE.Vector3();
const vMid = new THREE.Vector3();

interface ThreadLineProps {
  thread: Thread;
}

function ThreadLine({ thread }: ThreadLineProps) {
  const ref = useRef<Line2>(null);
  const progress = useRef(0);
  const colors = useMemo(() => gradientColors(thread), [thread]);

  const lineWidth = thread.kind === "faint" ? 1.2 : 1.6 + thread.tier * 0.45;
  const baseOpacity = thread.kind === "faint" ? 0.42 : 0.92;

  useFrame((_, dt) => {
    const line = ref.current;
    if (!line) return;
    const ia = frameState.beadIndex.get(thread.a);
    const ib = frameState.beadIndex.get(thread.b);
    if (ia === undefined || ib === undefined) return;
    const r = frameState.rendered;
    vStart.set(r[ia * 3], r[ia * 3 + 1], r[ia * 3 + 2]);
    vEnd.set(r[ib * 3], r[ib * 3 + 1], r[ib * 3 + 2]);
    arcMid(vStart, vEnd, vMid);
    (line as unknown as {
      setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void;
    }).setPoints(vStart, vEnd, vMid);

    // Draw-on: one dash the length of the curve, revealed by offset.
    const mat = line.material as unknown as {
      dashSize: number;
      gapSize: number;
      dashOffset: number;
      opacity: number;
    };
    const len = vStart.distanceTo(vMid) + vMid.distanceTo(vEnd);
    mat.dashSize = len;
    mat.gapSize = len;
    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + (dt * frameState.timeScale) / 0.7);
      const eased = 1 - Math.pow(1 - progress.current, 3);
      mat.dashOffset = len * (1 - eased);
      mat.opacity = baseOpacity * (0.35 + 0.65 * eased);
    } else {
      mat.dashOffset = 0;
      // During the concluding cinematic every thread brightens toward full.
      const concluding =
        useStore.getState().session?.interaction.mode === "concluding";
      const target = concluding ? Math.min(1, baseOpacity + 0.35) : baseOpacity;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 3);
    }
  });

  return (
    <QuadraticBezierLine
      ref={ref as never}
      start={[0, 0, 0]}
      end={[0, 0, 0.001]}
      lineWidth={lineWidth}
      vertexColors={colors}
      color="#ffffff"
      dashed
      dashSize={1}
      gapSize={1}
      transparent
      opacity={0}
      toneMapped={false}
      depthWrite={false}
    />
  );
}

/** All committed threads of the session's web. */
export function Threads() {
  const threads = useStore((s) => s.session?.threads ?? null);
  if (!threads || threads.length === 0) return null;
  return (
    <group>
      {threads.map((t) => (
        <ThreadLine key={t.id} thread={t} />
      ))}
    </group>
  );
}
