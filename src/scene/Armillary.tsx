import { useEffect, useMemo, useRef } from "react";
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
import { idleClock, precession, travellingLight } from "./idle";
import { armillaryRings, type RingSpec } from "./rings";
import { MAX_STATIONS, stationAnchors, type StationAnchor } from "./stations";

/**
 * THE ARMILLARY
 *
 * The beads do not float in a void; they sit in an instrument. A graduated
 * prime circle, two colures, a tilted index ring, and one small circle for
 * every boundary between faculties. The parallels are therefore *derived from
 * the draw*: they mark where Measure stops and Sound begins in this particular
 * session, which is why the arena reads as a chart rather than as decoration.
 *
 * Where the rings *are* — their nesting, and the clearance that keeps every
 * one of them outside the widest a bead ever reaches — is geometry, and lives
 * in `scene/rings.ts` where it can be measured. What is decided here is how
 * brass looks:
 *
 *   PROFILE. The band is rolled, not painted: two bright arrises with a hollow
 *   between them. A single gradient across the width reads as a printed
 *   stripe, which is what the rings used to be.
 *
 *   DEPTH. Every ring is weighted by where it stands in the room — brightest
 *   at the limb, receding on the far side, and deliberately held back on the
 *   near side, so brass passing in front of a bead reads as brass over glass
 *   rather than as a scratch through it.
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
varying vec3 vWorld;
void main() {
  vLocal = position.xy;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uInner;
uniform float uOuter;
uniform float uRadius;
uniform float uMajor;
uniform float uMinor;
uniform float uOpacity;
uniform float uPresence;
uniform float uBreath;
uniform float uCreep;
uniform float uSweep;
uniform float uSweepGain;
uniform float uStationCount;
uniform vec2 uStations[${MAX_STATIONS}];
uniform vec3 uBrass;
uniform vec3 uPatina;
uniform vec3 uGold;
uniform vec3 uVellum;

varying vec2 vLocal;
varying vec3 vWorld;

${GLSL_COMMON}

void main() {
  float rho = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x);
  float t = (rho - uInner) / max(uOuter - uInner, 1e-4);

  // Soft band edges: the composer renders without MSAA, so the antialiasing
  // has to live in the material. Tighter than it was, because the profile
  // below needs the edges to be edges.
  float band = smoothstep(0.0, 0.13, t) * smoothstep(1.0, 0.87, t);
  if (band < 0.002) discard;

  // THE PROFILE. A rolled band has two bright arrises and a hollow between
  // them; a single gradient across the width reads as a printed stripe.
  float across = min(t, 1.0 - t) * 2.0;
  float arris = 1.0 - smoothstep(0.0, 0.40, across);
  float hollow = smoothstep(0.28, 0.96, across);
  vec3 metal = mix(uPatina, uBrass, 0.30 + 0.70 * arris);
  metal = mix(metal, uPatina * 0.70, hollow * 0.5);

  // THE ENGRAVING. Minor divisions bite only in the hollow, where a graver
  // would reach; major divisions cross the whole band. A ring that maps onto
  // itself when it turns creeps its graduations instead (scene/idle.ts).
  float eng = ang + uCreep;
  float minor = gbgLine(fract(eng * uMinor / GBG_TAU) - 0.5, 0.10) * hollow;
  float major = gbgLine(fract(eng * uMajor / GBG_TAU) - 0.5, 0.06);
  vec3 col = mix(metal, uVellum, minor * 0.18 + major * 0.34);

  // DEPTH IN THE ROOM. Negative in front of the arena's centre, positive
  // behind it, +/-1 at the limb of this ring.
  float toFragment = length(vWorld - cameraPosition);
  float toCentre = length(cameraPosition);
  float rel = clamp((toFragment - toCentre) / max(uRadius, 1e-3), -1.0, 1.0);
  float limb = 1.0 - abs(rel);
  // Brightest where the ring turns edge-on, receding behind, and deliberately
  // held back in front so a ring crossing a bead reads as brass passing over
  // glass rather than as a scratch through it.
  float weight = mix(0.42, 1.0, pow(limb, 0.75));
  float behind = smoothstep(0.05, 0.9, rel);
  col = mix(col, uPatina * 0.8, behind * 0.45);

  float glow = 0.0;
  for (int i = 0; i < ${MAX_STATIONS}; i++) {
    vec2 station = uStations[i];
    float on = step(float(i) + 0.5, uStationCount);
    float delta = abs(atan(sin(ang - station.x), cos(ang - station.x)));
    glow += on * station.y * exp(-pow(delta / 0.17, 2.0));
  }
  glow = clamp(glow, 0.0, 1.6);
  col += uGold * glow * 0.35;

  // THE TRAVELLING LIGHT. One event crosses the world every fifteen seconds
  // and the brass takes it as brass does: a pass along the arris, brightest
  // where the band is already turning edge-on.
  float toLight = abs(atan(sin(ang - uSweep), cos(ang - uSweep)));
  float pass = exp(-pow(toLight / 0.30, 2.0)) * uSweepGain;
  col += mix(uVellum, uBrass, 0.4) * pass * (0.18 + 0.62 * arris) * limb;

  float alpha = band * uOpacity * weight * (0.86 + 0.14 * uBreath)
              + band * glow * 0.16 * weight
              + band * pass * 0.10 * weight;
  gl_FragColor = vec4(col, clamp(alpha * uPresence, 0.0, 1.0));
}
`;

/**
 * HOW PRESENT THE BRASS IS WHILE THE TITLE IS BEING READ.
 *
 * VC-05: "the ochre rings run straight through the wordmark and the eyebrow
 * with no contrast management". The composition answers half of that — the
 * title is composed concentrically now (`framing.titleComposition`), so the
 * letterforms sit inside the instrument rather than beside it — and this
 * answers the other half from the side that can: the brass is held back while
 * the title is on the page, and comes up to full as the world opens.
 *
 * It is not a fade-in trick. A room with a title over it is a room being
 * *read past*, and an instrument that is fully struck behind running text is
 * an instrument competing with it. The local contrast under the letterforms
 * themselves is the DOM's to manage; only the DOM knows where they are.
 */
