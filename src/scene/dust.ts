import { mulberry32, smoothstep } from "@/lib/utils";
import { glslFloat } from "./firmamentGeometry";

/**
 * THE AIR BETWEEN THE BEADS (M4-003)
 *
 * A sparse field of dust in the shell between the instrument and the vault,
 * so the space the beads stand in is inhabited rather than empty. It carries
 * no meaning and says so: nothing about a bead's outcome, faculty or facet
 * reaches it — only where the beads are and when one of them takes light
 * (Law 8). The drift is slow and meaningless by design; it is the air, not a
 * signal.
 *
 * When a bead's light rises (its kindling lane crosses `DUST_RING_THRESHOLD`
 * from below) a ring leaves it at a fixed speed and fades over a fixed life:
 * the dust it passes brightens once and is nudged outward, so a bead's sound
 * reads as reaching the room. Under reduced motion the field holds still and
 * only brightens where a ring passes — the same information, no travel of
 * anything but light (§6).
 *
 * Every number the shader draws with is stated here and tested here; the
 * shader is generated from them, and `ringStrength`, `dustAlpha` and
 * `dustPosition` are its arithmetic restated for the tests. This module owns
 * no Three, no React and no clock.
 */

/** The most beads one frame answers. A shader array bound; a draw has at most 24. */
export const DUST_MAX_BEADS = 24;

/**
 * The shell the dust hangs in, in world units around the arena's centre.
 * Inside it: the beads (radius 3, `ARENA_RADIUS`) and the armillary's outer
 * ring (3.63). Outside it: the drawn sky (41) and the vault (48). The camera
 * rests near 15 and may orbit in to 5.2, so the near field is handled in the
 * shader by view depth (`DUST_NEAR`), not by where the dust is placed.
 */
export const DUST_SHELL = Object.freeze({ inner: 4, outer: 12 });

/** The field's own seed: the same air on every run, test mode or not. */
export const DUST_SEED = 0x0d057a1;

/** How fast a ring travels outward from its bead. World units per dilated second. */
export const DUST_RING_SPEED = 3;
/** The ring's band: a particle this far from the ring's radius has fallen to 1/e. World units. */
export const DUST_RING_BAND = 0.9;
/**
 * How long a ring lives, from its bead's onset to nothing. Dilated seconds.
 *
 * It fades as the square of the life left, not linearly: a linear fade ends
 * with a corner, and the dust the ring's leading edge is only just reaching
 * when it ends would then rise and be cut off in a tenth of a second — faint,
 * but a flicker well above 3 Hz. The square ends with no slope at all, and
 * every pulse a particle can show above one 8-bit step stays under the
 * comfort bound (`dust.test.ts` samples it).
 */
export const DUST_RING_LIFE = 1.6;
/**
 * How long a ring takes to arrive at full strength. Seconds. Without it the
 * dust nearest a bead would step from rest to lit on the frame the light
 * rises — a hard edge, which is a flicker whatever its rate (§6).
 */
export const DUST_RING_RISE = 0.25;
/** The kindling a bead's light must rise through, from below, to send a ring. */
export const DUST_RING_THRESHOLD = 0.5;
/** How far a ring at full strength nudges a particle outward. World units. */
export const DUST_RING_PUSH = 0.12;

/** One turn of the drift. Dilated seconds: far below anything watched. */
export const DUST_DRIFT_PERIOD_S = 40;
/** How far a particle drifts from its place — a few percent of the spacing. World units. */
export const DUST_DRIFT_AMPLITUDE = 0.08;

/**
 * How bright the dust is, as the alpha of the theme's vellum over the room.
 *
 * A whisper at rest: a fifth of the faintest unaffiliated star (whose peak is
 * (0.25 + 0.75 x 0.1) x 0.75 = 0.24 in `Firmament.tsx`), so the rest frame is
 * the room's and not the dust's. A ring lifts a particle to at most the
 * ceiling, which stays under the brightest unaffiliated star (0.37) and far
 * under every drawn figure; Attunement raises the rest level, as the sky's
 * drawing comes forward.
 */
export const DUST_ALPHA = Object.freeze({
  rest: 0.05,
  ring: 0.3,
  attuned: 0.15,
  ceiling: 0.35,
});

/** The view depths over which dust fades in: nothing drifts across the lens. World units. */
export const DUST_NEAR = Object.freeze({ from: 2, to: 4.5 });

/** A particle's drawn size: `scale * aSize / depth` pixels, clamped. */
export const DUST_POINT = Object.freeze({ scale: 30, min: 1.5, max: 6 });

/** The per-particle size attribute's range. */
export const DUST_SIZE = Object.freeze({ min: 0.6, max: 1.4 });

