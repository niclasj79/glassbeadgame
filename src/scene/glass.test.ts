import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { FACULTIES } from "@/content/castalia/faculties";
import { castalia } from "@/themes/worlds";
import {
  BEAD_PROXY_SEGMENTS,
  GLASS_ATTRIBUTES,
  INK_VALUE,
  backdropResolution,
  beadGlassDefines,
  beadProxyScale,
  chordMarchInterval,
  createBeadGlassMaterial,
  inkAtValue,
  relativeLuminance,
  rimGather,
  sphereDeviation,
  wovenLight,
} from "./glass";
import { figureBound } from "./sigil";
import { sceneBudget } from "./quality";

const glassSource = (): string =>
  readFileSync(new URL("./glass.ts", import.meta.url), "utf8");

const beadsSource = (): string =>
  readFileSync(new URL("./Beads.tsx", import.meta.url), "utf8");

/** The shader the GPU is actually handed, not the module that assembles it. */
const fragment = (tier: "high" | "base" | "potato" = "high"): string =>
  createBeadGlassMaterial({
    theme: castalia,
    budget: sceneBudget(tier),
    reducedMotion: false,
  }).fragmentShader;

/** Source with comments removed — a note recording what was removed is not it. */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * A per-bead visible count of how many threads meet at it is a score readout in
 * the middle of the world. VERTICAL-SLICE-SPEC §19 excludes persistent counters
 * from core play and product law 7 forbids conventional gamification the spec
 * has not asked for. The bead used to wear up to four gold pips, one per
 * committed thread, arranged so they could be counted at a glance.
 *
 * Being woven is now a property of the material.
 */
describe("no countable degree marks on a bead", () => {
  it("draws no per-thread pips", () => {
    const source = code(glassSource());
    expect(source).not.toMatch(/pips?/i);
    // The tell of a countable mark: a fixed loop drawing one glyph per thread.
    expect(source).not.toMatch(/for \(int i = 0; i < 4; i\+\+\)/);
    expect(source).not.toMatch(/float degree/);
  });

  it("spends the third state channel on the material, not on a count", () => {
    expect(GLASS_ATTRIBUTES.state).toBe("aState");
    const source = glassSource();
    expect(source).toContain("float woven = clamp(vState.z, 0.0, 1.0);");
    // What the channel is allowed to change: how much light the glass carries
    // and how strongly it holds its figure. Never a drawn mark.
    expect(source).toMatch(/col = body \* \(0\.85 \+ [\d.]+ \* woven\)/);
    expect(source).toMatch(/ink \* \([\d.]+ \+ [\d.]+ \* woven\)/);
  });

  it("computes being-woven as a saturating quantity with no countable rungs", () => {
    expect(wovenLight(0)).toBe(0);
    expect(wovenLight(-3)).toBe(0);
    for (let degree = 1; degree < 24; degree++) {
      expect(wovenLight(degree)).toBeGreaterThan(wovenLight(degree - 1));
      expect(wovenLight(degree)).toBeLessThan(1);
    }
    // Diminishing returns: every additional thread changes the glass less than
    // the one before it, so the brightness never forms an evenly spaced ladder
    // a player could read a number off.
    for (let degree = 1; degree < 12; degree++) {
      const step = wovenLight(degree) - wovenLight(degree - 1);
      const next = wovenLight(degree + 1) - wovenLight(degree);
      expect(next).toBeLessThan(step);
    }
    // Continuous: the frame loop eases through the values between two degrees.
    expect(wovenLight(1.5)).toBeGreaterThan(wovenLight(1));
    expect(wovenLight(1.5)).toBeLessThan(wovenLight(2));
  });

  it("never lets the raw thread count reach the shader", () => {
    const source = beadsSource();
    // The count is a working number on its way to a material target; the
    // buffer the instanced draw reads gets `wovenLight`, eased over time.
    expect(source).toContain("woven.set(id, wovenLight(count))");
    expect(source).not.toMatch(/state\[i \* 4 \+ 2\] = /);
    expect(source).toMatch(/state\[i \* 4 \+ 2\] \+=/);
  });
});