const TITLE_PRESENCE = 0.72;
/** Seconds the brass takes to come up. One camera phrase, near enough. */
const PRESENCE_EASE_SECONDS = 1.05;

function Ring({
  spec,
  stations,
  presence,
  reducedMotion,
}: {
  spec: RingSpec;
  stations: readonly StationAnchor[];
  presence: number;
  reducedMotion: boolean;
}) {
  const theme = useCurrentTheme();
  const turn = useRef<THREE.Group>(null);
  const material = useMemo(() => {
    const p = theme.palette;
    const stationValues: THREE.Vector2[] = [];
    for (let i = 0; i < MAX_STATIONS; i++) stationValues.push(new THREE.Vector2());
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uInner: { value: spec.radius - spec.halfWidth },
        uOuter: { value: spec.radius + spec.halfWidth },
        uRadius: { value: Math.hypot(spec.radius, spec.position[1]) },
        uMajor: { value: spec.major },
        uMinor: { value: spec.minor },
        uOpacity: { value: spec.opacity },
        uPresence: { value: 1 },
        uBreath: { value: 0 },
        uCreep: { value: 0 },
        uSweep: { value: 0 },
        uSweepGain: { value: 0 },
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
  const held = useRef(presence);

  useFrame((_, rawDt) => {
    (material.uniforms.uBreath as { value: number }).value =
      Math.sin(frameState.breathPhase) * frameState.breathDepth;

    const dt = Math.min(rawDt, 1 / 20);
    held.current +=
      (presence - held.current) * Math.min(1, dt / PRESENCE_EASE_SECONDS);
    (material.uniforms.uPresence as { value: number }).value = held.current;

    // THE IDLE SCORE, at this ring's own rate. The turn is applied to a group
    // about the world's axis rather than folded into the ring's own Euler, so
    // an obliquity that was authored stays authored and only the node moves.
    const clock = idleClock();
    const group = turn.current;
    if (group) {
      group.rotation.y = precession(spec.precession, clock, reducedMotion);
    }
    (material.uniforms.uCreep as { value: number }).value = precession(
      spec.creep,
      clock,
      reducedMotion
    );
    const light = travellingLight(clock, reducedMotion);
    (material.uniforms.uSweep as { value: number }).value = light.longitude;
    (material.uniforms.uSweepGain as { value: number }).value = light.gain;

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
    <group ref={turn}>
      <mesh
        material={material}
        rotation={spec.rotation as unknown as [number, number, number]}
        position={spec.position as unknown as [number, number, number]}
        renderOrder={spec.order}
        frustumCulled={false}
      >
        <ringGeometry
          args={[
            spec.radius - spec.halfWidth,
            spec.radius + spec.halfWidth,
            192,
            1,
          ]}
        />
      </mesh>
    </group>
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

  /**
   * One small circle per boundary between two faculties in this draw — and
   * none at all before there is a draw, because a parallel says where Measure
   * stops and Sound begins and there is nothing yet to say it about.
   */
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
    () => armillaryRings(parallels, budget.graduations),
    [parallels, budget.graduations]
  );

  /**
   * Which beads the web is anchored to, and how heavily. Pure domain state:
   * no position is read here, because a position is not something render is
   * allowed to know.
   */
  const stations = useMemo(() => stationAnchors(threads), [threads]);

  const phase = useStore((s) => s.phase);
  const presence =
    phase === "title" || phase === "setup" ? TITLE_PRESENCE : 1;

  /**
   * THE INSTRUMENT EXISTS BEFORE THE DRAW DOES.
   *
   * This used to return `null` until a session had beads, so the title screen
   * was type over an empty sky and the opening camera move — a pure axial dolly
   * from 15.2 to 10.4 — acted on nothing with any parallax. Frame-diffing the
   * press showed 0.3% of pixels changing in the first 808 ms, and the largest
   * deltas were star twinkle.
   *
   * The armillary is the instrument the Game is played on; the beads are one
   * evening's draw on it. Standing the empty instrument in the title frame
   * costs four rings, gives the opening move something to turn, and means the
   * player's first press moves a thing they were already looking at.
   */
  return (
    <group>
      {specs.map((spec) => (
        <Ring
          key={spec.key}
          spec={spec}
          stations={stations}
          presence={presence}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
