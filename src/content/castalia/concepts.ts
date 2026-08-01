import { toFacetId, type CastaliaConcept } from "./schema";

/**
 * THE TWENTY-FOUR BEADS OF CASTALIA
 *
 * Six per faculty. Every entry satisfies the granularity rule (CAV-005): each is
 * a theorem, technique, work, phenomenon, instrument, formation, pattern, or
 * defined idea — never a whole field and never a whole era. That constraint is
 * what makes the set *play*: a technique has structure you can hear and see, a
 * discipline does not.
 *
 * The set is chosen so that genuine cross-faculty structure exists in every
 * direction. Decomposition runs Measure→Sound→Matter→Image through the Fourier
 * series, the overtone series, the standing wave, and divisionism. Symmetry runs
 * from continuous groups through conservation laws into crystal lattices and
 * girih tiling. Standpoint runs from perspective through anamorphosis into the
 * camera obscura. No bead is a dead end.
 *
 * Descriptions state standard, checkable content of each field. Claims that
 * relate two beads live in `relations.ts`, where they must declare a relation
 * type, an evidence class, and a source.
 */
const f = (...ids: string[]) => Object.freeze(ids.map(toFacetId));

/** Contextual typing: literals narrow to the schema's unions instead of widening. */
const concept = (value: CastaliaConcept): CastaliaConcept => Object.freeze(value);

