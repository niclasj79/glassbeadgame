import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, Text } from "@react-three/drei";
import interWoff from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import { useStore } from "@/state/store";
import { initialQualityTier } from "@/lib/device";
import { DEFAULT_THEME } from "@/themes";
import { useCurrentTheme } from "@/themes/useTheme";
import { Cosmos } from "./Cosmos";
import { GLASS_ATTRIBUTES, createBeadGlassMaterial } from "./glass";
import { presentationProfile } from "./quality";
import { OPENING_ALPHABET, openingWorld } from "./opening";
import { awaitLinks } from "./prewarmLinks";
import { testMode } from "@/runtime/testMode";
import { handleArenaMiss } from "./threading";

/**
 * THE WORLD IS BUILT WHILE THE PLAYER IS READING.
 *
 * Measured on a cold profile, headed, on a real GPU: the first press of BEGIN
 * blocked the main thread for 1956–2236 ms. Instrumenting the GL context named
 * the cause exactly — four programs are linked in answer to the press, and the
 * bead glass, whose fragment shader solves a sphere and marches a refracted
 * chord through it, blocks for **1914 ms** inside `getProgramInfoLog`: three.js
 * at the first draw, waiting for a link the driver has not finished. The other
 * three cost 29, 8 and 27 ms between them.
 *
 * A link cannot be made cheaper and cannot be split across frames. It can only
 * be started earlier. So the arena's two expensive constructions — the glass
 * program, and the label's derived program together with the signed-distance
 * atlas its glyphs are drawn from — are made here, off-stage, while the title
 * is up, and waited for with a poll of the parallel-compile extension's
 * completion status instead of a block on it (`prewarmLinks.ts`, which is
 * three's own `compileAsync` wait made safe for a material disposed mid-link).
 * `scene/opening.ts` carries the measurements and holds the door on the result.
 *
 * Three things this deliberately does *not* do. It does not build a second
 * scene: the program cache is keyed on the material *and the scene it is drawn
 * in* — lights, fog, tone mapping, and the colour space of whatever is bound —
 * so a warm-up under conditions of its own links a different program and leaves
 * the real one cold. It does not draw anything until the link is finished,
 * because a draw is exactly the blocking call being avoided. And it never
 * unmounts: three releases a program when the last material holding it is
 * disposed, so a warm-up that tidies itself away is a warm-up that undoes
 * itself.
 *
 * Measured after, three cold profiles, same machine: worst frame gap after the
 * press 105, 107 and 106 ms, all of it the audio context opening on the first
 * gesture (`audio/useAudio.ts`) — with that already unlocked, the first frame
 * after the press paints at 16 ms and the worst gap in the whole opening is
 * 53 ms. The title costs nothing for it: worst title-phase gap 346–365 ms
 * against 353–479 ms before this existed.
 */

/**
 * Far enough out that every vertex is clipped by the camera's far plane. The
 * meshes are drawn — that is the whole point, a program's first use is what
 * costs — and rasterise nothing.
 */
const OFF_STAGE = 1e5;

/**
 * Frames the warm-up stays drawable. Two: `useFrame` runs before the renderer
 * does, so the first pass only arms it and the second confirms a frame has been
 * drawn with these programs bound.
 */
const PREWARM_FRAMES = 2;

/**
 * How long the warm-up waits for the label's glyph atlas before going on
 * without it. Measured cold, the font is fetched, parsed and cut in 300–900 ms;
 * this is generous enough that it is never reached in ordinary weather and
 * short enough that a font which never arrives costs a label rather than the
 * whole door.
 */
const PREWARM_TYPE_WAIT_MS = 4000;

/** One zeroed instance of every per-instance buffer the glass declares. */
function prewarmGlassGeometry(): THREE.BufferGeometry {
  const geometry: THREE.BufferGeometry = new THREE.SphereGeometry(1, 8, 6);
  const widths: ReadonlyArray<readonly [string, number]> = [
    [GLASS_ATTRIBUTES.sigil, 4],
    [GLASS_ATTRIBUTES.ink, 3],
    [GLASS_ATTRIBUTES.set, 4],
    [GLASS_ATTRIBUTES.state, 4],
    [GLASS_ATTRIBUTES.tier, 2],
  ];
  for (const [name, size] of widths) {
    geometry.setAttribute(
      name,
      new THREE.InstancedBufferAttribute(new Float32Array(size), size)
    );
  }
  return geometry;
}

type WarmStage = "warming" | "drawing" | "done";

/** A signal a promise can wait on and a callback can fire. */
interface Latch {
  readonly settled: Promise<void>;
  release(): void;
}

