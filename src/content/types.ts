export type DisciplineId =
  | "mathematics"
  | "music"
  | "philosophy"
  | "physics"
  | "art"
  | "history";

export type TimbreId = "bell" | "pluck" | "pad" | "fm" | "breath" | "drone";
export type Register = "low" | "mid" | "high";

export interface Discipline {
  id: DisciplineId;
  name: string;
  /** Hex color — carried over from v1's discipline identity. */
  color: string;
  glyph: string;
  /** Primary + secondary degree indices into the shared pentatonic gamut (0–4). */
  degrees: [number, number];
  register: Register;
  timbre: TimbreId;
}

export interface Concept {
  /** Stable id, e.g. "math.fibonacci-sequence". */
  id: string;
  name: string;
  discipline: DisciplineId;
  description: string;
  /** Position on the transcendental axes — truth, beauty, good — each in [-1, 1]. */
  tbg: [number, number, number];
  /** This concept's identity note: a degree index (0–4) into the pentatonic gamut. */
  pitchDegree: number;
  /** 2–4 evocative fragments used by the faint-resonance composer. */
  keywords: string[];
  /** Eligible to be drawn as a cross-discipline bridge bead. */
  bridge?: boolean;
}

export interface CuratedConnection {
  /** Canonical id — always the sorted pairKey of the two concept ids. */
  id: string;
  pair: [string, string];
  /** Evocative name shown as the discovery's title. */
  title: string;
  /** 2–3 sentences of genuine intellectual content. */
  insight: string;
  /** 1 = solid, 2 = strong, 3 = profound. Drives score, thread brightness, chord voicing. */
  tier: 1 | 2 | 3;
  quote?: { text: string; source: string };
}

export type MotifId = "triad" | "symposium" | "fugue";

export interface MotifDef {
  id: MotifId;
  name: string;
  blurb: string;
  points: number;
}

/** Canonical unordered-pair key: sorted ids joined with '+'. */
export const pairKey = (a: string, b: string): string =>
  a < b ? `${a}+${b}` : `${b}+${a}`;
