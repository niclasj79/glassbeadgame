import type { DisciplineId } from "@/content/types";
import { hashString, mulberry32 } from "@/lib/utils";

const CONTROLLED_EPOCH_MS = Date.UTC(2025, 0, 1, 12, 0, 0);

export interface TestModeConfig {
  enabled: boolean;
  seedText: string | null;
  seed: number | null;
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
  now: number;
}

export interface BrowserTestAdapter {
  readonly seedText: string;
  readonly seed: number;
  startSession(picks: DisciplineId[]): TestSessionSnapshot;
  snapshot(): TestSessionSnapshot;
  advanceClock(milliseconds: number): number;
  beadScreen(id: string): { x: number; y: number; behind: boolean } | null;
  beadIds(): string[];
  weave(a: string, b: string): void;
}

declare global {
  interface Window {
    __gbgTest?: BrowserTestAdapter;
  }
}

export function parseTestMode(search: string, development: boolean): TestModeConfig {
  if (!development) return { enabled: false, seedText: null, seed: null };
  const params = new URLSearchParams(search);
  const seedText = params.get("seed")?.trim() ?? "";
  if (params.get("testMode") !== "1" || seedText.length === 0) {
    return { enabled: false, seedText: null, seed: null };
  }
  return { enabled: true, seedText, seed: hashString(seedText) };
}

const search = typeof window === "undefined" ? "" : window.location?.search ?? "";
export const testMode = parseTestMode(search, import.meta.env.DEV);

let controlledNow = CONTROLLED_EPOCH_MS;
let seededRandom = mulberry32(testMode.seed ?? 0);

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
