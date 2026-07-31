import * as THREE from "three";
import type { WorldTheme } from "@/themes/types";
import { GLSL_COMMON, GLSL_ENVIRONMENT, GLSL_FIGURE, GLSL_SETTING } from "./glsl";
import type { SceneBudget } from "./quality";

/**
 * THE BEAD IS A LENS
 *
 * One material draws all twenty-four beads. It is not a sphere with a colour
 * on it: the fragment refracts the view ray into the bead, marches the chord
 * it makes inside the glass, and accumulates the concept's own figure as ink
 * seen *through* thickness. The rim reflects the same environment function the
 * firmament is drawn with, so a bead is unmistakably an object in this room.
 *
 * Three channels carry meaning, and only the fourth is hue:
 *   figure   the concept's authored construction, drawn as line
 *   collar   the faculty's construction geometry, cut into the setting
 *   marks    countable graduations (resonance) and gold pips (degree)
 *   ink      the faculty's colour, at the world's `inkSaturation`
 *
 * Instanced: one draw call for every bead in the draw. Per-instance data is
 * written into pre-allocated Float32Arrays; nothing here allocates per frame.
 */

/** Layout of the per-instance buffers this material expects. */
export const GLASS_ATTRIBUTES = Object.freeze({
  /** (familyCode, symmetry, density, turbulence) — see scene/sigil.ts. */
  sigil: "aSigil",
  /** Faculty ink, linear rgb. */
  ink: "aInk",
  /** (settingCode, gilded, phase, authored). */
  set: "aSet",
  /** (emphasis, resonance 0–1, degree, attended) — rewritten every frame. */
  state: "aState",
});