export const CASTALIA_CONCEPTS: readonly CastaliaConcept[] = Object.freeze([
  // ── Measure ──────────────────────────────────────────────────────────────
  concept({
    id: "measure.fibonacci-sequence",
    name: "Fibonacci Sequence",
    faculty: "measure",
    kind: "pattern",
    caption: "Each term the sum of the two before it",
    description:
      "1, 1, 2, 3, 5, 8, 13 — a rule that feeds its own output back in as input. The ratio of consecutive terms approaches the golden ratio, and the sequence counts real branching and packing arrangements in plants. It is also badly over-claimed, which makes it a good test of how carefully one is willing to look.",
    facets: f("recursion", "proportion", "discreteness"),
    era: "described in Europe 1202; known earlier in Indian prosody",
    motif: {
      degrees: [0, 0, 1, 2, 4],
      rhythm: [1, 1, 2, 3, 5],
      register: "mid",
      articulation: "plucked",
      timbre: "gut",
    },
    sigil: { family: "spiral", symmetry: 1, density: 0.62, turbulence: 0.05, gilded: true },
  }),
  concept({
    id: "measure.prime-numbers",
    name: "Prime Numbers",
    faculty: "measure",
    kind: "pattern",
    caption: "Divisible only by one and themselves",
    description:
      "Every whole number factors into primes in exactly one way, which makes them arithmetic's indivisible units. They thin out as numbers grow but never run out — Euclid proved that. Their exact placement remains among the deepest open problems in mathematics.",
    facets: f("discreteness", "incommensurability", "decomposition"),
    era: "Euclid, c. 300 BCE",
    motif: {
      degrees: [0, 2, 3, 5],
      rhythm: [2, 3, 5, 7],
      register: "mid",
      articulation: "struck",
      timbre: "metal",
    },
    sigil: { family: "lattice", symmetry: 1, density: 0.44, turbulence: 0.3, gilded: false },
  }),
  concept({
    id: "measure.continuous-symmetry",
    name: "Continuous Symmetry",
    faculty: "measure",
    kind: "idea",
    caption: "Transformations you can make arbitrarily small",
    description:
      "A rotation can be performed by any angle, however slight, and leave a circle unchanged. Symmetries of this kind form continuous groups rather than finite lists, so they can be differentiated — and that is precisely what lets them be connected to physical law.",
    facets: f("invariance", "continuity"),
    era: "Lie groups, from the 1870s",
    motif: {
      degrees: [0, 0, 0],
      rhythm: [6, 6, 6],
      register: "low",
      articulation: "sustained",
      timbre: "glass",
    },
    sigil: { family: "orbit", symmetry: 12, density: 0.5, turbulence: 0, gilded: true },
  }),
  concept({
    id: "measure.fourier-series",
    name: "The Fourier Series",
    faculty: "measure",
    kind: "theorem",
    caption: "Any periodic shape, rebuilt from pure waves",
    description:
      "A repeating function can be written as a sum of sines and cosines at whole-number multiples of one fundamental frequency. The decomposition is exact and the components are independent, so a complicated recurring shape can be taken apart and reassembled without loss.",
    facets: f("decomposition", "superposition", "periodicity"),
    era: "Fourier, 1822",
    motif: {
      degrees: [0, 4, 7, 11],
      rhythm: [8, 4, 2, 2],
      register: "high",
      articulation: "bowed",
      timbre: "glass",
    },
    sigil: { family: "wave", symmetry: 2, density: 0.72, turbulence: 0.04, gilded: true },
  }),
  concept({
    id: "measure.mobius-band",
    name: "The Möbius Band",
    faculty: "measure",
    kind: "pattern",
    caption: "A surface with one side and one edge",
    description:
      "Give a strip a half-twist before joining its ends and the two faces become one face; an ant can reach every point without crossing an edge. Travelling once around returns you to your starting place mirrored, so the surface has no consistent notion of handedness.",
    facets: f("orientation", "self-reference", "continuity"),
    era: "Möbius and Listing, independently, 1858",
    motif: {
      degrees: [0, 3, 7, 3, 0],
      rhythm: [3, 3, 6, 3, 3],
      register: "mid",
      articulation: "bowed",
      timbre: "reed",
    },
    sigil: { family: "fold", symmetry: 2, density: 0.55, turbulence: 0.12, gilded: false },
  }),
  concept({
    id: "measure.cantor-diagonal",
    name: "Cantor's Diagonal Argument",
    faculty: "measure",
    kind: "theorem",
    caption: "A list that cannot contain everything it lists",
    description:
      "Suppose every real number between 0 and 1 has been listed. Build a new number by taking the first digit of the first entry, the second of the second, and changing each one. The result differs from every entry on the list, so no such list is complete.",
    facets: f("self-reference", "discreteness", "threshold"),
    era: "Cantor, 1891",
    motif: {
      degrees: [0, 1, 3, 6, 10],
      rhythm: [4, 3, 2, 2, 1],
      register: "high",
      articulation: "plucked",
      timbre: "metal",
    },
    sigil: { family: "grid", symmetry: 1, density: 0.68, turbulence: 0.2, gilded: false },
  }),

  // ── Sound ────────────────────────────────────────────────────────────────
  concept({
    id: "sound.counterpoint",
    name: "Counterpoint",
    faculty: "sound",
    kind: "technique",
    caption: "Independent voices that remain independent",
    description:
      "Two or more melodic lines sound together, each keeping its own shape and direction, while the intervals between them stay governed. The difficulty is precisely that neither line may become accompaniment — the writing has to be correct read horizontally and vertically at once.",
    // Recursion is not decoration here: in canon the answer is *derived* from
    // the subject by rule, and in fugue the subject reappears inside the texture
    // it generated. That is what lets Counterpoint rhyme with Fibonacci, and it
    // is the shared facet the golden path's opening relation rests on.
    facets: f("imitation", "superposition", "recursion", "invariance"),
    era: "codified in Europe c. 1300–1750",
    motif: {
      degrees: [0, 2, 4, 2, 7],
      rhythm: [2, 2, 4, 2, 6],
      register: "mid",
      articulation: "bowed",
      timbre: "gut",
    },
    sigil: { family: "branch", symmetry: 2, density: 0.66, turbulence: 0.06, gilded: false },
  }),
  concept({
    id: "sound.polyrhythm",
    name: "Polyrhythm",
    faculty: "sound",
    kind: "pattern",
    caption: "Cycles of different length running at once",
    description:
      "Three beats against two, or five against four: pulses of unequal period share a span of time. They coincide only where their lengths agree, so the longer the cycles go without a common factor, the longer the composite pattern takes to repeat.",
    facets: f("periodicity", "incommensurability", "interference"),
    era: "widespread; central to West African drumming traditions",
    motif: {
      degrees: [0, 0, 5, 0, 5],
      rhythm: [3, 3, 3, 2, 2],
      register: "low",
      articulation: "struck",
      timbre: "wood",
    },
    sigil: { family: "orbit", symmetry: 3, density: 0.58, turbulence: 0.18, gilded: false },
  }),
  concept({
    id: "sound.isorhythm",
    name: "Isorhythm",
    faculty: "sound",
    kind: "technique",
    caption: "A rhythm and a melody of different lengths",
    description:
      "A repeating rhythmic pattern (the talea) and a repeating pitch sequence (the color) are laid over one another with different lengths, so each restatement of the rhythm carries different notes. The two only realign after their lengths agree, which can take the whole piece.",
    facets: f("periodicity", "incommensurability", "recursion"),
    era: "Ars nova motets, 14th century",
    motif: {
      degrees: [0, 5, 3, 7, 2],
      rhythm: [4, 2, 4, 2, 4],
      register: "mid",
      articulation: "rung",
      timbre: "metal",
    },
    sigil: { family: "grid", symmetry: 1, density: 0.6, turbulence: 0.08, gilded: true },
  }),
  concept({
    id: "sound.just-intonation",
    name: "Just Intonation",
    faculty: "sound",
    kind: "idea",
    caption: "Intervals as exact whole-number ratios",
    description:
      "Tune a fifth to exactly 3:2 and a major third to exactly 5:4, and the intervals lock — their partials coincide and the beating stops. The cost is that the tuning is anchored to one key, and a passage that travels far from home goes audibly out of tune.",
    // NOT `continuity`. Just intonation is a set of exact whole-number ratios;
    // "unbroken variation, where every intermediate value genuinely occurs" is
    // false of it, and it is the more discretely specified of the two tunings,
    // not the less. It carried the facet only so that the opposition with
    // Continuous Symmetry — whose insight says outright that "just intonation
    // does not possess it" — had a second facet to declare as shared.
    //
    // `invariance` stays, in the sense the concept actually holds it: the ratios
    // are kept exact, which is what it sacrifices free modulation for.
    facets: f("proportion", "invariance"),
    era: "ancient; theorised by Ptolemy, 2nd century",
    motif: {
      degrees: [0, 7, 4, 12],
      rhythm: [6, 6, 6, 12],
      register: "low",
      articulation: "sustained",
      timbre: "voice",
    },
    sigil: { family: "arc", symmetry: 3, density: 0.5, turbulence: 0, gilded: true },
  }),
  concept({
    id: "sound.equal-temperament",
    name: "Equal Temperament",
    faculty: "sound",
    kind: "technique",
    caption: "The octave cut into twelve identical steps",
    description:
      "Every semitone is the same ratio, the twelfth root of two. No interval except the octave is exactly in tune, and the fifth is narrowed by about two cents — but the error is spread evenly, so every key is equally usable and modulation anywhere becomes free.",
    // Shares `proportion` with Just Intonation on purpose. The two are not
    // opposed because one uses ratio and the other does not — both are built
    // from ratio. They are opposed in what they are willing to sacrifice, and
    // an opposition between two treatments of the same thing is far sharper
    // than an opposition between unrelated things.
    facets: f("quantisation", "compromise", "proportion", "discreteness"),
    era: "described in China and Europe c. 1580s; standard by the 19th century",
    motif: {
      degrees: [0, 2, 4, 6, 8],
      rhythm: [2, 2, 2, 2, 2],
      register: "mid",
      articulation: "struck",
      timbre: "metal",
    },
    sigil: { family: "lattice", symmetry: 12, density: 0.7, turbulence: 0.02, gilded: false },
  }),
  concept({
    id: "sound.overtone-series",
    name: "The Overtone Series",
    faculty: "sound",
    kind: "phenomenon",
    caption: "One string sounding many pitches at once",
    description:
      "A vibrating string moves as a whole and, simultaneously, in halves, thirds and quarters. The resulting partials sit at whole-number multiples of the fundamental, and their relative strengths are most of what we hear as an instrument's timbre.",
    facets: f("decomposition", "superposition", "proportion"),
    era: "partials described by Mersenne and Sauveur, 17th century",
    motif: {
      degrees: [0, 12, 19, 24, 28],
      rhythm: [10, 6, 4, 3, 2],
      register: "sub",
      articulation: "rung",
      timbre: "glass",
    },
    sigil: { family: "wave", symmetry: 1, density: 0.8, turbulence: 0.03, gilded: true },
  }),

  // ── Matter ───────────────────────────────────────────────────────────────
  concept({
    id: "matter.standing-wave",
    name: "The Standing Wave",
    faculty: "matter",
    kind: "phenomenon",
    caption: "Two travelling waves that hold still",
    description:
      "Send a wave down a bounded string and its reflection meets it coming back. Where they always cancel, the string never moves; where they always add, it swings widest. The pattern no longer travels, and only certain wavelengths fit between the ends at all.",
    facets: f("superposition", "quantisation", "interference"),
    era: "understood through the 18th and 19th centuries",
    motif: {
      degrees: [0, 7, 0, 7],
      rhythm: [4, 4, 4, 4],
      register: "low",
      articulation: "bowed",
      timbre: "gut",
    },
    sigil: { family: "wave", symmetry: 2, density: 0.64, turbulence: 0.05, gilded: false },
  }),
  concept({
    id: "matter.conservation-of-energy",
    name: "Conservation of Energy",
    faculty: "matter",
    kind: "idea",
    caption: "A total that never changes, whatever happens",
    description:
      "Energy moves between forms — kinetic, potential, thermal — but an isolated system's total stays fixed. The principle is not an observation that happens to hold; it follows from the fact that the laws governing the system are the same today as tomorrow.",
    // NOT `irreversibility`. The First Law is time-reversal symmetric: run the
    // film backwards and energy is still conserved, which is precisely why the
    // Second Law is needed to give time a direction at all. The facet was here
    // to give `rel.conservation-entropy` something to declare as shared — and
    // that relation is titled "The Total Holds, the Direction Does Not", so the
    // pack asserted the shared property in the same breath as denying it.
    //
    // `decomposition` replaces it because the sentence above already states it:
    // the total resolves without remainder into kinetic, potential and thermal,
    // and that is what Parseval's theorem says of a Fourier expansion too.
    facets: f("invariance", "decomposition"),
    era: "unified as a principle in the 1840s",
    motif: {
      degrees: [0, 0, 0, 0],
      rhythm: [12, 12, 12, 12],
      register: "sub",
      articulation: "sustained",
      timbre: "glass",
    },
    sigil: { family: "vessel", symmetry: 4, density: 0.42, turbulence: 0, gilded: true },
  }),
  concept({
    id: "matter.coupled-pendulums",
    name: "Coupled Pendulums",
    faculty: "matter",
    kind: "phenomenon",
    caption: "Clocks on one beam that fall into step",
    description:
      "Two pendulums that share a support exchange tiny amounts of momentum through it. Left alone, they drift into a fixed phase relation and hold it — most famously swinging exactly opposite one another. Neither is driving the other; the coupling is doing the work.",
    facets: f("entrainment", "periodicity", "interference"),
    era: "observed by Huygens, 1665",
    motif: {
      degrees: [0, 5, 0, 5],
      rhythm: [5, 5, 4, 4],
      register: "low",
      articulation: "struck",
      timbre: "wood",
    },
    sigil: { family: "orbit", symmetry: 2, density: 0.48, turbulence: 0.22, gilded: false },
  }),
  concept({
    id: "matter.diffraction",
    name: "Diffraction",
    faculty: "matter",
    kind: "phenomenon",
    caption: "Light bending around an edge, and banding",
    description:
      "Pass light through a narrow opening and it spreads instead of casting a clean shadow. Through two openings the spread patterns cross, and where crests meet crests the screen is bright, where crests meet troughs it is dark — a striped record of interference.",
    facets: f("interference", "superposition", "threshold"),
    era: "named by Grimaldi, published 1665; two-slit result Young, 1801",
    motif: {
      degrees: [0, 1, 0, -1, 0],
      rhythm: [2, 2, 2, 2, 8],
      register: "high",
      articulation: "breathed",
      timbre: "reed",
    },
    sigil: { family: "ray", symmetry: 2, density: 0.7, turbulence: 0.1, gilded: false },
  }),
  concept({
    id: "matter.entropy",
    name: "Entropy",
    faculty: "matter",
    kind: "idea",
    caption: "Why the arrow of time points one way",
    description:
      "Vastly more arrangements of a system's parts look disordered than look ordered, so an isolated system overwhelmingly tends toward the disordered ones. Nothing in the underlying mechanics forbids the reverse; it is simply, overwhelmingly, unlikely.",
    facets: f("irreversibility", "threshold", "decomposition"),
    era: "Clausius 1865; statistical account Boltzmann, 1870s",
    motif: {
      degrees: [7, 4, 2, 0, -1],
      rhythm: [2, 3, 3, 5, 8],
      register: "low",
      articulation: "breathed",
      timbre: "voice",
    },
    sigil: { family: "branch", symmetry: 1, density: 0.75, turbulence: 0.85, gilded: false },
  }),
  concept({
    id: "matter.crystal-lattice",
    name: "The Crystal Lattice",
    faculty: "matter",
    kind: "phenomenon",
    caption: "Matter repeating on a fixed grid",
    description:
      "In a crystal, atoms occupy positions that repeat by translation in three directions. Only certain symmetries are compatible with filling space this way — which is why classical crystals can show three-, four- and six-fold rotation, but never five.",
    facets: f("tiling", "periodicity", "discreteness"),
    era: "lattice theory 19th century; X-ray confirmation 1912",
    motif: {
      degrees: [0, 4, 7, 4],
      rhythm: [3, 3, 3, 3],
      register: "mid",
      articulation: "rung",
      timbre: "metal",
    },
    sigil: { family: "lattice", symmetry: 6, density: 0.78, turbulence: 0.01, gilded: false },
  }),

  // ── Image ────────────────────────────────────────────────────────────────
  concept({
    id: "image.linear-perspective",
    name: "Linear Perspective",
    faculty: "image",
    kind: "technique",
    caption: "Parallel lines meeting at a point on the horizon",
    description:
      "Treat the picture as a window and project the scene onto it from a single eye position. Parallels running away from the viewer converge to a vanishing point, and the whole construction is only exactly right from one place in the room.",
    facets: f("projection", "viewpoint", "proportion"),
    era: "demonstrated by Brunelleschi c. 1413; codified by Alberti, 1435",
    motif: {
      degrees: [0, 4, 7, 12],
      rhythm: [6, 4, 3, 2],
      register: "mid",
      articulation: "bowed",
      timbre: "glass",
    },
    sigil: { family: "ray", symmetry: 1, density: 0.56, turbulence: 0.02, gilded: true },
  }),
  concept({
    id: "image.anamorphosis",
    name: "Anamorphosis",
    faculty: "image",
    kind: "technique",
    caption: "A shape that resolves from one place only",
    description:
      "Stretch a form so violently that it reads as nothing from in front, then step to the side and it snaps into focus. Holbein's *The Ambassadors* hides a skull this way, at the foot of a painting otherwise full of instruments for measuring the world.",
    facets: f("projection", "viewpoint", "threshold"),
    era: "Holbein, 1533; treatises through the 17th century",
    motif: {
      degrees: [0, 6, 1, 7],
      rhythm: [7, 2, 5, 4],
      register: "high",
      articulation: "breathed",
      timbre: "reed",
    },
    sigil: { family: "fold", symmetry: 1, density: 0.52, turbulence: 0.55, gilded: false },
  }),
  concept({
    id: "image.chiaroscuro",
    name: "Chiaroscuro",
    faculty: "image",
    kind: "technique",
    caption: "Form declared by light against dark",
    description:
      "Model volume with strong contrast rather than with outline, and let large areas fall away into darkness. What is withheld does as much work as what is lit: the eye reconstructs the unlit body from the few places the light touches it.",
    facets: f("threshold", "continuity", "viewpoint"),
    era: "Caravaggio and after, from c. 1600",
    motif: {
      degrees: [0, -5, 0, 4],
      rhythm: [8, 8, 4, 4],
      register: "low",
      articulation: "sustained",
      timbre: "voice",
    },
    sigil: { family: "vessel", symmetry: 1, density: 0.38, turbulence: 0.3, gilded: false },
  }),
  concept({
    id: "image.girih-tiling",
    name: "Girih Tiling",
    faculty: "image",
    kind: "pattern",
    caption: "Strapwork covering a wall without repeating simply",
    description:
      "Islamic architectural ornament built from a small set of decorated polygons whose edges continue into one another as unbroken strapwork. The vocabulary is finite; the surfaces it fills are enormous, and the resulting patterns often carry five- and ten-fold symmetry.",
    facets: f("tiling", "recursion", "proportion"),
    era: "from the 12th century; Darb-i Imam shrine, Isfahan, 1453",
    motif: {
      degrees: [0, 5, 10, 3, 8],
      rhythm: [5, 5, 5, 5, 5],
      register: "mid",
      articulation: "plucked",
      timbre: "gut",
    },
    sigil: { family: "lattice", symmetry: 10, density: 0.85, turbulence: 0.02, gilded: true },
  }),
  concept({
    id: "image.divisionism",
    name: "Divisionism",
    faculty: "image",
    kind: "technique",
    caption: "Separate dots of colour, mixed by the eye",
    description:
      "Lay pure pigments side by side instead of blending them on the palette, and let the mixing happen in the viewer's vision at a distance. Seurat and Signac worked from contemporary colour theory; the technique's optical claims were partly wrong and the pictures work anyway.",
    facets: f("optical-mixture", "discreteness", "decomposition"),
    era: "Seurat and Signac, from 1884",
    motif: {
      degrees: [0, 2, 4, 7, 9],
      rhythm: [1, 1, 1, 1, 1],
      register: "high",
      articulation: "plucked",
      timbre: "wood",
    },
    sigil: { family: "grid", symmetry: 1, density: 0.9, turbulence: 0.35, gilded: false },
  }),
  concept({
    id: "image.camera-obscura",
    name: "The Camera Obscura",
    faculty: "image",
    kind: "instrument",
    caption: "A dark room with one hole, and the world inverted on the wall",
    description:
      "Light entering a small aperture crosses itself and paints the outside scene, upside down, on the opposite surface. No lens is required. The device is old, well documented, and demonstrably capable of producing an image a painter could trace.",
    facets: f("projection", "viewpoint", "threshold"),
    era: "described by Ibn al-Haytham c. 1020; lens versions from the 16th century",
    motif: {
      degrees: [12, 7, 0, -5],
      rhythm: [2, 3, 5, 9],
      register: "mid",
      articulation: "breathed",
      timbre: "reed",
    },
    sigil: { family: "vessel", symmetry: 1, density: 0.45, turbulence: 0.06, gilded: false },
  }),
]);

export const castaliaConceptById = new Map(
  CASTALIA_CONCEPTS.map((c) => [c.id, c])
);
