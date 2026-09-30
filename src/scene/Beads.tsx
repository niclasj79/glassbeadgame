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
import { presentationNow } from "@/runtime/testMode";
import { beadClink } from "@/audio/sfx";
import { frameState } from "./frameState";
import {
  createContactTracker,
  detectContacts,
  resizeContactTracker,
} from "./contact";
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
import { focusFrame, sampleFocusView, sizeFocusFrame } from "./focusFrame";
import { idleClock, kindling } from "./idle";
import { arrivalDurationMs, beadArrival } from "./opening";
import {
  ATTENDED_NAME_BLUR,
  ATTENDED_NAME_MAX_WIDTH,
  ATTENDED_NAME_OUTLINE,
  ATTENDED_NAME_OUTLINE_OPACITY,
  ATTENDED_NAME_SCALE,
  NAME_MAX_WIDTH,
  NAME_OUTLINE,
  NAME_OUTLINE_OPACITY,
  SUPPRESSED,
  createLabelScratch,
  placeLabels,
  type LabelScratch,
} from "./labels";
import {
  PROMOTE_SECOND,
  assignSalience,
  invitationWeights,
  promotionFor,
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
const COARSE_POINTER = typeof window !== "undefined" && isCoarsePointer();
const HIT_SCALE = COARSE_POINTER ? 3.4 : 2.8;
const BOB_AMPLITUDE = 0.03;
/** The glass body is drawn a little larger than the nominal bead radius. */
const GLASS_SCALE = 1.72;

/**
 * THE ATTENDED BEAD'S NAME IS THE FRAME'S CAPTION, AND IT WAS THE FRAME'S
 * WORST ONE.
 *
 * Measured on the running build with a bead attended: row-max luminance
 * profiles put the attended label's peak at 175 against a local background of
 * 111–124 — the horizon streak and the dial's own ring — about 1.5:1, while
 * every unattended name in the same frame ran 3.3:1 or better. Re-measured over
 * each name's own box rather than a band, the same frame reads 86 against 29,
 * against 149–210 for the four names beside it (the table is in `labels.ts`):
 * different windows, same finding. The thing the player had just chosen carried
 * the least legible caption on the page, and the intention dial was drawn over
 * the top of it, because the name was offset by the bead's own glass and the
 * dial is a hundred and sixty pixels wider than that in every direction.
 *
 * Attending promotes the name in two ways at once, neither of them colour: it
 * is set larger than every other name in the frame, and it is struck on a field
 * of the world's own ground rather than on whatever happens to be behind it.
 *
 * It used to be lifted clear of a dial as well — the intention plate drawn
 * round the attended bead — and every name in the frame kept clear of that
 * dial's widest reach. The plate has left the attended bead: under the focus
 * view the sigils bloom on the preview thread between the locked pair (I-016),
 * so nothing is drawn round the attended bead but its own glass, and its name
 * hangs off that glass like any other bead's — larger, grounded, and cleared
 * of the fog with its bead (`focusFog.ts`).
 *
 * The registers the promotion is spent in — the setting, the ground and its
 * opacity — are in `labels.ts` beside the solver, because how a name is set
 * and where it goes are one question.
 */

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

/**
 * THE ATTENDED BEAD IS UNMISTAKABLY THE LARGEST THING IN THE FRAME (I-017).
 *
 * The camera closes in so the attended bead is near and large; these are the
 * bead's own half of that promise, and the half that has to carry it alone
 * under reduced motion, where the camera does not travel and the bead is set
 * apart by scale and brightness instead.
 *
 * A floor is not enough on its own. The attended bead is turned to the
 * lower-left of the sphere, so a bead facing the eye can stand nearer than it
 * does — and under reduced motion the attended bead may be on the far side of
 * the instrument altogether. So the scale is also a *dominance*: whatever the
 * pose, the attended bead is drawn at least `ATTENDED_DOMINANCE` times the
 * apparent size of every other bead in the frame, up to a ceiling.
 */
export const ATTENDED_SCALE = 1.42;
/** Under reduced motion, where scale and brightness carry the whole promise. */
export const ATTENDED_SCALE_STILL = 1.62;
export const ATTENDED_DOMINANCE = 1.12;
export const ATTENDED_SCALE_CEILING = 2.2;
/**
 * The second bead: settled under the lens, locked as the pair, or the other end
 * of a reopened thread. Present, lit, and always smaller than the first.
 */
export const SECOND_SCALE = 1.22;
/** Light, not size: the second bead's glass, and a bead under the lens. */
export const SECOND_EMPHASIS = 0.86;
export const LENS_EMPHASIS = 0.55;
/** A bead with keyboard focus while roaming. */
const FOCUSED_SCALE = 1.16;
const FOCUSED_EMPHASIS = 0.5;

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
       * What a bead's *own* name is offset by — its glass. See `labels.ts`: the
       * clearance every other name keeps from a bead and the offset of the
       * bead's own name are different questions.
       */
      ownRadius: new Float32Array(n),
      /** Drawn silhouette radius, in the same isotropic screen units. */
      glassRadius: new Float32Array(n),
      /** 1 for a bead inside the lens's disc this frame (I-017). */
      lensed: new Float32Array(n),
      /**
       * The opening's own three arrivals, per bead: where it stands in the
       * salience order the world assembles in, and this frame's condensation.
       * See `scene/opening.ts` — the world used to switch on.
       */
      arrivalRank: new Int32Array(n),
      drawn: new Float32Array(n),
      light: new Float32Array(n),
      gather: new Float32Array(n),
      /** The eased idle kindling, kept apart from what is handed to the glass. */
      kindled: new Float32Array(n),
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

  /** Per-pair contact memory. Outside React: it changes every frame. */
  const contacts = useRef(createContactTracker(count));

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
    focusedId: null as string | null,
  });

  live.current.focusedId = focusedBeadId;
  /**
   * Which bead the player is attending, read during render because the
   * promotion attending performs on that bead's *name* is a change of type — a
   * larger setting on a ground of its own — and that is a property of the
   * label, not a number the frame loop can write. Everything the frame loop
   * needs about attention it reads from the one focus view (`sampleFocusView`).
   */
  const attendedId =
    draft.stage === "inactive" ? null : String(draft.attendedConceptId);

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

  /**
   * How long this draw has been assembling, in real milliseconds, and whether
   * the order it assembles in has been taken yet. A ref for the same reason:
   * this changes every frame and must never re-render the arena.
   */
  const arrival = useRef({ elapsed: 0, ranked: false });

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
    // What the fog reads of each bead — its drawn size and its name — is sized
    // with the draw, never on a frame.
    sizeFocusFrame(count);
    // A new draw is a new invitation: the world offers again, once, to a
    // player who has not yet touched *this* arena.
    invite.current.unresolved = 1;
    invite.current.touched = false;
    // …and a new draw is a new arrival. A Game begun after a conclusion
    // assembles exactly as the first one did.
    arrival.current.elapsed = 0;
    arrival.current.ranked = false;
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

    // ── the focus view, as the hierarchy reads it (I-017) ───────────────
    // One derivation for every surface; sampled, so an unchanged world costs
    // four comparisons and no allocation. `held` — a reopened thread — has a
    // pair and no attended bead: nothing is being made, so nothing wears the
    // gold rule, and both ends of the thread are the pair.
    const view = sampleFocusView();
    const composing = view.mode !== "roaming";
    const attendingId =
      view.mode === "focus" || view.mode === "locked" ? view.attendedConceptId : null;
    const secondId = composing ? view.secondConceptId : null;
    const heldId = view.mode === "held" ? view.attendedConceptId : null;

    // The attended bead's scale is a floor *and* a dominance: at least
    // `ATTENDED_DOMINANCE` times the apparent size of every other bead, from
    // wherever the camera stands. Measured on last frame's depths and sizes,
    // which is a frame the eye cannot tell from this one.
    const attendedAt = attendingId === null ? -1 : (indexOf.get(attendingId) ?? -1);
    let attendedScale = reducedMotion ? ATTENDED_SCALE_STILL : ATTENDED_SCALE;
    if (attendedAt >= 0 && focal.depth[attendedAt] > 0) {
      let rival = 0;
      for (let k = 0; k < count; k++) {
        if (k === attendedAt || focal.hidden[k] > 0 || !(focal.depth[k] > 0)) continue;
        rival = Math.max(rival, focal.drawn[k] / focal.depth[k]);
      }
      attendedScale = Math.min(
        ATTENDED_SCALE_CEILING,
        Math.max(attendedScale, ATTENDED_DOMINANCE * rival * focal.depth[attendedAt])
      );
    }

    // ── the invitation, and whether it has been accepted ────────────────
    // The first hover, press, latch or focus ends it, once, for the session.
    if (
      !invite.current.touched &&
      (frameState.hoveredId !== null ||
        frameState.snapId !== null ||
        composing ||
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

    // ── the world assembling ────────────────────────────────────────────
    // Real milliseconds, not the clamped frame delta: the assembly is cut to
    // the departure of the title it plays under, and the title leaves on the
    // document's clock however slowly this machine is drawing.
    const assembling = arrival.current.elapsed;
    const assembly = arrivalDurationMs(count);
    if (assembling < assembly) {
      arrival.current.elapsed = Math.min(assembly, assembling + rawDt * 1000);
    }

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

      originVec.set(x, y, z);
      // ── the frame's hierarchy, measured ───────────────────────────────
      const eyeDistance = three.camera.position.distanceTo(originVec);
      focal.depth[i] = eyeDistance;
      projectVec.set(x, y, z).project(three.camera);
      const behind = projectVec.z < -1 || projectVec.z > 1;
      focal.anchor[i * 2] = projectVec.x * aspect;
      focal.anchor[i * 2 + 1] = projectVec.y;
      focal.hidden[i] =
        behind || Math.abs(projectVec.x) > 1.4 || Math.abs(projectVec.y) > 1.4
          ? 1
          : 0;

      // Who this bead is to the focus view. The second bead is the one settled
      // under the lens, the locked candidate, or the other end of a reopened
      // thread; a bead inside the lens's disc is the lens's, and comes sharp and
      // named (the fog clears it; this names it).
      const attended = attendingId === id;
      const second =
        !attended &&
        (secondId === id ||
          heldId === id ||
          (view.mode === "focus" && frameState.snapId === id));
      const hovered = frameState.hoveredId === id;
      const focused = now.focusedId === id;
      // Measured by the fog from inside the render, against the lens as it is
      // drawn — a frame old, which no eye can tell — so the names the lens is
      // over are exactly the beads it is clearing.
      const lensed =
        composing &&
        focal.hidden[i] === 0 &&
        index < focusFrame.lensed.length &&
        focusFrame.lensed[index] > 0;
      focal.lensed[i] = lensed ? 1 : 0;
      // Attention promotes a bead out of turn, and in order: the attended bead,
      // then the second, then whatever else the player's attention is on.
      // Attention is not content, and nothing here ranks a bead by its band.
      focal.promoted[i] = promotionFor(attended, second, lensed || hovered || focused);

      // The invitation is a *scale*, so it stands down the moment the player's
      // own attention arrives — a reached-for bead is never also an offer. It
      // is suppressed entirely under reduced motion, where the same invitation
      // is carried by light alone (see the kindling below).
      const invited = spark.index === i;
      const offered =
        reducedMotion || attended || second || hovered || focused
          ? 1
          : invited
            ? offer.reach
            : offer.recede;
      // Under the focus view the pointer is a lens, not a hover: a bead under
      // it is sharp and named, never swollen past the second bead.
      const target =
        (attended
          ? attendedScale
          : second
            ? SECOND_SCALE
            : composing
              ? 1
              : hovered
                ? HOVER_SCALE
                : focused
                  ? FOCUSED_SCALE
                  : 1) * offered;
      const current = scales.current[i] ?? 1;
      // Hover answers faster than it lets go: the arrival is the message.
      const rate = hovered || second || attended ? 13 : 8;
      const next = current + (target - current) * Math.min(1, dt * rate);
      scales.current[i] = next;

      // The opening's condensation is applied to what is *drawn* rather than
      // folded into the eased scale above, so the authored curve is the curve
      // on the screen and the interaction scales stay exactly what they were.
      const condensing = beadArrival(
        focal.arrivalRank[i],
        count,
        assembling,
        reducedMotion
      );
      focal.light[i] = condensing.light;
      focal.gather[i] = condensing.gather;
      const drawn = next * condensing.scale;
      focal.drawn[i] = drawn;

      const halfAtBead = Math.max(0.001, eyeDistance * tanHalfFov);
      focal.glassRadius[i] = (BEAD_RADIUS * GLASS_SCALE * drawn) / halfAtBead;
    }

    /*
     * Two beads meeting is a physical event, and it is heard before it is
     * answered: the contact is measured on the *unpushed* anchors, because the
     * separation below is the response to the collision and detecting it
     * afterwards would report every hard hit as a soft one.
     *
     * Nothing durable happens here. See `scene/contact.ts` for why this is not
     * a cue and does not reach the caption track.
     */
    contacts.current = resizeContactTracker(contacts.current, count);
    for (const contact of detectContacts(contacts.current, {
      anchor: focal.anchor,
      radius: focal.glassRadius,
      hidden: focal.hidden,
      count,
      dt,
      nowMs: presentationNow(),
    })) {
      beadClink(contact.strength, contact.size, contact.pan);
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
      const attended = attendingId === id;
      const promotion = focal.promoted[i];
      const hovered = frameState.hoveredId === id;
      const focused = now.focusedId === id;
      const drawn = focal.drawn[i];
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
      const radius = BEAD_RADIUS * GLASS_SCALE * drawn * breath;

      originVec.set(x, y, z);
      scaleVec.setScalar(radius);
      matrix.compose(originVec, identityQuat, scaleVec);
      mesh.setMatrixAt(i, matrix);
      // The fog clears exactly the glass that is drawn.
      if (index < focusFrame.radius.length) focusFrame.radius[index] = radius;

      // Light follows the same order as size: the attended bead brightest, the
      // second next, a bead under the lens lit; roaming, a hover still answers.
      const emphasis = attended
        ? 1
        : promotion >= PROMOTE_SECOND
          ? SECOND_EMPHASIS
          : focal.lensed[i] > 0
            ? LENS_EMPHASIS
            : !composing && hovered
              ? HOVER_EMPHASIS
              : focused
                ? FOCUSED_EMPHASIS
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
      // bead, which every other name keeps clear of — and the offset of the
      // bead's own name. Nothing is drawn round any bead but its glass now,
      // the attended one included (I-016), so both are the glass: the first
      // with air to spare, the second hung just off it.
      focal.beadRadius[i] = focal.glassRadius[i] + 0.06 / halfAtBead;
      focal.ownRadius[i] = focal.glassRadius[i] + 0.02;

      const label = labels.current[i];
      // Type stays the same size on screen whatever the orbit distance — and
      // the attended bead's name is set larger than every other name in the
      // frame, which is the promotion the verb has to earn.
      const typeScale =
        Math.min(2.2, Math.max(0.8, eyeDistance / 10.4)) *
        (attended ? ATTENDED_NAME_SCALE : 1);
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

    // The order the world assembles in is taken once, on the draw's first
    // frame, and then held. A stagger that re-sorted itself as the camera
    // turned would be a queue rather than an arrival — and by the time this
    // runs on that first frame the whole draw is still at `elapsed = 0`, so
    // nothing has been drawn out of order to get here.
    if (!arrival.current.ranked) {
      for (let rank = 0; rank < count; rank++) {
        focal.arrivalRank[focal.order[rank]] = rank;
      }
      arrival.current.ranked = true;
    }

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
      //
      // A bead that has not finished arriving has not gathered its tier yet:
      // the room's haze still stands in front of it, it has no specular and
      // its rim is held back. That is the whole of the arrival under reduced
      // motion, where the condensation above is suppressed — never removed,
      // and expressed in luminance instead of in size.
      const tier = focal.attribute[i * 2];
      const tierTarget = focal.tierTarget[i] * focal.light[i];
      focal.attribute[i * 2] =
        tier + (tierTarget - tier) * Math.min(1, dt * 2.6);
      const kindle = focal.kindled[i];
      // The idle score's own light, raised while the invitation stands — and
      // under reduced motion this is the whole of the invitation, because the
      // reach is travel and travel is what the preference is about.
      const wantKindle =
        spark.index === i
          ? Math.min(1, spark.gain * (1 + 0.55 * offer.light))
          : 0;
      focal.kindled[i] = kindle + (wantKindle - kindle) * Math.min(1, dt * 3.4);
      // The arrival's own gathering light rides the same channel — both are the
      // world putting light on a bead for a moment, and neither is content. It
      // is handed over unsmoothed because it is already a hump with no velocity
      // at either end, and easing a hump is how you lose it.
      focal.attribute[i * 2 + 1] = Math.max(
        focal.kindled[i],
        focal.gather[i]
      );

      const label = labels.current[i];
      const halfAtBead = Math.max(0.001, focal.depth[i] * tanHalfFov);
      if (label?.group) {
        // The solver answered in half-frame-heights, which is isotropic, so one
        // unit is the same world distance on both axes at this depth.
        //
        // The half-height is added because the solver reserves a box around its
        // *centre* and the label is anchored at its *top*: without it every name
        // is drawn half its own block lower than the clearance that was solved
        // for it. That was a few pixels while every name was one line, and it is
        // a whole line now the attended name sets over two.
        label.group.position
          .set(x, y, z)
          .addScaledVector(screenRight, focal.offset[i * 2] * halfAtBead)
          .addScaledVector(
            screenDown,
            -(focal.offset[i * 2 + 1] + focal.half[i * 2 + 1]) * halfAtBead
          );
        label.group.quaternion.copy(camQuaternion);
      }
      if (label?.text) {
        beadDir.set(x, y, z).normalize();
        const facing = smoothstep(-0.1, 0.34, camDir.dot(beadDir));
        const emphasised = focal.promoted[i] > 0;
        const attended = attendingId === id;
        // A name with nowhere legible to go is suppressed outright. Half a name
        // running off the page tells the player the world is broken; no name
        // tells them this bead is crowded, which is true and recoverable.
        const placed = focal.code[i] !== SUPPRESSED;
        // The tier carries label weight too, so the frame's first read is also
        // the frame's most legible name.
        const weight = tierWeights(focal.attribute[i * 2]).label;
        // …and a name arrives with the bead it belongs to. `light` is 0 until
        // this bead's turn in the assembly, so the world's captions are written
        // in the same order the world condenses in.
        const wanted =
          (placed ? Math.max(facing * weight, emphasised ? 1 : 0) : 0) *
          focal.light[i];
        // troika exposes fill/outline opacity as its own uniforms; the mesh's
        // `material` is undefined until it derives one, so writing to it
        // silently produced NaN and hid every label.
        const current = labelOpacity.current[i];
        const next = current + (wanted - current) * Math.min(1, dt * 9);
        labelOpacity.current[i] = next;
        const troika = label.text as unknown as TroikaText;
        troika.fillOpacity = next;
        // The attended name's ground is opaque: the measurement that opened
        // this was a peak of 175 against a background of 111–124, and a field
        // held at 0.92 is a field the horizon is still coming through.
        troika.outlineOpacity =
          next *
          (attended ? ATTENDED_NAME_OUTLINE_OPACITY : NAME_OUTLINE_OPACITY);
        label.text.visible = next > 0.02;
      }

      // What the fog reads of this bead's name: the box the solver placed, for
      // as long as the name is drawn, so a sharp bead's caption comes sharp
      // with it. A suppressed or faded name is no box at all.
      const named = index * 4 + 3 < focusFrame.names.length;
      if (named) {
        const shown = focal.code[i] !== SUPPRESSED && labelOpacity.current[i] > 0.05;
        focusFrame.names[index * 4] = shown ? focal.offset[i * 2] : 0;
        focusFrame.names[index * 4 + 1] = shown ? focal.offset[i * 2 + 1] : 0;
        focusFrame.names[index * 4 + 2] = shown ? focal.half[i * 2] : 0;
        focusFrame.names[index * 4 + 3] = shown ? focal.half[i * 2 + 1] : 0;
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
            /* Attention is a rare change, not a per-frame one, so these may be
               props: the attended name is struck on a feathered field of the
               world's own ground, which is what makes it legible over the
               horizon streak the plate is usually opened against. */
            outlineWidth={
              id === attendedId ? ATTENDED_NAME_OUTLINE : NAME_OUTLINE
            }
            outlineBlur={id === attendedId ? ATTENDED_NAME_BLUR : 0}
            outlineColor={theme.palette.ground}
            outlineOpacity={NAME_OUTLINE_OPACITY}
            maxWidth={
              id === attendedId ? ATTENDED_NAME_MAX_WIDTH : NAME_MAX_WIDTH
            }
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
