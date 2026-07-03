import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import interWoff from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import { hashString, smoothstep } from "@/lib/utils";
import { frameState } from "./frameState";
import { beadPointerHandlers } from "./threading";
import { getHaloTexture, getGlyphTexture } from "./textures";

import { isCoarsePointer } from "@/lib/device";

export const BEAD_RADIUS = 0.15;
const SHELL_SCALE = 1.42;
/** Fingers need bigger targets than cursors. */
const HIT_SCALE = typeof window !== "undefined" && isCoarsePointer() ? 2.8 : 2.1;
/** Un-tonemapped color boost that pushes bead cores above the bloom threshold. */
const CORE_BOOST = 1.42;
const BOB_AMPLITUDE = 0.035;
/** Additive halo that keeps beads luminous even when postprocessing is gone. */
const HALO_SCALE = 3.1;
const HALO_BASE_OPACITY = 0.22;

// One shared unit sphere; every bead scales it.
const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);

interface BeadProps {
  id: string;
  index: number;
  lensAnchor: boolean;
}

function Bead({ id, index, lensAnchor }: BeadProps) {
  const concept = conceptById.get(id);
  const discipline = concept ? disciplineById.get(concept.discipline) : undefined;

  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const label = useRef<THREE.Object3D>(null);
  const scaleRef = useRef(1);

  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const lensActive = useStore((s) => s.lensActive);
  const focusedBeadId = useStore((s) => s.focusedBeadId);
  const threaded = useStore((s) => !!s.session?.threads.some((t) => t.a === id || t.b === id));

  const { coreMaterial, shellMaterial, haloMaterial, glyphMaterial, bobPhase } = useMemo(() => {
    const base = new THREE.Color(discipline?.color ?? "#8888aa");
    return {
      coreMaterial: new THREE.MeshBasicMaterial({
        color: base.clone().multiplyScalar(CORE_BOOST),
        toneMapped: false,
      }),
      shellMaterial: new THREE.MeshPhysicalMaterial({
        color: base,
        // A colored ember inside the glass — beads stay jewels even when the
        // quality tier strips the bloom pass.
        emissive: base.clone().multiplyScalar(0.22),
        transparent: true,
        opacity: 0.3,
        roughness: 0.16,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.28,
        depthWrite: false,
      }),
      haloMaterial: new THREE.SpriteMaterial({
        map: getHaloTexture(),
        color: base,
        transparent: true,
        opacity: HALO_BASE_OPACITY,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      glyphMaterial: new THREE.SpriteMaterial({
        map: getGlyphTexture(discipline?.glyph ?? "?"),
        color: base.clone().lerp(new THREE.Color("#ffffff"), 0.35),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      bobPhase: (hashString(id) % 6283) / 1000,
    };
  }, [discipline?.color, discipline?.glyph, id]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const i = frameState.beadIndex.get(id) ?? index;
    const p = frameState.positions;
    const bob = reducedMotion
      ? 0
      : Math.sin(frameState.clock * 0.55 + bobPhase) * BOB_AMPLITUDE;
    g.position.set(p[i * 3], p[i * 3 + 1] + bob, p[i * 3 + 2]);

    // Threads and the aim raycast read the final rendered position.
    frameState.rendered[i * 3] = g.position.x;
    frameState.rendered[i * 3 + 1] = g.position.y;
    frameState.rendered[i * 3 + 2] = g.position.z;

    const interaction = useStore.getState().session?.interaction;
    const selected = interaction?.fromId === id && interaction.mode !== "idle";
    const snapped = frameState.snapId === id;
    const hovered = frameState.hoveredId === id;
    const focused = focusedBeadId === id;
    const targetScale = snapped ? 1.24 : focused ? 1.2 : selected ? 1.18 : hovered ? 1.12 : 1;
    scaleRef.current += (targetScale - scaleRef.current) * 0.12;
    const breath = reducedMotion ? 1 : 1 + Math.sin(frameState.clock * 0.9 + bobPhase) * 0.012;
    g.scale.setScalar(scaleRef.current * breath);

    // Halo: hover/select warmth over the resilient base glow, breathing
    // with the shared pulse. A sympathetic candidate shimmers — the eye's
    // half of what the ear is already hearing.
    const emphasis = snapped ? 0.2 : hovered || focused || selected ? 0.13 : 0;
    const breathGlow =
      0.05 * Math.sin(frameState.breathPhase) * frameState.breathDepth;
    const symp = frameState.sympathy;
    const sympathyGlow =
      symp && symp.id === id
        ? symp.strength * 0.22 * (0.5 + 0.5 * Math.sin(frameState.clock * 7))
        : 0;
    haloMaterial.opacity +=
      (HALO_BASE_OPACITY + emphasis + breathGlow + sympathyGlow - haloMaterial.opacity) *
      0.1;

    // Label legibility: fade far-hemisphere and distant labels.
    if (label.current) {
      const camDir = state.camera.position.clone().normalize();
      const beadDir = g.position.clone().normalize();
      const facing = smoothstep(-0.12, 0.32, camDir.dot(beadDir));
      const dist = state.camera.position.distanceTo(g.position);
      const near = 1 - smoothstep(12, 18, dist);
      const target = lensActive
        ? hovered || selected || snapped || focused
          ? 1
          : threaded
            ? 0.88
            : lensAnchor
              ? 0.62
              : 0
        : Math.max(facing * near, hovered || selected || snapped || focused ? 1 : 0);
      label.current.visible = target > 0.03;
      const textObj = label.current as unknown as { material?: THREE.Material };
      if (textObj.material && "opacity" in textObj.material) {
        textObj.material.transparent = true;
        textObj.material.opacity += (target - textObj.material.opacity) * 0.15;
      }
      // The glyph crest shares the label's fade, a touch dimmer.
      glyphMaterial.opacity += (target * 0.85 - glyphMaterial.opacity) * 0.15;
    }
  });

  if (!concept || !discipline) return null;

  return (
    <group ref={group}>
      <mesh ref={core} geometry={sphereGeometry} scale={BEAD_RADIUS} material={coreMaterial} />
      <mesh
        geometry={sphereGeometry}
        scale={BEAD_RADIUS * SHELL_SCALE}
        material={shellMaterial}
      />
      {/* Resilient glow — present at every quality tier. */}
      <sprite material={haloMaterial} scale={BEAD_RADIUS * HALO_SCALE} />
      {/* Discipline crest above the bead — identity at a glance. */}
      <sprite
        material={glyphMaterial}
        scale={0.17}
        position={[0, BEAD_RADIUS * SHELL_SCALE + 0.16, 0]}
      />
      {/* Enlarged invisible hit target carrying the weaving gesture handlers. */}
      <mesh
        geometry={sphereGeometry}
        scale={BEAD_RADIUS * HIT_SCALE}
        userData={{ beadId: id }}
        {...beadPointerHandlers(id)}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <Billboard follow>
        <Text
          ref={label as never}
          font={interWoff}
          fontSize={0.105}
          letterSpacing={0.02}
          color="#f0ede6"
          anchorX="center"
          anchorY="top"
          position={[0, -(BEAD_RADIUS * SHELL_SCALE + 0.1), 0]}
          outlineWidth={0.007}
          outlineColor="#06090f"
          outlineOpacity={0.9}
          maxWidth={2.2}
          textAlign="center"
        >
          {concept.name}
        </Text>
      </Billboard>
    </group>
  );
}

function lensAnchorIds(beadIds: string[]): Set<string> {
  const anchors = new Set<string>();
  const axes = [0, 1, 2] as const;
  for (const axis of axes) {
    let highId: string | null = null;
    let lowId: string | null = null;
    let high = -Infinity;
    let low = Infinity;
    for (const id of beadIds) {
      const value = conceptById.get(id)?.tbg[axis];
      if (value === undefined) continue;
      if (value > high) {
        high = value;
        highId = id;
      }
      if (value < low) {
        low = value;
        lowId = id;
      }
    }
    if (highId) anchors.add(highId);
    if (lowId) anchors.add(lowId);
  }
  return anchors;
}

export function Beads() {
  const beadIds = useStore((s) => s.session?.beadIds ?? null);
  if (!beadIds || beadIds.length === 0) return null;
  const anchors = lensAnchorIds(beadIds);
  return (
    <group>
      {beadIds.map((id, i) => (
        <Bead key={id} id={id} index={i} lensAnchor={anchors.has(id)} />
      ))}
    </group>
  );
}
