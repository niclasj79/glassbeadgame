import * as THREE from "three";
import type { WorldTheme } from "@/themes/types";
import { GLSL_COMMON, GLSL_ENVIRONMENT, GLSL_FIGURE, GLSL_SETTING } from "./glsl";
import type { SceneBudget } from "./quality";

/**
 * THE BEAD IS A LENS
 *
 * One material draws all twenty-four beads. It is not a sphere with a colour
 * on it: the fragment solves the sphere the proxy geometry stands for, refracts
 * the view ray into it, marches the chord it makes inside the glass, and lets
 * the ray leave the far surface bent — so the room behind a bead is *carried*
 * by it, compressed and inverted near the rim, and split into colour where the
 * deviation is steepest. The rim reflects the same environment function the
 * firmament is drawn with, so a bead is unmistakably an object in this room.
 *
 * Three channels carry meaning, and only the fourth is hue:
 *   figure   the concept's authored construction, drawn as line
 *   collar   the faculty's construction geometry, cut into the setting
 *   marks    the resonance band, as graduations on the collar
 *   ink      the faculty's colour, at the world's `inkSaturation`
 *
 * There was a fifth: a row of gold marks, one per committed thread, up to four.
 * That is a per-bead score readout — a persistent counter of connections in the
 * middle of the world, which VERTICAL-SLICE-SPEC §19 excludes from core play
 * and product law 7 forbids outright. Being woven is now a change in the
 * *material*: the glass gathers more light and holds its figure more strongly,
 * continuously and with diminishing returns, so there is nothing to count.
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
  /** (emphasis, resonance 0–1, woven 0–1, attended) — rewritten every frame. */
  state: "aState",
});

/**
 * How much light a bead's glass has gathered, given how many threads meet at
 * it. Deliberately not a count:
 *
 *  - it saturates, so the first thread changes the material most and the tenth
 *    changes it barely at all;
 *  - it is continuous, and the frame loop eases toward it over about a second,
 *    so the value on screen at any instant is usually between two degrees;
 *  - it drives transmission and ink depth, which no player can read backwards
 *    into an integer the way they could read four gold marks.
 *
 * A bead that is carried into the composition looks like it has been carried
 * into the composition. It does not display a score.
 */
export const WOVEN_SCALE = 2.4;

export function wovenLight(degree: number): number {
  if (!(degree > 0)) return 0;
  return 1 - Math.exp(-degree / WOVEN_SCALE);
}

/* ------------------------------------------------------------------ optics */

/**
 * THE OPTICS, AS SHARED NUMBERS
 *
 * Everything below is a pure function of the glass, exported so a test can
 * measure it, and emitted as GLSL from the same constants so the GPU runs the
 * model the tests measure rather than a second one that happens to resemble it.
 * This is the pattern `scene/resolution.ts` and `scene/sigil.ts` already use.
 */

/** Rec.709 weights. The emitted GLSL carries these same three numbers. */
const LUMA = Object.freeze([0.2126, 0.7152, 0.0722] as const);

/**
 * The value every bead's ink is drawn at, in linear luminance.
 *
 * A faculty's ink used to be mixed toward the world's engraving colour and left
 * there, and gold leaf was mixed in on top. The four gilded concepts therefore
 * came out about a third brighter than the ungilded ones, and at the 40–60px a
 * bead actually occupies that is the difference between a figure you can read
 * and a figure you can only tell is present. Gilding is a hue and a flourish
 * now; it is not allowed to be the source of contrast. 0.56 is the value the
 * gold leaf already had, so nothing got darker to make this true.
 */
export const INK_VALUE = 0.56;

/**
 * How far behind the far surface of a bead the room it carries is taken to be,
 * in bead radii. A transmitted ray has to be followed to *something*; following
 * it to a fixed distance is the approximation every real-time transmission
 * makes, and the distance is the whole art of it. Too far and every ray lands
 * on empty sky before it reaches anything — a bead sitting on a gold band shows
 * a patch of night instead of the band. This is about one world unit, roughly
 * the depth of the ring cage the beads are mounted in, so a bead carries its own
 * surroundings: undeviated through the middle, and turning over toward the rim
 * as the deviation climbs.
 */
export const TRANSMIT_SPAN = 4.5;

/** Index split between the red and blue images. Flint glass, not a rainbow. */
export const DISPERSION_SPLIT = 0.018;

