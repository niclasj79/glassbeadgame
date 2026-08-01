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
import { ARENA_FOV, worldSafeArea } from "./framing";
import { idleClock, kindling } from "./idle";
import {
  SUPPRESSED,
  createLabelScratch,
  placeLabels,
  type LabelScratch,
} from "./labels";
import {
  assignSalience,
  invitationWeights,
  separateOnScreen,
  tierWeights,
} from "./salience";

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

/**
 * WHAT A BEAD DOES WHEN THE POINTER ARRIVES.
 *
 * Measured A/B at 2x on the running build with a fresh profile: hovering a
 * 56 px bead grew it by about **eight per cent** and brightened it slightly.
 * That is inside the noise of a bead that is already bobbing and breathing —
 * a player cannot tell whether the world answered, and five critic passes in a
 * row reported that nothing on screen said what to do.
 *
 * A hover is now a full quarter larger, with the glass taking real light and
 * the bead's own name arriving with it (three channels, none of them colour).
 * These are exported because they are a product commitment, not a taste: a
 * test asserts the floor rather than a screenshot.
 */
export const HOVER_SCALE = 1.28;
/** Emphasis handed to the material on hover — light, not just size. */
export const HOVER_EMPHASIS = 0.82;
/** The attended bead, which also wears the gold rule and the plate. */
export const ATTENDED_SCALE = 1.24;
/** The other end of a weave, once the aim has acquired it. */
export const SNAPPED_SCALE = 1.34;

/**
 * How quickly the invitation lets go once the player has touched the draw.
 * About a second: long enough to read as the world settling, short enough that
 * it is over before the first press is answered.
 */
const INVITATION_RELEASE = 1.4;

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
const screenRight = new THREE.Vector3();
const camDir = new THREE.Vector3();
const beadDir = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const scaleVec = new THREE.Vector3();
const originVec = new THREE.Vector3();
const projectVec = new THREE.Vector3();
const identityQuat = new THREE.Quaternion();

const tanHalfFov = Math.tan((ARENA_FOV * Math.PI) / 360);

/**
 * A last-resort estimate of a name's size, used only for the frame or two
 * before troika has measured the real thing. Inter's average advance is a bit
 * over half its em; the letter spacing is added because the label sets it.
 */
const ESTIMATED_ADVANCE = 0.56;

interface LabelHandle {
  group: THREE.Group | null;
  text: THREE.Object3D | null;
}

/** What troika publishes once a label has actually been laid out. */
interface TroikaText {
  fillOpacity: number;
  outlineOpacity: number;
  textRenderInfo?: { blockBounds?: ArrayLike<number> };
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
  /**
   * Where each bead sits in *this* component's arrays. Not the same as
   * `frameState.beadIndex`, which is keyed to the armillary's own ordering.
   */
  const indexOf = useMemo(
    () => new Map(ids.map((id, i) => [id, i])),
    [ids]
  );

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

  /**
   * THE FRAME'S FOCAL HIERARCHY, AND WHERE THE NAMES GO.
   *
   * Both are solved once per frame in screen space, in one place, because they
   * are one problem: a name's placement depends on which beads the frame is
   * about, and which beads the frame is about is decided by the hierarchy.
   *
   * The screen space used here is isotropic — x carries the aspect ratio — so a
   * clearance is the same distance on both axes and a circle is a circle.
   * Everything is pre-allocated; the frame loop allocates nothing.
   */
  const focal = useMemo(() => {
    const n = Math.max(1, count);
    return {
      /** (tier, kindling) per bead, handed to the material. */
      attribute: new Float32Array(n * 2),
      tierTarget: new Float32Array(n),
      depth: new Float32Array(n),
      promoted: new Float32Array(n),
      order: new Int32Array(n),
      anchor: new Float32Array(n * 2),
      beadRadius: new Float32Array(n),
      /**
       * What a bead's *own* name is offset by — its glass, never the plate
       * around it. See `labels.ts`: the two radii are different questions, and
       * this one has been answered wrongly (by the other) since the solver
       * landed, which is why an attended bead carried no name at all.
       */
      ownRadius: new Float32Array(n),
      /** Drawn silhouette radius, in the same isotropic screen units. */
      glassRadius: new Float32Array(n),
      /** This frame's wanted separation, and the eased one actually applied. */
      push: new Float32Array(n * 2),
      pushEased: new Float32Array(n * 2),
      half: new Float32Array(n * 2),
      hidden: new Float32Array(n),
      code: new Int32Array(n),
      offset: new Float32Array(n * 2),
      /** Measured half-extents of each name in its own local units. */
      localHalf: new Float32Array(n * 2),
      /** Committed threads as screen chords, so no name lies across one. */
      chord: new Float32Array(n * n * 2),
      scratch: createLabelScratch(n) as LabelScratch,
    };
  }, [count]);

