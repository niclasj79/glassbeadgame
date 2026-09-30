import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { BloomEffect } from "postprocessing";
import { useStore } from "@/state/store";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import { FocusFogPass } from "./FocusFogEffect";
import { presentationProfile } from "./quality";

/**
 * RESTRAINED LUMINOSITY
 *
 * The threshold is high on purpose. In this world only four things are
 * genuinely bright — gold leaf, a specular highlight on glass, a lit
 * graduation, and the core of a star — and only those should bloom. Everything
 * else is pigment, metal and ink, and pigment does not glow.
 *
 * The margin owns the edge of the frame and the page's tooth, so there is no
 * vignette pass and no noise pass here; two passes were doing the job of one
 * material and fighting it.
 *
 * THE FOCUS FOG STANDS BEFORE THE BLOOM (I-017). It is the one other pass, it
 * is switched off — and therefore free — whenever the air is clear, and the
 * bloom then gathers from the fogged frame, so the receding world stops
 * glowing while the attended bead and the lens keep their light. It must never
 * be the composer's last pass: see `FocusFogEffect.tsx`.
 */
const TIER_BLOOM: Record<
  "high" | "base" | "potato",
  {
    intensity: number;
    radius: number;
    threshold: number;
      /**
     * Mip levels the blur climbs. This is the pass's real cost knob: with
     * `mipmapBlur` the resolution props are ignored, and each extra level is
     * another full downsample-and-blur of the frame.
     */
    levels: number;
  }
> = {
  high: { intensity: 0.52, radius: 0.38, threshold: 0.74, levels: 6 },
  base: { intensity: 0.44, radius: 0.32, threshold: 0.76, levels: 4 },
  potato: { intensity: 0.3, radius: 0.26, threshold: 0.8, levels: 3 },
};

function BreathDriver({
  bloomRef,
  base,
  depth,
}: {
  bloomRef: React.RefObject<BloomEffect>;
  base: number;
  depth: number;
}) {
  useFrame(() => {
    const bloom = bloomRef.current;
    if (!bloom) return;
    // The synesthetic pulse: bloom inhales with the shared breath. At ~0.1 Hz
    // this is two orders of magnitude below CAV-007's 3 Hz luminance ceiling.
    bloom.intensity =
      base *
      (1 + 0.06 * frameState.awakening) *
      (1 + depth * frameState.breathDepth * Math.sin(frameState.breathPhase));
  });
  return null;
}

export function Effects() {
  const tier = useStore((s) => s.settings.qualityTier);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const theme = useCurrentTheme();
  const bloomRef = useRef<BloomEffect>(null);
  const profile = useMemo(
    () => presentationProfile(tier, reducedMotion),
    [tier, reducedMotion]
  );
  const cfg = TIER_BLOOM[tier];

  // Reduced bloom is a first-class path, not an absence: the glass keeps its
  // rim and its highlight, it simply stops throwing light past its own edge.
  const glare = profile.reducedBloom ? 0.45 : 1;
  const baseIntensity = cfg.intensity * theme.bloomBias * glare;
  const breathDepth = profile.reducedMotion ? 0 : 0.12;

  return (
    <>
      <BreathDriver bloomRef={bloomRef} base={baseIntensity} depth={breathDepth} />
      <EffectComposer multisampling={0}>
        <FocusFogPass />
        <Bloom
          ref={bloomRef as never}
          mipmapBlur
          luminanceThreshold={cfg.threshold}
          luminanceSmoothing={0.22}
          intensity={baseIntensity}
          radius={cfg.radius}
          levels={cfg.levels}
        />
      </EffectComposer>
    </>
  );
}