describe("the bead glass honours reduced motion", () => {
  const budget = sceneBudget("high");

  it("carries a motion uniform that a preference actually sets", () => {
    const still = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: true,
    });
    const moving = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: false,
    });
    expect(still.uniforms.uMotion.value).toBe(0);
    expect(moving.uniforms.uMotion.value).toBe(1);
    still.dispose();
    moving.dispose();
  });

  it("changes nothing else — a still figure is the same figure", () => {
    const still = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: true,
    });
    const moving = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: false,
    });
    for (const key of Object.keys(moving.uniforms)) {
      if (key === "uMotion") continue;
      expect(JSON.stringify(still.uniforms[key].value)).toBe(
        JSON.stringify(moving.uniforms[key].value)
      );
    }
    expect(still.defines).toEqual(moving.defines);
    still.dispose();
    moving.dispose();
  });

  it("routes the figure's whole clock through that uniform", () => {
    const source = glassSource();
    expect(source).toContain("float aTime = uTime * uMotion;");
    // Every remaining mention of uTime is the declaration, the alias, and the
    // uniform seed: no branch may quietly keep its own animation running.
    const uses =
      source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .match(/uTime/g) ?? [];
    expect(uses).toHaveLength(3);
    expect(source).toMatch(/gbgFigure\(q, vSigil, aTime,/);
  });

  it("is wired from the player's preference, not from a constant", () => {
    expect(beadsSource()).toContain("reducedMotion: profile.reducedMotion");
  });
});

/**
 * MAT-01 — A BEAD IS GLASS, NOT A TRANSLUCENT DISC
 *
 * The bead used to refract nothing anyone could see. It bent the view ray once,
 * on the way in, and used the result to sample an analytic sky that has no
 * high-frequency detail in it — so there was nothing in the sampled image whose
 * displacement could be noticed. Everything genuinely behind a bead (the gold
 * armillary bands, the light shafts, the threads) was simply occluded: it ran
 * up to the silhouette, stopped, and reappeared on the far side with no offset,
 * no magnification and no inversion.
 *
 * Three things are measured here, and none of them can be satisfied by a
 * comment: the optics deviate, the deviation is enough to turn the image over,
 * and the material is wired to a picture of the room to deviate.
 */