  const bobPhases = useMemo(
    () => Float32Array.from(ids, (id) => (hashString(id) % 6283) / 1000),
    [ids]
  );

  /** Rare-change lookups, read by the frame loop through a ref. */
  const live = useRef({
    woven: new Map<string, number>(),
    resonance: new Map<string, number>(),
    /** Committed thread endpoints, flattened: a, b, a, b… */
    threads: [] as string[],
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
    const chords: string[] = [];
    for (const thread of threads ?? []) {
      chords.push(String(thread.pair[0]), String(thread.pair[1]));
    }
    live.current.threads = chords;
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

  /**
   * The invitation, and whether it has been accepted. A ref, not state: this
   * changes on a frame and must never re-render the arena.
   */
  const invite = useRef({ unresolved: 1, touched: false });

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
    // A new draw is a new invitation: the world offers again, once, to a
    // player who has not yet touched *this* arena.
    invite.current.unresolved = 1;
    invite.current.touched = false;
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
    mesh.geometry.setAttribute(
      "aTier",
      new THREE.InstancedBufferAttribute(focal.attribute, 2)
    );
  }, [statics, state, focal, count]);

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
    // Down and across the screen, in world space — labels hang from beads, not
    // from the world's vertical, so a steep camera never collapses the offset.
    screenDown.set(0, -1, 0).applyQuaternion(camQuaternion);
    screenRight.set(1, 0, 0).applyQuaternion(camQuaternion);
    camDir.copy(three.camera.position).normalize();
    const stateAttr = mesh.geometry.getAttribute("aState") as
      | THREE.InstancedBufferAttribute
      | undefined;
    const tierAttr = mesh.geometry.getAttribute("aTier") as
      | THREE.InstancedBufferAttribute
      | undefined;
    const aspect = three.size.width / Math.max(1, three.size.height);
    const spark = kindling(idleClock(), count);

    // ── the invitation, and whether it has been accepted ────────────────
    // The first hover, press, latch or focus ends it, once, for the session.
    if (
      !invite.current.touched &&
      (frameState.hoveredId !== null ||
        frameState.snapId !== null ||
        now.attendedId !== null ||
        now.focusedId !== null)
    ) {
      invite.current.touched = true;
    }
    if (invite.current.touched && invite.current.unresolved > 0) {
      invite.current.unresolved = Math.max(
        0,
        invite.current.unresolved - dt * INVITATION_RELEASE
      );
    }
    const offer = invitationWeights(spark.gain, invite.current.unresolved);

