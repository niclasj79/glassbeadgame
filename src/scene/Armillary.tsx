import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore as useVanillaStore } from "zustand";
import { useStore } from "@/state/store";
import { domainSessionStore } from "@/state/domainSession";
import { ARENA_RADIUS } from "@/game/layout";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { GLSL_COMMON } from "./glsl";
import { armillaryOrder, beadIdentity } from "./identity";
import { presentationProfile } from "./quality";
import { MAX_STATIONS, stationAnchors, type StationAnchor } from "./stations";

/**
 * THE ARMILLARY
 *
 * The beads do not float in a void; they sit in an instrument. Three principal
 * rings — a graduated prime circle and two colures — plus a tilted index ring
 * and one small circle for every boundary between faculties. The parallels are
 * therefore *derived from the draw*: they mark where Measure stops and Sound
 * begins in this particular session, which is why the arena reads as a chart
 * rather than as decoration.
 *
 * Committed threads leave stations on the prime circle at the longitudes their
 * endpoints occupy. That is topology, not a completion percentage: two threads
 * on one side of the arena look different from two threads across it. Which
 * beads are anchored is domain state (see scene/stations.ts); *where* they are
 * is per-frame state, and is resolved in the frame loop every frame so the
 * gold follows the arena through a Lens morph instead of being stamped where
 * the beads happened to be when the thread was committed.
 */

const VERTEX = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uInner;
uniform float uOuter;
uniform float uMajor;
uniform float uMinor;
uniform float uOpacity;
uniform float uBreath;
uniform float uStationCount;
uniform vec2 uStations[${MAX_STATIONS}];
uniform vec3 uBrass;
uniform vec3 uPatina;
uniform vec3 uGold;
uniform vec3 uVellum;

varying vec2 vLocal;

${GLSL_COMMON}

void main() {
  float rho = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x);
  float t = (rho - uInner) / max(uOuter - uInner, 1e-4);

  // Soft band edges: the composer renders without MSAA, so the antialiasing
  // has to live in the material.
  float band = smoothstep(0.0, 0.22, t) * smoothstep(1.0, 0.78, t);
  if (band < 0.002) discard;

  // Rolled metal is brighter toward its outer edge.
  vec3 metal = mix(uPatina, uBrass, smoothstep(0.1, 0.95, t));

  float minor = gbgLine(fract(ang * uMinor / GBG_TAU) - 0.5, 0.10) * smoothstep(0.45, 0.75, t);
  float major = gbgLine(fract(ang * uMajor / GBG_TAU) - 0.5, 0.06);
  vec3 col = mix(metal, uVellum, minor * 0.16 + major * 0.3);

  float glow = 0.0;
  for (int i = 0; i < ${MAX_STATIONS}; i++) {
    vec2 station = uStations[i];
    float on = step(float(i) + 0.5, uStationCount);
    float delta = abs(atan(sin(ang - station.x), cos(ang - station.x)));
    glow += on * station.y * exp(-pow(delta / 0.17, 2.0));
  }
  glow = clamp(glow, 0.0, 1.6);
  col += uGold * glow * 0.35;

  float alpha = band * uOpacity * (0.86 + 0.14 * uBreath) + band * glow * 0.16;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

interface RingSpec {
  readonly key: string;
  readonly radius: number;
  readonly halfWidth: number;
  readonly major: number;
  readonly minor: number;
  readonly opacity: number;
  readonly rotation: readonly [number, number, number];
  readonly position: readonly [number, number, number];
  readonly stations: boolean;
}

function ringSpecs(parallels: readonly number[], graduations: number): RingSpec[] {
  const R = ARENA_RADIUS;
  const specs: RingSpec[] = [
    {
      key: "prime",
      radius: R * 1.16,
      halfWidth: 0.062,
      major: 12,
      minor: graduations,
      opacity: 0.62,
      rotation: [-Math.PI / 2, 0, 0],
      position: [0, 0, 0],
      stations: true,
    },
    {
      key: "colure-a",
      radius: R * 1.16,
      halfWidth: 0.04,
      major: 4,
      minor: graduations / 2,
      opacity: 0.34,
      rotation: [0, 0, 0],
      position: [0, 0, 0],
      stations: false,
    },
    {
      key: "colure-b",
      radius: R * 1.16,
      halfWidth: 0.04,
      major: 4,
      minor: graduations / 2,
      opacity: 0.34,
      rotation: [0, Math.PI / 2, 0],
      position: [0, 0, 0],
      stations: false,
    },
  ];

  parallels.forEach((y, index) => {
    const r = Math.sqrt(Math.max(0.04, R * R - y * y)) * 1.03;
    specs.push({
      key: `parallel-${index}`,
      radius: r,
      halfWidth: 0.022,
      major: 6,
      minor: Math.max(12, graduations / 3),
      opacity: 0.3,
      rotation: [-Math.PI / 2, 0, 0],
      position: [0, y, 0],
      stations: false,
    });
  });

  return specs;
}

