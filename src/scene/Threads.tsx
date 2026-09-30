import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore as useVanillaStore } from "zustand";
import { useStore } from "@/state/store";
import { domainSessionStore } from "@/state/domainSession";
import type { RelationIntention } from "@/domain/events";
import type { CommittedThreadV1, ThreadOutcomeV1 } from "@/domain/model";
import { useCurrentTheme } from "@/themes/useTheme";
import { audio } from "@/audio/engine";
import { presentationNow } from "@/runtime/testMode";
import { frameState } from "./frameState";
import { arcPoint, intentionArcMid } from "./curves";
import { presentationProfile } from "./quality";
import { createRibbonMaterial, rhythmOf, ribbonGeometry, threadInk } from "./ribbon";
import { threadForm, unrestAmplitude } from "./threadGrammar";
import { forgetThreadCurve, writeThreadCurve } from "./threadPicking";
import { standingOf, threadStandings } from "./threadStanding";
import {
  conclusionPerformanceStore,
  runningConclusionFor,
  threadLightingTimes,
} from "./conclusionPerformance";
import {
  ATTUNED_EASE_SECONDS,
  ATTUNED_HOLD_SECONDS,
  attunedPresence,
  mirrorTravel,
  voiceTravel,
} from "./Attunement";
import { getHaloTexture } from "./textures";

const EMPTY_THREADS: readonly CommittedThreadV1[] = Object.freeze([]);
const EMPTY_OUTCOMES: readonly ThreadOutcomeV1[] = Object.freeze([]);

const vStart = new THREE.Vector3();
const vEnd = new THREE.Vector3();
const vMid = new THREE.Vector3();
const vPoint = new THREE.Vector3();

/** Two lights is the most any grammar asks for — Echo's mirrored pair. */
const MAX_VOICE_LIGHTS = 2;

/**
 * How quickly a strand comes back when the conclusion reaches it. Short enough
 * that it reads as a stroke landing on its beat rather than as a dissolve, and
 * well inside the gap between two entries at the tempi the compiler uses.
 * Reduced motion arrives sooner, as everywhere else: the *information* — this
 * one, now, in the order you made it — is what matters and is preserved.
 */
const REBUILD_EASE_S = 0.35;
const REBUILD_EASE_REDUCED_S = 0.08;

