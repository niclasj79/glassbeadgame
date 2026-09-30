import * as THREE from "three";
import { BlendFunction, Effect, EffectAttribute, EffectPass } from "postprocessing";
import type { CandidateResonance, ResonanceBand } from "@/domain/relations/resonance";
import type { QualityTier } from "@/lib/device";
import type { FocusView } from "@/runtime/interactionDraft";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import { frameState } from "./frameState";
import { focusFrame, sampleFocusView } from "./focusFrame";
import {
  CLARITY_EPSILON,
  FOG_BEAD_STRIDE,
  FOG_BLUR_RADIUS_PX,
  FOG_EASE_SECONDS,
  FOG_FLOOR,
  FOG_LIFT_MAX_SECONDS,
  FOG_MAX_CIRCLES,
  LENS_DIAMETER,
  buildFogCircles,
  createFogEase,
  fogClarityTarget,
  fogTreatment,
  lensShape,
  stepClarity,
  stepFogEase,
  stepLens,
  type FogTreatment,
} from "./focusFog";
import { sceneBudget } from "./quality";

/**
 * THE FOG, DRAWN (I-017)
 *
 * One full-screen pass: the frame dimmed toward the page's own ground and —
 * where the tier and the player allow it — softened, everywhere except inside
 * a handful of clear discs: the attended bead, the lens, each band's glow, and
 * a sharp bead's name. Every number it draws with is decided in `focusFog.ts`;
 * this module only measures the frame and hands the answers over.
 *
 * It is loaded after the first paint, not before it: nothing here is needed
 * until a bead is attended, and the first download is a budget
 * (`scripts/bundle-budgets.json`: "the answer is another dynamic import, not
 * another number"). `FocusFogEffect.tsx` holds its place in the composer's
 * chain from the first frame, so it arrives exactly where it belongs.
 *
 * WHERE IT STANDS IN THE CHAIN, AND WHY. Before the bloom, in a pass of its
 * own. Two reasons, one about cost and one about light:
 *
 *   A pass that is not the last one can simply be switched off, and the
 *   composer then skips it outright — no draw, no swap. So while the air is
 *   clear the fog costs nothing at all, which a pass rendering to the screen
 *   could never do.
 *
 *   The bloom then gathers from the fogged frame: the dimmed world falls below
 *   its threshold and stops throwing light, while the attended bead and
 *   whatever is under the lens keep their glare. The fog quietens the glow as
 *   well as the pigment, which is what receding is.
 *
 * THE SOFTENING IS ONE PASS. Nine or thirteen bilinear taps of the frame in
 * the same fragment that dims it, a few pixels wide: slight, by instruction.
 * The engraved tier and reduced motion compile none (`fogTreatment`), so the
 * dim-only fog is a single texture read and the discs.
 *
 * NOTHING HERE ALLOCATES ON THE FRAME PATH. Every per-bead number lives in
 * arrays sized when the draw changes; uniforms are written in place.
 *
 * The shader, in words: each disc is (centre, inverse radii) and (strength,
 * core) — fully clear inside the core, fog again at the rim, smooth between;
 * the clarity of a pixel is the strongest disc over it; the fog pulls the
 * softened frame toward the page's own ground, never toward black, and keeps
 * the floor of it (`focusFog.fogPixel` is the same arithmetic, tested).
 */