    // ── pass one: where each bead stands, and how big it is drawn ───────
    for (let i = 0; i < count; i++) {
      const id = ids[i];
      const index = frameState.beadIndex.get(id) ?? i;
      const bob = reducedMotion
        ? 0
        : Math.sin(frameState.clock * 0.5 + bobPhases[i]) * BOB_AMPLITUDE;
      const x = positions[index * 3];
      const y = positions[index * 3 + 1] + bob;
      const z = positions[index * 3 + 2];

      const attended = now.attendedId === id;
      const snapped = frameState.snapId === id || now.candidateId === id;
      const hovered = frameState.hoveredId === id;
      const focused = now.focusedId === id;
      // The invitation is a *scale*, so it stands down the moment the player's
      // own attention arrives — a reached-for bead is never also an offer. It
      // is suppressed entirely under reduced motion, where the same invitation
      // is carried by light alone (see the kindling below).
      const invited = spark.index === i;
      const offered =
        reducedMotion || attended || snapped || hovered || focused
          ? 1
          : invited
            ? offer.reach
            : offer.recede;
      const target =
        (snapped
          ? SNAPPED_SCALE
          : attended
            ? ATTENDED_SCALE
            : hovered
              ? HOVER_SCALE
              : focused
                ? 1.16
                : 1) * offered;
      const current = scales.current[i] ?? 1;
      // Hover answers faster than it lets go: the arrival is the message.
      const rate = hovered || snapped || attended ? 13 : 8;
      const next = current + (target - current) * Math.min(1, dt * rate);
      scales.current[i] = next;

      originVec.set(x, y, z);
      // ── the frame's hierarchy, measured ───────────────────────────────
      const eyeDistance = three.camera.position.distanceTo(originVec);
      focal.depth[i] = eyeDistance;
      // Attention promotes a bead out of turn. Attention is not content: a
      // bead the player has reached for is the subject of the frame.
      focal.promoted[i] = attended || snapped || hovered || focused ? 1 : 0;

      projectVec.set(x, y, z).project(three.camera);
      const behind = projectVec.z < -1 || projectVec.z > 1;
      focal.anchor[i * 2] = projectVec.x * aspect;
      focal.anchor[i * 2 + 1] = projectVec.y;
      focal.hidden[i] =
        behind || Math.abs(projectVec.x) > 1.4 || Math.abs(projectVec.y) > 1.4
          ? 1
          : 0;

      const halfAtBead = Math.max(0.001, eyeDistance * tanHalfFov);
      focal.glassRadius[i] = (BEAD_RADIUS * GLASS_SCALE * next) / halfAtBead;
    }

    // ── pass two: no two beads may read as one ──────────────────────────
    separateOnScreen(
      focal.anchor,
      focal.glassRadius,
      focal.hidden,
      count,
      focal.push
    );

    // The displacement eases rather than steps: a pair that opens as the camera
    // turns closes the gap again over about a fifth of a second, and a bead
    // never jumps between two frames. Applied to every anchor before anything
    // is placed, so the clearances measured below are the drawn ones.
    const easing = Math.min(1, dt * 5);
    for (let i = 0; i < count * 2; i++) {
      focal.pushEased[i] += (focal.push[i] - focal.pushEased[i]) * easing;
      focal.anchor[i] += focal.pushEased[i];
    }

