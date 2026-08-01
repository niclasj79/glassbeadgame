import {
  GLSL_FIGURE_DISPATCH,
  GLSL_FIGURE_GEOMETRY,
  GLSL_SETTING_INK,
} from "./sigil";

/**
 * SHARED GLSL — THE MATERIAL LANGUAGE OF CASTALIA
 *
 * Three chunks, used by more than one material, kept in one place so the world
 * a bead refracts is literally the same function as the world drawn behind it.
 * When the firmament changes, every lens changes with it; that is what makes
 * the beads read as glass in a room rather than as spheres in a void.
 *
 * All of it is GLSL ES 1.00 compatible: constant loop bounds, no `inverse()`,
 * no dynamic array indexing. Step counts are `#define`d by the material factory
 * from the quality budget, so a tier change recompiles rather than branches.
 */

export const GLSL_COMMON = /* glsl */ `
#define GBG_TAU 6.28318530718
#define GBG_PI  3.14159265359

vec2 gbgRot(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

/** Ink coverage for a signed distance and a half-width. */
float gbgLine(float d, float w) {
  return 1.0 - smoothstep(0.0, w, abs(d));
}

/**
 * SCREEN-AWARE INK
 *
 * The composer renders with no multisampling, so every edge in this world has
 * to be antialiased by the material that draws it. \`gbgLine\` cannot: below a
 * pixel it draws a line that is present in some fragments and absent in their
 * neighbours, which is the dotted, wobbling hairline a bead's setting used to
 * wear, and the frayed lattice a refracted figure used to break into near the
 * rim, where the glass compresses the drawing hardest.
 *
 * \`gbgCoverage\` widens a line to at least one pixel and gives back in strength
 * what it took in width, so a sub-pixel line goes *pale* — which is what a fine
 * line does on paper — instead of breaking into dots. The give-back is
 * \`f * (2 - f)\` rather than a flat \`f\`, which lets a line that is only a
 * little under a pixel keep most of its weight, and still takes a line that is
 * far under one all the way to nothing. A floor here would be a catastrophe:
 * at the centre of a polar figure a graduation is infinitely fine, and a floor
 * would fill the whole bead with ink at half strength.
 *
 * \`aa\` is the size of one screen pixel in the units \`d\` is measured in. The
 * caller computes it, because only the caller knows which space it is drawing
 * in — no shared chunk here may call a derivative function, since three of the
 * four materials that include this one do not need derivatives at all.
 */
float gbgCoverage(float d, float w, float aa) {
  float e = max(w, aa);
  float f = w / e;
  return (1.0 - smoothstep(0.0, e, abs(d))) * f * (2.0 - f);
}

/**
 * One screen pixel, in the figure space the bead is currently drawing in. Set
 * once per fragment before any construction is drawn; every line inside a
 * \`gbgFigure*\` reads it through \`gbgInk\`. It is a global rather than an
 * argument so that the family dispatch \`sigil.ts\` generates — the shader ABI
 * its tests pin — stays exactly \`(p, k, w)\`.
 */
float gbgInkAA;

/** Coverage of a figure line whose distance is a figure-space length. */
float gbgInk(float d, float w) {
  return gbgCoverage(d, w, gbgInkAA);
}

/**
 * Coverage of a figure line whose distance is measured in some unit other than
 * figure-space length — turns of a graduation, radians of an index — where
 * \`unitLength\` is how far one of those units reaches in figure space at the
 * place it is being drawn. A twelve-fold graduation near the middle of a figure
 * is finer on screen than the same graduation at its edge, and only the caller
 * knows which it is looking at.
 */
float gbgInkAt(float d, float w, float unitLength) {
  return gbgCoverage(d, w, gbgInkAA / max(unitLength, 1e-4));
}

/** Distance to the nearest integer, per component. */
vec3 gbgLattice(vec3 p) {
  return abs(fract(p + 0.5) - 0.5);
}
`;

/**
 * The world, as a function of direction. Deep dyed darkness below, a vellum-lit
 * horizon where the armillary stands, ribbed vault above. No stars: those are
 * drawn objects, because an authored sky cannot be a noise function.
 */
