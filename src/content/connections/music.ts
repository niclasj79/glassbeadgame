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
  {
    id: "music.melody-structure+phil.metaphysics",
    pair: ["music.melody-structure", "phil.metaphysics"],
    title: "A Copy of the Will Itself",
    insight:
      "Schopenhauer set music above every other art because it does not depict the world of appearances at all: where painting copies Ideas, music is 'a copy of the will itself.' In The World as Will and Representation (1818) he heard melody as the biography of striving — desire, delay, satisfaction — which is why an unresolved line aches like an unfinished life.",
    tier: 3,
  },
  {
    id: "music.dissonance+phil.beauty",
    pair: ["music.dissonance", "phil.beauty"],
    title: "The Dionysian Chord",
    insight:
      "In The Birth of Tragedy (1872) Nietzsche located the model of tragic beauty in musical dissonance — the Dionysian pain that Apollonian form barely contains, the ache that makes resolution mean anything. He held the position to the end: beauty that omits the terrible is mere decoration.",
    tier: 2,
    quote: {
      text: "Without music, life would be an error.",
      source: "Friedrich Nietzsche, Twilight of the Idols, 1889",
    },
  },
  {
    id: "music.harmonic-resonance+phil.reality",
    pair: ["music.harmonic-resonance", "phil.reality"],
    title: "The Three Musics",
    insight:
      "Boethius's De institutione musica (c. 500) taught Europe for a thousand years that audible music is the least of three: above musica instrumentalis stand musica humana, the tuning of soul to body, and musica mundana, the concord of the spheres. Reality itself was strung in proportion — and the old tradition held that we miss the cosmic music only because it never stops.",
    tier: 2,
  },
  {
    id: "music.rhythm-patterns+phil.consciousness",
    pair: ["music.rhythm-patterns", "phil.consciousness"],
    title: "Measuring the Psalm",
    insight:
      "Reciting a psalm in Confessions XI (c. 400), Augustine asked where its rhythm could possibly live: past syllables are gone, future ones not yet, the present a durationless edge. His answer — time is a distension of the mind, measured in memory, attention, and expectation — made rhythm the primal evidence that consciousness is itself a timekeeper.",
    tier: 3,
  },
  {
    id: "music.dynamics+phil.phenomenology",
    pair: ["music.dynamics", "phil.phenomenology"],
    title: "The Silence That Wasn't",
    insight:
      "In 1951 John Cage sat in Harvard's anechoic chamber and still heard two sounds — his nervous system, he was told, and his circulating blood. The next year David Tudor premiered 4'33'' at Woodstock, New York: the pianist plays nothing, dynamics fall to the ambient, and the audience is handed the phenomenologist's task — attend to what is actually given. There is no zero of experience.",
    tier: 2,
  },
  {
    id: "music.improvisation+phil.knowledge",
    pair: ["music.improvisation", "phil.knowledge"],
    title: "The Knowledge in the Fingers",
    insight:
      "Ask a bebop player which alteration fits a passing chord and the answer arrives through the hands before the sentence forms. Michael Polanyi named this tacit knowledge — skilled knowing that cannot be fully spelled out in rules — and improvisation is its purest exhibit: years of explicit study submerged until they resurface as instinct at 240 beats per minute.",
    tier: 2,
    quote: {
      text: "We can know more than we can tell.",
      source: "Michael Polanyi, The Tacit Dimension, 1966",
    },
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
  {
    id: "music.overtones+phys.string-theory",
    pair: ["music.overtones", "phys.string-theory"],
    title: "One String, Every Particle",
    insight:
      "A cello string sounds its whole harmonic series at once — one string, many modes. String theory begins from precisely that image: a single kind of fundamental string whose distinct vibration patterns appear to us as distinct particles, an electron one 'note,' a quark another. Whether or not nature ratifies it, physics borrowed its boldest unification from the luthier's workshop.",
    tier: 2,
  },
  {
    id: "music.modulation+phys.relativity",
    pair: ["music.modulation", "phys.relativity"],
    title: "Nature's Pitch-Bend",
    insight:
      "Doppler predicted in 1842 that motion shifts frequency — he was thinking of starlight; Buys Ballot tested it in 1845 with horn players on a Dutch locomotive, judging the pitch by ear. The cosmos modulates the same way: galaxy light arrives shifted down-key, and relativity reads that reddening as the stretching of space itself. Every passing siren rehearses the recession of the sky.",
    tier: 2,
  },
  {
    id: "music.dynamics+phys.thermodynamics",
    pair: ["music.dynamics", "phys.thermodynamics"],
    title: "Sabine's Decay",
    insight:
      "Every fortissimo is a loan the room repays as heat. Wallace Sabine, assigned in 1895 to fix an unusable Harvard lecture hall, timed with organ pipes and a stopwatch how sound energy dies away, derived the law of reverberation from the decay, and designed Boston's Symphony Hall (1900) with it. Dynamics obey the second law: every crescendo ends, eventually, as warmth too faint to feel.",
    tier: 2,
  },
  {
    id: "music.timbre+phys.electromagnetic-fields",
    pair: ["music.timbre", "phys.electromagnetic-fields"],
    title: "Faraday's Guitar",
    insight:
      "An electric guitar pickup is Faraday's 1831 induction experiment strung with steel: the vibrating string disturbs a magnet's field, the field writes a current into the coil, and the amplifier lends the wire a voice. Exactly a century after Faraday, George Beauchamp's 1931 'Frying Pan' made the field part of the instrument — a new palette of timbres drawn from an invisible force.",
    tier: 1,
  },
  {
    id: "music.harmonic-resonance+phys.gravity",
    pair: ["music.harmonic-resonance", "phys.gravity"],
    title: "The Chirp",
    insight:
      "On September 14, 2015, LIGO caught two black holes spiraling together 1.3 billion light-years away: as the orbit tightened, the gravitational wave swept upward through the audible range, and physicists played the 'chirp' aloud. The merged hole then rang down like a struck bell, settling at its natural frequencies. Spacetime, it turns out, can be played.",
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
  {
    id: "music.overtones+music.timbre",
    pair: ["music.overtones", "music.timbre"],
    title: "The Recipe of a Voice",
    insight:
      "Helmholtz showed in On the Sensations of Tone (1863) that what separates a violin from a flute on the same pitch is the recipe of overtone strengths — and proved it by rebuilding vowel sounds from tuning forks and resonators. Timbre is not an added coloring: it is the chord nature plays above every note, heard as a single face.",
    tier: 2,
  },
];
