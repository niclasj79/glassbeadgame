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

