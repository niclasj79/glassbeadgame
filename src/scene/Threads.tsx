import { useMemo, useRef } from "react";
import { useStore as useVanillaStore } from "zustand";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { CommittedThreadV1 } from "@/domain/model";
import { domainSessionStore } from "@/state/domainSession";
import { frameState } from "./frameState";
import { arcMid } from "./curves";

const EMPTY_THREADS: readonly CommittedThreadV1[] = Object.freeze([]);

const vStart = new THREE.Vector3();
const vEnd = new THREE.Vector3();
const vMid = new THREE.Vector3();

function ThreadLine({ thread }: { thread: CommittedThreadV1 }) {
  const ref = useRef<Line2>(null);
  const colors = useMemo(() => {
    return thread.pair.map((id) => {
      const concept = conceptById.get(String(id));
      return concept ? disciplineById.get(concept.discipline)?.color ?? "#dfe6ff" : "#dfe6ff";
    }) as [string, string];
  }, [thread]);
  const pattern = {
    echo: [0.13, 0.1],
    passage: [0.3, 0.09],
    tension: [0.08, 0.06],
    ground: [0.5, 0.04],
  }[thread.intention];

  useFrame(() => {
    const line = ref.current;
    const a = frameState.beadIndex.get(String(thread.pair[0]));
    const b = frameState.beadIndex.get(String(thread.pair[1]));
    if (!line || a === undefined || b === undefined) return;
    const rendered = frameState.rendered;
    vStart.set(rendered[a * 3], rendered[a * 3 + 1], rendered[a * 3 + 2]);
    vEnd.set(rendered[b * 3], rendered[b * 3 + 1], rendered[b * 3 + 2]);
    arcMid(vStart, vEnd, vMid);
    (line as unknown as { setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void }).setPoints(vStart, vEnd, vMid);
  });

  return (
    <QuadraticBezierLine
      ref={ref as never}
      start={[0, 0, 0]}
      end={[0, 0, 0.001]}
      lineWidth={1.8}
      color={colors[0]}
      dashed
      dashSize={pattern[0]}
      gapSize={pattern[1]}
      transparent
      opacity={0.86}
      toneMapped={false}
      depthWrite={false}
    />
  );
}

export function Threads() {
  const threads = useVanillaStore(domainSessionStore, (state) => state.session?.threads ?? EMPTY_THREADS);
  if (threads.length === 0) return null;
  return <group>{threads.map((thread) => <ThreadLine key={thread.id} thread={thread} />)}</group>;
}
