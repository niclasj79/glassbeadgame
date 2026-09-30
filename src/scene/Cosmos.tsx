import { useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { domainSessionStore } from "@/state/domainSession";
import { useCurrentTheme } from "@/themes/useTheme";
import { castaliaConceptById } from "@/content/castalia";
import type { CastaliaConcept } from "@/content/castalia/schema";
import { fibonacciSpherePositions, lensPlanePositions } from "@/game/layout";
import { conductor } from "@/audio/conductor";
import {
  breathPhaseAfter,
  frameState,
  initFramePositions,
  setMorphTargets,
} from "./frameState";
import { advanceIdleClock } from "./idle";
import { armillaryOrder } from "./identity";
import { Firmament } from "./Firmament";
import { Armillary } from "./Armillary";
import { LensAxes } from "./LensAxes";
import { Bursts } from "./Bursts";
import { Beads } from "./Beads";
import { Threads } from "./Threads";
import { MotifMarks } from "./MotifMarks";
import { ThreadPreview } from "./ThreadPreview";
import { IntentionConstellation } from "./IntentionConstellation";
import { ThreadingDriver } from "./ThreadingDriver";
import { CameraRig } from "./CameraRig";
import { MarginRule } from "./MarginRule";
import { Effects } from "./Effects";

/** Scene root: composition + the global frame-loop bookkeeping. */
export function Cosmos() {
  const beadIds = useStore((s) => s.session?.beadIds ?? null);
  const lensActive = useStore((s) => s.lensActive);
  const lensView = useStore((s) => s.lensView);
  const theme = useCurrentTheme();

  /**
   * The draw's order on the armillary: faculties become contiguous zones
   * between two parallels rather than a scatter, so the arena has a geography
   * the eye can learn. The position *set* is unchanged — only which bead sits
   * at which station — so separation and reachability are exactly as before.
   */
  const ordered = useMemo(
    () => (beadIds && beadIds.length > 0 ? armillaryOrder(beadIds) : null),
    [beadIds]
  );

  // A layout effect, not a passive one: children position their hit targets
  // from `frameState` in their own effects, and a passive parent effect would
  // run after them — leaving one commit in which a bead is drawn where the
  // pointer cannot reach it.
  useLayoutEffect(() => {
    if (ordered && ordered.length > 0) {
      initFramePositions(ordered, fibonacciSpherePositions(ordered.length));
    }
  }, [ordered]);

  // The Lens morphs between the armillary and one of three plane readings, each
  // laid out from fields the pack authors. A draw containing a bead the pack
  // does not know simply does not morph rather than throwing.
  useEffect(() => {
    if (!ordered || ordered.length === 0) return;
    const reduced = useStore.getState().settings.reducedMotion;
    const concepts = ordered.map((id) => castaliaConceptById.get(id));
    const plane =
      lensActive &&
      concepts.every((concept): concept is CastaliaConcept => Boolean(concept))
        ? lensPlanePositions(concepts, lensView)
        : null;
    const targets = plane ?? fibonacciSpherePositions(ordered.length);
    if (reduced) {
      frameState.positions = targets.slice();
      frameState.targets = targets.slice();
      frameState.morphActive = false;
    } else {
      setMorphTargets(targets);
    }
  }, [lensActive, lensView, ordered]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20); // clamp hitches so damps never jump
    if (frameState.framesSinceLayout < 8) frameState.framesSinceLayout += 1;

    // Global time dilation (the reveal's slow-motion).
    const k = 1 - Math.exp(-dt / 0.35);
    frameState.timeScale += (frameState.timeScaleTarget - frameState.timeScale) * k;
    frameState.clock += dt * frameState.timeScale;
    // The idle score runs on the same dilated seconds, on a clock that a new
    // draw does not reset — see `scene/idle.ts`.
    advanceIdleClock(dt * frameState.timeScale);

    // The Breath. While the conductor keeps the world's time it is the
    // conductor's own — one breath every four slots, cresting on the bar, on
    // the clock the music is scheduled on (ADR-016) — so the bloom, the bed,
    // the sky and the lens breathe with the score. With no grid (no bed is
    // playing) the phase integrates dilated time at 0.1 Hz, so it slows with
    // reveals and stays phase-continuous, taking up from wherever the
    // conductor left it. Depth eases toward its context target either way.
    frameState.breathPhase = breathPhaseAfter(
      frameState.breathPhase,
      dt,
      frameState.timeScale,
      conductor
    );
    const st = useStore.getState();
    const depthTarget = st.settings.reducedMotion
      ? 0
      : st.session?.interaction.mode === "reveal"
        ? 0.25
        : 1;
    frameState.breathDepth += (depthTarget - frameState.breathDepth) * Math.min(1, dt * 2);

    /**
     * How far the web has been *carried*, not how much of it has been found.
     *
     * This was `curatedDiscoveries / curatedAvailable` — the fraction of the
     * draw's hidden authored pairs the player had located. The sky literally
     * brightened as they guessed more correct answers, and global bloom scaled
     * with it. That is a completion meter wearing an atmosphere, and it breaks
     * two product laws at once: the player is not hunting hidden pairs, and the
     * environment must evolve from topology rather than from percentage
     * completion (VERTICAL-SLICE-SPEC §17).
     *
     * It is now the reach of the largest connected region, normalised against
     * the arena. Reach is a property of the composition: it rises when threads
     * join, and it cannot be raised by finding anything. There is no ceiling to
     * complete and nothing to fill.
     */
    const domain = domainSessionStore.getState().session;
    let reach = 0;
    if (domain && domain.threads.length > 0) {
      const neighbours = new Map<string, string[]>();
      for (const thread of domain.threads) {
        const a = String(thread.pair[0]);
        const b = String(thread.pair[1]);
        (neighbours.get(a) ?? neighbours.set(a, []).get(a)!).push(b);
        (neighbours.get(b) ?? neighbours.set(b, []).get(b)!).push(a);
      }
      const seen = new Set<string>();
      let largest = 0;
      for (const startId of neighbours.keys()) {
        if (seen.has(startId)) continue;
        let size = 0;
        const stack = [startId];
        while (stack.length > 0) {
          const current = stack.pop() as string;
          if (seen.has(current)) continue;
          seen.add(current);
          size += 1;
          for (const next of neighbours.get(current) ?? []) {
            if (!seen.has(next)) stack.push(next);
          }
        }
        if (size > largest) largest = size;
      }
      reach = Math.min(1, largest / Math.max(4, domain.conceptIds.length));
    }
    frameState.awakening +=
      (reach - frameState.awakening) * Math.min(1, dt * 0.8);

    // Layout morph toward targets.
    if (frameState.morphActive) {
      const { positions, targets } = frameState;
      const km = 1 - Math.exp(-dt / 0.45);
      let maxDelta = 0;
      for (let i = 0; i < positions.length; i++) {
        const d = targets[i] - positions[i];
        positions[i] += d * km;
        const abs = Math.abs(d);
        if (abs > maxDelta) maxDelta = abs;
      }
      if (maxDelta < 0.004) {
        positions.set(targets);
        frameState.morphActive = false;
      }
    }
  });

  return (
    <>
      <color attach="background" args={[theme.palette.ground]} />
      <fog
        key={theme.id}
        attach="fog"
        args={[theme.fog.color, theme.fog.near, theme.fog.far]}
      />

      {/* The beads and rings carry their own shading; these lights exist for
          the few standard materials left in the scene. */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={theme.keyLight as unknown as [number, number, number]}
        intensity={0.9}
        color={theme.palette.vellum}
      />

      <Firmament />
      <Armillary />
      <LensAxes />
      <Beads />
      <IntentionConstellation />
      <Threads />
      {/* Completed motifs leave a permanent mark on the world (spec §12).
          `MotifMarks` existed but was mounted nowhere, so completion changed
          nothing that could be seen. */}
      <MotifMarks />
      <Bursts />
      <ThreadPreview />
      <ThreadingDriver />
      <CameraRig />
      <MarginRule />
      <Effects />
    </>
  );
}
