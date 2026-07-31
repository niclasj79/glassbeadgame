import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore as useVanillaStore } from "zustand";
import { useStore } from "@/state/store";
import { domainSessionStore } from "@/state/domainSession";
import type { CommittedThreadV1, ThreadOutcomeV1 } from "@/domain/model";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { intentionArcMid } from "./curves";
import { presentationProfile } from "./quality";
import { createRibbonMaterial, rhythmOf, ribbonGeometry, threadInk } from "./ribbon";
import { threadForm, unrestAmplitude } from "./threadGrammar";

const EMPTY_THREADS: readonly CommittedThreadV1[] = Object.freeze([]);
const EMPTY_OUTCOMES: readonly ThreadOutcomeV1[] = Object.freeze([]);

const vStart = new THREE.Vector3();
const vEnd = new THREE.Vector3();
const vMid = new THREE.Vector3();

interface RibbonProps {
  readonly sourceId: string;
  readonly targetId: string | null;
  readonly intention: CommittedThreadV1["intention"];
  readonly opacity: number;
  /**
   * Whether this thread's figure has closed. A documented relation closes; an
   * Open Thread stays open. The two are drawn at the same strength and with
   * the same quantity of ink — see scene/resolution.ts (CAV-006).
   */
  readonly resolved: boolean;
  /** Committed threads grow once and stay; a preview is always fully drawn. */
  readonly animateGrowth: boolean;
}

/**
 * One relation, drawn as material. The curve is evaluated in the vertex
 * shader from three endpoint uniforms, so a moving bead costs three vector
 * writes rather than a geometry rebuild.
 */
function Ribbon({
  sourceId,
  targetId,
  intention,
  opacity,
  resolved,
  animateGrowth,
}: RibbonProps) {
  const theme = useCurrentTheme();
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const profile = useMemo(
    () => presentationProfile(tier, reducedMotion),
    [tier, reducedMotion]
  );
  const form = useMemo(() => threadForm(intention), [intention]);
  const geometry = useMemo(
    () => ribbonGeometry(profile.budget.threadSegments),
    [profile.budget.threadSegments]
  );

  const material = useMemo(
    () =>
      createRibbonMaterial({
        theme,
        form,
        ink: threadInk(theme, sourceId, targetId ?? sourceId),
        width: 0.022,
        opacity,
        reducedMotion: profile.reducedMotion,
      }),
    [theme, form, sourceId, targetId, opacity, profile.reducedMotion]
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    (material.uniforms.uResolved as { value: number }).value = resolved ? 1 : 0;
    (material.uniforms.uRhythmA as { value: number }).value = rhythmOf(sourceId);
    (material.uniforms.uRhythmB as { value: number }).value = rhythmOf(
      targetId ?? sourceId
    );
    (material.uniforms.uGrow as { value: number }).value = animateGrowth ? 0 : 1;
  }, [material, resolved, sourceId, targetId, animateGrowth]);

  const age = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    age.current += dt;
    const uniforms = material.uniforms;
    (uniforms.uTime as { value: number }).value = frameState.clock;

    const ia = frameState.beadIndex.get(sourceId);
    if (ia === undefined) return;
    const rendered = frameState.rendered;
    vStart.set(rendered[ia * 3], rendered[ia * 3 + 1], rendered[ia * 3 + 2]);

    if (targetId) {
      const ib = frameState.beadIndex.get(targetId);
      if (ib === undefined) return;
      vEnd.set(rendered[ib * 3], rendered[ib * 3 + 1], rendered[ib * 3 + 2]);
    } else if (frameState.snapId) {
      const ib = frameState.beadIndex.get(frameState.snapId);
      if (ib === undefined) return;
      vEnd.set(rendered[ib * 3], rendered[ib * 3 + 1], rendered[ib * 3 + 2]);
    } else if (frameState.aim.active) {
      vEnd.set(frameState.aim.x, frameState.aim.y, frameState.aim.z);
    } else {
      return;
    }

    intentionArcMid(vStart, vEnd, intention, vMid);
    (uniforms.uA.value as THREE.Vector3).copy(vStart);
    (uniforms.uB.value as THREE.Vector3).copy(vEnd);
    (uniforms.uM.value as THREE.Vector3).copy(vMid);

    if (animateGrowth) {
      const grow = uniforms.uGrow as { value: number };
      const speed = reducedMotion ? 6 : 1.6;
      grow.value = Math.min(1, grow.value + dt * speed);
    }

    // Tension keeps its instability as a permanent fact but stops shouting:
    // the amplitude decays to a floor within roughly twelve seconds (CAV-007).
    (uniforms.uUnrest as { value: number }).value =
      form.beatHz > 0 ? unrestAmplitude(age.current) : 1;

    // Ground settles once and stays seated.
    (uniforms.uSettle as { value: number }).value = Math.min(
      1,
      age.current / (reducedMotion ? 0.2 : 1.4)
    );
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}

export { Ribbon };

export function Threads() {
  const threads = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.threads ?? EMPTY_THREADS
  );
  const outcomes = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.outcomes ?? EMPTY_OUTCOMES
  );

  /**
   * Which threads have closed. Every committed thread used to be drawn as a
   * documented relation, which made CAV-006's distinction unreachable from the
   * arena. A thread closes when a documented relation is revealed for it; an
   * Open Thread, and a thread whose outcome has not landed yet, stay open —
   * at the same brightness and the same weight.
   */
  const closed = useMemo(() => {
    const ids = new Set<string>();
    for (const outcome of outcomes) {
      if (outcome.type === "documented-relation") ids.add(String(outcome.threadId));
    }
    return ids;
  }, [outcomes]);

  if (threads.length === 0) return null;
  return (
    <group>
      {threads.map((thread) => (
        <Ribbon
          key={thread.id}
          sourceId={String(thread.pair[0])}
          targetId={String(thread.pair[1])}
          intention={thread.intention}
          opacity={0.9}
          resolved={closed.has(String(thread.id))}
          animateGrowth
        />
      ))}
    </group>
  );
}
