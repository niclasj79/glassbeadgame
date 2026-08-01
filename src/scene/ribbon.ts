import * as THREE from "three";
import type { WorldTheme } from "@/themes/types";
import { GLSL_COMMON } from "./glsl";
import { beadIdentity } from "./identity";
import { GLSL_RESOLUTION } from "./resolution";
import { COMFORT, type ThreadForm } from "./threadGrammar";

/**
 * THREADS AS MATERIAL, NOT AS COLOURED LINE
 *
 * One geometry and one material draw every relation. What differs between an
 * Echo and a Tension is *construction, motion and mark* — three channels the
 * shader reads from `uForm` — so a screenshot in greyscale still says which
 * reading the player made.
 *
 *   0 echo     two strands mirrored about the arc's midpoint; growth arrives
 *              from both ends at once; ticks appear at mirrored stations.
 *   1 passage  one strand, wide at the source and narrow at the destination;
 *              chevrons travel one way only; the mark's period transforms
 *              along the path from the source's rhythm to the target's.
 *   2 tension  two strands wound in opposite senses, counter-rotating within
 *              CAV-007's ±14° with continuous easing, hatched in opposing
 *              directions, over a beat that decays to a floor and stays there.
 *   3 ground   one heavy strand that passes *inside* the armillary and settles
 *              onto a base rule beneath the supported bead.
 *
 * The curve is evaluated in the vertex shader from three endpoint uniforms, so
 * moving beads cost no CPU geometry work and nothing allocates per frame.
 *
 * Two cross-cutting rules run through every branch of both shaders:
 *
 *   uResolved  reaches the picture only through `gbgThreadInk` in scene/
 *              resolution.ts, which is the accepted CAV-006 model: a documented
 *              relation and an Open Thread carry the same ink at the same
 *              strength and differ only in whether the figure closes.
 *   uMotion    is 0 for a player who has asked for reduced motion. Every
 *              time-dependent expression is written against `aTime = uTime *
 *              uMotion`, so travel and oscillation stop while the *pattern*
 *              they were carrying stays exactly where it is: a Tension thread
 *              still counter-rotates to CAV-007's bound and still hatches in
 *              opposing directions, it simply holds the pose (CAV-007's
 *              reduced-motion clause, VERTICAL-SLICE-SPEC §22).
 */

export interface RibbonGeometry {
  readonly geometry: THREE.BufferGeometry;
  readonly segments: number;
}

/**
 * Two independent strips sharing one buffer: `aStrand` is −1 on the first and
 * +1 on the second, and a one-strand form collapses the unused strip onto the
 * curve so it contributes no area.
 */
