import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { useStore as useVanillaStore } from "zustand";
import { domainSessionStore } from "@/state/domainSession";
import type { CompletedMotifV1 } from "@/domain/model";
import { planMotifMarks } from "./motifMarkPlan";
import { frameState } from "./frameState";
import { getHaloTexture } from "./textures";

/**
 * PERSISTENT MARKS FOR THE SESSION'S COMPLETED MOTIFS.
 *
 * Spec §12: "Completion changes the score and world, not merely a badge." This
 * is the world half of that sentence, and until now it was unreachable — the
 * component read `useStore().session.motifs`, the legacy presentation
 * projection, which is published empty and has had no writer since the legacy
 * scoring model was removed. Completing a motif therefore left no mark at all.
 *
 * It reads the canonical session now, and it draws the domain's own three
 * families rather than the prototype's `triad / symposium / fugue`, which no
 * detector has produced for a long time:
 *
 *   dialectic  a Tension held by a third concept → the three are drawn as a
 *              closed figure. The mark *is* the holding: a circuit that does not
 *              come apart, breathing with the room.
 *   canon      a facet recurring, transformed → a light forever walking the
 *              carriers' path. Recurrence, said as motion rather than as a
 *              label.
 *   bridge     the joint two regions hang on → a slowly turning ring about the
 *              whole span, so the region reads as one thing held.
 *
 * None of them is colour-only, none is a badge, none carries a number, and each
 * one keeps working in a greyscale print: a closed circuit, a travelling light,
 * a turning ring are three different *constructions*.
 *
 * Their voices live in the ambient engine (`audio/ambient.ts`), seated by the
 * same completions.
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

/** The centroid and radius of a set of beads, from this frame's positions. */
function gatherSpan(beads: readonly string[]): number {
  vCentroid.set(0, 0, 0);
  const r = frameState.rendered;
  let n = 0;
  for (const id of beads) {
    const i = frameState.beadIndex.get(id);
    if (i === undefined) continue;
    vCentroid.x += r[i * 3];
    vCentroid.y += r[i * 3 + 1];
    vCentroid.z += r[i * 3 + 2];
    n++;
  }
  if (n === 0) return 0;
  vCentroid.multiplyScalar(1 / n);
  let maxD = 0.6;
  for (const id of beads) {
    const i = frameState.beadIndex.get(id);
    if (i === undefined) continue;
    vTmp.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]).sub(vCentroid);
    maxD = Math.max(maxD, vTmp.length());
  }
  return maxD;
}

/** The Bridge's mark: a ring slowly turning about the span the joint holds. */
function SpanRing({ beads }: { beads: readonly string[] }) {
  const group = useRef<THREE.Group>(null);
  const line = useRef<Line2>(null);
  const points = useMemo(() => circlePoints(), []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const maxD = gatherSpan(beads);
    if (maxD === 0) return;
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

/**
 * The Dialectic's mark: the three concepts drawn as a closed circuit.
 *
 * The figure follows the beads, so it stays true as the arena breathes and as
 * the Lens morphs the layout. It closes, and that is the whole statement — an
 * opposition that a third concept holds is a circuit rather than a line with two
 * ends.
 */
function HeldFigure({ beads }: { beads: readonly string[] }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(beads.length * 3), 3)
    );
    // The vertices are written from world positions every frame, so bounds
    // computed from the initial zeros would cull the figure entirely.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, [beads.length]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color("#c9d6f2"),
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useFrame(() => {
    const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const r = frameState.rendered;
    let written = 0;
    for (const id of beads) {
      const i = frameState.beadIndex.get(id);
      if (i === undefined) continue;
      array[written * 3] = r[i * 3];
      array[written * 3 + 1] = r[i * 3 + 1];
      array[written * 3 + 2] = r[i * 3 + 2];
      written += 1;
    }
    if (written < 2) {
      geometry.setDrawRange(0, 0);
      return;
    }
    geometry.setDrawRange(0, written);
    attribute.needsUpdate = true;
    material.opacity =
      0.2 + 0.07 * Math.sin(frameState.breathPhase) * frameState.breathDepth;
  });

  return (
    <lineLoop geometry={geometry} material={material} frustumCulled={false} />
  );
}

/** The Canon's mark: a light forever walking the recurring subject's path. */
function RecurrenceLight({ beads }: { beads: readonly string[] }) {
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

const EMPTY_MOTIFS: readonly CompletedMotifV1[] = Object.freeze([]);

export function MotifMarks() {
  const completed = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.completedMotifs ?? EMPTY_MOTIFS
  );

  const marks = useMemo(() => planMotifMarks(completed), [completed]);

  if (marks.length === 0) return null;
  return (
    <group>
      {marks.map((mark) => {
        if (mark.kind === "bridge") {
          return <SpanRing key={mark.key} beads={mark.beads} />;
        }
        if (mark.kind === "canon") {
          return <RecurrenceLight key={mark.key} beads={mark.beads} />;
        }
        return <HeldFigure key={mark.key} beads={mark.beads} />;
      })}
    </group>
  );
}