export interface DustField {
  /** xyz per particle, at rest. */
  readonly positions: Float32Array;
  /** 0..1 per particle: the drift's phase. */
  readonly seeds: Float32Array;
  /** `DUST_SIZE` per particle. */
  readonly sizes: Float32Array;
}

/**
 * Where the dust hangs, deterministically: uniform in direction and uniform in
 * radius through the shell, so the air is thickest about the instrument and
 * thins toward the vault (density falls as 1/r²).
 *
 * Not uniform in volume, which was tried first: it puts nine particles in ten
 * in the outer two thirds of the shell, where they crowd the camera, and
 * leaves a bead's ring two or three motes to light — a ring nobody could see.
 * Uniform in radius gives a ring at the base tier about eight, and the high
 * tier sixteen (`dust.test.ts`).
 */
export function buildDust(count: number, seed: number = DUST_SEED): DustField {
  const n = Math.max(0, Math.floor(count));
  const positions = new Float32Array(n * 3);
  const seeds = new Float32Array(n);
  const sizes = new Float32Array(n);
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const across = Math.sqrt(Math.max(0, 1 - u * u));
    const radius = DUST_SHELL.inner + (DUST_SHELL.outer - DUST_SHELL.inner) * rng();
    positions[i * 3] = Math.cos(theta) * across * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = Math.sin(theta) * across * radius;
    seeds[i] = rng();
    sizes[i] = DUST_SIZE.min + (DUST_SIZE.max - DUST_SIZE.min) * rng();
  }
  return { positions, seeds, sizes };
}

/* ────────────────────────────────────────────────────────────────────── *
 * THE ONSET CLOCK
 * ────────────────────────────────────────────────────────────────────── */

/** One bead's ring, between frames. */
export interface RingClock {
  /** When the travelling ring left its bead, on the dilated clock; -1 when none. */
  onset: number;
  /** The light the bead had on the last frame. */
  previous: number;
}

export function createRingClock(): RingClock {
  return { onset: -1, previous: 0 };
}

/** Forget any ring and any light, in place: a new draw starts silent. */
export function resetRingClock(clock: RingClock): void {
  clock.onset = -1;
  clock.previous = 0;
}

/**
 * One frame of a bead's ring: its age in seconds, or -1 when none travels.
 *
 * A ring starts when the light rises through the threshold from below and no
 * ring is already travelling; it lives `DUST_RING_LIFE` and is never
 * restarted while it travels, so a particle sees at most one pass per ring.
 * A clock that runs backwards (a new draw resets the frame clock) ends it.
 * Reduced motion is not an argument: the ring is light, and light is kept.
 */
export function ringClock(clock: RingClock, light: number, now: number): number {
  if (clock.onset >= 0 && (now < clock.onset || now - clock.onset >= DUST_RING_LIFE)) {
    clock.onset = -1;
  }
  const rose = clock.previous <= DUST_RING_THRESHOLD && light > DUST_RING_THRESHOLD;
  clock.previous = light;
  if (rose && clock.onset < 0) clock.onset = now;
  return clock.onset < 0 ? -1 : now - clock.onset;
}

/* ────────────────────────────────────────────────────────────────────── *
 * THE SHADER'S ARITHMETIC, RESTATED
 * ────────────────────────────────────────────────────────────────────── */

/**
 * How strongly a ring of `age` seconds lights a particle `distance` from its
 * bead, 0..1: a band travelling at `DUST_RING_SPEED`, arriving over
 * `DUST_RING_RISE` and fading, as the square of the life left, to nothing at
 * `DUST_RING_LIFE`.
 */
export function ringStrength(distance: number, age: number): number {
  if (!(age >= 0) || age >= DUST_RING_LIFE) return 0;
  const x = (distance - DUST_RING_SPEED * age) / DUST_RING_BAND;
  const left = 1 - age / DUST_RING_LIFE;
  return Math.exp(-x * x) * smoothstep(0, DUST_RING_RISE, age) * left * left;
}

/** The alpha a particle is drawn at, before its disc and its near fade. */
export function dustAlpha(ring: number, attuned: number): number {
  return Math.min(
    DUST_ALPHA.ceiling,
    DUST_ALPHA.rest + DUST_ALPHA.attuned * attuned + DUST_ALPHA.ring * Math.min(1, ring)
  );
}

/** The drift's angular rate. Radians per dilated second. */
export const DUST_DRIFT_RATE = (Math.PI * 2) / DUST_DRIFT_PERIOD_S;

/**
 * Where a particle is drawn, and how lit: the drift, then every travelling
 * ring's push away from its bead, both scaled by `motion` (0 under reduced
 * motion). `beads` is the shader's array: xyz and the ring's age per bead.
 * Writes the position into `out` and returns the ring strength summed over
 * the beads, which does not depend on `motion`.
 */
