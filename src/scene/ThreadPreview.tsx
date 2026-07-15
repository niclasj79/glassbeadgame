import { useRef } from "react";
import { useStore as useVanillaStore } from "zustand";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { frameState } from "./frameState";
import { arcMid } from "./curves";

const start = new THREE.Vector3();
const end = new THREE.Vector3();
const middle = new THREE.Vector3();

function Preview({ a, b }: { a: string; b: string }) {
  const ref = useRef<Line2>(null);
  useFrame((_, dt) => {
    const line = ref.current;
    const ia = frameState.beadIndex.get(a);
    const ib = frameState.beadIndex.get(b);
    if (!line || ia === undefined || ib === undefined) return;
    const rendered = frameState.rendered;
    start.set(rendered[ia * 3], rendered[ia * 3 + 1], rendered[ia * 3 + 2]);
    end.set(rendered[ib * 3], rendered[ib * 3 + 1], rendered[ib * 3 + 2]);
    arcMid(start, end, middle);
    (line as unknown as { setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void }).setPoints(start, end, middle);
    (line.material as unknown as { dashOffset: number }).dashOffset -= dt;
  });
  return <QuadraticBezierLine ref={ref as never} start={[0, 0, 0]} end={[0, 0, 0.001]} color="#dfe6ff" lineWidth={1.4} dashed dashSize={0.15} gapSize={0.1} transparent opacity={0.6} toneMapped={false} depthWrite={false} />;
}

export function ThreadPreview() {
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  if (draft.stage !== "candidate-selected") return null;
  return <Preview a={String(draft.attendedConceptId)} b={String(draft.candidateConceptId)} />;
}
