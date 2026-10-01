import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore as useVanillaStore } from "zustand";
import { useStore } from "@/state/store";
import { domainSessionStore } from "@/state/domainSession";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { GLSL_COMMON, GLSL_ENVIRONMENT } from "./glsl";
import { castaliaConceptById } from "@/content/castalia/concepts";
import type { CommittedThreadV1 } from "@/domain/model";
import { buildSky, CONSTELLATIONS } from "./constellations";
import {
  FIGURE_BASE,
  FIGURE_COUNT,
  easeReveal,
  figureReveal,
} from "./constellationReveal";
import { idleClock, travellingLight } from "./idle";
import { presentationProfile } from "./quality";
import { getHaloTexture } from "./textures";
import { glslFloat, VAULT } from "./firmamentGeometry";
import {
  LEVEL_COLATITUDE,
  LEVEL_WIDTH,
  WALL_FOOT,
  floorCourses,
} from "./firmamentRoom";

/**
 * THE FIRMAMENT
 *
 * Not a sky box of stars: a room. One inverted shell carries the whole world —
 * the dyed darkness of the well below, the vellum-lit band at the instrument's
 * own level, and the ribbed vault overhead closing on a rose window. The same
 * `gbgEnvironment` function is what every bead refracts, so the glass and the
 * room agree by construction rather than by matching swatches.
 *
 * The constellations are drawn objects, not noise: six authored figures from
 * `scene/constellations.ts`, with a sparse unaffiliated field between them.
 *
 * ── Why the largest surface in the product had no identity on it ────────────
 *
 * All of the above was true of the source and none of it was true of the
 * pixels. Two separate causes, both measured against the default camera (fov
 * 42°, at [0, 0.5, 15.2] looking at the arena — so it sees roughly −23° to
 * +21° of elevation):
 *
 *  1. **The architecture was authored above the frustum.** `above` opened at
 *     colatitude 1.42 (about 9° of elevation) and only reached full strength at
 *     0.95 (33°), the transverse courses started at colatitude 0.42 (66°), the
 *     rose window lives inside 26° of the zenith, and `gbgEnvironment`'s own
 *     vault is gated on `y > 0.42` (25°). At the very top row of the frame the
 *     ribs therefore rendered at about a third of their intended strength and
 *     everything else rendered at zero. The room was a vaulted room in a
 *     direction nobody was looking. The springing line has been brought down to
 *     the height a standing figure would see it at, the courses now walk the
 *     whole vault instead of only its crown, and the well below the instrument
 *     has been given its courses inside the frame. The rose and the boss stay
 *     where they were: looking up is still worth doing.
 *
 *  2. **The drawn figures were being erased by fog.** The constellation lines
 *     are a `LineBasicMaterial`, which is fog-enabled by default, hung at
 *     radius 41 in a world whose fog runs from 16 to 74 — so better than 40% of
 *     every figure was mixed into `#070912` before it reached the frame, on top
 *     of a base opacity of 0.1. Six hand-drawn figures were resolving to
 *     nothing at all, which is the entire difference between a starfield and a
 *     firmament. The sky's shell is not *in* the room's depth, so it is off the
 *     fog path now and drawn at a strength a figure can be read at.
 */

const SKY_RADIUS = 48;

/**
 * The strength an authored figure's line is drawn at, and how far it breathes.
 *
 * It was 0.085–0.115 *before* the fog took another 40%. Six figures that were
 * drawn by hand and hung at fixed bearings arrived as an empty gradient. This
 * is the level at which a figure reads as a figure and still stays behind
 * everything in the room.
 */
const LINE_OPACITY = 0.26;
const LINE_BREATH = 0.05;

