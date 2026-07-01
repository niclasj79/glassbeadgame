import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import { frameState } from "./frameState";
import { arcMid } from "./curves";

const vStart = new THREE.Vector3();
const vEnd = new THREE.Vector3();
const vMid = new THREE.Vector3();

function PreviewLine({ fromId }: { fromId: string }) {
  const ref = useRef<Line2>(null);

  const color = useMemo(() => {
    const concept = conceptById.get(fromId);
    const disc = concept ? disciplineById.get(concept.discipline) : undefined;
    return disc?.color ?? "#9aa2ff";
  }, [fromId]);

  useFrame((_, dt) => {
    const line = ref.current;
    if (!line) return;
    const i = frameState.beadIndex.get(fromId);
    if (i === undefined || !frameState.aim.active) return;
    const r = frameState.rendered;
    vStart.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]);

    // The tip lands on the snap candidate when one is magnetized.
    const snapId = frameState.snapId;
    if (snapId) {
      const j = frameState.beadIndex.get(snapId);
      if (j !== undefined) vEnd.set(r[j * 3], r[j * 3 + 1], r[j * 3 + 2]);
    } else {
      vEnd.set(frameState.aim.x, frameState.aim.y, frameState.aim.z);
    }
    arcMid(vStart, vEnd, vMid);
    (line as unknown as {
      setPoints: (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Vector3) => void;
    }).setPoints(vStart, vEnd, vMid);

    const mat = line.material as unknown as { dashOffset: number; opacity: number; linewidth: number };
    mat.dashOffset -= dt * 1.5; // marching ants — tentative, alive
    mat.opacity += ((snapId ? 0.95 : 0.55) - mat.opacity) * 0.2;
  });

  return (
    <QuadraticBezierLine
      ref={ref as never}
      start={[0, 0, 0]}
      end={[0, 0, 0.001]}
      lineWidth={1.7}
      color={color}
      dashed
      dashSize={0.16}
      gapSize={0.09}
      transparent
      opacity={0.55}
      toneMapped={false}
      depthWrite={false}
    />
  );
}

/** The live thread from the selected bead to the pointer, while weaving. */
export function ThreadPreview() {
  const mode = useStore((s) => s.session?.interaction.mode);
  const fromId = useStore((s) => s.session?.interaction.fromId);
  if (mode !== "threading" || !fromId) return null;
  return <PreviewLine fromId={fromId} />;
}