function createLatch(): Latch {
  let release = (): void => undefined;
  const settled = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { settled, release };
}

function Prewarm() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const theme = useCurrentTheme();
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);

  const [stage, setStage] = useState<WarmStage>("warming");
  const group = useRef<THREE.Group>(null);
  const drawnFrames = useRef(0);

  const profile = useMemo(
    () => presentationProfile(tier, reducedMotion),
    [tier, reducedMotion]
  );
  // The same construction the arena will ask for, so the program the arena
  // wants is the program this links.
  const material = useMemo(
    () =>
      createBeadGlassMaterial({
        theme,
        budget: profile.budget,
        reducedMotion: profile.reducedMotion,
      }),
    [theme, profile.budget, profile.reducedMotion]
  );
  useEffect(() => () => material.dispose(), [material]);

  const geometry = useMemo(prewarmGlassGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  /**
   * A one-pixel target, bound only for the instant `compile()` reads the
   * renderer's state. See `compileInto` below for why that instant decides
   * whether any of this works at all.
   */
  const asIfComposed = useMemo(() => new THREE.WebGLRenderTarget(1, 1), []);
  useEffect(() => () => asIfComposed.dispose(), [asIfComposed]);

  /**
   * troika re-syncs on every render, so this arrives more than once; the latch
   * makes the extra arrivals free and keeps the callback stable, which is what
   * stops the signal from provoking another sync.
   */
  const [typeset] = useState(createLatch);
  const onTypeset = useCallback(() => typeset.release(), [typeset]);

  useEffect(() => {
    let cancelled = false;

    /**
     * COMPILE UNDER THE CONDITIONS THE DRAW WILL ACTUALLY HAPPEN IN.
     *
     * three keys its program cache on `parameters.outputColorSpace`, which is
     * the renderer's own colour space when drawing to the canvas and linear
     * when drawing to a render target — and the arena is drawn to a render
     * target, because the composer owns the frame. A `compileAsync` called with
     * nothing bound therefore links a program the frame will never use, and the
     * real one is linked at the first draw exactly as before.
     *
     * This was not a theory. Traced on a cold profile with the compile
     * unbound: the glass was linked at 3119 ms, `compileAsync` waited 2.8 s for
     * it, and then the first draw linked the glass *a second time* at 5923 ms
     * and blocked for 1985 ms doing it. Binding a target for the length of the
     * synchronous `compile()` is the whole fix.
     *
     * And only this group is compiled, under the scene's own lights and fog.
     * The glass is remade with the theme, and the theme is the session's, so
     * this runs again while a Game is up — and a compile of the whole scene
     * then collects the live beads' materials too, which the arena disposes
     * when the Game is left. three's `compileAsync` throws from its timer at
     * that; the wait here lets a disposed material go (`prewarmLinks.ts`).
     */
    const compileInto = (): Promise<void> => {
      const previous = gl.getRenderTarget();
      gl.setRenderTarget(asIfComposed);
      const linked = gl.compile(group.current ?? scene, camera, scene);
      gl.setRenderTarget(previous);
      return awaitLinks(gl, linked);
    };

    /**
     * The glass is started at once rather than after the type, because it is
     * the long pole by an order of magnitude and it links on the driver's own
     * thread — so the font can be fetched, parsed and cut into an atlas in its
     * worker during the same seconds. The second compile picks up the label's
     * derived program, which does not exist until the label does.
     *
     * The type is waited for, but not indefinitely. A font that never arrives
     * would otherwise hold this chain open forever and leave the door to be
     * opened by its own deadline — which is the freeze, back again. The glass
     * is what the press cannot afford; a late atlas costs a label, and the
     * label is the smaller loss by two orders of magnitude.
     */
    const type = new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, PREWARM_TYPE_WAIT_MS);
      void typeset.settled.then(() => {
        window.clearTimeout(timer);
        resolve();
      });
    });

    void Promise.all([compileInto(), type])
      .then(compileInto)
      .then(() => {
        if (cancelled) return;
        drawnFrames.current = 0;
        setStage("drawing");
      });
    return () => {
      cancelled = true;
    };
    // `material` is a dependency because a quality tier that changes while the
    // title is up changes the glass's `#define`s, and a warm-up still holding
    // the program for a tier the arena no longer wants has warmed nothing.
  }, [gl, scene, camera, asIfComposed, typeset, material]);

  useFrame(() => {
    if (stage !== "drawing") return;
    drawnFrames.current += 1;
    if (drawnFrames.current < PREWARM_FRAMES) return;
    const node = group.current;
    if (node) node.visible = false;
    setStage("done");
    openingWorld.open();
  });

  const label = {
    font: interWoff,
    fontSize: 0.115,
    letterSpacing: 0.04,
    color: theme.palette.vellum,
    anchorX: "center" as const,
    anchorY: "top" as const,
    outlineWidth: 0.008,
    outlineColor: theme.palette.ground,
    outlineOpacity: 0.92,
    maxWidth: 2.1,
    textAlign: "center" as const,
  };

  return (
    <group
      ref={group}
      position={[0, OFF_STAGE, 0]}
      visible={stage === "drawing"}
    >
      <instancedMesh args={[geometry, material, 1]} frustumCulled={false} />
      {/* The invisible hit target's material is a program too. */}
      <mesh frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
      <Suspense fallback={null}>
        {/* The atlas: every letter the pack can ask for, cut before any name
            needs one. */}
        <Text {...label} characters={OPENING_ALPHABET} onSync={onTypeset}>
          {OPENING_ALPHABET}
        </Text>
        {/* And the same label without a character set, because that is the
            request the arena's own names make and drei caches the font
            preload under exactly the arguments it was asked with. */}
        <Text {...label}>{OPENING_ALPHABET}</Text>
      </Suspense>
    </group>
  );
}