/**
 * ── THE ROOM WHERE THE INSTRUMENT IS NOT ────────────────────────────────────
 *
 * B5, measured at 1440x810 on the golden seed: the instrument's silhouette
 * stood in the left 59% of the page and the remaining 40% carried two nav
 * pills, a mute button, the page's rule "and three stray light streaks". The
 * streaks were this shader: two transverse courses and the impost, arriving at
 * a strength the eye reads as lens flare because *nothing else in that part of
 * the frame was drawn*. A sphere fitted to the ruled height of a 16:9 page
 * covers 44% of its width and no framing decision changes that (see
 * `framing.REST_SUBJECT_BOX`), so the width the instrument cannot fill has to
 * be filled by the room — or it is a hole, which is what a stranger judged.
 *
 * The level, the floor and the wall's foot are stated in `firmamentRoom.ts`,
 * next to the vault's own geometry and under the same discipline: the
 * description the tests measure is the description that renders. What is
 * decided *here* is how hard each of them is struck, and every one of those
 * numbers used to resolve below the level a floor-subtracted luminance
 * measurement can see.
 */

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uGold;
uniform float uAwakening;
uniform float uSweepLon;
uniform float uSweepColat;
uniform float uSweepGain;
uniform float uAttuned;

varying vec3 vDir;

${GLSL_COMMON}
${GLSL_ENVIRONMENT}

