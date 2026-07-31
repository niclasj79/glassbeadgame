import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import interWoff from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { domainSessionStore } from "@/state/domainSession";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { useCurrentTheme } from "@/themes/useTheme";
import { hashString, smoothstep } from "@/lib/utils";
import { isCoarsePointer } from "@/lib/device";
import { frameState } from "./frameState";
import { beadPointerHandlers } from "./threading";
import { beadIdentity } from "./identity";
import { sigilUniform, settingCode } from "./sigil";
import {
  BEAD_PROXY_SEGMENTS,
  backdropResolution,
  beadProxyScale,
  createBeadGlassMaterial,
  wovenLight,
} from "./glass";
import { presentationProfile } from "./quality";
import { ARENA_FOV } from "./framing";

export const BEAD_RADIUS = 0.15;
/**
 * Hit targets are deliberately much larger than the glass they stand for.
 * I-014 is explicit that weaving is not a dexterity test, and a target only
 * a fifth wider than the bead punishes a hand that moved a few pixels while
 * the arena was still settling. Fingers get more again.
 */
const HIT_SCALE = typeof window !== "undefined" && isCoarsePointer() ? 3.4 : 2.8;
const BOB_AMPLITUDE = 0.03;
/** The glass body is drawn a little larger than the nominal bead radius. */
const GLASS_SCALE = 1.72;
/** How far under an attended bead its label hangs, clear of the plate. */
const ATTENDED_LABEL_DROP_PX = 148;

const RESONANCE_LEVEL: Readonly<Record<string, number>> = Object.freeze({
  weak: 0.25,
  medium: 0.6,
  high: 1,
});

/**
 * The proxy the glass is drawn with. It is *not* the bead: the fragment shader
 * solves the sphere it circumscribes, so the silhouette is a true circle at any
 * zoom instead of the drawn polygon's forty-sided wobble. Being a proxy it can
 * also be much coarser than the sphere it stands for — this is a third of the
 * triangles the old bead had.
 */
const sphereGeometry = (() => {
  const { width, height } = BEAD_PROXY_SEGMENTS;
  const lift = beadProxyScale(width, height);
  const geometry = new THREE.SphereGeometry(1, width, height);
  geometry.scale(lift, lift, lift);
  return geometry;
})();
const hitGeometry = new THREE.SphereGeometry(1, 12, 8);

const camQuaternion = new THREE.Quaternion();
const screenDown = new THREE.Vector3();
const camDir = new THREE.Vector3();
const beadDir = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const scaleVec = new THREE.Vector3();
const originVec = new THREE.Vector3();
const identityQuat = new THREE.Quaternion();

interface LabelHandle {
  group: THREE.Group | null;
  text: THREE.Object3D | null;
}

/**
 * Every bead in the draw, as optical glass in an engraved setting.
 *
 * One instanced draw call carries the glass; the labels and the invisible hit
 * targets stay per-bead because the interaction contract in `threading.ts`
 * addresses beads individually and must not change. Nothing in the frame loop
 * allocates, and no per-frame value passes through React.
 */
