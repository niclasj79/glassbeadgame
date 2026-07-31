import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { GLSL_COMMON, GLSL_ENVIRONMENT } from "./glsl";
import { buildSky } from "./constellations";
import { presentationProfile } from "./quality";
import { getHaloTexture } from "./textures";

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
 */

const SKY_RADIUS = 48;

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

varying vec3 vDir;

${GLSL_COMMON}
${GLSL_ENVIRONMENT}

void main() {
  vec3 dir = normalize(vDir);
  vec3 col = gbgEnvironment(dir);

#if GBG_TRACERY
  float lon = atan(dir.z, dir.x);
  float colat = acos(clamp(dir.y, -1.0, 1.0));
#endif

#if GBG_TRACERY
  // Above the springing line the room becomes architecture.
  float above = smoothstep(1.42, 0.95, colat);

  // Primary ribs: twelve meridians rising to the boss.
  float ribs = gbgLine(fract(lon * 12.0 / GBG_TAU) - 0.5, 0.010) * above;

  float tracery = 0.0;
  float rose = 0.0;

  // Transverse arcs: the vault's courses.
  for (int i = 0; i < 4; i++) {
    tracery = max(tracery, gbgLine(colat - (0.42 + float(i) * 0.23), 0.005));
  }
  tracery *= above;

  // The rose window at the zenith: two rings, twelve mullions, twelve foils.
  float roseR = colat / 0.34;
  if (roseR < 1.35) {
    float n = 12.0;
    float cell = fract(lon * n / GBG_TAU) - 0.5;
    float mullion = gbgLine(cell, 0.028) * step(0.26, roseR) * step(roseR, 1.0);
    float rings = max(gbgLine(roseR - 1.0, 0.03), gbgLine(roseR - 0.25, 0.035));
    vec2 pc = vec2(cell * (GBG_TAU / n) * max(roseR, 0.2) * 1.6, roseR - 0.63);
    float foil = gbgLine(length(pc) - 0.15, 0.028);
    rose = max(max(mullion, rings), foil);
  }
  col += uEngraving * (ribs * 0.5 + tracery * 0.3) * 0.32;
  col += mix(uEngraving, uGold, 0.45) * rose * 0.3;

  // The boss: a single point of gold leaf directly overhead.
  col += uGold * smoothstep(0.09, 0.0, colat) * 0.28;

  // The well below: graduated courses receding into the dye.
  float below = smoothstep(1.75, 2.6, colat);
  col += uEngraving * gbgLine(fract(colat * 3.2 / GBG_PI) - 0.5, 0.02) * below * 0.05;
#endif

  // The room brightens a little as the web fills; never a percentage bar.
  col *= 1.0 + 0.18 * uAwakening;

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
      },
    });
  }, [theme, profile.budget.vaultTracery]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    (material.uniforms.uAwakening as { value: number }).value = frameState.awakening;
  });

  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 64, 48]} />
    </mesh>
  );
}

const STAR_VERTEX = /* glsl */ `
attribute float aMagnitude;
uniform float uScale;
uniform float uFlare;
varying float vMagnitude;
void main() {
  vMagnitude = aMagnitude;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uScale * (0.6 + aMagnitude) * (1.0 + 0.3 * uFlare) / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uStarlight;
uniform float uFlare;
varying float vMagnitude;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.85, r);
  float alpha = core * (0.25 + 0.75 * vMagnitude) * (0.75 + 0.35 * uFlare);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uStarlight, alpha);
}
`;

function Constellations() {
  const theme = useCurrentTheme();
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
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

  const { starGeometry, lineGeometry, starMaterial, lineMaterial } = useMemo(() => {
    const stars = new THREE.BufferGeometry();
    stars.setAttribute("position", new THREE.BufferAttribute(sky.starPositions, 3));
    stars.setAttribute("aMagnitude", new THREE.BufferAttribute(sky.starMagnitudes, 1));
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
        },
      }),
      lineMaterial: new THREE.LineBasicMaterial({
        color: new THREE.Color(theme.palette.engraving),
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        toneMapped: false,
      }),
    };
  }, [sky, theme.palette.starlight, theme.palette.engraving]);

  useEffect(
    () => () => {
      starGeometry.dispose();
      lineGeometry.dispose();
      starMaterial.dispose();
      lineMaterial.dispose();
    },
    [starGeometry, lineGeometry, starMaterial, lineMaterial]
  );

  useFrame((_, dt) => {
    frameState.flare = Math.max(0, frameState.flare - dt / 1.1);
    (starMaterial.uniforms.uFlare as { value: number }).value = frameState.flare;
    // The drawn figures keep their orientation; only the unaffiliated field
    // turns, and slowly enough to be felt rather than watched.
    if (group.current && !reducedMotion) {
      group.current.rotation.y += dt * 0.0022 * frameState.timeScale;
    }
    const breath = 0.085 + 0.03 * Math.sin(frameState.breathPhase) * frameState.breathDepth;
    lineMaterial.opacity = breath;
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