export function dustPosition(
  rest: readonly [number, number, number],
  seed: number,
  time: number,
  timeScale: number,
  motion: number,
  beads: Float32Array,
  count: number,
  out: [number, number, number]
): number {
  const theta = time * DUST_DRIFT_RATE;
  const phase = seed * Math.PI * 2;
  const reach = DUST_DRIFT_AMPLITUDE * motion * timeScale;
  const x = rest[0] + reach * Math.sin(theta + phase);
  const y = rest[1] + reach * Math.cos(theta + phase * 2);
  const z = rest[2] + reach * Math.sin(theta + phase * 3);
  let ring = 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i < Math.min(count, DUST_MAX_BEADS); i++) {
    const age = beads[i * 4 + 3];
    if (age < 0) continue;
    const ax = x - beads[i * 4];
    const ay = y - beads[i * 4 + 1];
    const az = z - beads[i * 4 + 2];
    const d = Math.hypot(ax, ay, az);
    const strength = ringStrength(d, age);
    ring += strength;
    const inv = strength / Math.max(d, 1e-3);
    px += ax * inv;
    py += ay * inv;
    pz += az * inv;
  }
  const push = DUST_RING_PUSH * motion;
  out[0] = x + px * push;
  out[1] = y + py * push;
  out[2] = z + pz * push;
  return ring;
}

/* ────────────────────────────────────────────────────────────────────── *
 * THE SHADER
 * ────────────────────────────────────────────────────────────────────── */

/**
 * The vertex stage: the arithmetic above, generated from the same constants.
 *
 * `uTime` is the dilated frame clock and appears once, at the drift's rate.
 * `uTimeScale` settles the air as time thins (Attunement, a reveal): a held
 * world holds its dust too. `uLights` is the kindling lane the ring's clock
 * reads on the CPU; the ring's own arithmetic deliberately does not multiply
 * by it — the ring is the event, and a ring times a moving light could beat
 * faster than the comfort bound (CAV-007).
 */
export const DUST_VERTEX = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uTimeScale;
uniform float uAttuned;
uniform float uMotion;
uniform vec4 uBeads[${DUST_MAX_BEADS}];
uniform float uLights[${DUST_MAX_BEADS}];
uniform int uCount;
varying float vAlpha;

const float DUST_TAU = 6.283185307179586;

void main() {
  float theta = uTime * ${glslFloat(DUST_DRIFT_RATE)};
  float phase = aSeed * DUST_TAU;
  float reach = ${glslFloat(DUST_DRIFT_AMPLITUDE)} * uMotion * uTimeScale;
  vec3 pos = position + reach * vec3(
    sin(theta + phase),
    cos(theta + phase * 2.0),
    sin(theta + phase * 3.0)
  );

  float ring = 0.0;
  vec3 push = vec3(0.0);
  for (int i = 0; i < ${DUST_MAX_BEADS}; i++) {
    if (i >= uCount) break;
    vec4 bead = uBeads[i];
    if (bead.w < 0.0) continue;
    vec3 away = pos - bead.xyz;
    float d = length(away);
    float x = (d - ${glslFloat(DUST_RING_SPEED)} * bead.w) / ${glslFloat(DUST_RING_BAND)};
    float left = max(0.0, 1.0 - bead.w / ${glslFloat(DUST_RING_LIFE)});
    float strength = exp(-x * x)
      * smoothstep(0.0, ${glslFloat(DUST_RING_RISE)}, bead.w)
      * left * left;
    ring += strength;
    push += away * (strength / max(d, 0.001));
  }
  pos += push * (${glslFloat(DUST_RING_PUSH)} * uMotion);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float depth = -mv.z;
  float near = smoothstep(${glslFloat(DUST_NEAR.from)}, ${glslFloat(DUST_NEAR.to)}, depth);
  vAlpha = near * min(
    ${glslFloat(DUST_ALPHA.ceiling)},
    ${glslFloat(DUST_ALPHA.rest)} + ${glslFloat(DUST_ALPHA.attuned)} * uAttuned
      + ${glslFloat(DUST_ALPHA.ring)} * min(ring, 1.0)
  );
  gl_PointSize = clamp(
    ${glslFloat(DUST_POINT.scale)} * aSize / max(depth, 0.1),
    ${glslFloat(DUST_POINT.min)},
    ${glslFloat(DUST_POINT.max)}
  );
  gl_Position = projectionMatrix * mv;
}
`;

/** A soft disc of the theme's vellum: the dust has no hue of its own. */
export const DUST_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uVellum;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float alpha = vAlpha * (1.0 - smoothstep(0.0, 1.0, r));
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uVellum, alpha);
}
`;