export const GLSL_ENVIRONMENT = /* glsl */ `
uniform vec3 uGround;
uniform vec3 uDepth;
uniform vec3 uHorizon;
uniform vec3 uVellum;
uniform vec3 uBrass;
uniform vec3 uEngraving;
uniform vec3 uKey;

vec3 gbgEnvironment(vec3 d) {
  vec3 dir = normalize(d);
  float y = dir.y;

  // Down is a well of dyed pigment; up is the vault. The darkest place in the
  // world is the floor, and it still is not black.
  vec3 col = mix(uGround * 0.72, uDepth, smoothstep(-0.55, 0.55, y));

  // A narrow band of lit air at the instrument's own level. Narrow on purpose:
  // a wide glow would read as haze, and haze is what outer space looks like.
  float band = exp(-pow((y - 0.01) * 42.0, 2.0));
  col = mix(col, uHorizon, band * 0.3);

  // Brass light rising off the rings just under the eye — a reflection on the
  // floor of the room, not a dye poured through the whole well.
  col += uBrass * exp(-pow((y + 0.2) * 9.0, 2.0)) * 0.028;

#ifndef GBG_CHEAP_ENV
  // The vault: primary ribs converging on the boss overhead, with the courses
  // that spring from them. Above the eye the world is architecture.
  float up = smoothstep(0.42, 0.86, y);
  float lon = atan(dir.z, dir.x);
  float ribs = pow(abs(sin(lon * 6.0)), 30.0);
  float rings = pow(abs(sin(acos(clamp(y, -1.0, 1.0)) * 7.0)), 30.0);
  col += uEngraving * (ribs * 1.2 + rings * 0.45) * up * 0.10;

  // The springing line where the vault meets the wall.
  col += uBrass * exp(-pow((y - 0.42) * 26.0, 2.0)) * 0.07;

  // One key light, so the world has a direction even with no geometry in it.
  col += uVellum * pow(max(dot(dir, normalize(uKey)), 0.0), 9.0) * 0.055;
#endif
  return col;
}
`;

/**
 * THE FIGURE INSIDE THE GLASS
 *
 * One construction per `SigilFamily`. `sym` folds the plane for the radial
 * families and multiplies frequency for the cartesian ones — see
 * `scene/sigil.ts`, which owns that distinction and is tested.
 *
 * This chunk owns the *drawing* of each construction and nothing else. Which
 * family is which index, how large the figure is, how fine its line is and how
 * far the ink may wander are all generated by `scene/sigil.ts` and pasted in
 * below, so the description the tests measure is the description that renders.
 * A function here is named `gbgFigure<Family>` and that name is derived from
 * the schema — renaming one breaks the build rather than the picture.
 *
 * Every branch returns ink coverage in 0–1 and must remain legible with hue
 * removed: these are line drawings, and the line is the meaning.
 *
 * Every line here is drawn with `gbgInk` (or `gbgInkAt`, where the distance is
 * measured in turns or radians rather than in figure-space length) rather than
 * with `gbgLine`. That is the whole of the fix for a figure that used to tear
 * into square tiles and doubled ghosts near the rim: the refraction compresses
 * a construction hardest exactly where the glass is steepest, and a fixed line
 * width has no way to know that it has fallen under a pixel.
 */