    // ── pass three: place the glass, the targets and the names ──────────
    for (let i = 0; i < count; i++) {
      const id = ids[i];
      const index = frameState.beadIndex.get(id) ?? i;
      const attended = now.attendedId === id;
      const snapped = frameState.snapId === id || now.candidateId === id;
      const hovered = frameState.hoveredId === id;
      const focused = now.focusedId === id;
      const next = scales.current[i];
      const eyeDistance = focal.depth[i];
      const halfAtBead = Math.max(0.001, eyeDistance * tanHalfFov);
      const pushX = focal.pushEased[i * 2];
      const pushY = focal.pushEased[i * 2 + 1];

      const bob = reducedMotion
        ? 0
        : Math.sin(frameState.clock * 0.5 + bobPhases[i]) * BOB_AMPLITUDE;
      // Back into the world, along the screen's own axes at this bead's depth,
      // so the separation the eye asked for is exactly the separation it gets.
      const x =
        positions[index * 3] +
        (screenRight.x * pushX - screenDown.x * pushY) * halfAtBead;
      const y =
        positions[index * 3 + 1] +
        bob +
        (screenRight.y * pushX - screenDown.y * pushY) * halfAtBead;
      const z =
        positions[index * 3 + 2] +
        (screenRight.z * pushX - screenDown.z * pushY) * halfAtBead;
      rendered[index * 3] = x;
      rendered[index * 3 + 1] = y;
      rendered[index * 3 + 2] = z;

      const breath = reducedMotion
        ? 1
        : 1 + Math.sin(frameState.clock * 0.9 + bobPhases[i]) * 0.01;
      const radius = BEAD_RADIUS * GLASS_SCALE * next * breath;

      originVec.set(x, y, z);
      scaleVec.setScalar(radius);
      matrix.compose(originVec, identityQuat, scaleVec);
      mesh.setMatrixAt(i, matrix);

      const emphasis = snapped
        ? 1
        : attended
          ? 0.78
          : hovered
            ? HOVER_EMPHASIS
            : focused
              ? 0.5
              : 0;
      const resonance = now.resonance.get(id) ?? 0;
      state[i * 4] += (emphasis - state[i * 4]) * Math.min(1, dt * 11);
      state[i * 4 + 1] += (resonance - state[i * 4 + 1]) * Math.min(1, dt * 4);
      // Woven eases rather than steps: a bead takes on light as it is carried
      // into the composition, and never arrives at a countable rung.
      state[i * 4 + 2] +=
        ((now.woven.get(id) ?? 0) - state[i * 4 + 2]) * Math.min(1, dt * 1.6);
      state[i * 4 + 3] += ((attended ? 1 : 0) - state[i * 4 + 3]) * Math.min(1, dt * 8);

      // THE TARGET IS THE BEAD'S OWN, ALWAYS.
      //
      // The generous target I-014 asks for is generous because weaving is not a
      // dexterity test — but a target wider than the gap to the next bead is
      // not generosity, it is a bead standing in front of another one. It is
      // held back to half the distance to the nearest neighbour, and never
      // below the glass the player can actually see, so what is on the screen
      // is always what the pointer reaches.
      let clearance = Number.POSITIVE_INFINITY;
      if (focal.hidden[i] === 0) {
        for (let k = 0; k < count; k++) {
          if (k === i || focal.hidden[k] > 0) continue;
          const dx = focal.anchor[k * 2] - focal.anchor[i * 2];
          const dy = focal.anchor[k * 2 + 1] - focal.anchor[i * 2 + 1];
          const gap = Math.hypot(dx, dy) * 0.5;
          if (gap < clearance) clearance = gap;
        }
      }
      const hit = hits.current[i];
      if (hit) {
        const generous = BEAD_RADIUS * HIT_SCALE;
        const bounded = Number.isFinite(clearance)
          ? Math.max(radius, Math.min(generous, clearance * halfAtBead))
          : generous;
        hit.position.set(x, y, z);
        hit.scale.setScalar(bounded);
        hit.updateMatrixWorld();
      }

      // Screen size, in half-frame-heights, of everything drawn *around* this
      // bead. For the attended one that is the intention plate, not the glass:
      // the plate is what a neighbouring name would actually collide with.
      focal.beadRadius[i] = attended
        ? ATTENDED_LABEL_DROP_PX / (three.size.height * 0.5)
        : focal.glassRadius[i] + 0.06 / halfAtBead;
      // …and what its *own* name hangs from is its own glass, whatever else is
      // drawn around it. Handing the plate's radius to both is what left the
      // attended bead — the frame's one definite subject — with no name at all.
      focal.ownRadius[i] = focal.glassRadius[i] + 0.02;

      const label = labels.current[i];
      // Type stays the same size on screen whatever the orbit distance.
      const typeScale = Math.min(2.2, Math.max(0.8, eyeDistance / 10.4));
      if (label?.group) label.group.scale.setScalar(typeScale);
      const bounds = (label?.text as TroikaText | null)?.textRenderInfo
        ?.blockBounds;
      const localHalfX = bounds
        ? Math.max(Math.abs(bounds[0]), Math.abs(bounds[2]))
        : Math.min(1.05, ids[i].length * 0.115 * ESTIMATED_ADVANCE * 0.5);
      const localHalfY = bounds
        ? Math.max(0.03, (bounds[3] - bounds[1]) / 2)
        : 0.075;
      focal.localHalf[i * 2] = localHalfX;
      focal.localHalf[i * 2 + 1] = localHalfY;
      focal.half[i * 2] = (localHalfX * typeScale) / halfAtBead;
      focal.half[i * 2 + 1] = (localHalfY * typeScale) / halfAtBead;
    }

    // ── the hierarchy, then the names ───────────────────────────────────
    assignSalience(
      focal.depth,
      focal.promoted,
      count,
      focal.order,
      focal.tierTarget
    );