const VERTEX = /* glsl */ `
attribute vec4 aSigil;
attribute vec3 aInk;
attribute vec4 aSet;
attribute vec4 aState;

varying vec3 vLocal;
varying vec3 vLocalCam;
varying vec4 vSigil;
varying vec3 vInk;
varying vec4 vSet;
varying vec4 vState;

void main() {
  vSigil = aSigil;
  vInk = aInk;
  vSet = aSet;
  vState = aState;
  vLocal = position;

  #ifdef USE_INSTANCING
    mat4 place = modelMatrix * instanceMatrix;
  #else
    mat4 place = modelMatrix;
  #endif

  vec4 world = place * vec4(position, 1.0);
  vec3 center = place[3].xyz;
  float scale = max(length(place[0].xyz), 1e-4);
  vLocalCam = (cameraPosition - center) / scale;

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIor;
uniform float uInkSaturation;
uniform vec3 uGold;
uniform vec3 uPatina;

varying vec3 vLocal;
varying vec3 vLocalCam;
varying vec4 vSigil;
varying vec3 vInk;
varying vec4 vSet;
varying vec4 vState;

${GLSL_COMMON}
${GLSL_ENVIRONMENT}
${GLSL_FIGURE}
${GLSL_SETTING}

void main() {
  vec3 n = normalize(vLocal);
  vec3 camDir = normalize(vLocalCam - vLocal);
  float ndv = max(dot(n, camDir), 0.0);
  float fres = pow(1.0 - ndv, 4.0);

  // The figure is drawn in a frame that faces the viewer, so a bead is
  // identifiable at a glance from anywhere on the armillary. Its per-bead
  // phase keeps twenty-four beads from sharing one orientation.
  vec3 fz = normalize(vLocalCam);
  vec3 upv = abs(fz.y) > 0.94 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 fx = normalize(cross(upv, fz));
  vec3 fy = cross(fz, fx);
  float ph = vSet.z;
  vec3 rx = fx * cos(ph) - fy * sin(ph);
  vec3 ry = fx * sin(ph) + fy * cos(ph);

  float emphasis = clamp(vState.x, 0.0, 1.0);
  float gilded = vSet.y;
  float widthBias = 1.0 + emphasis * 0.55;

  vec3 inkCol = mix(uEngraving, vInk, uInkSaturation);
  inkCol = mix(inkCol, uGold, gilded);

  float ink = 0.0;
  vec3 col;

#if GBG_ENGRAVED
  // The engraved tier: the figure is cut into a plate rather than suspended
  // in glass. A different picture of the same bead, not a broken one.
  vec3 q = vec3(dot(n, rx), dot(n, ry), 0.0);
  ink = gbgFigure(q, vSigil, uTime, widthBias * 1.25);
  vec3 plate = mix(uDepth, uPatina, 0.5) + uHorizon * 0.5;
  col = plate * (0.55 + 0.7 * ndv);
  col = mix(col, inkCol * 1.5, clamp(ink * 1.6, 0.0, 1.0));
  col += mix(uEngraving, uGold, gilded) * smoothstep(0.5, 1.0, fres) * 0.6;
#else
  vec3 rd = refract(-camDir, n, 1.0 / uIor);
  float tExit = -2.0 * dot(vLocal, rd);
  for (int i = 0; i < GBG_STEPS; i++) {
    float f = (float(i) + 0.5) / float(GBG_STEPS);
    vec3 p = vLocal + rd * tExit * f;
    vec3 q = vec3(dot(p, rx), dot(p, ry), dot(p, fz));
    float d = gbgFigure(q, vSigil, uTime, widthBias);
    ink += d * (1.0 - ink);
  }
  ink = clamp(ink * 1.3, 0.0, 1.0);

  vec3 body = gbgEnvironment(rd);
#if GBG_DISPERSION
  // Flint glass splits the world it carries. Only at the two indices that
  // matter; a full spectral march buys nothing at this size.
  body.r = gbgEnvironment(refract(-camDir, n, 1.0 / (uIor * 0.982))).r;
  body.b = gbgEnvironment(refract(-camDir, n, 1.0 / (uIor * 1.018))).b;
#endif
  vec3 rimCol = gbgEnvironment(reflect(-camDir, n));

  // Glass gathers light. Without a transmission floor a lens in a dark room
  // is just a black ball, and the figure inside it has nothing to sit on.
  col = body * 0.85 + uHorizon * 0.55 + uVellum * 0.035;
  col = mix(col, inkCol * 1.5, ink);
  col = mix(col, rimCol + uHorizon * 0.35, fres * 0.5);

  float spec = pow(max(dot(reflect(-camDir, n), normalize(uKey)), 0.0), 90.0);
  col += uVellum * spec * 1.1;
  col += mix(uEngraving, uGold, gilded) * smoothstep(0.66, 1.0, fres) * 0.42;
#endif

  // The setting: engraved metal, and the only faculty channel that survives
  // a greyscale print.
  vec2 uv = vec2(dot(n, rx), dot(n, ry));
  float resonance = clamp(vState.y, 0.0, 1.0);
  float majors = 4.0 + floor(resonance * 8.0 + 0.5);
  float collar = gbgSetting(uv, vSet.x, majors);
  vec3 collarCol = mix(uPatina, uBrass, 0.25 + 0.75 * ndv) * 1.25;
  col = mix(col, collarCol, collar * (0.82 + 0.18 * emphasis));

  // Degree: one gold pip per committed thread, up to four. Countable.
  float degree = vState.z;
  float pips = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    if (fi < degree) {
      float a0 = 1.5707963 + (fi - (min(degree, 4.0) - 1.0) * 0.5) * 0.24;
      vec2 pp = uv - 0.905 * vec2(cos(a0), sin(a0));
      pips = max(pips, 1.0 - smoothstep(0.0, 0.03, length(pp)));
    }
  }
  col = mix(col, uGold, pips * 0.92);

  // Attended: a full gold rule around the setting. One bead wears it.
  float rule = gbgLine(length(uv) - 0.993, 0.009);
  col = mix(col, uGold, rule * clamp(vState.w, 0.0, 1.0) * 0.95);

  // Weight: the underside of a bead is not as lit as its top.
  col *= 0.84 + 0.16 * smoothstep(-1.0, 1.0, dot(n, normalize(uKey)));
  col *= 1.0 + emphasis * 0.24;

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface BeadGlassOptions {
  readonly theme: WorldTheme;
  readonly budget: SceneBudget;
}

/**
 * A recompile is cheaper than a branch: step count, dispersion and the
 * engraved path are `#define`s, so the shader a device runs contains only the
 * work that device's tier asked for.
 */
export function beadGlassDefines(budget: SceneBudget): Record<string, string> {
  return {
    GBG_STEPS: String(Math.max(1, budget.glassSteps)),
    GBG_DISPERSION: budget.dispersion ? "1" : "0",
    GBG_ENGRAVED: budget.engravedGlass ? "1" : "0",
  };
}

export function createBeadGlassMaterial(
  options: BeadGlassOptions
): THREE.ShaderMaterial {
  const { theme, budget } = options;
  const p = theme.palette;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    defines: beadGlassDefines(budget),
    uniforms: {
      uTime: { value: 0 },
      uIor: { value: theme.refraction },
      uInkSaturation: { value: theme.inkSaturation },
      uGround: { value: new THREE.Color(p.ground) },
      uDepth: { value: new THREE.Color(p.depth) },
      uHorizon: { value: new THREE.Color(p.horizon) },
      uVellum: { value: new THREE.Color(p.vellum) },
      uBrass: { value: new THREE.Color(p.brass) },
      uEngraving: { value: new THREE.Color(p.engraving) },
      uGold: { value: new THREE.Color(p.gold) },
      uPatina: { value: new THREE.Color(p.patina) },
      uKey: { value: new THREE.Vector3(...theme.keyLight).normalize() },
    },
    toneMapped: false,
  });
  material.name = "castalia.beadGlass";
  return material;
}