/**
 * The proxy the beads are drawn with is a coarse sphere that *circumscribes*
 * the bead, and the surface is solved per fragment. Before, the drawn polygon
 * was the bead: a forty-sided silhouette, wobbling by a pixel from facet to
 * facet, which at 2× read exactly like a compression artifact. Fewer triangles
 * now, and a mathematically round edge.
 */
export const BEAD_PROXY_SEGMENTS = Object.freeze({ width: 24, height: 16 });

/**
 * A little more than the circumscribing factor, because a proxy that only just
 * contains the sphere leaves the silhouette to floating-point luck.
 */
const PROXY_MARGIN = 1.004;

/**
 * Scale that lifts a `SphereGeometry` of these segment counts off the unit
 * sphere until every one of its faces lies outside it — which is what makes the
 * solved silhouette a complete circle rather than a circle with bites in it.
 */
export function beadProxyScale(
  widthSegments: number,
  heightSegments: number
): number {
  const lon = Math.cos(Math.PI / Math.max(3, widthSegments));
  const lat = Math.cos(Math.PI / (2 * Math.max(2, heightSegments)));
  return PROXY_MARGIN / (lon * lat);
}

const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

/** Rec.709 relative luminance of a linear colour. */
export function relativeLuminance(
  rgb: readonly [number, number, number]
): number {
  return LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2];
}

/** The same colour, at `INK_VALUE`. Hue and chroma are untouched. */
export function inkAtValue(
  rgb: readonly [number, number, number]
): [number, number, number] {
  const scale = INK_VALUE / Math.max(relativeLuminance(rgb), 1e-3);
  return [rgb[0] * scale, rgb[1] * scale, rgb[2] * scale];
}

/**
 * How far a ray is bent by passing through a solid sphere of index `ior`,
 * entering at impact parameter `h` — 0 through the middle, 1 at the rim.
 *
 * `2 * (asin(h) - asin(h / ior))` is exact for a sphere: the ray refracts by
 * `asin(h) - asin(h / ior)` on the way in and, because the sphere is symmetric
 * about the chord, by the same again on the way out. It is also the reason a
 * bead can never total-internally-reflect on a single pass, which is why this
 * closed form needs no branch for the case where `refract()` returns nothing.
 *
 * At the world's own index of 1.52 a ray at the rim leaves nearly a right angle
 * away from the one that arrived. That is what makes the armillary band inside
 * a bead compress, turn over, and run the other way.
 */
export function sphereDeviation(impact: number, ior: number): number {
  const h = clamp01(impact);
  return 2 * (Math.asin(h) - Math.asin(clamp01(h / Math.max(ior, 1))));
}

/**
 * Schlick's approximation: the fraction of light a glass surface reflects
 * rather than transmits, at a given cosine of incidence.
 *
 * This is the strongest single cue that a thing is glass and not a disc, and
 * the bead had none of it: the grazing edge was drawn dimmer than the middle.
 * It goes to 1 at the silhouette for any index, which is why the rim of a bead
 * is now the brightest part of it.
 */
export function rimGather(ndv: number, ior: number): number {
  const f0 = ((ior - 1) / (ior + 1)) ** 2;
  return f0 + (1 - f0) * (1 - clamp01(ndv)) ** 5;
}

/**
 * The stretch of the chord worth marching, given where the refracted ray enters
 * (`entryDotDir` is the entry point dotted with the ray, always ≤ 0) and how
 * far the figure reaches (`bound`, from `scene/sigil.ts`).
 *
 * The march used to spread its samples along the whole chord. For a figure that
 * fills half the bead that spends half of them on empty glass, and the three or
 * four that land on the drawing land at different lateral offsets because the
 * ray is bent — which is precisely how you get a torn figure with a doubled
 * ghost of itself beside it. Clipping to the figure's own bounding sphere puts
 * every sample where there is something to see.
 */
export function chordMarchInterval(
  entryDotDir: number,
  bound: number
): readonly [number, number] {
  const chord = -2 * entryDotDir;
  const disc = entryDotDir * entryDotDir - (1 - bound * bound);
  if (disc <= 0) return [0, chord];
  const root = Math.sqrt(disc);
  const near = Math.max(0, -entryDotDir - root);
  const far = Math.min(chord, -entryDotDir + root);
  return far > near ? [near, far] : [0, chord];
}