const FRAGMENT = /* glsl */ `
uniform vec4 uShape[FOG_MAX_CIRCLES];
uniform vec2 uWeight[FOG_MAX_CIRCLES];
uniform int uCount;
uniform vec4 uLensShape;
uniform vec2 uLensWeight;
uniform float uAmount;
uniform float uFloor;
uniform float uBlur;
uniform vec2 uBlurStep;
uniform vec3 uGround;
float clearDisc(const in vec2 p, const in vec4 shape, const in vec2 weight) {
  float d = length((p - shape.xy) * shape.zw);
  return weight.x * (1.0 - smoothstep(weight.y, 1.0, d));
}
float clarityAt(const in vec2 p) {
  float clear = clearDisc(p, uLensShape, uLensWeight);
  for (int i = 0; i < FOG_MAX_CIRCLES; i++) {
    if (i >= uCount) break;
    clear = max(clear, clearDisc(p, uShape[i], uWeight[i]));
  }
  return clear;
}
#if FOG_TAPS > 0
vec3 fogTap(const in vec2 uv) {
  return texture2D(inputBuffer, uv).rgb;
}
vec3 softened(const in vec2 uv, const in vec3 centre) {
  vec2 s = uBlurStep;
  vec2 d = s * 0.7071;
#if FOG_TAPS >= 13
  vec3 sum = centre * 0.16;
  sum += (fogTap(uv + vec2(s.x, 0.0)) + fogTap(uv - vec2(s.x, 0.0)) +
    fogTap(uv + vec2(0.0, s.y)) + fogTap(uv - vec2(0.0, s.y))) * 0.1;
  sum += (fogTap(uv + d) + fogTap(uv - d) +
    fogTap(uv + vec2(d.x, -d.y)) + fogTap(uv + vec2(-d.x, d.y))) * 0.07;
  sum += (fogTap(uv + vec2(2.0 * s.x, 0.0)) + fogTap(uv - vec2(2.0 * s.x, 0.0)) +
    fogTap(uv + vec2(0.0, 2.0 * s.y)) + fogTap(uv - vec2(0.0, 2.0 * s.y))) * 0.04;
#else
  vec3 sum = centre * 0.25;
  sum += (fogTap(uv + vec2(s.x, 0.0)) + fogTap(uv - vec2(s.x, 0.0)) +
    fogTap(uv + vec2(0.0, s.y)) + fogTap(uv - vec2(0.0, s.y))) * 0.125;
  sum += (fogTap(uv + d) + fogTap(uv - d) +
    fogTap(uv + vec2(d.x, -d.y)) + fogTap(uv + vec2(-d.x, d.y))) * 0.0625;
#endif
  return sum;
}
#endif
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 fogged = inputColor.rgb;
#if FOG_TAPS > 0
  if (uBlur > 0.001) fogged = mix(fogged, softened(uv, inputColor.rgb), uBlur);
#endif
  vec3 dimmed = uGround + (fogged - uGround) * uFloor;
  float ratio = resolution.x / max(resolution.y, 1.0);
  float clear = clarityAt(vec2(uv.x * ratio, uv.y));
  vec3 veiled = mix(dimmed, inputColor.rgb, clear);
  outputColor = vec4(mix(inputColor.rgb, veiled, uAmount), inputColor.a);
}
`;

/** Which bands the draw's beads carry, by `frameState.beadIndex`. */
interface BandTable {
  resonance: readonly CandidateResonance[] | null;
  beadIndex: Map<string, number> | null;
  ids: string[];
  bands: (ResonanceBand | null)[];
}

class FocusFogEffect extends Effect {
  /** The arena's camera, measured every frame from inside the render. */
  camera: THREE.Camera | null = null;
  /** Eased clarity per bead, by `frameState.beadIndex`, written by the driver. */
  clarity = new Float32Array(0);
  /** The eased fog and softening, written by the driver. */
  amount = 0;
  blur = 0;
  /** Whether the lens is live and present enough to name what is under it. */
  lensOn = false;

  private readonly shape: THREE.Uniform<Float32Array>;
  private readonly weight: THREE.Uniform<Float32Array>;
  private readonly count: THREE.Uniform<number>;
  private readonly lensShapeUniform: THREE.Uniform<THREE.Vector4>;
  private readonly lensWeightUniform: THREE.Uniform<THREE.Vector2>;
  private readonly amountUniform: THREE.Uniform<number>;
  private readonly blurUniform: THREE.Uniform<number>;
  private readonly blurStep: THREE.Uniform<THREE.Vector2>;
  private readonly ground: THREE.Uniform<THREE.Color>;
  private beads = new Float32Array(0);
  private order = new Int32Array(0);
  private width = 1;
  private height = 1;
  private readonly view = new THREE.Vector3();