export const GLSL_FIGURE = /* glsl */ `
float gbgFigureSpiral(vec3 q, float k, float w) {
  float r = length(q.xy);
  float a = atan(q.y, q.x);
  float phase = (a + 2.3 * log(r + 0.09)) * k / GBG_TAU;
  // The phase climbs with the angle and with the log of the radius at once;
  // 2.5 is the two of them together, so one turn of the arm is this long.
  float arm = gbgInkAt(fract(phase) - 0.5, w * 0.9, GBG_TAU * r / max(k * 2.5, 1e-3));
  arm *= smoothstep(1.15, 0.92, r) * smoothstep(0.03, 0.12, r);
  float core = gbgInk(r - 0.05, w * 1.1);
  float sheet = 1.0 - smoothstep(0.06, 0.34, abs(q.z));
  return max(arm, core) * sheet;
}

float gbgFigureLattice(vec3 q, float k, float w) {
  float f = 1.4 + k * 0.5;
  // The cell distances come back in cell units; dividing by the cell count
  // puts them and their widths in figure space, where a pixel has a size.
  vec3 g = gbgLattice(q * f) / f;
  float d = min(min(max(g.x, g.y), max(g.y, g.z)), max(g.x, g.z));
  float node = gbgInk(length(g), w * 1.4 / f);
  float body = gbgInk(d, w * 1.1 / f);
  return max(body, node) * smoothstep(1.25, 0.95, length(q));
}

float gbgFigureWave(vec3 q, float k, float w) {
  float y = sin(q.x * 3.1);
  y += sin(q.x * 6.2 + 1.1) * 0.5 * step(1.5, k);
  y += sin(q.x * 9.3 + 2.2) * 0.33 * step(2.5, k);
  y *= 0.34;
  float crest = gbgInk(q.y - y, w * 1.2);
  float trough = gbgInk(q.y + y, w * 0.8) * 0.55;
  float node = gbgInk(q.y, w * 0.5) * 0.4;
  float span = smoothstep(1.2, 0.95, abs(q.x));
  float sheet = 1.0 - smoothstep(0.05, 0.32, abs(q.z));
  return max(max(crest, trough), node) * span * sheet;
}

float gbgFigureOrbit(vec3 q, float k, float w) {
  float best = 1e3;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ri = 0.3 + fi * 0.23;
    vec3 p = q;
    p.yz = gbgRot(p.yz, fi * 0.42);
    float ring = max(abs(length(p.xy) - ri), abs(p.z) - 0.012);
    best = min(best, ring);
  }
  float rings = gbgInk(best, w * 1.1);
  float a = atan(q.y, q.x);
  float rr = length(q.xy);
  float nodes = gbgInkAt(fract(a * k / GBG_TAU) - 0.5, 0.06, GBG_TAU * rr / k)
              * gbgInk(rr - 0.99, w * 1.6);
  return max(rings, nodes) * smoothstep(1.3, 1.02, length(q));
}

float gbgFigureFold(vec3 q, float k, float w) {
  float a = atan(q.y, q.x);
  float r = length(q.xy);
  vec2 lp = gbgRot(vec2(r - 0.64, q.z), a * 0.5);
  float within = 1.0 - smoothstep(0.0, 0.075, abs(lp.y));
  float edges = gbgInk(abs(lp.x) - 0.27, w * 1.1) * within;
  float rulings = gbgInkAt(fract(a * k * 1.5 / GBG_TAU) - 0.5, w * 0.7,
                           GBG_TAU * r / max(k * 1.5, 1e-3))
                * (1.0 - smoothstep(0.24, 0.3, abs(lp.x))) * within;
  return max(edges, rulings * 0.85);
}

float gbgFigureRay(vec3 q, float k, float w) {
  vec2 vp = vec2(0.0, 0.16);
  vec2 d = q.xy - vp;
  float len = length(d);
  float a = atan(d.y, d.x);
  float rays = max(7.0, k * 3.0);
  float pencil = gbgInkAt(fract(a * rays / GBG_TAU) - 0.5, w * 0.75,
                          GBG_TAU * len / rays);
  pencil *= smoothstep(0.06, 0.26, len) * smoothstep(1.2, 0.85, len);
  float horizon = gbgInk(q.y - 0.16, w * 0.8) * smoothstep(1.2, 0.95, abs(q.x));
  float point = gbgInk(len - 0.035, w * 1.2);
  float sheet = 1.0 - smoothstep(0.05, 0.3, abs(q.z));
  return max(max(pencil, horizon), point) * sheet;
}

float gbgFigureGrid(vec3 q, float k, float w) {
  float n = 2.0 + k * 1.3;
  vec2 g = abs(fract(q.xy * n + 0.5) - 0.5) / n;
  float d = min(g.x, g.y);
  float body = gbgInk(d, w * 0.75);
  float frame = max(gbgInk(abs(q.x) - 1.0, w), gbgInk(abs(q.y) - 1.0, w));
  float inside = smoothstep(1.06, 0.98, max(abs(q.x), abs(q.y)));
  float sheet = 1.0 - smoothstep(0.05, 0.28, abs(q.z));
  return max(body * inside, frame) * sheet;
}

float gbgFigureBranch(vec3 q, float k, float w) {
  vec2 p = vec2(abs(q.x), q.y + 0.86);
  float d = 1e3;
  float s = 1.0;
  for (int i = 0; i < 4; i++) {
    float L = 0.6 * s;
    vec2 seg = vec2(p.x, p.y - clamp(p.y, 0.0, L));
    d = min(d, length(seg));
    p.y -= L;
    p.x = abs(p.x);
    p = gbgRot(p, -0.46 - 0.03 * k);
    s *= 0.66;
  }
  float sheet = 1.0 - smoothstep(0.05, 0.3, abs(q.z));
  return gbgInk(d, w * 1.2) * sheet;
}

float gbgFigureVessel(vec3 q, float k, float w) {
  float d = 1e3;
  for (int i = 0; i < 3; i++) {
    float ri = 0.42 + float(i) * 0.25;
    float shell = abs(length(q) - ri);
    // Open above: the vessel is a container, not a ball.
    shell += step(0.30, q.y) * 1e3;
    d = min(d, shell);
  }
  float lip = max(abs(q.y - 0.30), abs(length(q.xz) - 0.44));
  d = min(d, lip);
  float ribs = gbgInkAt(fract(atan(q.z, q.x) * k / GBG_TAU) - 0.5, w * 0.6,
                        GBG_TAU * length(q.xz) / k)
             * (1.0 - smoothstep(0.5, 1.0, length(q)))
             * step(q.y, 0.3);
  return max(gbgInk(d, w * 1.3), ribs * 0.7);
}

float gbgFigureArc(vec3 q, float k, float w) {
  float a = atan(q.y, q.x);
  float r = length(q.xy);
  float limb = 1.0 - smoothstep(1.18, 1.32, abs(a));
  float d = 1e3;
  for (int i = 0; i < 3; i++) {
    d = min(d, abs(r - (0.46 + float(i) * 0.24)));
  }
  float arcs = gbgInk(d, w * 1.0) * limb;
  float ticks = gbgInkAt(fract(a * k * 6.0 / GBG_TAU) - 0.5, w * 0.5,
                         GBG_TAU * r / max(k * 6.0, 1e-3))
              * smoothstep(0.68, 0.72, r) * smoothstep(0.98, 0.94, r) * limb;
  float index = gbgInkAt(a, w * 0.9, r) * smoothstep(0.1, 0.2, r);
  float sheet = 1.0 - smoothstep(0.05, 0.3, abs(q.z));
  return max(max(arcs, ticks), index * 0.8) * sheet;
}

${GLSL_FIGURE_GEOMETRY}

/**
 * sigil is (familyCode, symmetry, density, turbulence) exactly as produced by
 * scene/sigil.ts. t is the world clock; turbulence is the only channel allowed
 * to consume it, and only at a bounded amplitude.
 *
 * Radius, line width and the family switch are all generated by scene/sigil.ts
 * — the module whose tests describe them. This function decides nothing about
 * the figure's geometry on its own.
 */
float gbgFigure(vec3 pIn, vec4 sigil, float t, float bias) {
  float family = sigil.x;
  float k = max(sigil.y, 1.0);
  float density = sigil.z;
  float turbulence = sigil.w;

  float radius = gbgFigureRadius(density);
  float w = gbgFigureLineWidth(density) * bias;
  float warp = gbgFigureWarp(turbulence);

  vec3 p = pIn;
  p += warp * 0.5 * vec3(
    sin(p.y * 6.1 + t * 0.55),
    sin(p.z * 5.3 + t * 0.41),
    sin(p.x * 7.0 + t * 0.47)
  );
  p /= radius;
  if (dot(p, p) > 2.9) return 0.0;

  int fam = int(family + 0.5);
${GLSL_FIGURE_DISPATCH}
  return 0.0;
}
`;

