import type { Discipline, DisciplineId } from "./types";

/**
 * The six disciplines of the Game. Colors and glyphs carry over from v1.
 * Degrees index the shared pentatonic gamut (C D E G A = 0..4) so that any
 * combination of disciplines sounds consonant; register places each voice
 * in its octave band.
 */
export const disciplines: Discipline[] = [
  {
    id: "mathematics",
    name: "Mathematics",
    color: "#60A5FA",
    glyph: "∑",
    degrees: [0, 3], // C, G — pure fifths, crystalline
    register: "high",
    timbre: "bell",
  },
  {
    id: "music",
    name: "Music",
    color: "#34D399",
    glyph: "♪",
    degrees: [4, 2], // A, E
    register: "mid",
    timbre: "pluck",
  },
  {
    id: "philosophy",
    name: "Philosophy",
    color: "#A78BFA",
    glyph: "Φ",
    degrees: [1, 4], // D, A
    register: "low",
    timbre: "pad",
  },
  {
    id: "physics",
    name: "Physics",
    color: "#FBBF24",
    glyph: "Ψ",
    degrees: [3, 1], // G, D
    register: "mid",
    timbre: "fm",
  },
  {
    id: "art",
    name: "Art",
    color: "#FB7185",
    glyph: "◊",
    degrees: [2, 4], // E, A
    register: "high",
    timbre: "breath",
  },
  {
    id: "history",
    name: "History",
    color: "#22D3EE",
    glyph: "⚖",
    degrees: [0, 3], // C, G — grounded, an octave below mathematics
    register: "low",
    timbre: "drone",
  },
];

export const disciplineById = new Map<DisciplineId, Discipline>(
  disciplines.map((d) => [d.id, d])
);