  constructor() {
    const shape = new THREE.Uniform(new Float32Array(FOG_MAX_CIRCLES * 4));
    const weight = new THREE.Uniform(new Float32Array(FOG_MAX_CIRCLES * 2));
    const count = new THREE.Uniform(0);
    const lensShapeUniform = new THREE.Uniform(new THREE.Vector4(0, 0, 1, 1));
    const lensWeightUniform = new THREE.Uniform(new THREE.Vector2(0, 0.5));
    const amountUniform = new THREE.Uniform(0);
    const blurUniform = new THREE.Uniform(0);
    const blurStep = new THREE.Uniform(new THREE.Vector2(0, 0));
    const ground = new THREE.Uniform(new THREE.Color(0, 0, 0));
    super("FocusFogEffect", FRAGMENT, {
      blendFunction: BlendFunction.SRC,
      defines: new Map([
        ["FOG_MAX_CIRCLES", String(FOG_MAX_CIRCLES)],
        ["FOG_TAPS", "0"],
      ]),
      uniforms: new Map<string, THREE.Uniform>([
        ["uShape", shape],
        ["uWeight", weight],
        ["uCount", count],
        ["uLensShape", lensShapeUniform],
        ["uLensWeight", lensWeightUniform],
        ["uAmount", amountUniform],
        ["uFloor", new THREE.Uniform(FOG_FLOOR)],
        ["uBlur", blurUniform],
        ["uBlurStep", blurStep],
        ["uGround", ground],
      ]),
    });
    this.shape = shape;
    this.weight = weight;
    this.count = count;
    this.lensShapeUniform = lensShapeUniform;
    this.lensWeightUniform = lensWeightUniform;
    this.amountUniform = amountUniform;
    this.blurUniform = blurUniform;
    this.blurStep = blurStep;
    this.ground = ground;
  }

  /**
   * Compile the softening in or out. A convolution only when there is one:
   * the dim-only fog reads the frame at its own pixel and nowhere else.
   */
  setTreatment(treatment: FogTreatment): void {
    const taps = String(treatment.blurTaps);
    if (this.defines.get("FOG_TAPS") === taps) return;
    this.defines.set("FOG_TAPS", taps);
    this.setAttributes(
      treatment.blurTaps > 0 ? EffectAttribute.CONVOLUTION : EffectAttribute.NONE
    );
    this.setChanged();
  }

  /** The page's ground, as the theme states it (sRGB), carried into linear light. */
  setGround(colour: string): void {
    this.ground.value.set(colour);
  }

  /** Size the per-bead scratch for a draw of `count` beads. Only on change. */
  sizeFor(count: number): void {
    if (this.clarity.length !== count) this.clarity = new Float32Array(count);
    if (this.beads.length !== count * FOG_BEAD_STRIDE) {
      this.beads = new Float32Array(count * FOG_BEAD_STRIDE);
    }
    if (this.order.length !== count) this.order = new Int32Array(count);
  }