/**
 * The size of the buffer the room behind the beads is drawn into, or `null` for
 * a tier that does not carry the room at all.
 *
 * It is deliberately far below the frame's own resolution. A transmitted image
 * is bent, compressed and inverted before it is seen, so its detail is spent
 * long before its resolution is; and the softness a low buffer gives it reads
 * as the thickness of the glass rather than as a lack of pixels. The engraved
 * tier gets none: a plate does not transmit, so there is nothing to draw.
 */
export function backdropResolution(
  budget: SceneBudget,
  width: number,
  height: number
): { readonly width: number; readonly height: number } | null {
  if (budget.engravedGlass) return null;
  const scale = budget.glassSteps >= 12 ? 0.5 : 0.36;
  const longest = Math.max(width, height, 1);
  const capped = Math.min(scale, 640 / longest, 1);
  return {
    width: Math.max(2, Math.round(width * capped)),
    height: Math.max(2, Math.round(height * capped)),
  };
}

/** GLSL literal: a shader rejects an integer where a float belongs. */
const glslFloat = (value: number): string => value.toFixed(6);

/**
 * The same optics, as GLSL, generated from the same constants. Nothing in the
 * fragment shader below restates any of these numbers.
 */
const GLSL_OPTICS = /* glsl */ `
float gbgLuma(vec3 c) {
  return dot(c, vec3(${glslFloat(LUMA[0])}, ${glslFloat(LUMA[1])}, ${glslFloat(
    LUMA[2]
  )}));
}

vec3 gbgInkValue(vec3 c) {
  return c * (${glslFloat(INK_VALUE)} / max(gbgLuma(c), 1e-3));
}

float gbgSphereDeviation(float h, float ior) {
  float hi = clamp(h, 0.0, 1.0);
  return 2.0 * (asin(hi) - asin(clamp(hi / max(ior, 1.0), 0.0, 1.0)));
}

float gbgRimGather(float ndv, float ior) {
  float f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  return f0 + (1.0 - f0) * pow(1.0 - clamp(ndv, 0.0, 1.0), 5.0);
}

vec2 gbgMarchInterval(float entryDotDir, float bound) {
  float chord = -2.0 * entryDotDir;
  float disc = entryDotDir * entryDotDir - (1.0 - bound * bound);
  if (disc <= 0.0) return vec2(0.0, chord);
  float root = sqrt(disc);
  float near = max(0.0, -entryDotDir - root);
  float far = min(chord, -entryDotDir + root);
  return far > near ? vec2(near, far) : vec2(0.0, chord);
}

/**
 * One screen pixel measured in radians of atan(uv.y, uv.x), taken from the
 * derivatives of uv rather than of the angle itself, so it does not blow up
 * where the angle wraps.
 */
float gbgAngleAA(vec2 uv) {
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  float r2 = max(dot(uv, uv), 1e-6);
  return (abs(uv.x * dx.y - uv.y * dx.x) + abs(uv.x * dy.y - uv.y * dy.x)) / r2;
}
`;

