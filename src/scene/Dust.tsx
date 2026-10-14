import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { sceneBudget } from "./quality";
import {
  DUST_FRAGMENT,
  DUST_MAX_BEADS,
  DUST_VERTEX,
  buildDust,
  createRingClock,
  resetRingClock,
  ringClock,
  type RingClock,
} from "./dust";

/**
 * THE DUST FIELD (M4-003)
 *
 * One `points` draw in the shell between the instrument and the vault, modelled
 * on the star field: its arithmetic, its numbers and its reasons are in
 * `dust.ts`. This component only hands the shader what the frame knows —
 * where the beads are drawn, how lit each one is, and each bead's ring — from
 * inside the frame loop, into arrays made once, without allocating.
 *
 * The engraved tier has no dust at all (`SceneBudget.dust` is 0), and nothing
 * is mounted for it.
 *
 * Its frame callback may run before the beads' own (it is mounted beside the
 * sky), so it may read the positions and the light the beads wrote on the
 * frame before: at most one frame late, which nothing a ring does can show.
 */
export function Dust() {
  const tier = useStore((s) => s.settings.qualityTier);
  const count = sceneBudget(tier).dust;
  if (count <= 0) return null;
  return <DustField count={count} />;
}

function DustField({ count }: { count: number }) {
  const theme = useCurrentTheme();
  const reducedMotion = useStore((s) => s.settings.reducedMotion);

  const geometry = useMemo(() => {
    const field = buildDust(count);
    const made = new THREE.BufferGeometry();
    made.setAttribute("position", new THREE.BufferAttribute(field.positions, 3));
    made.setAttribute("aSeed", new THREE.BufferAttribute(field.seeds, 1));
    made.setAttribute("aSize", new THREE.BufferAttribute(field.sizes, 1));
    return made;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERTEX,
        fragmentShader: DUST_FRAGMENT,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uVellum: { value: new THREE.Color(theme.palette.vellum) },
          uTime: { value: 0 },
          uTimeScale: { value: 1 },
          uAttuned: { value: 0 },
          uMotion: { value: 1 },
          uBeads: { value: new Float32Array(DUST_MAX_BEADS * 4) },
          uLights: { value: new Float32Array(DUST_MAX_BEADS) },
          uCount: { value: 0 },
        },
      }),
    [theme.palette.vellum]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  /** One onset clock per bead slot, made once and reused for every draw. */
  const clocks = useMemo<readonly RingClock[]>(
    () => Array.from({ length: DUST_MAX_BEADS }, createRingClock),
    []
  );
  /** The draw the clocks belong to: a new bead index is a new draw. */
  const drawn = useRef<ReadonlyMap<string, number> | null>(null);
  useFrame(() => {
    const uniforms = material.uniforms;
    const beads = (uniforms.uBeads as { value: Float32Array }).value;
    const lights = (uniforms.uLights as { value: Float32Array }).value;
    const now = frameState.clock;

    if (frameState.beadIndex !== drawn.current) {
      drawn.current = frameState.beadIndex;
      for (let i = 0; i < DUST_MAX_BEADS; i++) resetRingClock(clocks[i]);
    }

    const rendered = frameState.rendered;
    const kindling = frameState.kindling;
    const present = Math.min(
      DUST_MAX_BEADS,
      frameState.beadIndex.size,
      kindling.length,
      Math.floor(rendered.length / 3)
    );
    for (let i = 0; i < present; i++) {
      const light = kindling[i];
      beads[i * 4] = rendered[i * 3];
      beads[i * 4 + 1] = rendered[i * 3 + 1];
      beads[i * 4 + 2] = rendered[i * 3 + 2];
      beads[i * 4 + 3] = ringClock(clocks[i], light, now);
      lights[i] = light;
    }

    (uniforms.uCount as { value: number }).value = present;
    (uniforms.uTime as { value: number }).value = now;
    (uniforms.uTimeScale as { value: number }).value = frameState.timeScale;
    (uniforms.uMotion as { value: number }).value = reducedMotion ? 0 : 1;
    // The air answers the held state with the rest of the room (ADR-018).
    (uniforms.uAttuned as { value: number }).value = frameState.attuned.value;
  });

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-8}
    />
  );
}