export function Beads() {
  const beadIds = useStore((s) => s.session?.beadIds ?? null);
  const focusedBeadId = useStore((s) => s.focusedBeadId);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const tier = useStore((s) => s.settings.qualityTier);
  const theme = useCurrentTheme();
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const threads = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.threads
  );
  const candidateResonance = useVanillaStore(
    interpretationPresentationStore,
    (state) => state.candidateResonance
  );

  const ids = useMemo(() => beadIds ?? [], [beadIds]);
  const count = ids.length;

  const profile = useMemo(
    () => presentationProfile(tier, reducedMotion),
    [tier, reducedMotion]
  );

  const material = useMemo(
    () =>
      createBeadGlassMaterial({
        theme,
        budget: profile.budget,
        reducedMotion: profile.reducedMotion,
      }),
    [theme, profile.budget, profile.reducedMotion]
  );
  useEffect(() => () => material.dispose(), [material]);

  /**
   * THE ROOM THE BEADS ARE CARRYING
   *
   * A bead is glass, and glass transmits what is behind it. The arena is drawn
   * once more per frame — without its beads — into a small buffer, and each
   * fragment of each bead looks the room up along the ray that actually leaves
   * its far surface. That is why the armillary band now compresses, turns over
   * and splits into colour inside a bead instead of stopping dead at its edge.
   *
   * It is deliberately small (see `backdropResolution`): a transmitted image is
   * bent and inverted before anyone sees it, so its detail is spent long before
   * its resolution is, and the extra pass costs a fraction of a frame rather
   * than a second one. The engraved tier asks for no buffer at all and gets no
   * extra pass — a plate does not transmit.
   */
  const backdrop = useMemo(() => {
    // The size is a per-frame question (the viewport moves); whether there is a
    // buffer at all is a tier question, and that is what is asked here.
    if (!backdropResolution(profile.budget, 2, 2)) return null;
    const target = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    target.texture.name = "castalia.beadBackdrop";
    return target;
  }, [profile.budget]);
  useEffect(() => () => backdrop?.dispose(), [backdrop]);
  useEffect(() => {
    (material.uniforms.uBackdrop as { value: THREE.Texture | null }).value =
      backdrop?.texture ?? null;
  }, [material, backdrop]);

  /** Static per-instance description: figure, setting, ink, phase. */
  const statics = useMemo(() => {
    const sigil = new Float32Array(Math.max(1, count) * 4);
    const ink = new Float32Array(Math.max(1, count) * 3);
    const set = new Float32Array(Math.max(1, count) * 4);
    const colour = new THREE.Color();
    ids.forEach((id, i) => {
      const identity = beadIdentity(id);
      const u = sigilUniform(identity.sigil);
      sigil[i * 4] = u.family;
      sigil[i * 4 + 1] = u.symmetry;
      sigil[i * 4 + 2] = u.density;
      sigil[i * 4 + 3] = u.turbulence;
      colour.set(identity.ink);
      ink[i * 3] = colour.r;
      ink[i * 3 + 1] = colour.g;
      ink[i * 3 + 2] = colour.b;
      set[i * 4] = settingCode(identity.setting);
      // Gold leaf is reserved for authored content; a derived placeholder
      // figure never gets it (see scene/identity.ts).
      set[i * 4 + 1] = identity.authored && identity.sigil.gilded ? 1 : 0;
      set[i * 4 + 2] = ((hashString(id) % 6283) / 1000) * 0.5;
      set[i * 4 + 3] = identity.authored ? 1 : 0;
    });
    return { sigil, ink, set };
  }, [ids, count]);

  const state = useMemo(
    () => new Float32Array(Math.max(1, count) * 4),
    [count]
  );

  const bobPhases = useMemo(
    () => Float32Array.from(ids, (id) => (hashString(id) % 6283) / 1000),
    [ids]
  );

  /** Rare-change lookups, read by the frame loop through a ref. */
  const live = useRef({
    woven: new Map<string, number>(),
    resonance: new Map<string, number>(),
    attendedId: null as string | null,
    candidateId: null as string | null,
    focusedId: null as string | null,
  });

  live.current.focusedId = focusedBeadId;
  live.current.attendedId =
    draft.stage === "inactive" ? null : String(draft.attendedConceptId);
  live.current.candidateId =
    draft.stage === "candidate-selected" ? String(draft.candidateConceptId) : null;

  /**
   * How woven each bead is. The count of threads at a bead is a working
   * number here and never reaches the screen as one: it is turned into a
   * saturating material target, and the frame loop then eases toward that
   * target over about a second, so what is drawn is a property of the glass
   * rather than a readout of a score (VERTICAL-SLICE-SPEC §19).
   */
  useEffect(() => {
    const degree = new Map<string, number>();
    for (const thread of threads ?? []) {
      for (const conceptId of thread.pair) {
        const key = String(conceptId);
        degree.set(key, (degree.get(key) ?? 0) + 1);
      }
    }
    const woven = new Map<string, number>();
    for (const [id, count] of degree) woven.set(id, wovenLight(count));
    live.current.woven = woven;
  }, [threads]);

  useEffect(() => {
    const resonance = new Map<string, number>();
    for (const candidate of candidateResonance) {
      resonance.set(
        String(candidate.candidateId),
        RESONANCE_LEVEL[candidate.band] ?? 0
      );
    }
    live.current.resonance = resonance;
  }, [candidateResonance]);

  const glass = useRef<THREE.InstancedMesh>(null);
  const root = useRef<THREE.Group>(null);

  // These are built during render, not in an effect: ref callbacks fire before
  // effects, so allocating them afterwards would wipe every handle React had
  // just given us — and the labels would silently never appear.
  const hits = useRef<(THREE.Object3D | null)[]>([]);
  const labels = useRef<LabelHandle[]>([]);
  const scales = useRef(new Float32Array(0));
  const labelOpacity = useRef(new Float32Array(0));
  useMemo(() => {
    scales.current = new Float32Array(Math.max(1, count)).fill(1);
    labelOpacity.current = new Float32Array(Math.max(1, count));
    hits.current = new Array(count).fill(null);
    labels.current = ids.map(() => ({ group: null, text: null }));
  }, [ids, count]);

  // Instance attributes are static for the life of a draw; state is not.
  useEffect(() => {
    const mesh = glass.current;
    if (!mesh || count === 0) return;
    mesh.geometry.setAttribute(
      "aSigil",
      new THREE.InstancedBufferAttribute(statics.sigil, 4)
    );
    mesh.geometry.setAttribute(
      "aInk",
      new THREE.InstancedBufferAttribute(statics.ink, 3)
    );
    mesh.geometry.setAttribute(
      "aSet",
      new THREE.InstancedBufferAttribute(statics.set, 4)
    );
    mesh.geometry.setAttribute(
      "aState",
      new THREE.InstancedBufferAttribute(state, 4)
    );
  }, [statics, state, count]);

  /**
   * Put the invisible hit targets where the beads already are, without
   * waiting for a frame. The pointer contract in `threading.ts` addresses
   * these meshes, so a commit in which they are still at the origin is a
   * commit in which the arena silently ignores clicks.
   */
  useEffect(() => {
    const positions = frameState.positions;
    ids.forEach((id, i) => {
      const index = frameState.beadIndex.get(id);
      const hit = hits.current[i];
      if (index === undefined || !hit || positions.length < (index + 1) * 3) return;
      hit.position.set(
        positions[index * 3],
        positions[index * 3 + 1],
        positions[index * 3 + 2]
      );
      // The pointer raycast reads `matrixWorld`, which is otherwise only
      // refreshed when a frame is drawn. On a slow first render that leaves
      // the arena visibly correct but silently unclickable.
      hit.updateMatrixWorld();
    });
  }, [ids]);

  useFrame((three, rawDt) => {
    const mesh = glass.current;
    if (!mesh || count === 0) return;
    const dt = Math.min(rawDt, 1 / 20);
    const now = live.current;
    const positions = frameState.positions;
    const rendered = frameState.rendered;
    if (positions.length < count * 3) return;

    (material.uniforms.uTime as { value: number }).value = frameState.clock;

    camQuaternion.copy(three.camera.quaternion);
    // Down the screen, in world space — labels hang from beads, not from the
    // world's vertical, so a steep camera never collapses the offset.
    screenDown.set(0, -1, 0).applyQuaternion(camQuaternion);
    camDir.copy(three.camera.position).normalize();
    const stateAttr = mesh.geometry.getAttribute("aState") as
      | THREE.InstancedBufferAttribute
      | undefined;

    for (let i = 0; i < count; i++) {
      const id = ids[i];
      const index = frameState.beadIndex.get(id) ?? i;
      const bob = reducedMotion
        ? 0
        : Math.sin(frameState.clock * 0.5 + bobPhases[i]) * BOB_AMPLITUDE;
      const x = positions[index * 3];
      const y = positions[index * 3 + 1] + bob;
      const z = positions[index * 3 + 2];
      rendered[index * 3] = x;
      rendered[index * 3 + 1] = y;
      rendered[index * 3 + 2] = z;

      const attended = now.attendedId === id;
      const snapped = frameState.snapId === id || now.candidateId === id;
      const hovered = frameState.hoveredId === id;
      const focused = now.focusedId === id;
      const target = snapped ? 1.3 : focused ? 1.16 : attended ? 1.2 : hovered ? 1.1 : 1;
      const current = scales.current[i] ?? 1;
      const next = current + (target - current) * Math.min(1, dt * 8);
      scales.current[i] = next;
      const breath = reducedMotion
        ? 1
        : 1 + Math.sin(frameState.clock * 0.9 + bobPhases[i]) * 0.01;
      const radius = BEAD_RADIUS * GLASS_SCALE * next * breath;

      originVec.set(x, y, z);
      scaleVec.setScalar(radius);
      matrix.compose(originVec, identityQuat, scaleVec);
      mesh.setMatrixAt(i, matrix);

      const emphasis = snapped ? 1 : attended ? 0.72 : hovered || focused ? 0.5 : 0;
      const resonance = now.resonance.get(id) ?? 0;
      state[i * 4] += (emphasis - state[i * 4]) * Math.min(1, dt * 9);
      state[i * 4 + 1] += (resonance - state[i * 4 + 1]) * Math.min(1, dt * 4);
      // Woven eases rather than steps: a bead takes on light as it is carried
      // into the composition, and never arrives at a countable rung.
      state[i * 4 + 2] +=
        ((now.woven.get(id) ?? 0) - state[i * 4 + 2]) * Math.min(1, dt * 1.6);
      state[i * 4 + 3] += ((attended ? 1 : 0) - state[i * 4 + 3]) * Math.min(1, dt * 8);

      const hit = hits.current[i];
      if (hit) {
        hit.position.set(x, y, z);
        hit.updateMatrixWorld();
      }

      const label = labels.current[i];
      const eyeDistance = three.camera.position.distanceTo(originVec);
      if (label?.group) {
        // The attended bead's label steps clear of the intention plate rather
        // than disappearing: the player must never lose the name of the idea
        // they are working with. The plate is a fixed number of screen pixels
        // across, so the drop is measured in pixels too — a world-space offset
        // would slide under the plate as the camera moves.
        const drop = attended
          ? (ATTENDED_LABEL_DROP_PX / (three.size.height * 0.5)) *
            eyeDistance *
            Math.tan((ARENA_FOV * Math.PI) / 360)
          : BEAD_RADIUS * GLASS_SCALE + 0.16;
        label.group.position
          .set(x, y, z)
          .addScaledVector(screenDown, drop);
        // Type stays the same size on screen whatever the orbit distance.
        label.group.scale.setScalar(
          Math.min(2.2, Math.max(0.8, eyeDistance / 10.4))
        );
        label.group.quaternion.copy(camQuaternion);
      }
      if (label?.text) {
        beadDir.set(x, y, z).normalize();
        const facing = smoothstep(-0.1, 0.34, camDir.dot(beadDir));
        // Labels thin out only in the last third of the zoom range, measured
        // from the arena's centre — a portrait viewport has to stand much
        // further back to frame the instrument at all, and its labels must
        // not vanish for it.
        const near = 1 - smoothstep(18, 25, three.camera.position.length());
        const emphasised = hovered || snapped || focused || attended;
        const wanted = Math.max(facing * near, emphasised ? 1 : 0);
        // troika exposes fill/outline opacity as its own uniforms; the mesh's
        // `material` is undefined until it derives one, so writing to it
        // silently produced NaN and hid every label.
        const current = labelOpacity.current[i];
        const next = current + (wanted - current) * Math.min(1, dt * 9);
        labelOpacity.current[i] = next;
        const troika = label.text as unknown as {
          fillOpacity: number;
          outlineOpacity: number;
        };
        troika.fillOpacity = next;
        troika.outlineOpacity = next * 0.9;
        label.text.visible = next > 0.02;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (stateAttr) stateAttr.needsUpdate = true;

    if (!backdrop) return;
    // Where the room lands on screen, so a bead can look up what it carries.
    // Written in the same breath as the buffer below, so the two always agree
    // about which camera the photograph was taken from.
    (
      material.uniforms.uProjView as { value: THREE.Matrix4 }
    ).value.multiplyMatrices(
      three.camera.projectionMatrix,
      three.camera.matrixWorldInverse
    );

    const wanted = backdropResolution(
      profile.budget,
      three.size.width * three.viewport.dpr,
      three.size.height * three.viewport.dpr
    );
    if (!wanted) return;
    if (backdrop.width !== wanted.width || backdrop.height !== wanted.height) {
      backdrop.setSize(wanted.width, wanted.height);
    }

    // The beads step out of the room while it is photographed: without this a
    // bead transmits itself, and the second frame is a hall of mirrors. This
    // runs at the default frame priority, which is before the composer's, so
    // the buffer is always the arena as it is about to be drawn.
    const group = root.current;
    if (group) group.visible = false;
    const previous = three.gl.getRenderTarget();
    three.gl.setRenderTarget(backdrop);
    three.gl.render(three.scene, three.camera);
    three.gl.setRenderTarget(previous);
    if (group) group.visible = true;
  });

  if (count === 0) return null;

  return (
    <group ref={root}>
      <instancedMesh
        ref={glass}
        args={[sphereGeometry, material, count]}
        frustumCulled={false}
        renderOrder={1}
      />
      {ids.map((id, i) => (
        <mesh
          key={`hit-${id}`}
          ref={(node) => {
            hits.current[i] = node;
          }}
          geometry={hitGeometry}
          scale={BEAD_RADIUS * HIT_SCALE}
          userData={{ beadId: id }}
          {...beadPointerHandlers(id)}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      ))}
      {/* Labels load a font, and drei's Text suspends while it does. Their own
          boundary keeps that suspension off the beads and their hit targets:
          without it the whole arena is unclickable until the font arrives. */}
      <Suspense fallback={null}>
      {ids.map((id, i) => (
        <group
          key={`label-${id}`}
          ref={(node) => {
            const handle = labels.current[i];
            if (handle) handle.group = node;
          }}
        >
          <Text
            ref={(node) => {
              const handle = labels.current[i];
              if (handle) handle.text = node as unknown as THREE.Object3D;
            }}
            font={interWoff}
            fontSize={0.115}
            letterSpacing={0.04}
            color={theme.palette.vellum}
            anchorX="center"
            anchorY="top"
            outlineWidth={0.008}
            outlineColor={theme.palette.ground}
            outlineOpacity={0.92}
            maxWidth={2.1}
            textAlign="center"
          >
            {beadIdentity(id).name}
          </Text>
        </group>
      ))}
      </Suspense>
    </group>
  );
}
