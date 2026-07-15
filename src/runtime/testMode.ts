import type { DisciplineId } from "@/content/types";
import type { QualityTier } from "@/lib/device";
import { hashString, mulberry32 } from "@/lib/utils";

const CONTROLLED_EPOCH_MS = Date.UTC(2025, 0, 1, 12, 0, 0);

export interface TestModeConfig {
  enabled: boolean;
  seedText: string | null;
  seed: number | null;
  qualityTier: QualityTier;
  reducedMotion: boolean;
}

export interface TestSessionSnapshot {
  phase: string;
  seed: number;
  seedText: string;
  disciplines: DisciplineId[];
  beadIds: string[];
  themeId: string;
  startedAt: number;
  score: number;
  threads: Array<{
    id: string;
    a: string;
    b: string;
    kind: "curated" | "faint";
    tier: 0 | 1 | 2 | 3;
    createdAt: number;
  }>;
  discoveries: Array<{
    id: string;
    kind: "curated" | "faint";
    points: number;
  }>;
  interactionMode: string;
  draftStage: string;
  message: string;
  now: number;
  domainSession: {
    eventCount: number;
    sessionId: string;
    seed: string;
    worldId: string;
    conceptIds: string[];
    attendedConceptId: string | null;
    eventTypes: string[];
    threads: Array<{ id: string; pair: readonly [string, string]; intention: string; inputModality: string }>;
  };
}

export interface BrowserTestAdapter {
  readonly seedText: string;
  readonly seed: number;
  startSession(picks: DisciplineId[]): TestSessionSnapshot;
  snapshot(): TestSessionSnapshot;
  advanceClock(milliseconds: number): number;
  beadScreen(id: string): { x: number; y: number; behind: boolean } | null;
  beadIds(): string[];
  reloadCanonical(): TestSessionSnapshot;
  startFrameSample(): void;
  finishFrameSample(): FrameSample;
  rendererInfo(): { renderer: string; vendor: string; software: boolean };
  presentationProfile(): { qualityTier: QualityTier; reducedMotion: boolean };
}

export interface FrameSample {
  sampleCount: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  longFrames: number;
  effectiveFps: number;
}

declare global {
  interface Window {
    __gbgTest?: BrowserTestAdapter;
  }
}

export function parseTestMode(search: string, development: boolean): TestModeConfig {
  if (!development) return { enabled: false, seedText: null, seed: null, qualityTier: "base", reducedMotion: false };
  const params = new URLSearchParams(search);
  const seedText = params.get("seed")?.trim() ?? "";
  if (params.get("testMode") !== "1" || seedText.length === 0) {
    return { enabled: false, seedText: null, seed: null, qualityTier: "base", reducedMotion: false };
  }
  const quality = params.get("quality");
  const qualityTier: QualityTier = quality === "high" || quality === "potato" ? quality : "base";
  return { enabled: true, seedText, seed: hashString(seedText), qualityTier, reducedMotion: params.get("reducedMotion") === "1" };
}

const search = typeof window === "undefined" ? "" : window.location?.search ?? "";
export const testMode = parseTestMode(search, import.meta.env.DEV);

let controlledNow = CONTROLLED_EPOCH_MS;
let seededRandom = mulberry32(testMode.seed ?? 0);
let frameSamples: number[] | null = null;

export function resetTestRuntime(): void {
  if (!testMode.enabled) return;
  controlledNow = CONTROLLED_EPOCH_MS;
  seededRandom = mulberry32(testMode.seed!);
}

export function gameNow(): number {
  return testMode.enabled ? controlledNow : Date.now();
}

export function presentationNow(): number {
  return testMode.enabled ? controlledNow - CONTROLLED_EPOCH_MS : performance.now();
}

export function runtimeRandom(): number {
  return testMode.enabled ? seededRandom() : Math.random();
}

export function advanceTestClock(milliseconds: number): number {
  if (!testMode.enabled) throw new Error("test mode is not active");
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new Error("clock advance must be a finite non-negative number");
  }
  controlledNow += Math.floor(milliseconds);
  return controlledNow;
}

export function startFrameSample(): void {
  if (!testMode.enabled) throw new Error("test mode is not active");
  frameSamples = [];
}

export function recordFrameSample(deltaSeconds: number): void {
  frameSamples?.push(deltaSeconds * 1000);
}

export function finishFrameSample(): FrameSample {
  if (!frameSamples || frameSamples.length === 0) throw new Error("no frame sample is active");
  const result = summarizeFrameSamples(frameSamples);
  frameSamples = null;
  return result;
}

export function summarizeFrameSamples(samples: readonly number[]): FrameSample {
  if (samples.length === 0 || samples.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("frame samples must contain positive finite milliseconds");
  }
  const values = samples.slice().sort((a, b) => a - b);
  const percentile = (p: number) => values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    sampleCount: values.length,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    longFrames: values.filter((value) => value > 50).length,
    effectiveFps: 1000 / (total / values.length),
  };
}
