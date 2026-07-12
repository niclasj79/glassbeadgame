import { testMode } from "@/runtime/testMode";

export type QualityTier = "high" | "base" | "potato";

export function probeWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (testMode.enabled) return testMode.reducedMotion;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function isCoarsePointer(): boolean {
  if (testMode.enabled) return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/**
 * Conservative starting tier; drei's PerformanceMonitor demotes at runtime
 * if sustained frame drops are observed. "potato" is reached only by demotion.
 */
export function initialQualityTier(): QualityTier {
  if (testMode.enabled) return testMode.qualityTier;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isCoarsePointer() && cores <= 6) return "base";
  if (cores <= 4) return "base";
  return "high";
}
