import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import { audio } from "@/audio/engine";
import { currentTheme } from "@/themes/useTheme";
import type { Thread } from "@/state/types";
import { frameState } from "./frameState";
import { arcMid } from "./curves";
// (useStore is also read transiently inside useFrame for the concluding lift.)

const SEGMENTS = 20; // drei's QuadraticBezierLine samples 20 segments = 21 points

function gradientColors(thread: Thread): [number, number, number][] {
  const out: [number, number, number][] = [];
  if (thread.kind === "faint" && !thread.consecratedBy) {
    const faint = new THREE.Color(currentTheme().faintThread);
    for (let i = 0; i <= SEGMENTS; i++) out.push([faint.r, faint.g, faint.b]);
    return out;
  }
  if (thread.kind === "faint" && thread.consecratedBy) {
    // Consecrated: the disciplines' colors surface through silver — a state
    // between faint resonance and luminous connection.
    const ca = new THREE.Color(
      disciplineById.get(conceptById.get(thread.a)!.discipline)!.color
    );
    const cb = new THREE.Color(
      disciplineById.get(conceptById.get(thread.b)!.discipline)!.color
    );
    const silver = new THREE.Color("#c9cede");
    const c = new THREE.Color();
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      c.copy(ca).lerp(cb, t).lerp(silver, 0.45).multiplyScalar(0.6);
      out.push([c.r, c.g, c.b]);
    }
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
  const wasPulsing = useRef(false);
  const colors = useMemo(() => gradientColors(thread), [thread]);
  // Flat base colors in Line2's interleaved layout: segment j carries
  // point j's color at j*6..+2 and point j+1's at j*6+3..+5.
  const baseFlat = useMemo(() => {
    const flat = new Float32Array(SEGMENTS * 6);
    for (let j = 0; j < SEGMENTS; j++) {
      flat.set(colors[j], j * 6);
      flat.set(colors[j + 1], j * 6 + 3);
    }
    return flat;
  }, [colors]);

  const consecrated = thread.kind === "faint" && !!thread.consecratedBy;
  const lineWidth =
    thread.kind === "curated" ? 1.6 + thread.tier * 0.45 : consecrated ? 1.45 : 1.2;
  const baseOpacity = thread.kind === "curated" ? 0.92 : consecrated ? 0.68 : 0.42;

  /** When this thread's motif sounds, a pulse of light rides the strand. */
  const applyPulse = (line: Line2): number => {
    const now = audio.now();
    const running = audio.get()?.state === "running";
    // Drop stale entries (suspended context would burst-fire on resume).
    frameState.pulses = frameState.pulses.filter(
      (p) => running && now - p.atAudioTime < p.duration + 0.25
    );
    const pulse = frameState.pulses.find(
      (p) => p.threadId === thread.id && now >= p.atAudioTime
    );
    const geom = line.geometry as unknown as {
      attributes?: { instanceColorStart?: { data?: THREE.InterleavedBuffer } };
    };
    const buffer = geom.attributes?.instanceColorStart?.data;
    if (!buffer) return 0;

    if (!pulse) {
      if (wasPulsing.current) {
        (buffer.array as Float32Array).set(baseFlat);
        buffer.needsUpdate = true;
        wasPulsing.current = false;
      }
      return 0;
    }

    const p = Math.min(1, (now - pulse.atAudioTime) / pulse.duration);
    const head = pulse.flip ? 1 - p : p;
    const arr = buffer.array as Float32Array;
    // Each point j is stored twice: as segment j's start and segment j-1's end.
    for (let j = 0; j <= SEGMENTS; j++) {
      const tv = j / SEGMENTS;
      const g = Math.exp(-((tv - head) ** 2) / (2 * 0.09 * 0.09));
      const mult = 1 + 2.2 * g * (1 - p * 0.4);
      for (let c = 0; c < 3; c++) {
        if (j < SEGMENTS) arr[j * 6 + c] = baseFlat[j * 6 + c] * mult;
        if (j > 0) arr[(j - 1) * 6 + 3 + c] = baseFlat[(j - 1) * 6 + 3 + c] * mult;
      }
    }
    buffer.needsUpdate = true;
    wasPulsing.current = true;
    // A gentle opacity lift rides along.
    return 0.15 * Math.sin(Math.PI * p);
  };

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
      let target = concluding ? Math.min(1, baseOpacity + 0.35) : baseOpacity;
      // Duplicate-weave flash: the existing thread answers instead.
      if (frameState.pulseThreadId === thread.id) {
        const age = (performance.now() - frameState.pulseAt) / 1000;
        if (age < 0.9) {
          target = Math.min(1, target + Math.sin(age * Math.PI * 4) * 0.5 * (1 - age));
        } else {
          frameState.pulseThreadId = null;
        }
      }
      // The motif pulse: light rides the strand while its notes sound.
      target = Math.min(1, target + applyPulse(line));
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 8);
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
      renderOrder={1}
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