describe("the glass bends what is behind it", () => {
  const ior = castalia.refraction;

  it("is drawn at an index that is actually glass", () => {
    // The brief's floor. Below this a sphere barely deviates anything.
    expect(ior).toBeGreaterThanOrEqual(1.45);
  });

  it("deviates nothing through the middle and everything at the rim", () => {
    expect(sphereDeviation(0, ior)).toBe(0);
    // A sphere of air is not a lens.
    expect(sphereDeviation(0.8, 1)).toBe(0);
    for (let h = 0.05; h <= 1.0001; h += 0.05) {
      expect(sphereDeviation(h, ior)).toBeGreaterThan(
        sphereDeviation(h - 0.05, ior)
      );
    }
  });

  it("turns the image over before the rim, which is what a lens does", () => {
    // How far off the bead's own axis the transmitted ray has travelled one
    // radius behind the far surface, in radii. Where that exceeds the impact
    // parameter the ray has crossed the axis: what was on the left of the room
    // behind the bead comes out on the right of the image the bead carries.
    const crossed = (h: number): boolean => {
      const bend = sphereDeviation(h, ior);
      return bend >= Math.PI / 2 || Math.tan(bend) > h;
    };
    expect(crossed(0.2)).toBe(false);
    expect(crossed(0.75)).toBe(true);
    // Past a right angle the ray is thrown clear across the frame.
    expect(sphereDeviation(1, ior)).toBeGreaterThan(Math.PI / 2);
  });

  it("the grazing edge is the brightest part of the bead", () => {
    // Schlick: a glass surface reflects everything at grazing incidence. The
    // bead used to be drawn *darker* there, which is the clearest single tell
    // that a thing is a picture of a sphere rather than a sphere.
    expect(rimGather(0, ior)).toBeCloseTo(1, 6);
    expect(rimGather(1, ior)).toBeLessThan(0.06);
    expect(rimGather(0.02, ior) / rimGather(1, ior)).toBeGreaterThan(10);
    for (let ndv = 0.05; ndv <= 1.0001; ndv += 0.05) {
      expect(rimGather(ndv, ior)).toBeLessThan(rimGather(ndv - 0.05, ior));
    }
  });

  it("refracts on the way in and again on the way out", () => {
    const source = fragment("high");
    // Half the deviation carries the ray to the far surface …
    expect(source).toContain("gbgSphereDeviation(impact, uIor)");
    expect(source).toContain(
      "iDir * cos(bend * 0.5) + bendAxis * sin(bend * 0.5)"
    );
    // … and the whole of it is the ray that leaves it.
    expect(source).toContain("iDir * cos(bend) + bendAxis * sin(bend)");
    expect(source).toContain("vec3 exitP = n + rd * (-2.0 * entryDotDir);");
  });

  it("looks the room up along the ray that leaves the far surface", () => {
    const source = fragment("high");
    expect(source).toContain("texture2D(uBackdrop, uv)");
    expect(source).toContain("uProjView * vec4(from + dir *");
    expect(source).toContain("vec3 body = gbgRoomOver(exitWorld, outDir, sky);");
    const material = createBeadGlassMaterial({
      theme: castalia,
      budget: sceneBudget("high"),
      reducedMotion: false,
    });
    expect(material.uniforms.uBackdrop).toBeDefined();
    expect(material.uniforms.uProjView).toBeDefined();
    material.dispose();
  });

  it("splits the carried image at two indices either side of the glass", () => {
    const source = fragment("high");
    expect(source).toMatch(/gbgSphereDeviation\(impact, uIor \* 0\.98\d+\)/);
    expect(source).toMatch(/gbgSphereDeviation\(impact, uIor \* 1\.01\d+\)/);
    // Dispersion is a tier decision — the preprocessor compiles the split out
    // of the shader a device that has not bought it actually runs.
    expect(source).toContain("#if GBG_DISPERSION");
    expect(beadGlassDefines(sceneBudget("high")).GBG_DISPERSION).toBe("1");
    expect(beadGlassDefines(sceneBudget("base")).GBG_DISPERSION).toBe("0");
  });

  it("tiers the room honestly instead of charging every device for it", () => {
    expect(beadGlassDefines(sceneBudget("high")).GBG_BACKDROP).toBe("1");
    expect(beadGlassDefines(sceneBudget("base")).GBG_BACKDROP).toBe("1");
    // The engraved tier is a plate. A plate does not transmit, so it is not
    // asked to pay for a second pass over the scene.
    expect(beadGlassDefines(sceneBudget("potato")).GBG_BACKDROP).toBe("0");
    expect(backdropResolution(sceneBudget("potato"), 1280, 720)).toBeNull();

    const high = backdropResolution(sceneBudget("high"), 1280, 720)!;
    const base = backdropResolution(sceneBudget("base"), 1280, 720)!;
    expect(high.width).toBeLessThan(1280);
    expect(base.width).toBeLessThan(high.width);
    for (const size of [high, base]) {
      expect(size.width / size.height).toBeCloseTo(1280 / 720, 1);
    }
    // …and it never grows without bound on a large display.
    const huge = backdropResolution(sceneBudget("high"), 5120, 2880)!;
    expect(Math.max(huge.width, huge.height)).toBeLessThanOrEqual(640);
    expect(huge.width).toBeGreaterThan(1);
  });

  it("photographs the room without the beads in it", () => {
    const source = beadsSource();
    // Otherwise a bead transmits itself and the second frame is a hall of
    // mirrors — and the pass has to precede the composer's, which is what the
    // default frame priority buys.
    expect(source).toContain("group.visible = false");
    expect(source).toContain("three.gl.setRenderTarget(backdrop)");
    expect(source).toContain("three.gl.render(three.scene, three.camera)");
    expect(source).toContain("three.gl.setRenderTarget(previous)");
  });
});

/**
 * MAT-02 — THE FIGURE IS NOT A TORN BITMAP
 *
 * There is no bitmap: the figure is a signed-distance construction. What tore
 * it was the sampling. The march spread its steps evenly along the whole chord
 * the refracted ray makes through the bead, so for any figure that does not
 * fill the glass most of the samples fell on empty glass; the handful that did
 * land on the drawing landed at different lateral offsets, because the ray is
 * bent, and were composited over one another — which prints the figure twice
 * and fills the gap between the copies.
 */
