import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import type { BloomEffect } from "postprocessing";
import { useStore } from "@/state/store";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";

/**
 * The art direction lives here: threshold bloom over a near-black void.
 * Bloom survives at EVERY tier — losing it means losing the glass — the
 * tiers only trade its richness (and the garnish passes) for headroom.
 */
const TIER_BLOOM: Record<
  "high" | "base" | "potato",
  { intensity: number; radius: number; levels?: number }
> = {
  high: { intensity: 0.92, radius: 0.55 },
  base: { intensity: 0.7, radius: 0.45 },
  potato: { intensity: 0.5, radius: 0.35, levels: 3 },
};

function BreathDriver({ bloomRef, base }: { bloomRef: React.RefObject<BloomEffect>; base: number }) {
  useFrame(() => {
    const bloom = bloomRef.current;
    if (!bloom) return;
    // The synesthetic pulse: bloom inhales with the shared breath, and the
    // whole stage glows a shade brighter as the weave completes.
    bloom.intensity =
      base *
      (1 + 0.08 * frameState.awakening) *
      (1 + 0.16 * frameState.breathDepth * Math.sin(frameState.breathPhase));
  });
  return null;
}

export function Effects() {
  const tier = useStore((s) => s.settings.qualityTier);
  const theme = useCurrentTheme();
  const bloomRef = useRef<BloomEffect>(null);
  const cfg = TIER_BLOOM[tier];
  const baseIntensity = cfg.intensity * theme.bloomBias;

  // EffectComposer instantiates every child as a pass — build the list
  // explicitly so no non-effect nodes ever reach it.
  const passes = [
    <Bloom
      key="bloom"
      ref={bloomRef as never}
      mipmapBlur
      luminanceThreshold={0.32}
      luminanceSmoothing={0.18}
      intensity={baseIntensity}
      radius={cfg.radius}
      levels={cfg.levels}
    />,
  ];
  if (tier !== "potato") passes.push(<Vignette key="vignette" offset={0.3} darkness={0.65} />);
  if (tier === "high") passes.push(<Noise key="noise" premultiply opacity={0.02} />);

  return (
    <>
      <BreathDriver bloomRef={bloomRef} base={baseIntensity} />
      <EffectComposer multisampling={0}>{passes}</EffectComposer>
    </>
  );
}