interface RibbonProps {
  readonly sourceId: string;
  readonly targetId: string;
  /**
   * The reading this strand is drawn in — or null for the unread strand: a
   * sighting, or a locked pair nobody has read yet (I-016, I-017). A
   * committed thread always has one.
   */
  readonly intention: RelationIntention | null;
  readonly opacity: number;
  /**
   * Whether this thread's figure has closed. A documented relation closes; an
   * Open Thread stays open. The two are drawn at the same strength and with
   * the same quantity of ink — see scene/resolution.ts (CAV-006).
   */
  readonly resolved: boolean;
  /**
   * Whether the Game answered this thread at all. A documented relation and an
   * Open Thread are lit; a strand the Game had nothing to add to hangs unlit —
   * same ink, same construction, no mark and so no bloom (Schell #7). A
   * preview is always lit: nothing has been asked of it yet.
   */
  readonly lit?: boolean;
  /** Committed threads grow once and stay; a preview is always fully drawn. */
  readonly animateGrowth: boolean;
  /**
   * The committed thread this ribbon draws, where there is one. A draft has no
   * identity yet, so it neither lights nor recedes.
   */
  readonly threadId?: string;
  /** Whether the world is currently in the held state of Attunement. */
  readonly attuned?: boolean;
  /**
   * THE CONCLUSION'S REBUILDING (spec §14).
   *
   * When the concluded log has been compiled into a performance, the web is
   * drawn again from nothing in the order the player made it: this strand is
   * withheld until `litAtSeconds` after `performanceStartedAtMs`, then strikes
   * exactly as it first did. Both null in ordinary play, where a committed
   * thread is simply present.
   *
   * The time comes from the compiler and nowhere else, and no outcome kind is
   * read here — a documented relation, an Open Thread and an unresolved one
   * arrive at the second they were woven at, identically (CAV-006).
   */
  readonly litAtSeconds?: number | null;
  readonly performanceStartedAtMs?: number | null;
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
  lit = true,
  animateGrowth,
  threadId,
  attuned = false,
  litAtSeconds = null,
  performanceStartedAtMs = null,
}: RibbonProps) {
  const theme = useCurrentTheme();
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const profile = useMemo(
    () => presentationProfile(tier, reducedMotion),
    [tier, reducedMotion]
  );
  const form = useMemo(
    () => (intention === null ? null : threadForm(intention)),
    [intention]
  );
  const geometry = useMemo(
    () => ribbonGeometry(profile.budget.threadSegments),
    [profile.budget.threadSegments]
  );

  const material = useMemo(
    () =>
      createRibbonMaterial({
        theme,
        form,
        ink: threadInk(theme, sourceId, targetId),
        width: 0.022,
        opacity,
        reducedMotion: profile.reducedMotion,
      }),
    [theme, form, sourceId, targetId, opacity, profile.reducedMotion]
  );
  useEffect(() => () => material.dispose(), [material]);

  /**
   * THE VOICE LIGHT.
   *
   * `frameState.pulses` carries "this thread is sounding, from this audio-clock
   * moment, for this long" — written by the ambient choir and by the audio
   * director, and until now read by nothing at all. These sprites are its one
   * consumer: a relation lights while its own voice speaks, so the note in the
   * ear and the light on the strand are the same event rather than two
   * approximations of it (ARCHITECTURE §10).
   *
   * Bounded: two sprites per ribbon, allocated once, never per frame.
   */
  const lights = useRef<(THREE.Sprite | null)[]>([]);
  const lightMaterials = useMemo(() => {
    const ink = threadInk(theme, sourceId, targetId);
    return Array.from({ length: MAX_VOICE_LIGHTS }, () =>
      new THREE.SpriteMaterial({
        map: getHaloTexture(),
        color: new THREE.Color(theme.palette.vellum).lerp(ink, 0.35),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
  }, [theme, sourceId, targetId]);
  useEffect(
    () => () => lightMaterials.forEach((m) => m.dispose()),
    [lightMaterials]
  );

  /** Eased presence: 1 ordinarily, receding toward the floor in Attunement. */
  const presence = useRef(1);

  useEffect(() => {
    (material.uniforms.uResolved as { value: number }).value = resolved ? 1 : 0;
    (material.uniforms.uLit as { value: number }).value = lit ? 1 : 0;
    (material.uniforms.uRhythmA as { value: number }).value = rhythmOf(sourceId);
    (material.uniforms.uRhythmB as { value: number }).value = rhythmOf(targetId);
    (material.uniforms.uGrow as { value: number }).value = animateGrowth ? 0 : 1;
  }, [material, resolved, lit, sourceId, targetId, animateGrowth]);

  /**
   * How much of this strand the conclusion has given back: 0 before its moment,
   * eased to 1 as it strikes. 1 whenever no performance is running, so ordinary
   * play is untouched.
   */
  const arrival = useRef(1);

  /*
   * A performance beginning takes the web away, once. The stroke is unwound
   * with it — a strand does not fade in, it is drawn again — and only for
   * strands whose moment is still ahead: one that has already passed is left
   * exactly as it is, so a canvas that remounts mid-conclusion does not replay
   * everything the player has already watched arrive.
   */
  useEffect(() => {
    if (performanceStartedAtMs === null || litAtSeconds === null) return;
    if ((presentationNow() - performanceStartedAtMs) / 1000 >= litAtSeconds) {
      return;
    }
    arrival.current = 0;
    if (animateGrowth) {
      (material.uniforms.uGrow as { value: number }).value = 0;
    }
  }, [material, animateGrowth, performanceStartedAtMs, litAtSeconds]);

  const age = useRef(0);

  /*
   * A committed strand is pickable for as long as it is drawn (I-019): the
   * frame loop below keeps its curve current in the picking registry, and it
   * leaves the registry with the ribbon.
   */
  useEffect(() => {
    if (threadId === undefined) return;
    return () => forgetThreadCurve(threadId);
  }, [threadId]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    age.current += dt;
    const uniforms = material.uniforms;
    (uniforms.uTime as { value: number }).value = frameState.clock;

    // Has the conclusion given this strand back yet? Read before anything is
    // drawn, because it gates the stroke itself and not only its opacity.
    const rebuilding =
      performanceStartedAtMs !== null && litAtSeconds !== null;
    const arrived =
      !rebuilding ||
      (presentationNow() - performanceStartedAtMs) / 1000 >= litAtSeconds;
    arrival.current +=
      ((arrived ? 1 : 0) - arrival.current) *
      Math.min(1, dt / (reducedMotion ? REBUILD_EASE_REDUCED_S : REBUILD_EASE_S));

    const ia = frameState.beadIndex.get(sourceId);
    const ib = frameState.beadIndex.get(targetId);
    if (ia === undefined || ib === undefined) return;
    const rendered = frameState.rendered;
    vStart.set(rendered[ia * 3], rendered[ia * 3 + 1], rendered[ia * 3 + 2]);
    vEnd.set(rendered[ib * 3], rendered[ib * 3 + 1], rendered[ib * 3 + 2]);

    intentionArcMid(vStart, vEnd, intention, vMid);
    (uniforms.uA.value as THREE.Vector3).copy(vStart);
    (uniforms.uB.value as THREE.Vector3).copy(vEnd);
    (uniforms.uM.value as THREE.Vector3).copy(vMid);
    if (threadId !== undefined) writeThreadCurve(threadId, vStart, vMid, vEnd);

    // A withheld strand is not a slow strand: it is not being drawn at all yet.
    if (animateGrowth && arrived) {
      const grow = uniforms.uGrow as { value: number };
      const speed = reducedMotion ? 6 : 1.6;
      grow.value = Math.min(1, grow.value + dt * speed);
    }

    // Tension keeps its instability as a permanent fact but stops shouting:
    // the amplitude decays to a floor within roughly twelve seconds (CAV-007).
    (uniforms.uUnrest as { value: number }).value =
      form !== null && form.beatHz > 0 ? unrestAmplitude(age.current) : 1;

    // Ground settles once and stays seated.
    (uniforms.uSettle as { value: number }).value = Math.min(
      1,
      age.current / (reducedMotion ? 0.2 : 1.4)
    );

    // ── Is this thread's own voice sounding right now? ──────────────────────
    let progress = -1;
    let fromFarEnd = false;
    // Whether *any* thread has spoken recently. Without it, a session whose
    // audio context was never unlocked would enter Attunement and simply dim.
    let cycleRunning = false;
    if (threadId !== undefined) {
      const now = audio.now();
      for (const pulse of frameState.pulses) {
        if (pulse.duration <= 0) continue;
        const elapsed = now - pulse.atAudioTime;
        if (elapsed < 0 || elapsed > pulse.duration + ATTUNED_HOLD_SECONDS) continue;
        cycleRunning = true;
        if (pulse.threadId !== threadId || elapsed > pulse.duration) continue;
        progress = elapsed / pulse.duration;
        // The choir alternates which bead speaks first; the light walks from
        // whichever one is actually sounding.
        fromFarEnd = pulse.flip;
      }
    }
    const speaking = progress >= 0;

    let travel =
      speaking && intention !== null ? voiceTravel(intention, progress) : null;
    if (travel !== null && fromFarEnd) travel = mirrorTravel(travel);
    for (let i = 0; i < MAX_VOICE_LIGHTS; i++) {
      const sprite = lights.current[i];
      if (!sprite) continue;
      const at = travel?.positions[i];
      if (at === undefined) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      arcPoint(vStart, vMid, vEnd, Math.max(0, Math.min(1, at)), vPoint);
      sprite.position.copy(vPoint);
      const strength = travel ? travel.strength : 0;
      (sprite.material as THREE.SpriteMaterial).opacity =
        0.55 * strength * arrival.current;
      sprite.scale.setScalar(0.055 + 0.035 * strength);
    }

    // ── Attunement: one thread at a time becomes individually present ───────
    const target = attunedPresence(attuned, cycleRunning, speaking);
    presence.current +=
      (target - presence.current) * Math.min(1, dt / ATTUNED_EASE_SECONDS);
    (uniforms.uOpacity as { value: number }).value =
      opacity * presence.current * arrival.current;
  });

  return (
    <group>
      <mesh
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={2}
      />
      {lightMaterials.map((lightMaterial, i) => (
        <sprite
          key={i}
          ref={(el) => (lights.current[i] = el)}
          material={lightMaterial}
          visible={false}
          renderOrder={3}
        />
      ))}
    </group>
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
  const attuned = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.attunementActive ?? false
  );
  const sessionId = useVanillaStore(domainSessionStore, (state) =>
    state.session ? String(state.session.sessionId) : null
  );

  /**
   * THE WEB, REBUILT IN THE ORDER IT WAS MADE (spec §14).
   *
   * The camera director writes the running performance here when the conclusion
   * cue arrives (`scene/conclusionPerformance.ts`); this is the other half of
   * executing it. Each strand is given back at the second the compiler placed
   * its voice — the same second its line reaches the register — so the player
   * watches their own composition assemble in their own order.
   *
   * Guarded by session: last Game's times may not hold this Game's web dark.
   */
  const running = useVanillaStore(conclusionPerformanceStore, (s) => s.running);
  const conclusion = useMemo(
    () => runningConclusionFor(running, sessionId),
    [running, sessionId]
  );
  const litTimes = useMemo(
    () =>
      conclusion === null
        ? null
        : threadLightingTimes(
            conclusion.performance,
            threads.map((thread) => String(thread.id))
          ),
    [conclusion, threads]
  );

  /**
   * Which threads have closed. Every committed thread used to be drawn as a
   * documented relation, which made CAV-006's distinction unreachable from the
   * arena. A thread closes when a documented relation is revealed for it; an
   * Open Thread, and a thread whose outcome has not landed yet, stay open —
   * at the same brightness and the same weight.
   */
  const standings = useMemo(() => threadStandings(outcomes), [outcomes]);

  if (threads.length === 0) return null;
  return (
    <group>
      {threads.map((thread) => (
        <Ribbon
          key={thread.id}
          threadId={String(thread.id)}
          sourceId={String(thread.pair[0])}
          targetId={String(thread.pair[1])}
          intention={thread.intention}
          opacity={0.9}
          resolved={standingOf(standings, String(thread.id)).closed}
          lit={standingOf(standings, String(thread.id)).lit}
          animateGrowth
          attuned={attuned}
          litAtSeconds={litTimes?.get(String(thread.id)) ?? null}
          performanceStartedAtMs={conclusion?.startedAtMs ?? null}
        />
      ))}
    </group>
  );
}