/**
 * THE SETTING — the engraved metal collar the glass is mounted in.
 *
 * This is the faculty channel that survives a greyscale print: four visibly
 * different collars, cut in the faculty's own construction geometry, plus a
 * plain graduated collar for a bead whose pack declares no faculty. Which cut
 * belongs to which faculty is unchanged; what changed is that every rule and
 * every graduation is now drawn at a width it can be seen at.
 *
 * `aaR` is one screen pixel measured in `rho`, `aaA` one screen pixel measured
 * in radians of `ang`. Both are computed by the caller: `gbgSetting` may not
 * take a derivative itself, because the collar is drawn from a normal that the
 * bead solves analytically and the caller is the only place that knows it.
 */
export const GLSL_SETTING = /* glsl */ `
${GLSL_SETTING_INK}

/** Coverage of an n-fold graduation of half-width w, measured in turns. */
float gbgGraduation(float ang, float n, float w, float aaA) {
  return gbgCoverage(fract(ang * n / GBG_TAU) - 0.5, w, aaA * n / GBG_TAU);
}

/** A radial rule, softened to one pixel rather than dropped below it. */
float gbgRule(float rho, float at, float w, float aaR) {
  return gbgCoverage(rho - at, w, aaR);
}

float gbgSetting(vec2 uv, float code, float majors, float aaR, float aaA) {
  float rho = length(uv);
  float ang = atan(uv.y, uv.x);
  if (rho < 0.78 - aaR) return 0.0;

  int c = int(code + 0.5);
  float band = smoothstep(0.845 - aaR, 0.845 + aaR, rho)
             * smoothstep(0.975 + aaR, 0.975 - aaR, rho);
  float mark = 0.0;

  if (c == 1) {
    // lattice — two rules cross-tied on the square
    mark = max(gbgRule(rho, 0.855, 0.014, aaR), gbgRule(rho, 0.968, 0.011, aaR));
    mark = max(mark, gbgGraduation(ang, 4.0, 0.055, aaA) * band);
  } else if (c == 2) {
    // wave — a scalloped rule over a plain one
    float s = 0.912 + 0.03 * sin(ang * 13.0);
    mark = gbgRule(rho, s, 0.016, aaR);
    mark = max(mark, gbgRule(rho, 0.972, 0.009, aaR));
  } else if (c == 3) {
    // orbit — three concentric rules
    mark = max(gbgRule(rho, 0.848, 0.009, aaR), gbgRule(rho, 0.909, 0.009, aaR));
    mark = max(mark, gbgRule(rho, 0.970, 0.009, aaR));
  } else if (c == 4) {
    // ray — sixteen spokes between two rules
    mark = max(gbgRule(rho, 0.855, 0.012, aaR), gbgRule(rho, 0.968, 0.012, aaR));
    mark = max(mark, gbgGraduation(ang, 16.0, 0.028, aaA) * band);
  } else {
    // unattributed — one plain rule, finely graduated
    mark = gbgRule(rho, 0.93, 0.013, aaR);
    mark = max(mark, gbgGraduation(ang, 48.0, 0.02, aaA)
                     * smoothstep(0.90 - aaR, 0.90 + aaR, rho)
                     * smoothstep(0.96 + aaR, 0.96 - aaR, rho));
  }

  // Countable major graduations: the colour-free resonance channel. They used
  // to be cut into the outermost 2.5% of the disc, which at bead size is most
  // of a pixel — countable in principle and a row of flickering dots in fact.
  // They are cut into the fillet now, where there is room for them.
  float major = gbgGraduation(ang, majors, 0.024, aaA)
              * smoothstep(0.940 - aaR, 0.940 + aaR, rho)
              * smoothstep(1.0, 1.0 - aaR, rho);
  return clamp(max(mark, major * 1.2), 0.0, 1.0);
}

/**
 * THE BEZEL — where the metal closes over the glass, i.e. the bead's edge.
 *
 * The silhouette used to be whatever the collar's outermost graduation
 * happened to leave behind at that radius: a dotted, aliased hairline that read
 * as a compression artifact. It is a drawn arris now — a lit outer edge with a
 * dark quirk under it — and it is the same width in pixels at every zoom.
 */
float gbgBezelArris(float rho, float aaR) {
  return gbgCoverage(rho - 0.988, 0.012, aaR);
}

float gbgBezelQuirk(float rho, float aaR) {
  return gbgCoverage(rho - 0.958, 0.010, aaR);
}
`;
