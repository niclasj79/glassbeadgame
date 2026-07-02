import { connectionByPair } from "@/content/connections";
import type { CodexEntry } from "@/state/types";

export const CONTINUE_HASH_KEY = "gbg";
const SHARE_VERSION = 1;
const MAX_TOKEN_LENGTH = 24_000;

export interface SharedProgress {
  version: typeof SHARE_VERSION;
  exportedAt: number;
  codex: Record<string, CodexEntry>;
  lifetimeStats: { sessions: number; totalScore: number };
  hintsSeen: Record<string, boolean>;
}

interface ProgressSource {
  codex: Record<string, CodexEntry>;
  lifetimeStats: { sessions: number; totalScore: number };
  settings: { hintsSeen: Record<string, boolean> };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function cleanCodex(value: unknown): Record<string, CodexEntry> {
  if (!isRecord(value)) return {};
  const out: Record<string, CodexEntry> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!connectionByPair.has(id) || !isRecord(entry)) continue;
    const firstFoundAt = cleanNonNegativeNumber(entry.firstFoundAt);
    const count = cleanNonNegativeNumber(entry.count);
    if (firstFoundAt > 0 && count > 0) out[id] = { firstFoundAt, count };
  }
  return out;
}

function cleanStats(value: unknown): SharedProgress["lifetimeStats"] {
  if (!isRecord(value)) return { sessions: 0, totalScore: 0 };
  return {
    sessions: cleanNonNegativeNumber(value.sessions),
    totalScore: cleanNonNegativeNumber(value.totalScore),
  };
}

function cleanHints(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [id, seen] of Object.entries(value)) {
    if (typeof id === "string" && seen === true) out[id] = true;
  }
  return out;
}

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeBase64Url(token: string): string | null {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function makeSharedProgress(source: ProgressSource): SharedProgress {
  return {
    version: SHARE_VERSION,
    exportedAt: Date.now(),
    codex: cleanCodex(source.codex),
    lifetimeStats: cleanStats(source.lifetimeStats),
    hintsSeen: cleanHints(source.settings.hintsSeen),
  };
}

export function encodeSharedProgress(progress: SharedProgress): string {
  return encodeBase64Url(JSON.stringify(progress));
}

export function decodeSharedProgress(token: string): SharedProgress | null {
  const text = decodeBase64Url(token);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed) || parsed.version !== SHARE_VERSION) return null;
    return {
      version: SHARE_VERSION,
      exportedAt: cleanNonNegativeNumber(parsed.exportedAt),
      codex: cleanCodex(parsed.codex),
      lifetimeStats: cleanStats(parsed.lifetimeStats),
      hintsSeen: cleanHints(parsed.hintsSeen),
    };
  } catch {
    return null;
  }
}

export function buildContinueUrl(progress: SharedProgress, location: Location): string {
  const url = new URL(location.href);
  url.hash = new URLSearchParams({
    [CONTINUE_HASH_KEY]: encodeSharedProgress(progress),
  }).toString();
  return url.toString();
}

export function progressFromHash(hash: string): SharedProgress | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const token = new URLSearchParams(rawHash).get(CONTINUE_HASH_KEY);
  return token ? decodeSharedProgress(token) : null;
}
