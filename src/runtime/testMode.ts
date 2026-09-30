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
  focusedBeadId: string | null;
  draftStage: string;
  draftAttendedConceptId: string | null;
  draftIntention: string | null;
  draftCandidateConceptId: string | null;
  candidateResonance: Array<{
    candidateId: string;
    band: "weak" | "medium" | "high";
  }>;
  weaving: boolean;
  /** The bead settled under the lens while attending (I-017). */
  sightedConceptId: string | null;
  previewIntention: string | null;
  reopenedThreadId: string | null;
  /** The focus view as every surface derives it (deriveFocusView). */
  focus: {
    mode: "roaming" | "focus" | "locked" | "held";
    fogActive: boolean;
    blurActive: boolean;
    lensActive: boolean;
    sigilsVisible: boolean;
    attendedCardOpen: boolean;
    gapOpen: boolean;
    sightedCardOpen: boolean;
    dwellCardConceptId: string | null;
  };
  message: string;
  failureMessage: string | null;
  now: number;
  domainSession: {
    eventCount: number;
    sessionId: string;
    seed: string;
    worldId: string;
    conceptIds: string[];
    attendedConceptId: string | null;
    eventTypes: string[];
    threads: Array<{
      id: string;
      pair: readonly [string, string];
      intention: string;
      inputModality: string;
      gesture: {
        inputModality: string;
        durationMs?: number;
        pathLengthViewport?: number;
        curvature?: number;
        averageSpeedViewportPerSecond?: number;
        speedVariance?: number;
        pressure?: number;
      };
    }>;
  };
}

/** What a browser test may know about a Study: form and outcome, never a count of Studies. */
export interface TestStudySnapshot {
  readonly studyId: string | null;
  readonly kind: "not-yet" | "solved" | null;
  readonly by: "threads" | "silence" | null;
  readonly threadIds: readonly string[];
  readonly marks: readonly string[];
  readonly notYet: "no-answer-yet" | "can-be-done" | null;
  readonly plateOpen: boolean;
}

export interface BrowserTestAdapter {
  readonly seedText: string;
  readonly seed: number;
  startSession(picks: DisciplineId[]): TestSessionSnapshot;
  /**
   * Begin a Study (M9-001) on the reset test runtime: its own session, built
   * without the draw, opened straight into the arena. The Studies load with the
   * Studies, so this resolves once their chunk has arrived.
   */
  startStudy(studyId: string): Promise<TestSessionSnapshot>;
  /** The Study being played and the evaluator's latest word, or none. */
  studyStatus(): TestStudySnapshot;
  /** "It cannot be done", as the silence control says it. */
  declareSilence(): Promise<TestStudySnapshot>;
  snapshot(): TestSessionSnapshot;
  advanceClock(milliseconds: number): number;
  /**
   * A bead's centre on the page. While the camera is moving, or has a move
   * waiting, it answers "behind" so nothing acts on a point about to change —
   * unless `evenIfUnsettled` asks what is drawn right now, to measure whether
   * the world is holding still.
   */
  beadScreen(
    id: string,
    options?: { readonly evenIfUnsettled?: boolean }
  ): { x: number; y: number; behind: boolean } | null;
  /**
   * A point along a committed thread's drawn strand (`at` from 0 at its first
   * bead to 1 at its second; the middle by default), in page pixels, or null
   * when no strand with that id is drawn (I-019: the world can be pointed at).
   */
  threadScreen(
    threadId: string,
    at?: number
  ): { x: number; y: number; behind: boolean } | null;
  beadIds(): string[];
  /**
   * Musical time (M4-001): the conductor's grid, armed with the world's slot on
   * the controlled clock while the arena is up. Seconds on that clock.
   */
  musicalTime(): {
    now: number;
    armed: boolean;
    slotSeconds: number;
    slotPhase: number;
    breathPhase: number;
    nextHandAt: number;
    nextAnswerAt: number;
  };
  /** Schedule a note on a concept `inMs` ahead, as a scheduler would. */
  conduct(onset: {
    conceptId: string;
    inMs: number;
    durationMs: number;
    weight?: number;
  }): void;
  /**
   * The light on a bead: what the bead pass wrote into the glass's kindling
   * lane on its last frame, the conductor's own light for the concept, and
   * whether the idle score has kindled this bead within the last moment. The
   * lane is a `max` of both, and the idle score keeps the frame clock, which
   * the controlled clock does not move.
   */
  beadLight(
    conceptId: string
  ): { written: number; note: number; kindled: boolean } | null;
  canonicalEventLog(): string;
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