export function createRibbonGeometry(segments: number): RibbonGeometry {
  const cols = segments + 1;
  const vertsPerStrand = cols * 2;
  const total = vertsPerStrand * 2;
  const aU = new Float32Array(total);
  const aV = new Float32Array(total);
  const aStrand = new Float32Array(total);
  const position = new Float32Array(total * 3); // placeholder; vertex shader owns it
  const indices: number[] = [];

  for (let s = 0; s < 2; s++) {
    const base = s * vertsPerStrand;
    for (let i = 0; i < cols; i++) {
      for (let v = 0; v < 2; v++) {
        const index = base + i * 2 + v;
        aU[index] = i / segments;
        aV[index] = v === 0 ? -1 : 1;
        aStrand[index] = s === 0 ? -1 : 1;
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
  geometry.setAttribute("aV", new THREE.BufferAttribute(aV, 1));
  geometry.setAttribute("aStrand", new THREE.BufferAttribute(aStrand, 1));
  geometry.setIndex(indices);
  // The vertex shader places every vertex from uniforms, so bounds computed
  // from the placeholder positions would cull the whole ribbon.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return { geometry, segments };
}

const VERTEX = /* glsl */ `
attribute float aU;
attribute float aV;
attribute float aStrand;

uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uM;
uniform float uTime;
uniform float uMotion;
uniform float uWidth;
uniform float uForm;
uniform float uStrands;
uniform float uTorsion;
uniform float uBeat;
uniform float uUnrest;
uniform float uGrow;
uniform float uSettle;

varying float vU;
varying float vV;
varying float vStrand;
varying float vTaper;

${GLSL_COMMON}

vec3 gbgBezier(float t) {
  float it = 1.0 - t;
  return it * it * uA + 2.0 * it * t * uM + t * t * uB;
}

void main() {
  // Animated time. Reduced motion sets uMotion to 0, which freezes travel and
  // oscillation without touching amplitude, construction or bound.
  float aTime = uTime * uMotion;

  float t = clamp(aU, 0.0, 1.0);
  vU = t;
  vV = aV;
  vStrand = aStrand;

  vec3 p = gbgBezier(t);
  vec3 ahead = gbgBezier(min(t + 0.02, 1.0));
  vec3 behind = gbgBezier(max(t - 0.02, 0.0));
  vec3 tangent = normalize(ahead - behind);
  vec3 radial = normalize(p + vec3(1e-5));
  vec3 side = normalize(cross(tangent, radial));
  vec3 up = normalize(cross(side, tangent));

  int form = int(uForm + 0.5);
  float width = uWidth;
  float twist = 0.0;
  vec3 offset = vec3(0.0);
  float taper = 1.0;

  if (form == 0) {
    // Echo — mirrored pair. Separation is symmetric about the midpoint, so
    // neither end is privileged and the figure reads the same reversed.
    float sep = uWidth * (1.15 + 0.85 * sin(t * GBG_PI));
    offset = side * aStrand * sep;
    taper = 0.8 + 0.35 * sin(t * GBG_PI);
  } else if (form == 1) {
    // Passage — one strand. Wide where it leaves, narrow where it arrives:
    // the material itself changes along the path.
    taper = mix(1.45, 0.55, t);
    twist = t * 0.9;
    offset = vec3(0.0);
  } else if (form == 2) {
    // Tension — counter-wound pair. The helix is construction; the bounded
    // oscillation on top of it is the counter-motion, and it never resolves.
    float wind = t * GBG_TAU * 1.35 * aStrand;
    // uTorsion is CAV-007's accepted bound and is used at face value. It was
    // multiplied by 4 here, which put each strand at +/-56 degrees and, since
    // the strands counter-rotate, ~112 degrees of visible relative counter-
    // motion — eight times the envelope. The grammar test asserted the value
    // going *into* this uniform, so it passed while the render broke the bound.
    // A bound that a shader is free to scale is not a bound.
    //
    // Under reduced motion aTime is 0 and this becomes sin(t * 2.1) — a
    // *static* counter-rotation that still varies along the arc and still
    // opposes between the strands. The Tension is held, not removed (CAV-007).
    float sway = uTorsion * uUnrest * sin(GBG_TAU * uBeat * aTime + t * 2.1) * aStrand;
    float angle = wind + sway;
    float sep = uWidth * (1.25 + 0.35 * uUnrest);
    offset = (side * cos(angle) + up * sin(angle)) * sep;
    twist = sway;
    taper = 0.85;
  } else {
    // Ground — one strand, seated. It arrives from below and comes to rest.
    taper = mix(1.6, 1.15, t);
    offset = up * (-uWidth * 0.9) * (1.0 - uSettle) * (1.0 - abs(t * 2.0 - 1.0));
    twist = 0.0;
  }

  // A one-strand form collapses its second strip so it draws no area.
  float live = (uStrands > 1.5 || aStrand < 0.0) ? 1.0 : 0.0;
  width *= taper * live;
  vTaper = taper;

  vec3 crossDir = side * cos(twist) + up * sin(twist);
  vec3 world = p + offset * live + crossDir * aV * width;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uInk;
uniform vec3 uMarkColor;
uniform float uTime;
uniform float uMotion;
uniform float uForm;
uniform float uTravel;
uniform float uOpacity;
uniform float uGrow;
uniform float uUnrest;
uniform float uResolved;
uniform float uRhythmA;
uniform float uRhythmB;

varying float vU;
varying float vV;
varying float vStrand;
varying float vTaper;

${GLSL_COMMON}
${GLSL_RESOLUTION}

void main() {
  float aTime = uTime * uMotion;

  int form = int(uForm + 0.5);
  float across = abs(vV);

  // The thread's own growth coordinate: 0 at the ends it grew from, 1 where
  // the figure closes. Echo and Tension arrive from both beads and close in
  // the middle; Passage and Ground close at the destination. Both the reveal
  // and CAV-006's terminal read this one coordinate, so "where it closes" is
  // stated once per form instead of twice.
  float mirrored = (form == 0 || form == 2) ? 1.0 : 0.0;
  float closure = mix(vU, min(vU, 1.0 - vU) * 2.0, mirrored);

  // CAV-006, in one call. Documented ink is dry and closes; open ink has
  // spread to the full width of the nib and stops short. Same quantity of ink,
  // same peak strength — see scene/resolution.ts, where the spread is solved
  // rather than tuned, and measured by test.
  float body = gbgThreadInk(across, closure, uResolved);

  float mark = 0.0;
  float reveal = 1.0;

  if (form == 0) {
    // Echo — growth arrives from both ends at once, and the ticks it leaves
    // sit at mirrored stations.
    reveal = 1.0 - smoothstep(uGrow, uGrow + 0.12, closure);
    float station = fract(closure * 5.0 - aTime * uTravel);
    mark = (1.0 - smoothstep(0.0, 0.18, station)) * body;
  } else if (form == 1) {
    // Passage — chevrons that only ever travel one way, over a mark period
    // that transforms from the source's rhythm into the destination's.
    reveal = 1.0 - smoothstep(uGrow, uGrow + 0.14, closure);
    float period = mix(uRhythmA, uRhythmB, vU);
    float phase = fract(vU * period - aTime * uTravel * 3.0);
    mark = step(phase, 0.5 - 0.42 * across) * body;
  } else if (form == 2) {
    // Tension — the two strands hatch in opposing directions and never agree.
    reveal = 1.0 - smoothstep(uGrow, uGrow + 0.12, closure);
    float slope = vStrand;
    float hatch = fract(vU * 22.0 + vV * slope * 2.2 + aTime * 0.16 * slope);
    mark = step(hatch, 0.34) * body;
  } else {
    // Ground — a heavy strand with its weight declared along the lower edge.
    reveal = 1.0 - smoothstep(uGrow, uGrow + 0.16, closure);
    mark = smoothstep(0.55, 0.95, -vV) * body;
    mark = max(mark, gbgLine(vV, 0.12) * 0.35 * body);
  }

  vec3 col = mix(uInk, uMarkColor, mark * 0.85);
  float alpha = body * uOpacity * reveal;
  // Deliberately NOT modulated by uUnrest. A settled Tension used to render
  // about 22% dimmer than an Echo, which is the "one kind pays better" failure
  // CAV-006 forbids for outcomes, applied instead to intentions — a player who
  // sees Tension fade learns it is worth less. CAV-007's decay governs the
  // *amplitude of the instability*, and that is already carried by the sway in
  // the vertex stage and by the beat; spending ink on it a second time costs
  // legibility for nothing. Every relation is equally present.
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export interface RibbonUniformSeed {
  readonly theme: WorldTheme;
  readonly form: ThreadForm;
  readonly ink: THREE.Color;
  readonly width: number;
  readonly opacity: number;
  /**
   * The player's reduced-motion preference. It sets exactly one uniform, and
   * that uniform scales time — never amplitude, opacity, construction or
   * bound. Reduced motion may take away the travel; it may not take away the
   * relation (VERTICAL-SLICE-SPEC §22, CAV-007).
   */
  readonly reducedMotion: boolean;
}

export function createRibbonMaterial(seed: RibbonUniformSeed): THREE.ShaderMaterial {
  const { theme, form } = seed;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uA: { value: new THREE.Vector3() },
      uB: { value: new THREE.Vector3(0, 0, 0.001) },
      uM: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uMotion: { value: seed.reducedMotion ? 0 : 1 },
      uWidth: { value: seed.width },
      uForm: { value: form.code },
      uStrands: { value: form.strands },
      uTorsion: { value: form.torsion },
      uBeat: { value: form.beatHz },
      uUnrest: { value: 1 },
      uGrow: { value: 1 },
      uSettle: { value: 1 },
      uInk: { value: seed.ink.clone() },
      uMarkColor: { value: new THREE.Color(theme.palette.vellum) },
      uTravel: { value: form.travel },
      uOpacity: { value: seed.opacity },
      uResolved: { value: 1 },
      uRhythmA: { value: 7 },
      uRhythmB: { value: 7 },
    },
  });
  material.name = `castalia.thread.${form.intention}`;
  return material;
}

/** Unrest amplitude for a Tension thread, exported for the frame loop. */
export const UNREST_FLOOR = COMFORT.unrestFloor;

/** One geometry per segment count, shared by every ribbon at that tier. */
const geometryCache = new Map<number, THREE.BufferGeometry>();

export function ribbonGeometry(segments: number): THREE.BufferGeometry {
  const hit = geometryCache.get(segments);
  if (hit) return hit;
  const built = createRibbonGeometry(segments).geometry;
  geometryCache.set(segments, built);
  return built;
}

/**
 * The ink a relation is drawn in: the two beads' faculty inks averaged and
 * then pulled most of the way back toward the world's engraving colour. A
 * thread is a drawn line first and a coloured line fourth — the construction,
 * the motion and the mark have already said what it is.
 */
export function threadInk(theme: WorldTheme, a: string, b: string): THREE.Color {
  const ink = new THREE.Color(beadIdentity(a).ink);
  ink.lerp(new THREE.Color(beadIdentity(b).ink), 0.5);
  return new THREE.Color(theme.palette.engraving).lerp(ink, theme.inkSaturation);
}

/** Mark period along a Passage thread at one end, derived from that bead's figure. */
export function rhythmOf(id: string): number {
  const sigil = beadIdentity(id).sigil;
  return 4 + sigil.symmetry + Math.round(sigil.density * 4);
}
