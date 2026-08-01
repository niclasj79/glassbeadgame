import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore as useVanillaStore } from "zustand";
import { useStore } from "@/state/store";
import { domainSessionStore } from "@/state/domainSession";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { GLSL_COMMON, GLSL_ENVIRONMENT } from "./glsl";
import { buildSky, CONSTELLATIONS } from "./constellations";
import { idleClock, travellingLight } from "./idle";
import { presentationProfile } from "./quality";
import { getHaloTexture } from "./textures";
import { glslFloat, VAULT } from "./firmamentGeometry";

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
 * How fast the room enters and leaves the held state of Attunement. Seconds.
 * Slow, so it reads as attention changing rather than as a light switch.
 */
const ATTUNED_EASE_SECONDS = 0.9;

function easeToward(current: number, target: number, dt: number): number {
  return current + (target - current) * Math.min(1, dt / ATTUNED_EASE_SECONDS);
}

/** Whether the canonical session is currently held in Attunement. */
function useAttuned(): boolean {
  return useVanillaStore(
    domainSessionStore,
    (state) => state.session?.attunementActive ?? false
  );
}

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

  // Primary ribs: meridians rising to the boss.
  float ribs = gbgLine(
    fract(lon * ${glslFloat(VAULT.ribs)} / GBG_TAU) - 0.5, 0.010) * above;

  // The impost course, struck once across the room at the height the vault
  // springs from. One drawn rule is what tells the eye it is indoors.
  float impost = gbgLine(colat - ${glslFloat(VAULT.impost)}, ${glslFloat(VAULT.impostWidth)});

  // The well below: graduated courses receding into the dye. Brought up from
  // colatitude 1.75 so the floor of the room is inside the frame too.
  float below = smoothstep(${glslFloat(VAULT.wellStart)}, ${glslFloat(VAULT.wellEnd)}, colat);
  float floorCourses =
    gbgLine(fract(colat * 3.2 / GBG_PI) - 0.5, 0.02) * below;

  /*
   * The engraved room, kept out of the GBG_TRACERY gate on purpose.
   *
   * The whole of the architecture used to sit behind that define, so the
   * engraved tier rendered a bare gradient, and quality.ts states the rule
   * the other way round: a lower tier "may only change the material the channel
   * is made of", never remove it. The ribs, the impost and the floor courses
   * are the room's identity; the tracery, the rose and the boss are its
   * ornament, and only the ornament is a budget decision.
   */
  vec3 ink = uEngraving * ribs * 0.5 * 0.32;
  ink += mix(uEngraving, uGold, 0.3) * impost * 0.1;
  ink += uEngraving * floorCourses * 0.09;

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

  ink += uEngraving * tracery * 0.42 * 0.32;
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
  const attuned = useAttuned();
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

  const held = useRef(0);

  useFrame((_, dt) => {
    (material.uniforms.uAwakening as { value: number }).value = frameState.awakening;
    const light = travellingLight(idleClock(), profile.reducedMotion);
    (material.uniforms.uSweepLon as { value: number }).value = light.longitude;
    (material.uniforms.uSweepColat as { value: number }).value = light.colatitude;
    (material.uniforms.uSweepGain as { value: number }).value = light.gain;
    held.current = easeToward(held.current, attuned ? 1 : 0, Math.min(dt, 1 / 20));
    (material.uniforms.uAttuned as { value: number }).value = held.current;
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
  // In Attunement the drawn figures come forward and the unaffiliated field
  // recedes — the sky becoming individually legible, exactly as the threads
  // become individually audible (spec §13).
  float attend = 1.0 + uAttuned * (aFigure > 0.5 ? 0.35 : -0.25);
  gl_PointSize = uScale * (0.6 + aMagnitude) * (1.0 + 0.3 * uFlare) * attend / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uStarlight;
uniform float uFlare;
uniform float uAttuned;
varying float vMagnitude;
varying float vFigure;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.85, r);
  float attend = 1.0 + uAttuned * (vFigure > 0.5 ? 0.45 : -0.45);
  float alpha = core * (0.25 + 0.75 * vMagnitude) * (0.75 + 0.35 * uFlare) * attend;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uStarlight, clamp(alpha, 0.0, 1.0));
}
`;

function Constellations() {
  const theme = useCurrentTheme();
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const attuned = useAttuned();
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
        },
      }),
      lineMaterial: new THREE.LineBasicMaterial({
        color: new THREE.Color(theme.palette.engraving),
        transparent: true,
        opacity: LINE_OPACITY,
        depthWrite: false,
        toneMapped: false,
        // The drawn sky is a shell at a fixed radius, not an object standing in
        // the room's depth. Leaving it on the fog path mixed better than 40% of
        // every authored figure into the ground colour before it reached the
        // frame, which is why six hand-drawn figures rendered as nothing.
        fog: false,
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

  const held = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    frameState.flare = Math.max(0, frameState.flare - dt / 1.1);
    (starMaterial.uniforms.uFlare as { value: number }).value = frameState.flare;
    held.current = easeToward(held.current, attuned ? 1 : 0, dt);
    (starMaterial.uniforms.uAttuned as { value: number }).value = held.current;
    // The drawn figures keep their orientation; only the unaffiliated field
    // turns, and slowly enough to be felt rather than watched.
    if (group.current && !reducedMotion) {
      group.current.rotation.y += dt * 0.0022 * frameState.timeScale;
    }
    const breath =
      LINE_OPACITY +
      LINE_BREATH * Math.sin(frameState.breathPhase) * frameState.breathDepth;
    lineMaterial.opacity = breath * (1 + 0.9 * held.current);
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