describe("the march lands on the figure", () => {
  const steps = sceneBudget("high").glassSteps;

  /** Is a point at `t` along the chord inside the figure's bounding sphere? */
  const inside = (entryDotDir: number, t: number, bound: number): boolean =>
    1 + 2 * t * entryDotDir + t * t <= bound * bound + 1e-9;

  const sampleAt = (from: number, to: number): number[] =>
    Array.from(
      { length: steps },
      (_, i) => from + (to - from) * ((i + 0.5) / steps)
    );

  /** What the march used to do: the whole chord, evenly. */
  const wholeChord = (entryDotDir: number): number[] =>
    sampleAt(0, -2 * entryDotDir);

  const clipped = (entryDotDir: number, bound: number): number[] => {
    const [from, to] = chordMarchInterval(entryDotDir, bound);
    return sampleAt(from, to);
  };

  /** Rays that actually meet the figure, over three authored densities. */
  const rays: { entryDotDir: number; bound: number }[] = [];
  for (const density of [0.35, 0.42, 0.6]) {
    const bound = figureBound(density, 0);
    for (let e = -0.98; e < -0.05; e += 0.04) {
      if (e * e - (1 - bound * bound) > 0) rays.push({ entryDotDir: e, bound });
    }
  }

  const hitRate = (
    pick: (ray: { entryDotDir: number; bound: number }) => number[]
  ): number => {
    let hits = 0;
    let total = 0;
    for (const ray of rays) {
      for (const t of pick(ray)) {
        total += 1;
        if (inside(ray.entryDotDir, t, ray.bound)) hits += 1;
      }
    }
    return hits / total;
  };

  it("spends every sample where there is something to draw", () => {
    expect(rays.length).toBeGreaterThan(20);
    expect(hitRate((ray) => clipped(ray.entryDotDir, ray.bound))).toBe(1);
  });

  it("is a real improvement on marching the whole chord", () => {
    // The old sampler, stated here so the gap is measured rather than claimed.
    expect(hitRate((ray) => wholeChord(ray.entryDotDir))).toBeLessThan(0.6);
  });

  it("never clips a ray that misses the figure to nothing", () => {
    // A grazing ray meets no part of the figure; it must still march the chord
    // rather than collapse to a zero-length interval and divide by it.
    const [from, to] = chordMarchInterval(-0.05, 0.6);
    expect(to).toBeGreaterThan(from);
    expect(to).toBeCloseTo(0.1, 6);
  });

  it("stays inside the glass at every density the pack authors", () => {
    for (const density of [0, 0.35, 0.6, 1]) {
      const [from, to] = chordMarchInterval(-1, figureBound(density, 1));
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(2 + 1e-9);
    }
  });

  it("takes the strongest hit along the chord rather than compositing", () => {
    const source = fragment("high");
    expect(source).toContain(
      "ink = max(ink, gbgFigure(q, vSigil, aTime, widthBias));"
    );
    expect(source).not.toContain("ink += ");
    // Which also means the tier's step count changes how finely the glass is
    // searched, never how heavy the figure comes out.
    expect(source).toContain("gbgMarchInterval(entryDotDir, gbgFigureBound(");
  });

  it("gives every line a screen-space width so the drawing cannot fray", () => {
    const source = fragment("high");
    expect(source).toContain(
      "gbgInkAA = max(length(dFdx(aaProbe)), length(dFdy(aaProbe)))"
    );
    // Measured on the *marched* point, so it carries the refraction's own
    // compression — which is worst exactly where the tearing was worst.
    expect(source).toContain(
      "vec3 aaProbe = vec3(dot(mid, rx), dot(mid, ry), dot(mid, fz))"
    );
    // No construction may draw with the width-blind line function any more.
    const figures = source.slice(source.indexOf("float gbgFigureSpiral"));
    const constructions = figures.slice(
      0,
      figures.indexOf("float gbgFigure(vec3 pIn")
    );
    expect(constructions.length).toBeGreaterThan(1000);
    expect(constructions).not.toContain("gbgLine(");
    expect(constructions).toContain("gbgInk(");
  });
});

