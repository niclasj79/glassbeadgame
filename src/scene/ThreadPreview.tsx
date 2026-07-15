import { useRef } from "react";
import { useStore as useVanillaStore } from "zustand";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import type { RelationIntention } from "@/domain/events";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { frameState } from "./frameState";
import { arcMid } from "./curves";

const start = new THREE.Vector3();
const end = new THREE.Vector3();
const middle = new THREE.Vector3();

const INTENTION_COLORS: Record<RelationIntention, string> = {
  echo: "#b9e9ff",
  passage: "#f6d08c",
  tension: "#e8a7d2",
  ground: "#bce0bd",
};

function Preview({
  a,
  b,
  intention,
}: {
  a: string;
  b?: string;
  intention: RelationIntention;
}) {
  const ref = useRef<Line2>(null);
  useFrame((_, dt) => {
    const line = ref.current;
    const ia = frameState.beadIndex.get(a);
    if (!line || ia === undefined) return;
    const rendered = frameState.rendered;
    start.set(rendered[ia * 3], rendered[ia * 3 + 1], rendered[ia * 3 + 2]);
    const endpointId = b ?? frameState.snapId;
    const ib = endpointId ? frameState.beadIndex.get(endpointId) : undefined;
    if (ib === undefined) {
      if (!frameState.aim.active) return;
      end.set(frameState.aim.x, frameState.aim.y, frameState.aim.z);
    } else {
      end.set(rendered[ib * 3], rendered[ib * 3 + 1], rendered[ib * 3 + 2]);
    }
    arcMid(start, end, middle);
    (line as unknown as { setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void }).setPoints(start, end, middle);
    (line.material as unknown as { dashOffset: number }).dashOffset -= dt;
  });
  return <QuadraticBezierLine ref={ref as never} start={[0, 0, 0]} end={[0, 0, 0.001]} color={INTENTION_COLORS[intention]} lineWidth={1.7} dashed dashSize={0.15} gapSize={0.1} transparent opacity={0.72} toneMapped={false} depthWrite={false} />;
}

export function ThreadPreview() {
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const weaving = useVanillaStore(
    interpretationPresentationStore,
    (state) => state.weaving
  );
  if (draft.stage === "candidate-selected") {
    return <Preview a={String(draft.attendedConceptId)} b={String(draft.candidateConceptId)} intention={draft.intention} />;
  }
  if (draft.stage !== "armed" || !weaving) return null;
  return <Preview a={String(draft.attendedConceptId)} intention={draft.intention} />;
}