const VERTEX = /* glsl */ `
attribute vec4 aSigil;
attribute vec3 aInk;
attribute vec4 aSet;
attribute vec4 aState;

varying vec3 vLocal;
varying vec3 vLocalCam;
varying vec4 vSphere;
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
  // Where this bead is in the room, and how big it is there: the transmitted
  // ray has to be followed in world space to be looked up on screen.
  vSphere = vec4(center, scale);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uMotion;
uniform float uIor;
uniform float uInkSaturation;
uniform vec3 uGold;
uniform vec3 uPatina;
uniform mat4 uProjView;
uniform sampler2D uBackdrop;

varying vec3 vLocal;
varying vec3 vLocalCam;
varying vec4 vSphere;
varying vec4 vSigil;
varying vec3 vInk;
varying vec4 vSet;
varying vec4 vState;

${GLSL_COMMON}
${GLSL_ENVIRONMENT}
${GLSL_OPTICS}
${GLSL_FIGURE}
${GLSL_SETTING}

/**
 * THE ROOM THIS BEAD IS CARRYING
 *
 * A ray leaving the far surface of the glass is followed a fixed distance and
 * looked up in the buffer the arena was drawn into without its beads. Where the
 * ray leaves the frame entirely — which it does often, because the deviation at
 * the rim is nearly a right angle — the analytic environment stands in, and it
 * is the same function the firmament itself is drawn with, so the seam between
 * the two is a seam between one description of the room and the same one.
 */
vec3 gbgRoomOver(vec3 from, vec3 dir, vec3 sky) {
#if GBG_BACKDROP
  vec4 clip = uProjView * vec4(from + dir * (vSphere.w * ${glslFloat(
    TRANSMIT_SPAN
  )}), 1.0);
  vec2 uv = clip.xy / max(clip.w, 1e-4) * 0.5 + 0.5;
  vec2 within = smoothstep(0.0, 0.04, uv) * smoothstep(1.0, 0.96, uv);
  float inside = within.x * within.y * step(0.0, clip.w);
  return mix(sky, texture2D(uBackdrop, uv).rgb, inside);
#else
  return sky;
#endif
}

/**
 * The three dispersed images leave along three rays a degree or two apart, and
 * the sky they fall back on is a smooth gradient — so it is evaluated once for
 * all three. The environment is the most expensive function in this shader and
 * calling it three times to get three indistinguishable answers is a cost the
 * lower tiers cannot afford and the top tier should not pay.
 */
vec3 gbgRoom(vec3 from, vec3 dir) {
  return gbgRoomOver(from, dir, gbgEnvironment(dir));
}

void main() {
  // The only clock the figure is allowed to read, and reduced motion stops it.
  // The ink still departs from its ideal construction by exactly as much as
  // its turbulence says — it simply stops crawling (VERTICAL-SLICE-SPEC §22).
  float aTime = uTime * uMotion;

  // THE SURFACE, SOLVED RATHER THAN INTERPOLATED
  //
  // The drawn geometry is a coarse proxy that circumscribes the bead; the
  // sphere is found here, per fragment. "edge" is the coverage of the true
  // circle in screen space — the bead's own antialiasing, because the composer
  // offers none and a polygon silhouette is what the bead used to have.
  vec3 ro = vLocalCam;
  vec3 rv = normalize(vLocal - vLocalCam);
  float along = dot(ro, rv);
  float disc = along * along - (dot(ro, ro) - 1.0);
  float edge = clamp(disc / max(fwidth(disc), 1e-6) + 0.5, 0.0, 1.0);

  vec3 n = normalize(ro + rv * (-along - sqrt(max(disc, 0.0))));
  vec3 camDir = -rv;
  float ndv = clamp(dot(n, camDir), 0.0, 1.0);
  // Impact parameter: 0 through the middle of the bead, 1 at the silhouette.
  float impact = sqrt(max(1.0 - ndv * ndv, 0.0));
  float rim = gbgRimGather(ndv, uIor);

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
  // How a faculty draws is the faculty's own construction geometry's business
  // (see settingInkWeight in scene/sigil.ts) — it is not gold leaf's.
  float widthBias = (1.0 + emphasis * 0.55) * gbgSettingInkWeight(vSet.x);

  // How far this bead has been woven into the composition — a saturating,
  // continuously eased quantity, never a count. See wovenLight below.
  float woven = clamp(vState.z, 0.0, 1.0);

  vec3 inkCol = mix(uEngraving, vInk, uInkSaturation);
  inkCol = mix(inkCol, uGold, gilded);
  // Value last, so gilding cannot be where contrast comes from.
  inkCol = gbgInkValue(inkCol);

  float figureRadius = gbgFigureRadius(vSigil.z);

  // THE REFRACTION, IN CLOSED FORM
  //
  // A ray through a sphere is deviated by exactly 2*(asin h - asin h/n), half
  // of it on the way in. Both halves are one rotation of the incoming ray
  // toward the bead's centre, in the plane the two of them span.
  vec3 iDir = -camDir;
  vec3 perp = -n - iDir * dot(-n, iDir);
  float perpLen = length(perp);
  vec3 bendAxis = perpLen > 1e-5 ? perp / perpLen : vec3(0.0);
  float bend = gbgSphereDeviation(impact, uIor);
  vec3 rd = iDir * cos(bend * 0.5) + bendAxis * sin(bend * 0.5);
  float entryDotDir = dot(n, rd);
  vec2 span = gbgMarchInterval(entryDotDir, gbgFigureBound(vSigil.z, vSigil.w));

  // One screen pixel, measured in the figure's own space, *after* everything
  // the refraction does to it — taken at the middle of the marched stretch, and
  // read by every line the construction is made of. This is what stops a figure
  // fraying into square tiles where the glass compresses it hardest.
#if GBG_ENGRAVED
  vec3 aaProbe = vec3(dot(n, rx), dot(n, ry), 0.0) / figureRadius;
#else
  vec3 mid = n + rd * mix(span.x, span.y, 0.5);
  vec3 aaProbe = vec3(dot(mid, rx), dot(mid, ry), dot(mid, fz)) / figureRadius;
#endif
  gbgInkAA = max(length(dFdx(aaProbe)), length(dFdy(aaProbe))) * 0.6;

  vec2 uv = vec2(dot(n, rx), dot(n, ry));
  float rho = length(uv);
  float aaR = max(fwidth(rho), 1e-5);
  float aaA = gbgAngleAA(uv);

  // Every derivative is taken before this: a fragment that leaves the draw must
  // not take its neighbours' antialiasing with it.
  if (edge <= 0.0) discard;

  float ink = 0.0;
  vec3 col;

#if GBG_ENGRAVED
  // The engraved tier: the figure is cut into a plate rather than suspended
  // in glass. A different picture of the same bead, not a broken one.
  vec3 q = vec3(dot(n, rx), dot(n, ry), 0.0);
  ink = gbgFigure(q, vSigil, aTime, widthBias * 1.25);
  vec3 plate = mix(uDepth, uPatina, 0.5) + uHorizon * 0.5;
  col = plate * (0.55 + 0.7 * ndv + 0.12 * woven);
  // Woven: the line is bitten deeper into the plate.
  col = mix(col, inkCol * 1.5, clamp(ink * (1.6 + 0.5 * woven), 0.0, 1.0));
  col += mix(uEngraving, uGold, gilded) * smoothstep(0.45, 1.0, rim) * 0.6;
#else
  // The march takes the strongest hit along the chord rather than compositing
  // every sample over the last. Alpha-over treats fourteen samples of one line
  // as fourteen independent lines: a construction the glass has compressed to a
  // faint wash accumulates to a solid blot, and a planar figure crossed at an
  // angle prints a ghost of itself beside itself. It also made the weight of a
  // figure depend on how many samples the tier could afford, which is a tier
  // changing what a bead means rather than what it is made of.
  for (int i = 0; i < GBG_STEPS; i++) {
    float f = (float(i) + 0.5) / float(GBG_STEPS);
    vec3 p = n + rd * mix(span.x, span.y, f);
    vec3 q = vec3(dot(p, rx), dot(p, ry), dot(p, fz));
    ink = max(ink, gbgFigure(q, vSigil, aTime, widthBias));
  }
  // Woven: the figure reads more strongly through the thickness — the glass
  // holds it rather than merely containing it.
  ink = clamp(ink * (1.3 + 0.45 * woven), 0.0, 1.0);

  // The far surface, and the ray that leaves it carrying the room.
  vec3 exitP = n + rd * (-2.0 * entryDotDir);
  vec3 exitWorld = vSphere.xyz + exitP * vSphere.w;
  vec3 outDir = iDir * cos(bend) + bendAxis * sin(bend);

  vec3 sky = gbgEnvironment(outDir);
  vec3 body = gbgRoomOver(exitWorld, outDir, sky);
#if GBG_DISPERSION
  // Flint glass splits the world it carries. The two indices leave the far
  // surface along different rays, so the split opens toward the rim exactly
  // where the deviation does — which is where a real bead splits it too.
  float bendR = gbgSphereDeviation(impact, uIor * ${glslFloat(
    1 - DISPERSION_SPLIT
  )});
  float bendB = gbgSphereDeviation(impact, uIor * ${glslFloat(
    1 + DISPERSION_SPLIT
  )});
  body.r = gbgRoomOver(exitWorld, iDir * cos(bendR) + bendAxis * sin(bendR), sky).r;
  body.b = gbgRoomOver(exitWorld, iDir * cos(bendB) + bendAxis * sin(bendB), sky).b;
#endif
  vec3 rimCol = gbgEnvironment(reflect(-camDir, n));

  // Glass gathers light. Without a transmission floor a lens in a dark room
  // is just a black ball, and the figure inside it has nothing to sit on.
  // A woven bead gathers more of it — the material answers the composition.
  col = body * (0.85 + 0.10 * woven)
      + uHorizon * (0.55 + 0.13 * woven)
      + uVellum * (0.035 + 0.03 * woven);
  col = mix(col, inkCol * 1.5, ink);

  // The caustic: light from the same source the highlight is from, gathered by
  // the front of the bead and thrown onto the floor of its interior, with the
  // bright cusp a round lens always leaves around the focus.
  vec3 key = normalize(uKey);
  float focus = dot(normalize(exitP), -key);
  float caustic = pow(max(focus, 0.0), 26.0)
                + gbgCoverage(focus - 0.58, 0.055, 0.02) * 0.45;
  col += uVellum * caustic * (1.0 - rim) * 0.30;

  // The rim gathers: at grazing incidence a glass surface transmits almost
  // nothing and reflects almost everything, so the edge of a bead is the
  // brightest part of it. The bead used to be drawn darker there.
  col = mix(col, rimCol + uHorizon * 0.42, rim * 0.72);
  col += (uVellum * 0.5 + uHorizon) * smoothstep(0.90, 1.0, rho)
       * (0.20 + 0.55 * rim);

  float spec = pow(max(dot(reflect(-camDir, n), key), 0.0), 90.0);
  col += uVellum * spec * 1.1;
  col += mix(uEngraving, uGold, gilded) * smoothstep(0.45, 1.0, rim) * 0.42;
#endif

  // The setting: engraved metal, and the only faculty channel that survives
  // a greyscale print.
  float resonance = clamp(vState.y, 0.0, 1.0);
  float majors = 4.0 + floor(resonance * 8.0 + 0.5);
  float collar = gbgSetting(uv, vSet.x, majors, aaR, aaA);
  vec3 collarCol = mix(uPatina, uBrass, 0.25 + 0.75 * ndv) * 1.25;
  col = mix(col, collarCol, collar * (0.82 + 0.18 * emphasis));

  // The bezel: a dark quirk, then the lit arris the metal closes over the glass
  // with. This is the bead's edge, and it is drawn as one.
  col = mix(col, uGround * 0.7 + uPatina * 0.3, gbgBezelQuirk(rho, aaR) * 0.65);
  vec2 keyUv = normalize(vec2(dot(normalize(uKey), rx),
                              dot(normalize(uKey), ry)) + 1e-4);
  float facing = clamp(0.42 + 0.58 * dot(uv / max(rho, 1e-4), keyUv), 0.0, 1.0);
  col = mix(col, mix(uPatina, uBrass, 0.55) * (0.7 + 1.6 * facing),
            gbgBezelArris(rho, aaR) * 0.92);

  // Attended: a full gold rule around the setting. One bead wears it.
  float rule = gbgCoverage(rho - 0.993, 0.009, aaR);
  col = mix(col, uGold, rule * clamp(vState.w, 0.0, 1.0) * 0.95);

  // Weight: the underside of a bead is not as lit as its top.
  col *= 0.84 + 0.16 * smoothstep(-1.0, 1.0, dot(n, normalize(uKey)));
  col *= 1.0 + emphasis * 0.24;

  // The silhouette is antialiased against the room the bead is standing in
  // rather than by blending, so the bead stays opaque and the depth buffer
  // stays honest for everything drawn after it.
  // Only the sliver of fragments actually on the silhouette needs it looked up.
  vec3 behind = col;
  if (edge < 0.999) behind = gbgRoom(vSphere.xyz + n * vSphere.w, rv);
  gl_FragColor = vec4(mix(behind, col, edge), 1.0);
}
`;

