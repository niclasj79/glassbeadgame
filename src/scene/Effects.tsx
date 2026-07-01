import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { useStore } from "@/state/store";

/**
 * The art direction lives here: threshold bloom over a near-black void.
 * Anything above ~0.28 luminance radiates; everything else recedes.
 * "potato" tier renders raw — boosted bead colors still read bright.
 */
export function Effects() {
  const tier = useStore((s) => s.settings.qualityTier);
  if (tier === "potato") return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        luminanceThreshold={0.32}
        luminanceSmoothing={0.18}
        intensity={0.92}
        radius={0.55}
      />
      <Vignette offset={0.3} darkness={0.65} />
      <Noise premultiply opacity={0.02} />
    </EffectComposer>
  );
}