    // The player's own threads, as screen chords. A name laid across a thread
    // is the worst of the collisions: the thread is the thing they made.
    const woven = live.current.threads;
    let chords = 0;
    const maxChords = Math.floor(focal.chord.length / 4);
    for (let t = 0; t < woven.length && chords < maxChords; t += 2) {
      const a = indexOf.get(woven[t]);
      const b = indexOf.get(woven[t + 1]);
      if (a === undefined || b === undefined) continue;
      if (focal.hidden[a] > 0 && focal.hidden[b] > 0) continue;
      focal.chord[chords * 4] = focal.anchor[a * 2];
      focal.chord[chords * 4 + 1] = focal.anchor[a * 2 + 1];
      focal.chord[chords * 4 + 2] = focal.anchor[b * 2];
      focal.chord[chords * 4 + 3] = focal.anchor[b * 2 + 1];
      chords++;
    }

    const safe = worldSafeArea(aspect);
    placeLabels(
      {
        anchor: focal.anchor,
        beadRadius: focal.beadRadius,
        ownRadius: focal.ownRadius,
        half: focal.half,
        tier: focal.tierTarget,
        hidden: focal.hidden,
        thread: focal.chord,
        threadCount: chords,
        count,
        area: {
          minX: safe.minX * aspect,
          maxX: safe.maxX * aspect,
          minY: safe.minY,
          maxY: safe.maxY,
        },
      },
      focal.scratch,
      focal.code,
      focal.offset
    );

    for (let i = 0; i < count; i++) {
      const id = ids[i];
      const index = frameState.beadIndex.get(id) ?? i;
      const x = rendered[index * 3];
      const y = rendered[index * 3 + 1];
      const z = rendered[index * 3 + 2];

      // The tier eases rather than steps: two beads that trade rank as the
      // camera turns must cross-fade, never pop.
      const tier = focal.attribute[i * 2];
      focal.attribute[i * 2] =
        tier + (focal.tierTarget[i] - tier) * Math.min(1, dt * 2.6);
      const kindle = focal.attribute[i * 2 + 1];
      // The idle score's own light, raised while the invitation stands — and
      // under reduced motion this is the whole of the invitation, because the
      // reach is travel and travel is what the preference is about.
      const wantKindle =
        spark.index === i
          ? Math.min(1, spark.gain * (1 + 0.55 * offer.light))
          : 0;
      focal.attribute[i * 2 + 1] =
        kindle + (wantKindle - kindle) * Math.min(1, dt * 3.4);

      const label = labels.current[i];
      const halfAtBead = Math.max(0.001, focal.depth[i] * tanHalfFov);
      if (label?.group) {
        // The solver answered in half-frame-heights, which is isotropic, so one
        // unit is the same world distance on both axes at this depth.
        label.group.position
          .set(x, y, z)
          .addScaledVector(screenRight, focal.offset[i * 2] * halfAtBead)
          .addScaledVector(screenDown, -focal.offset[i * 2 + 1] * halfAtBead);
        label.group.quaternion.copy(camQuaternion);
      }
      if (label?.text) {
        beadDir.set(x, y, z).normalize();
        const facing = smoothstep(-0.1, 0.34, camDir.dot(beadDir));
        const emphasised = focal.promoted[i] > 0;
        // A name with nowhere legible to go is suppressed outright. Half a name
        // running off the page tells the player the world is broken; no name
        // tells them this bead is crowded, which is true and recoverable.
        const placed = focal.code[i] !== SUPPRESSED;
        // The tier carries label weight too, so the frame's first read is also
        // the frame's most legible name.
        const weight = tierWeights(focal.attribute[i * 2]).label;
        const wanted = placed
          ? Math.max(facing * weight, emphasised ? 1 : 0)
          : 0;
        // troika exposes fill/outline opacity as its own uniforms; the mesh's
        // `material` is undefined until it derives one, so writing to it
        // silently produced NaN and hid every label.
        const current = labelOpacity.current[i];
        const next = current + (wanted - current) * Math.min(1, dt * 9);
        labelOpacity.current[i] = next;
        const troika = label.text as unknown as TroikaText;
        troika.fillOpacity = next;
        troika.outlineOpacity = next * 0.92;
        label.text.visible = next > 0.02;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (stateAttr) stateAttr.needsUpdate = true;
    if (tierAttr) tierAttr.needsUpdate = true;

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