/**
 * The one persistent WebGL canvas. Every screen renders above it; phase
 * changes are camera moves, never context churn. Handles the two ways a
 * GPU betrays you: context loss (overlay + remount on restore) and
 * sustained frame drops (quality-tier demotion).
 */
export function ArenaCanvas() {
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const setQualityTier = useStore((s) => s.setQualityTier);

  const handleCreated = useCallback((state: { gl: { domElement: HTMLCanvasElement; setClearColor: (c: string) => void } }) => {
    // The deepest dye in the world, never `#000` — see themes/types.ts.
    state.gl.setClearColor(DEFAULT_THEME.palette.ground);
    glRef.current = state.gl.domElement;
  }, []);

  useEffect(() => {
    const el = glRef.current;
    if (!el) return;
    const onLost = (e: Event) => {
      e.preventDefault(); // allow the browser to attempt a restore
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
      setCanvasKey((k) => k + 1); // full remount rebuilds all GPU resources
    };
    el.addEventListener("webglcontextlost", onLost);
    el.addEventListener("webglcontextrestored", onRestored);
    return () => {
      el.removeEventListener("webglcontextlost", onLost);
      el.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [canvasKey, contextLost]);

  const ceilingTier = useRef(initialQualityTier());

  const demote = useCallback(() => {
    const tier = useStore.getState().settings.qualityTier;
    if (tier === "high") setQualityTier("base");
    else if (tier === "base") setQualityTier("potato");
  }, [setQualityTier]);

  // Demotion is no longer a one-way trapdoor: sustained good frames climb
  // back up, capped at what this device started with.
  const promote = useCallback(() => {
    const tier = useStore.getState().settings.qualityTier;
    const ceiling = ceilingTier.current;
    if (tier === "potato") setQualityTier(ceiling === "potato" ? "potato" : "base");
    else if (tier === "base" && ceiling === "high") setQualityTier("high");
  }, [setQualityTier]);

  const settle = useCallback(() => {
    // Oscillating between tiers: settle at base and stop flip-flopping.
    setQualityTier(ceilingTier.current === "potato" ? "potato" : "base");
  }, [setQualityTier]);

  const cosmos = (
    <Suspense fallback={null}>
      <Cosmos />
    </Suspense>
  );

  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        key={canvasKey}
        dpr={testMode.enabled ? 1 : [1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
        }}
        camera={{ fov: 42, near: 0.1, far: 160, position: [0, 0.5, 15.2] }}
        onCreated={handleCreated}
        onPointerMissed={handleArenaMiss}
      >
        {/* Outside the monitor: the warm-up's frames are not the arena's, and
            a tier must not be demoted for the cost of building it. */}
        <Prewarm />
        {testMode.enabled ? (
          cosmos
        ) : (
          <PerformanceMonitor
            onDecline={demote}
            onIncline={promote}
            flipflops={4}
            onFallback={settle}
          >
            {cosmos}
          </PerformanceMonitor>
        )}
      </Canvas>

      {contextLost && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-void/90">
          <div className="text-center">
            <p className="font-display text-2xl italic text-bright">The cosmos flickered.</p>
            <p className="mt-2 font-ui text-sm text-dim">
              The graphics context was lost — restoring the beads…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