void main() {
  vec3 dir = normalize(vDir);
  vec3 col = gbgEnvironment(dir);

  float skyLon = atan(dir.z, dir.x);
  float skyColat = acos(clamp(dir.y, -1.0, 1.0));

  float lon = skyLon;
  float colat = skyColat;

  /*
   * The springing line: where the wall stops and the vault begins.
   *
   * This used to open at colatitude 1.42 and reach full strength at 0.95 —
   * that is, between 9 and 33 degrees of elevation, when the default camera can
   * see about 21. The room's architecture was drawn almost entirely above the
   * frame. It springs from a little below the instrument's own level now, which
   * is where a standing figure sees an impost course, and closes on the crown
   * exactly as before.
   */
  float above = smoothstep(${glslFloat(VAULT.springing)}, ${glslFloat(VAULT.crown)}, colat);

  /*
   * The wall the ribs stand on. The ramp above opens at the springing line,
   * which is where the *vault* begins; a rib that only exists above it is a
   * rib with nothing under it, and at the level itself that ramp was at 18%.
   * The ribs run from below the frame's own floor now, so the room has
   * verticals standing on horizontals (B5).
   */
  float wall = smoothstep(${glslFloat(WALL_FOOT)}, ${glslFloat(VAULT.crown)}, colat);

  // Primary ribs: meridians rising from the floor to the boss.
  float ribs = gbgLine(
    fract(lon * ${glslFloat(VAULT.ribs)} / GBG_TAU) - 0.5, 0.010) * wall;

  /*
   * The minor order. Twelve ribs put one meridian every 30 degrees, and the
   * arena's field of view is 66 wide — so the wall the instrument does not
   * cover carried two verticals and nothing between them. A wall with a major
   * and a minor order is the oldest way of giving a plain surface a rhythm,
   * and it is the one mark in this room that reads at every orbit rather than
   * only where a course happens to cross the frame.
   */
  float minorRibs = gbgLine(
    fract(lon * ${glslFloat(VAULT.ribs * 2)} / GBG_TAU) - 0.5, 0.006) * wall;

  // The impost course, struck once across the room at the height the vault
  // springs from. One drawn rule is what tells the eye it is indoors.
  float impost = gbgLine(colat - ${glslFloat(VAULT.impost)}, ${glslFloat(VAULT.impostWidth)});

  // THE LEVEL. The one rule the whole composition is measured from: the
  // instrument's own horizon, struck rather than glowed, and reaching the side
  // of the page the instrument never gets to.
  float level = gbgLine(colat - ${glslFloat(Number(LEVEL_COLATITUDE.toFixed(5)))}, ${glslFloat(LEVEL_WIDTH)});

  // THE FLOOR. Courses receding on a plane one eye-height below the level.
  float floorCourses = 0.0;
${floorCourses()
  .map(
    (course) =>
      `  floorCourses = max(floorCourses, gbgLine(colat - ${glslFloat(
        course.colatitude
      )}, ${glslFloat(course.width)}) * ${glslFloat(course.weight)});`
  )
  .join("\n")}

  /*
   * The engraved room, kept out of the GBG_TRACERY gate on purpose.
   *
   * The whole of the architecture used to sit behind that define, so the
   * engraved tier rendered a bare gradient, and quality.ts states the rule
   * the other way round: a lower tier "may only change the material the channel
   * is made of", never remove it. The ribs, the impost and the floor courses
   * are the room's identity; the tracery, the rose and the boss are its
   * ornament, and only the ornament is a budget decision.
   *
   * THE STRENGTHS. Every one of these used to resolve below the level a
   * floor-subtracted luminance measurement can see: the ribs peaked at 16% of
   * the engraving colour and the floor at 4% of it once its presence ramp was
   * counted — about 47 and 10 of 255, over a ground that already sits near 20.
   * Drawn architecture that cannot be told from its own background is not
   * architecture; it is the "stray light streaks" B5 measured. They are struck
   * at the strength a fine line on dark vellum is actually struck at — and no
   * higher: the instrument is still the brightest thing in the room, and the
   * room is still behind everything.
   */
  vec3 ink = uEngraving * ribs * 0.32;
  ink += uEngraving * minorRibs * 0.13;
  ink += mix(uEngraving, uBrass, 0.5) * impost * 0.14;
  ink += mix(uEngraving, uBrass, 0.55) * level * 0.34;
  ink += mix(uEngraving, uBrass, 0.4) * floorCourses * 0.22;

#if GBG_TRACERY
  float tracery = 0.0;
  float rose = 0.0;

  // Transverse arcs: the vault's courses. The ladder in firmamentGeometry.ts
  // is chosen so two of them cross the default view at a strength the eye can
  // read; the old one put its lowest course at colatitude 1.11, above the frame.
  for (int i = 0; i < ${VAULT.courseCount}; i++) {
    tracery = max(tracery, gbgLine(
      colat - (${glslFloat(VAULT.courseFirst)} + float(i) * ${glslFloat(VAULT.courseStep)}),
      ${glslFloat(VAULT.courseWidth)}));
  }
  tracery *= above;

  // The rose window at the zenith: two rings, twelve mullions, twelve foils.
  // Deliberately left overhead. Looking up should still be worth doing.
  float roseR = colat / ${glslFloat(VAULT.roseUnit)};
  if (roseR < ${glslFloat(VAULT.roseReach)}) {
    float n = 12.0;
    float cell = fract(lon * n / GBG_TAU) - 0.5;
    float mullion = gbgLine(cell, 0.028) * step(0.26, roseR) * step(roseR, 1.0);
    float rings = max(gbgLine(roseR - 1.0, 0.03), gbgLine(roseR - 0.25, 0.035));
    vec2 pc = vec2(cell * (GBG_TAU / n) * max(roseR, 0.2) * 1.6, roseR - 0.63);
    float foil = gbgLine(length(pc) - 0.15, 0.028);
    rose = max(max(mullion, rings), foil);
  }

  // The vault's courses, quieter than they were. These are the "three stray
  // light streaks" B5 saw in the empty right of the frame: at 0.134 of the
  // engraving colour, and with nothing else drawn anywhere near them, two long
  // shallow arcs across an empty sky read as lens flare rather than as a
  // ceiling. They are part of a room now — a level, a floor, ribs and an impost
  // — and a part is allowed to be quieter than a solo.
  ink += uEngraving * tracery * 0.10;
  ink += mix(uEngraving, uGold, 0.45) * rose * 0.3;
  // The boss: a single point of gold leaf directly overhead.
  ink += uGold * smoothstep(0.09, 0.0, colat) * 0.28;
#endif

  /*
   * ATTUNEMENT (spec §13). Not a brightening — a change of attention. The
   * atmosphere falls back and the drawing comes forward, so the room becomes
   * *legible* rather than louder. Total light is close to unchanged; what
   * changes is how much of it is structure.
   */
  col *= 1.0 - 0.16 * uAttuned;
  col += ink * (1.0 + 0.85 * uAttuned);

  // The room brightens a little as the web fills; never a percentage bar.
  col *= 1.0 + 0.18 * uAwakening;

  // THE TRAVELLING LIGHT (scene/idle.ts): a shaft crosses the room on a
  // fifteen-second cycle, leaning as it goes. Luminance, not travel, so
  // reduced motion keeps it.
  // Narrow. A wide one is not a shaft, it is an exposure change: at sigma 0.62
  // in longitude this lifted the whole visible sky and read as the lights being
  // turned up, which is a worse defect than the stillness it was fixing.
  float dLon = abs(atan(sin(skyLon - uSweepLon), cos(skyLon - uSweepLon)));
  float dColat = abs(skyColat - uSweepColat);
  float shaft = exp(-pow(dLon / 0.17, 2.0)) * exp(-pow(dColat / 0.44, 2.0));
  col += mix(uHorizon, uVellum, 0.5) * shaft * uSweepGain * 0.115;

  gl_FragColor = vec4(col, 1.0);
}
`;

function Vault() {
  const theme = useCurrentTheme();
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const profile = useMemo(
    () => presentationProfile(tier, reducedMotion),
    [tier, reducedMotion]
  );

  const material = useMemo(() => {
    const p = theme.palette;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      defines: profile.budget.vaultTracery
        ? { GBG_TRACERY: "1" }
        : { GBG_TRACERY: "0", GBG_CHEAP_ENV: "1" },
      uniforms: {
        uGround: { value: new THREE.Color(p.ground) },
        uDepth: { value: new THREE.Color(p.depth) },
        uHorizon: { value: new THREE.Color(p.horizon) },
        uVellum: { value: new THREE.Color(p.vellum) },
        uBrass: { value: new THREE.Color(p.brass) },
        uEngraving: { value: new THREE.Color(p.engraving) },
        uGold: { value: new THREE.Color(p.gold) },
        uKey: { value: new THREE.Vector3(...theme.keyLight).normalize() },
        uAwakening: { value: 0 },
        uSweepLon: { value: 0 },
        uSweepColat: { value: Math.PI / 2 },
        uSweepGain: { value: 0 },
        uAttuned: { value: 0 },
      },
    });
  }, [theme, profile.budget.vaultTracery]);

  useEffect(() => () => material.dispose(), [material]);

  /** The theme's depth colour, which the held state deepens from (ADR-018). */
  const restingDepth = useMemo(
    () => new THREE.Color(theme.palette.depth),
    [theme.palette.depth]
  );

  useFrame(() => {
    (material.uniforms.uAwakening as { value: number }).value = frameState.awakening;
    const light = travellingLight(idleClock(), profile.reducedMotion);
    (material.uniforms.uSweepLon as { value: number }).value = light.longitude;
    (material.uniforms.uSweepColat as { value: number }).value = light.colatitude;
    (material.uniforms.uSweepGain as { value: number }).value = light.gain;
    // The held state, as `Cosmos` stepped it: the drawing comes forward and the
    // void deepens, together with everything else that answers it.
    (material.uniforms.uAttuned as { value: number }).value = frameState.attuned.value;
    (material.uniforms.uDepth as { value: THREE.Color }).value
      .copy(restingDepth)
      .multiplyScalar(frameState.attunedAnswers.depthScale);
  });

  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 64, 48]} />
    </mesh>
  );
}

const STAR_VERTEX = /* glsl */ `
attribute float aMagnitude;
attribute float aFigure;
uniform float uScale;
uniform float uFlare;
uniform float uAttuned;
varying float vMagnitude;
varying float vFigure;
void main() {
  vMagnitude = aMagnitude;
  vFigure = aFigure;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // In Attunement the unaffiliated field recedes, so the drawn figures stand
  // out; the figures themselves keep their size and brighten only as the
  // threads' voices enter (the fragment stage, ADR-018).
  float attend = aFigure > 0.5 ? 1.0 : 1.0 - 0.25 * uAttuned;
  gl_PointSize = uScale * (0.6 + aMagnitude) * (1.0 + 0.3 * uFlare) * attend / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uStarlight;
uniform float uFlare;
uniform float uAttuned;
uniform float uFigureGain;
varying float vMagnitude;
varying float vFigure;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.85, r);
  // The drawn figures brighten with the voices heard in this hold, to at most
  // half again their rest (uFigureGain, attuned.ts); the field recedes.
  float attend = vFigure > 0.5 ? uFigureGain : 1.0 - 0.45 * uAttuned;
  float alpha = core * (0.25 + 0.75 * vMagnitude) * (0.75 + 0.35 * uFlare) * attend;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uStarlight, clamp(alpha, 0.0, 1.0));
}
`;

/**
 * The drawn figures' lines. Each figure belongs to one pair of faculties and
 * is drawn at its own strength (`uReveal`), so the sky assembles as the web
 * joins the regions it stands for — see scene/constellationReveal.ts. The
 * reveal is looked up in the vertex stage from a per-vertex figure index,
 * with a constant-bound loop rather than a dynamic index, so it runs on
 * every GLSL the room may be drawn with.
 */
const LINE_VERTEX = /* glsl */ `
attribute float aFigure;
uniform float uReveal[${FIGURE_COUNT}];
varying float vReveal;
void main() {
  int index = int(aFigure + 0.5);
  float reveal = 0.0;
  for (int i = 0; i < ${FIGURE_COUNT}; i++) {
    if (i == index) reveal = uReveal[i];
  }
  vReveal = reveal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LINE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uBase;
varying float vReveal;
void main() {
  float alpha = uOpacity * mix(uBase, 1.0, clamp(vReveal, 0.0, 1.0));
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

const NO_THREADS: readonly CommittedThreadV1[] = Object.freeze([]);

const facultyOfConcept = (conceptId: string) =>
  castaliaConceptById.get(conceptId)?.faculty;

function Constellations() {
  const theme = useCurrentTheme();
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  /**
   * Which faculties the web has joined, read from the canonical session so a
   * replayed log lights the same sky. The outcome of a thread is not read: a
   * documented crossing and an unlit one join the same two regions.
   */
  const threads = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.threads ?? NO_THREADS
  );
  const revealTarget = useMemo(
    () => figureReveal(threads, facultyOfConcept),
    [threads]
  );
  const reveal = useRef(new Float32Array(FIGURE_COUNT));
  const budget = useMemo(
    () => presentationProfile(tier, reducedMotion).budget,
    [tier, reducedMotion]
  );
  const group = useRef<THREE.Group>(null);

  const sky = useMemo(
    () =>
      buildSky(
        SKY_RADIUS * 0.86,
        budget.constellationFigures,
        budget.fieldStars
      ),
    [budget.constellationFigures, budget.fieldStars]
  );

  /**
   * Which stars belong to an authored figure. `buildSky` writes the figures
   * first and the unaffiliated field after, in the drawing order the pack
   * declares, so the split is the sum of the drawn figures' star counts.
   */
  const figureFlags = useMemo(() => {
    const figureStars = CONSTELLATIONS.slice(
      0,
      Math.max(0, budget.constellationFigures)
    ).reduce((n, f) => n + f.stars.length, 0);
    const flags = new Float32Array(sky.starMagnitudes.length);
    for (let i = 0; i < flags.length; i++) flags[i] = i < figureStars ? 1 : 0;
    return flags;
  }, [sky, budget.constellationFigures]);

  const { starGeometry, lineGeometry, starMaterial, lineMaterial } = useMemo(() => {
    const stars = new THREE.BufferGeometry();
    stars.setAttribute("position", new THREE.BufferAttribute(sky.starPositions, 3));
    stars.setAttribute("aMagnitude", new THREE.BufferAttribute(sky.starMagnitudes, 1));
    stars.setAttribute("aFigure", new THREE.BufferAttribute(figureFlags, 1));
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.BufferAttribute(sky.linePositions, 3));
    lines.setAttribute("aFigure", new THREE.BufferAttribute(sky.lineFigures, 1));
    return {
      starGeometry: stars,
      lineGeometry: lines,
      starMaterial: new THREE.ShaderMaterial({
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uStarlight: { value: new THREE.Color(theme.palette.starlight) },
          uScale: { value: 155 },
          uFlare: { value: 0 },
          uAttuned: { value: 0 },
          uFigureGain: { value: 1 },
        },
      }),
      // The drawn sky is a shell at a fixed radius, not an object standing in
      // the room's depth. Leaving it on the fog path mixed better than 40% of
      // every authored figure into the ground colour before it reached the
      // frame, which is why six hand-drawn figures rendered as nothing. A
      // ShaderMaterial is off the fog path unless it asks for it.
      lineMaterial: new THREE.ShaderMaterial({
        vertexShader: LINE_VERTEX,
        fragmentShader: LINE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color(theme.palette.engraving) },
          uOpacity: { value: LINE_OPACITY },
          uBase: { value: FIGURE_BASE },
          uReveal: { value: new Float32Array(FIGURE_COUNT) },
        },
      }),
    };
  }, [sky, figureFlags, theme.palette.starlight, theme.palette.engraving]);

  useEffect(
    () => () => {
      starGeometry.dispose();
      lineGeometry.dispose();
      starMaterial.dispose();
      lineMaterial.dispose();
    },
    [starGeometry, lineGeometry, starMaterial, lineMaterial]
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    frameState.flare = Math.max(0, frameState.flare - dt / 1.1);
    (starMaterial.uniforms.uFlare as { value: number }).value = frameState.flare;
    (starMaterial.uniforms.uAttuned as { value: number }).value = frameState.attuned.value;
    const figureGain = frameState.attunedAnswers.figureGain;
    (starMaterial.uniforms.uFigureGain as { value: number }).value = figureGain;
    // The drawn figures keep their orientation; only the unaffiliated field
    // turns, and slowly enough to be felt rather than watched.
    if (group.current && !reducedMotion) {
      group.current.rotation.y += dt * 0.0022 * frameState.timeScale;
    }
    const breath =
      LINE_OPACITY +
      LINE_BREATH * Math.sin(frameState.breathPhase) * frameState.breathDepth;
    (lineMaterial.uniforms.uOpacity as { value: number }).value = breath * figureGain;
    // The figures assemble toward what the web has joined — a fade, not a
    // snap, and the same under reduced motion, because nothing travels.
    easeReveal(reveal.current, revealTarget, dt);
    const uReveal = lineMaterial.uniforms.uReveal as { value: Float32Array };
    uReveal.value.set(reveal.current);
  });

  const haloTexture = useMemo(() => getHaloTexture(), []);
  void haloTexture; // shared texture cache is warmed here for the burst pool

  return (
    <group ref={group} renderOrder={-9}>
      <points geometry={starGeometry} material={starMaterial} frustumCulled={false} />
      <lineSegments geometry={lineGeometry} material={lineMaterial} frustumCulled={false} />
    </group>
  );
}

/** The whole world behind the instrument: vault, well, and drawn sky. */
export function Firmament() {
  return (
    <group>
      <Vault />
      <Constellations />
    </group>
  );
}
