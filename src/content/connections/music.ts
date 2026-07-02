/**
 * Curated connections filed under music (lexicographically-first of each
 * pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const musicConnections: CuratedConnection[] = [
  // ── music × philosophy ──────────────────────────────────────────────────
  {
    id: "music.harmonic-resonance+phil.beauty",
    pair: ["music.harmonic-resonance", "phil.beauty"],
    title: "The Pythagorean Wager",
    insight:
      "On the monochord, Pythagoras found that the intervals we love live at the simplest ratios — the octave at 2:1, the fifth at 3:2. It was the first mathematical theory of beauty, and its wager still stands: that what pleases the senses is number heard.",
    tier: 3,
  },
  {
    id: "music.counterpoint+phil.dialectics",
    pair: ["music.counterpoint", "phil.dialectics"],
    title: "Voices in Argument",
    insight:
      "A fugue is structured disagreement: the countersubject answers the subject, inversions negate, the stretto forces the argument to a head. Adorno heard Beethoven's development sections as Hegel in sound — contradiction driven, not resolved away, until it earns its synthesis.",
    tier: 2,
  },
  {
    id: "music.dissonance+phil.meaning",
    pair: ["music.dissonance", "phil.meaning"],
    title: "The Necessary Wound",
    insight:
      "Leonard Meyer's Emotion and Meaning in Music argued that musical meaning is born when expectation is blocked: the suspension aches, and its resolution signifies. Meaning, in music as in life, is not given but produced — by tension honestly arrived at and honestly discharged.",
    tier: 2,
  },
  {
    id: "music.improvisation+phil.existence",
    pair: ["music.improvisation", "phil.existence"],
    title: "Existence Precedes the Score",
    insight:
      "Sartre's formula — existence precedes essence — is the improviser's condition: no prewritten part, only choices that retroactively become a self. It is no accident that Nausea ends with a jazz record, four notes of a saxophone briefly justifying being.",
    tier: 3,
  },
  {
    id: "music.modal-scales+phil.ethics",
    pair: ["music.modal-scales", "phil.ethics"],
    title: "The Ethos of Modes",
    insight:
      "In the Republic, Plato admits the Dorian and Phrygian modes for courage and temperance and banishes the soft Lydian from the ideal city. The Greek doctrine of ethos held that scales shape souls — the oldest claim that aesthetic form is already moral formation.",
    tier: 2,
  },

  // ── music × physics ─────────────────────────────────────────────────────
  {
    id: "music.overtones+phys.optics",
    pair: ["music.overtones", "phys.optics"],
    title: "Newton's Seven Notes of Light",
    insight:
      "Newton split sunlight and named seven colors — adding indigo partly so the spectrum would match the seven notes of the scale. The analogy proved deeper than his mysticism: light and sound alike decompose into pure frequencies, one spectrum for the eye, one for the ear.",
    tier: 1,
  },
  {
    id: "music.harmonic-resonance+phys.electromagnetic-fields",
    pair: ["music.harmonic-resonance", "phys.electromagnetic-fields"],
    title: "Sympathetic Strings",
    insight:
      "Hertz detected the first radio waves with a resonant loop that answered its transmitter the way an open string answers its own pitch across a room. Tuning a receiver is playing a sympathetic string in the electromagnetic field — resonance is one phenomenon wearing two bodies.",
    tier: 2,
  },
  {
    id: "music.rhythm-patterns+phys.cosmology",
    pair: ["music.rhythm-patterns", "phys.cosmology"],
    title: "The Primordial Beat",
    insight:
      "For its first 380,000 years the universe rang with pressure waves — literal sound in the primordial plasma. Those baryon acoustic oscillations froze when light broke free, and galaxies still cluster on that wavelength: the large-scale structure of the cosmos is a rhythm section that never stopped echoing.",
    tier: 3,
  },

  // ── music intra ─────────────────────────────────────────────────────────
  {
    id: "music.consonance+music.dissonance",
    pair: ["music.consonance", "music.dissonance"],
    title: "One Continuum",
    insight:
      "Helmholtz measured dissonance as the roughness of beating partials — not the opposite of consonance but the far end of one dial. Every age relocates the boundary: yesterday's forbidden seventh is today's lullaby.",
    tier: 2,
    quote: {
      text: "Dissonances are only the more remote consonances.",
      source: "Arnold Schoenberg, Theory of Harmony",
    },
  },
];