export interface BeadGlassOptions {
  readonly theme: WorldTheme;
  readonly budget: SceneBudget;
  /**
   * Reduced motion stops the figure's clock and nothing else: the turbulence
   * a concept was authored with is still drawn at full amplitude, it simply
   * holds still (VERTICAL-SLICE-SPEC §22).
   */
  readonly reducedMotion: boolean;
}

/**
 * A recompile is cheaper than a branch: step count, dispersion, the transmitted
 * room and the engraved path are `#define`s, so the shader a device runs
 * contains only the work that device's tier asked for.
 */
export function beadGlassDefines(budget: SceneBudget): Record<string, string> {
  return {
    GBG_STEPS: String(Math.max(1, budget.glassSteps)),
    GBG_DISPERSION: budget.dispersion ? "1" : "0",
    GBG_ENGRAVED: budget.engravedGlass ? "1" : "0",
    GBG_BACKDROP: budget.engravedGlass ? "0" : "1",
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
      uMotion: { value: options.reducedMotion ? 0 : 1 },
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
      // Written by the frame loop; a bead cannot look up the room behind it
      // without knowing where the room lands on screen.
      uProjView: { value: new THREE.Matrix4() },
      uBackdrop: { value: null as THREE.Texture | null },
    },
    toneMapped: false,
  });
  material.name = "castalia.beadGlass";
  return material;
}