  override setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  /**
   * Measured from inside the render, after the scene has been drawn: the
   * camera's matrices here are exactly the ones the frame was drawn with, so a
   * disc of clear air sits on its bead even while the camera is turning. The
   * same measurement says which beads are under the lens, for `Beads` to name.
   */
  override update(renderer: THREE.WebGLRenderer): void {
    this.amountUniform.value = this.amount;
    this.blurUniform.value = this.blur;
    const pixelRatio = renderer.getPixelRatio();
    this.blurStep.value.set(
      (FOG_BLUR_RADIUS_PX * pixelRatio) / this.width,
      (FOG_BLUR_RADIUS_PX * pixelRatio) / this.height
    );

    const ratio = this.width / this.height;
    const lens = focusFrame.lens;
    const lensX = lens.x * ratio;
    const lensY = 1 - lens.y;
    const shape = lensShape(ratio);
    this.lensShapeUniform.value.set(lensX, lensY, 1 / shape.radius, 1 / shape.radius);
    this.lensWeightUniform.value.set(lens.strength, shape.core);
    // Under the lens is inside its half-clear edge: a twelfth of the width.
    const lensReach = (LENS_DIAMETER * ratio) / 2;

    const camera = this.camera;
    const rendered = frameState.rendered;
    const count = Math.min(
      this.clarity.length,
      Math.floor(rendered.length / 3),
      Math.floor(this.beads.length / FOG_BEAD_STRIDE)
    );
    if (!camera || count <= 0) {
      this.count.value = 0;
      return;
    }
    const projection = camera.projectionMatrix.elements;
    const radii = focusFrame.radius;
    const names = focusFrame.names;
    const lensed = focusFrame.lensed;
    const beads = this.beads;
    const view = this.view;
    for (let i = 0; i < count; i++) {
      const at = i * FOG_BEAD_STRIDE;
      view
        .set(rendered[i * 3], rendered[i * 3 + 1], rendered[i * 3 + 2])
        .applyMatrix4(camera.matrixWorldInverse);
      const depth = -view.z;
      beads[at + 3] = this.clarity[i];
      if (!(depth > 1e-3) || i >= radii.length) {
        beads[at + 2] = 0;
        if (i < lensed.length) lensed[i] = 0;
        continue;
      }
      view.applyMatrix4(camera.projectionMatrix);
      // Half-height NDC to the pass's full-height units: halve it.
      const x = ((view.x + 1) / 2) * ratio;
      const y = (view.y + 1) / 2;
      beads[at] = x;
      beads[at + 1] = y;
      beads[at + 2] = (radii[i] * projection[5]) / depth / 2;
      if (i < lensed.length) {
        lensed[i] =
          this.lensOn && Math.hypot(x - lensX, y - lensY) < lensReach ? 1 : 0;
      }
      // The name's box, from the arena's isotropic half-height units.
      const hasName = names.length >= (i + 1) * 4 && names[i * 4 + 2] > 0;
      beads[at + 4] = hasName ? names[i * 4] / 2 : 0;
      beads[at + 5] = hasName ? names[i * 4 + 1] / 2 : 0;
      beads[at + 6] = hasName ? names[i * 4 + 2] / 2 : 0;
      beads[at + 7] = hasName ? names[i * 4 + 3] / 2 : 0;
    }
    this.count.value = buildFogCircles(
      beads,
      count,
      this.order,
      this.shape.value,
      this.weight.value
    );
  }
}

/**
 * THE FOG'S OWN CLOCK.
 *
 * Runs on every frame, whether or not the pass is drawing, because it is what
 * decides whether the pass draws: it reads the one focus view, eases the fog,
 * the softening, each bead's clarity and the lens toward what the view asks
 * for, and switches the pass off once the air is clear again.
 *
 * WHILE THE FOG LIFTS, NOTHING IN IT CHANGES. The discs keep the clarity they
 * had — the pair stays sharp as the world clears round it — and only the
 * amount eases out; from clear air they start at their targets, because a
 * change nobody can see need not be eased. After a commit the lift takes the
 * length of the commit's own performance (M2-012 "Return": the fog lifts on
 * its own as the performance ends), and never less than the ordinary ease.
 */
class FocusFogDriver {
  private readonly ease = createFogEase();
  private liftSeconds = FOG_EASE_SECONDS;
  private readonly table: BandTable = {
    resonance: null,
    beadIndex: null,
    ids: [],
    bands: [],
  };

  constructor(
    private readonly effect: FocusFogEffect,
    private readonly host: { enabled: boolean }
  ) {}

  /** The commit's performance is being staged: lift over its length. */
  liftOver(seconds: number): void {
    const bounded = Number.isFinite(seconds) ? seconds : FOG_EASE_SECONDS;
    this.liftSeconds = Math.min(FOG_LIFT_MAX_SECONDS, Math.max(FOG_EASE_SECONDS, bounded));
  }

  advance(dt: number): void {
    const view = sampleFocusView();
    const active = view.fog.active;
    this.refreshTable();
    const effect = this.effect;
    const table = this.table;
    effect.sizeFor(table.ids.length);

    const fromClear = this.ease.amount <= CLARITY_EPSILON;
    if (active) {
      this.liftSeconds = FOG_EASE_SECONDS;
      const clarity = effect.clarity;
      for (let i = 0; i < clarity.length; i++) {
        const want = fogClarityTarget(isSharp(view, table.ids[i]), table.bands[i] ?? null);
        clarity[i] = fromClear ? want : stepClarity(clarity[i], want, dt);
      }
      const blurWant = view.fog.blur ? 1 : 0;
      effect.blur = fromClear ? blurWant : stepClarity(effect.blur, blurWant, dt);
      this.advanceLens(view, dt, fromClear);
    } else {
      effect.lensOn = false;
    }
    // What is under the lens is measured inside the render; with no lens there
    // is nothing under it, and nothing stale may be left for the names to read.
    if (!effect.lensOn) focusFrame.lensed.fill(0);

    const amount = stepFogEase(
      this.ease,
      active ? 1 : 0,
      dt,
      active ? FOG_EASE_SECONDS : this.liftSeconds
    );
    if (!active && amount <= 0) this.liftSeconds = FOG_EASE_SECONDS;
    effect.amount = amount;
    this.host.enabled = active || amount > 0;
  }