/**
 * MAT-03 — THE BEAD HAS AN EDGE
 *
 * The silhouette was the drawn polygon's: a forty-sided sphere, whose outline
 * wobbles by a pixel from facet to facet, decorated with the outermost 2.5% of
 * the collar's graduations — sub-pixel marks, with no antialiasing anywhere in
 * the pipeline to catch them. Together those read as a dotted hairline, which
 * is what a compression artifact looks like.
 *
 * The drawn geometry is now a proxy that *contains* the bead, and the sphere is
 * solved per fragment. That only works if the proxy really does contain it:
 * a face that cuts inside the unit sphere takes a bite out of the silhouette.
 */
describe("the bead's silhouette is a circle", () => {
  /** Distance from the origin to each triangle's plane, for a scaled sphere. */
  const facePlanes = (scale: number): number[] => {
    const { width, height } = BEAD_PROXY_SEGMENTS;
    const geometry = new THREE.SphereGeometry(1, width, height);
    geometry.scale(scale, scale, scale);
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex()!;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const plane = new THREE.Plane();
    const out: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i));
      b.fromBufferAttribute(position, index.getX(i + 1));
      c.fromBufferAttribute(position, index.getX(i + 2));
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      if (ab.cross(ac).length() < 1e-9) continue;
      plane.setFromCoplanarPoints(a, b, c);
      out.push(Math.abs(plane.constant));
    }
    geometry.dispose();
    return out;
  };

  it("draws a proxy that contains the whole bead from every direction", () => {
    const lift = beadProxyScale(
      BEAD_PROXY_SEGMENTS.width,
      BEAD_PROXY_SEGMENTS.height
    );
    const planes = facePlanes(lift);
    expect(planes.length).toBeGreaterThan(100);
    // Every face outside the unit sphere ⇒ the convex proxy contains it ⇒ the
    // solved silhouette is a complete circle from any angle.
    expect(Math.min(...planes)).toBeGreaterThanOrEqual(1);
    // And not wastefully far outside it: this is overdraw, and it is paid for
    // in fragments of a shader that marches glass.
    expect(Math.min(...planes)).toBeLessThan(1.05);
  });

  it("would not, drawn on the unit sphere the bead used to be", () => {
    // The bead the critic photographed: the polygon *was* the silhouette, and
    // every face plane cuts inside the circle it was meant to describe.
    expect(Math.min(...facePlanes(1))).toBeLessThan(0.995);
  });

  it("solves the surface per fragment and antialiases its own coverage", () => {
    const source = fragment("high");
    expect(source).toContain(
      "float disc = along * along - (dot(ro, ro) - 1.0);"
    );
    expect(source).toContain(
      "clamp(disc / max(fwidth(disc), 1e-6) + 0.5, 0.0, 1.0)"
    );
    expect(source).toContain(
      "vec3 n = normalize(ro + rv * (-along - sqrt(max(disc, 0.0))));"
    );
    // Antialiased against the room rather than by blending, so the bead stays
    // opaque and nothing drawn after it sorts against a half-transparent edge.
    expect(source).toContain(
      "gl_FragColor = vec4(mix(behind, col, edge), 1.0);"
    );
    // Every derivative is taken before the discard, or a fragment leaving the
    // draw takes its neighbours' antialiasing with it.
    const discard = source.indexOf("discard");
    expect(discard).toBeGreaterThan(source.lastIndexOf("fwidth(rho)"));
    expect(discard).toBeGreaterThan(source.lastIndexOf("gbgAngleAA(uv)"));
    expect(source.slice(discard)).not.toContain("dFdx");
  });

  it("draws the setting at a width it can be seen at", () => {
    const source = fragment("high");
    // The collar's rules and graduations are coverage-aware …
    expect(source).toContain(
      "float gbgSetting(vec2 uv, float code, float majors, float aaR, float aaA)"
    );
    expect(source).not.toContain("gbgLine(rho -");
    // … and the edge itself is a drawn arris rather than whatever the collar
    // happened to leave behind at that radius.
    expect(source).toContain("gbgBezelArris(rho, aaR)");
    expect(source).toContain("gbgBezelQuirk(rho, aaR)");
  });
});