function Ring({
  spec,
  stations,
}: {
  spec: RingSpec;
  stations: readonly StationAnchor[];
}) {
  const theme = useCurrentTheme();
  const material = useMemo(() => {
    const p = theme.palette;
    const stationValues: THREE.Vector2[] = [];
    for (let i = 0; i < MAX_STATIONS; i++) stationValues.push(new THREE.Vector2());
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uInner: { value: spec.radius - spec.halfWidth },
        uOuter: { value: spec.radius + spec.halfWidth },
        uMajor: { value: spec.major },
        uMinor: { value: spec.minor },
        uOpacity: { value: spec.opacity },
        uBreath: { value: 0 },
        uStationCount: { value: 0 },
        uStations: { value: stationValues },
        uBrass: { value: new THREE.Color(p.brass) },
        uPatina: { value: new THREE.Color(p.patina) },
        uGold: { value: new THREE.Color(p.gold) },
        uVellum: { value: new THREE.Color(p.vellum) },
      },
    });
  }, [theme, spec]);

  useEffect(() => () => material.dispose(), [material]);

  /**
   * Both the breath and the stations are written here, in the frame loop.
   *
   * The stations used to be written by an effect whose dependency list named
   * the `Float32Array` they were staged in — a buffer that was refilled in
   * place, so React saw the same array identity and never re-ran the effect
   * when its contents changed. The gold went stale. There is no effect to key
   * now: the longitudes are per-frame data, and per-frame data is written by
   * the frame loop. Nothing here allocates — the `Vector2`s are the pooled
   * uniform values, and `stations` is at most `MAX_STATIONS` long.
   */
  useFrame(() => {
    (material.uniforms.uBreath as { value: number }).value =
      Math.sin(frameState.breathPhase) * frameState.breathDepth;

    if (!spec.stations) return;
    const values = material.uniforms.uStations.value as THREE.Vector2[];
    const positions = frameState.positions;
    let live = 0;
    for (let i = 0; i < stations.length && live < MAX_STATIONS; i++) {
      const station = stations[i];
      const index = frameState.beadIndex.get(station.id);
      if (index === undefined || positions.length < (index + 1) * 3) continue;
      const x = positions[index * 3];
      const z = positions[index * 3 + 2];
      // The prime circle lies in world XZ and its material works in the ring's
      // own XY, where the longitude runs the other way — hence the negation.
      values[live].set(-Math.atan2(z, x), station.weight);
      live++;
    }
    (material.uniforms.uStationCount as { value: number }).value = live;
  });

  return (
    <mesh
      material={material}
      rotation={spec.rotation as unknown as [number, number, number]}
      position={spec.position as unknown as [number, number, number]}
      renderOrder={-4}
      frustumCulled={false}
    >
      <ringGeometry
        args={[spec.radius - spec.halfWidth, spec.radius + spec.halfWidth, 192, 1]}
      />
    </mesh>
  );
}

export function Armillary() {
  const beadIds = useStore((s) => s.session?.beadIds ?? null);
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const threads = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.threads
  );
  const budget = useMemo(
    () => presentationProfile(tier, reducedMotion).budget,
    [tier, reducedMotion]
  );

  /** One small circle per boundary between two faculties in this draw. */
  const parallels = useMemo(() => {
    if (!beadIds || beadIds.length < 2) return [];
    const ordered = armillaryOrder(beadIds);
    const out: number[] = [];
    for (let i = 1; i < ordered.length; i++) {
      if (beadIdentity(ordered[i]).faculty === beadIdentity(ordered[i - 1]).faculty) {
        continue;
      }
      out.push(ARENA_RADIUS * (1 - (2 * i) / ordered.length));
    }
    return out;
  }, [beadIds]);

  const specs = useMemo(
    () => ringSpecs(parallels, budget.graduations),
    [parallels, budget.graduations]
  );

  /**
   * Which beads the web is anchored to, and how heavily. Pure domain state:
   * no position is read here, because a position is not something render is
   * allowed to know.
   */
  const stations = useMemo(() => stationAnchors(threads), [threads]);

  if (!beadIds || beadIds.length === 0) return null;

  return (
    <group>
      {specs.map((spec) => (
        <Ring key={spec.key} spec={spec} stations={stations} />
      ))}
    </group>
  );
}