  /** The lens follows the hand only while it is a lens; otherwise it fades where it is. */
  private advanceLens(view: FocusView, dt: number, fromClear: boolean): void {
    const lens = focusFrame.lens;
    const live = view.lensActive && frameState.lens.active;
    const reducedMotion = useStore.getState().settings.reducedMotion;
    if (live) {
      if (fromClear || lens.strength <= CLARITY_EPSILON) {
        lens.x = frameState.lens.x;
        lens.y = frameState.lens.y;
      } else {
        lens.x = stepLens(lens.x, frameState.lens.x, dt, reducedMotion);
        lens.y = stepLens(lens.y, frameState.lens.y, dt, reducedMotion);
      }
    }
    const want = live ? 1 : 0;
    lens.strength = fromClear ? want : stepClarity(lens.strength, want, dt);
    this.effect.lensOn = live && lens.strength > 0.5;
  }

  /** Rebuilt only when the draw or the published bands change — never per frame. */
  private refreshTable(): void {
    const table = this.table;
    const resonance = interpretationPresentationStore.getState().candidateResonance;
    const beadIndex = frameState.beadIndex;
    if (table.resonance === resonance && table.beadIndex === beadIndex) return;
    if (table.beadIndex !== beadIndex) {
      const ids: string[] = new Array(beadIndex.size).fill("");
      beadIndex.forEach((index, id) => {
        if (index >= 0 && index < ids.length) ids[index] = id;
      });
      table.ids = ids;
    }
    const bands: (ResonanceBand | null)[] = new Array(table.ids.length).fill(null);
    for (const candidate of resonance) {
      const index = beadIndex.get(String(candidate.candidateId));
      if (index !== undefined && index < bands.length) bands[index] = candidate.band;
    }
    table.bands = bands;
    table.resonance = resonance;
    table.beadIndex = beadIndex;
  }
}

function isSharp(view: FocusView, id: string | undefined): boolean {
  if (id === undefined) return false;
  const sharp = view.sharpConceptIds;
  for (let k = 0; k < sharp.length; k++) {
    if (sharp[k] === id) return true;
  }
  return false;
}

export interface FocusFogSettings {
  readonly camera: THREE.Camera;
  readonly tier: QualityTier;
  readonly reducedMotion: boolean;
  /** The page's ground, as the theme states it. */
  readonly ground: string;
}

/** The fog, as the arena's composer holds it. */
export interface FocusFog {
  /** The pass that draws it; `FocusFogEffect.tsx`'s slot renders it. */
  readonly pass: EffectPass;
  configure(settings: FocusFogSettings): void;
  /** The commit's performance is being staged: lift over its length. */
  liftOver(seconds: number): void;
  /** One frame of the fog's own clock. */
  advance(dt: number): void;
}

/**
 * Build the fog. `host` is the pass the composer actually holds — its
 * `enabled` is what the driver switches, so clear air costs nothing. The pass
 * is built without the arena's camera: the fog reads no depth, and the camera
 * it measures beads with is handed over by `configure`.
 */
export function createFocusFog(host: { enabled: boolean }): FocusFog {
  const effect = new FocusFogEffect();
  const pass = new EffectPass(undefined, effect);
  const driver = new FocusFogDriver(effect, host);
  return {
    pass,
    configure: (settings) => {
      effect.camera = settings.camera;
      effect.setTreatment(fogTreatment(sceneBudget(settings.tier), settings.reducedMotion));
      effect.setGround(settings.ground);
    },
    liftOver: (seconds) => driver.liftOver(seconds),
    advance: (dt) => driver.advance(dt),
  };
}