/**
 * m9 — CONTRAST IS NOT GOLD LEAF'S JOB
 *
 * A faculty's ink was mixed toward the world's engraving colour and drawn at
 * whatever value that landed on; gold leaf was mixed in on top of it. The four
 * gilded concepts therefore came out about a third brighter than everything
 * else, and at the size a bead occupies that is the difference between a figure
 * you can read and a figure you can only tell is present.
 */
describe("every faculty's ink is drawn at one value", () => {
  const linear = (hex: string): [number, number, number] => {
    const colour = new THREE.Color(hex);
    return [colour.r, colour.g, colour.b];
  };
  const mix = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    t: number
  ): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  /** What the shader mixes, before it decides what value to draw it at. */
  const mixed = (inkHex: string, gilded: boolean): [number, number, number] =>
    mix(
      mix(
        linear(castalia.palette.engraving),
        linear(inkHex),
        castalia.inkSaturation
      ),
      linear(castalia.palette.gold),
      gilded ? 1 : 0
    );

  const cases = FACULTIES.flatMap((faculty) => [
    { label: faculty.id, rgb: mixed(faculty.ink, false) },
    { label: `${faculty.id} gilded`, rgb: mixed(faculty.ink, true) },
  ]);

  it("was the source of the illegibility, and the measurement shows it", () => {
    // The old shader drew exactly `mixed` — this is the spread it had.
    const values = cases.map((entry) => relativeLuminance(entry.rgb));
    expect(Math.max(...values) / Math.min(...values)).toBeGreaterThan(1.25);
  });

  it("draws every faculty, gilded or not, at the same value", () => {
    for (const entry of cases) {
      expect(relativeLuminance(inkAtValue(entry.rgb))).toBeCloseTo(
        INK_VALUE,
        6
      );
    }
    // Nothing was darkened to make that true: the value is the one gold leaf
    // already had, so the fix is four faculties brought up to it.
    expect(INK_VALUE).toBeGreaterThanOrEqual(
      relativeLuminance(linear(castalia.palette.gold)) - 1e-3
    );
  });

  it("keeps the hue it was given — this is a value change, not a repaint", () => {
    for (const entry of cases) {
      const after = inkAtValue(entry.rgb);
      const scale = after[0] / entry.rgb[0];
      expect(after[1] / entry.rgb[1]).toBeCloseTo(scale, 6);
      expect(after[2] / entry.rgb[2]).toBeCloseTo(scale, 6);
    }
  });

  it("normalises after gilding, so gold cannot be where contrast comes from", () => {
    const source = fragment("high");
    const gild = source.indexOf("inkCol = mix(inkCol, uGold, gilded);");
    const value = source.indexOf("inkCol = gbgInkValue(inkCol);");
    expect(gild).toBeGreaterThan(-1);
    expect(value).toBeGreaterThan(gild);
  });

  it("emits the value and the luminance weights it was measured with", () => {
    const source = fragment("high");
    const weights =
      /gbgLuma\(vec3 c\) \{\s*return dot\(c, vec3\(([\d.]+), ([\d.]+), ([\d.]+)\)\);/.exec(
        source
      );
    expect(weights).not.toBeNull();
    // The shader's luminance is this module's luminance, to the last digit
    // either of them can carry.
    expect(relativeLuminance([1, 0, 0])).toBeCloseTo(Number(weights![1]), 6);
    expect(relativeLuminance([0, 1, 0])).toBeCloseTo(Number(weights![2]), 6);
    expect(relativeLuminance([0, 0, 1])).toBeCloseTo(Number(weights![3]), 6);
    const target = /gbgInkValue\(vec3 c\) \{\s*return c \* \(([\d.]+) \//.exec(
      source
    );
    expect(target).not.toBeNull();
    expect(Number(target![1])).toBeCloseTo(INK_VALUE, 6);
  });

  it("distinguishes faculties by how the ink is laid down, not by brightness", () => {
    expect(fragment("high")).toContain("gbgSettingInkWeight(vSet.x)");
  });
});
