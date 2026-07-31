import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/state/store";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { FRAME_RULE_INSET, frameRuleShared } from "./framing";
import { GLSL_COMMON } from "./glsl";
import { presentationProfile } from "./quality";

/**
 * THE MARGIN
 *
 * The page the world is drawn on. A ruled frame, two corner flourishes and a
 * vellum tooth at the very edge of vision — the manuscript behaviour the arena
 * is meant to have, kept where it belongs: outside the reading area, at an
 * amplitude the eye accepts as material rather than as an effect.
 *
 * It is a quad carried by the camera rather than a post pass, so it is fully
 * owned by the scene, costs one draw call, and disappears cleanly when the
 * tier or the low-glare path asks it to.
 */

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uVellum;
uniform vec3 uGround;
uniform vec3 uEngraving;
uniform float uAspect;
uniform float uInset;
uniform float uGrain;
uniform float uBreath;
uniform float uRule;

varying vec2 vUv;

${GLSL_COMMON}

float gbgHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // Work in a frame where one unit is the same distance on both axes, so the
  // ruling and the flourishes are not stretched on a wide viewport.
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  vec2 half_ = vec2(uAspect, 1.0);

  // Distance to the nearest page edge, in shared units.
  vec2 toEdge = half_ - abs(p);
  float edge = min(toEdge.x, toEdge.y);
  // Everything the page draws scales with its own margin (framing.ts).
  float k = uInset / 0.115;
  // The page has no marks in the middle; most of the frame can stop here.
  if (edge > 0.24 * k) discard;

  // Vellum tooth: the page has a surface. Present everywhere, felt only where
  // the light rakes across it near the edge.
  float grain = (gbgHash(floor(vUv * 900.0)) - 0.5) * uGrain;

  // The ruling: two rules, the outer heavier, breathing very slowly. Its inset
  // comes from framing.frameRuleShared — one number, not two that resemble.
  float drift = 0.004 * uBreath;
  float outerInset = uInset * (0.075 / 0.115);
  float outer = gbgLine(edge - (outerInset + drift), 0.004);
  float inner = gbgLine(edge - (uInset + drift), 0.002);
  float rule = (outer * 0.8 + inner * 0.45) * uRule;

  // Corner flourishes: a quarter arc struck from each corner of the ruling.
  vec2 corner = half_ - vec2(outerInset + drift);
  vec2 d = abs(p) - corner;
  float arc = gbgLine(length(max(d, 0.0)) - 0.055 * k, 0.005)
            * step(0.0, d.x) * step(0.0, d.y) * uRule;

  // Material depth at the very edge of vision: a dyed falloff kept tight
  // against the frame, so it reads as the page's edge and never as a box
  // drawn around the world.
  float fade = 1.0 - smoothstep(0.0, 0.22 * k, edge);
  float wash = pow(fade, 2.6);

  vec3 col = uGround;
  float alpha = wash * 0.5;
  col = mix(col, uVellum, clamp(rule + arc * 0.9, 0.0, 1.0));
  alpha = max(alpha, (rule + arc) * 0.42);
  alpha += grain * fade;

  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();

export function MarginRule() {
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const theme = useCurrentTheme();
  const mesh = useRef<THREE.Mesh>(null);

  const profile = useMemo(
    () => presentationProfile(tier, reducedMotion),
    [tier, reducedMotion]
  );

  const material = useMemo(() => {
    const p = theme.palette;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uVellum: { value: new THREE.Color(p.vellum) },
        uGround: { value: new THREE.Color(p.ground) },
        uEngraving: { value: new THREE.Color(p.engraving) },
        uAspect: { value: 1 },
        uInset: { value: FRAME_RULE_INSET },
        uGrain: { value: profile.budget.grain },
        uBreath: { value: 0 },
        uRule: { value: profile.budget.marginRule ? 1 : 0 },
      },
    });
  }, [theme, profile.budget.grain, profile.budget.marginRule]);

  useEffect(() => () => material.dispose(), [material]);

  /**
   * The page rides the camera without being parented to it: R3F's default
   * camera is not part of the scene graph, so a child of it would never be
   * traversed. Copying the transform each frame is the honest way to do this.
   *
   * THE PAGE DOES NOT SHIFT WITH THE WORLD. The arena is composed off-centre by
   * a lens shift (`framing.homeComposition`), and a shift translates everything
   * the camera projects — including this quad. The page is the frame, not part
   * of the picture, so the same translation is subtracted back off here, read
   * from the camera's own view offset so the two can never disagree.
   */
  useFrame((three) => {
    const quad = mesh.current;
    const cam = three.camera as THREE.PerspectiveCamera;
    if (!quad || !cam.isPerspectiveCamera) return;
    const distance = cam.near + 0.05;
    const height = 2 * distance * Math.tan((cam.fov * Math.PI) / 360);
    const width = height * cam.aspect;
    quad.quaternion.copy(cam.quaternion);
    quad.position.copy(cam.position).addScaledVector(
      forward.set(0, 0, -1).applyQuaternion(cam.quaternion),
      distance
    );
    const view = cam.view;
    if (view?.enabled) {
      const shiftX = (-2 * view.offsetX) / Math.max(1, view.fullWidth);
      const shiftY = (2 * view.offsetY) / Math.max(1, view.fullHeight);
      quad.position.addScaledVector(
        right.set(1, 0, 0).applyQuaternion(cam.quaternion),
        (-shiftX * width) / 2
      );
      quad.position.addScaledVector(
        up.set(0, 1, 0).applyQuaternion(cam.quaternion),
        (-shiftY * height) / 2
      );
    }
    quad.scale.set(width, height, 1);
    (material.uniforms.uAspect as { value: number }).value = cam.aspect;
    (material.uniforms.uInset as { value: number }).value = frameRuleShared(
      cam.aspect
    );
    (material.uniforms.uBreath as { value: number }).value =
      Math.sin(frameState.breathPhase) * frameState.breathDepth;
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={900} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
