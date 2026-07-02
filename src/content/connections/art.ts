/**
 * Curated connections filed under art (lexicographically-first of each
 * pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const artConnections: CuratedConnection[] = [
  // ── art × mathematics ───────────────────────────────────────────────────
  {
    id: "art.composition+math.golden-ratio",
    pair: ["art.composition", "math.golden-ratio"],
    title: "The Sacrament of Proportion",
    insight:
      "Dalí painted The Sacrament of the Last Supper inside a golden rectangle, a great dodecahedron hovering over the table — deliberate geometry, worked out after his studies with the proportion theorist Matila Ghyka. Where most golden-ratio sightings in art are myth, here the mathematics is the composition.",
    tier: 2,
  },
  {
    id: "art.perspective+math.geometry",
    pair: ["art.perspective", "math.geometry"],
    title: "Brunelleschi's Window",
    insight:
      "Around 1420 Brunelleschi had viewers peer through a hole at a mirrored panel of the Florence Baptistery, proving painted space could obey optical law. Alberti then wrote the recipe: the canvas is a section cut through the pyramid of sight. Painting became applied geometry — and geometry gained a new laboratory.",
    tier: 3,
  },

  // ── art × music ─────────────────────────────────────────────────────────
  {
    id: "art.color-theory+music.timbre",
    pair: ["art.color-theory", "music.timbre"],
    title: "The Sound of Vermilion",
    insight:
      "Kandinsky heard his paintings: for him vermilion rang like a tuba, and light blue sounded like a flute. Timbre and color are the same phenomenon in different media — a spectrum of component frequencies fused by perception into a single, unmistakable quality.",
    tier: 2,
    quote: {
      text: "Color is the keyboard, the eyes are the hammers, the soul is the piano with many strings.",
      source: "Wassily Kandinsky, Concerning the Spiritual in Art",
    },
  },
  {
    id: "art.abstract-expression+music.musical-form",
    pair: ["art.abstract-expression", "music.musical-form"],
    title: "Painting Without Objects",
    insight:
      "When Kandinsky abandoned the depicted world he reached for music's vocabulary, titling his canvases Compositions and Improvisations. Music had always meant without picturing anything; abstraction was painting claiming that same right — form itself as the subject.",
    tier: 1,
  },

  // ── art × philosophy ────────────────────────────────────────────────────
  {
    id: "art.harmony+phil.beauty",
    pair: ["art.harmony", "phil.beauty"],
    title: "The Canon of Polykleitos",
    insight:
      "Polykleitos sculpted the Doryphoros as a demonstration of his written Canon: beauty as the commensurability of every part to every other. Galen preserved the doctrine — health and beauty alike as right proportion — making one statue the ancient world's most argued-with definition of the beautiful.",
    tier: 2,
  },

  // ── art × history ───────────────────────────────────────────────────────
  {
    id: "art.perspective+hist.renaissance",
    pair: ["art.perspective", "hist.renaissance"],
    title: "The Wall That Opened",
    insight:
      "Masaccio's Trinity (c. 1427) in Santa Maria Novella was the demonstration piece of Brunelleschi's new geometry: a painted chapel whose coffered vault seems to pierce the church wall. Perspective became the Renaissance's signature — space reorganized around a single human eye, the era's humanism stated as an optical fact.",
    tier: 3,
  },
  {
    id: "art.symbolism+hist.revolution",
    pair: ["art.symbolism", "hist.revolution"],
    title: "Allegory at the Barricade",
    insight:
      "Delacroix painted Liberty Leading the People within months of the July Revolution of 1830, setting an allegory on a documentary barricade: barefoot Liberty in a Phrygian cap strides over real corpses beside a top-hatted bourgeois and a pistol-waving boy. Revolution needed a body, and symbolism gave it one no police could arrest.",
    tier: 2,
    quote: {
      text: "If I have not fought for my country, at least I shall paint for her.",
      source: "Eugène Delacroix, letter to his brother, October 1830",
    },
  },
  {
    id: "art.composition+hist.power-structures",
    pair: ["art.composition", "hist.power-structures"],
    title: "The Composed Coronation",
    insight:
      "In David's Coronation of Napoleon (1807) the emperor crowns Joséphine — David first sketched Napoleon crowning himself, then chose the safer scene — while Napoleon's mother presides from the central tribune, though she had refused to attend. Composition is statecraft: where power sits in the frame is where it claims to sit in the world.",
    tier: 2,
  },
  {
    id: "art.contrast+hist.warfare",
    pair: ["art.contrast", "hist.warfare"],
    title: "War in Greyscale",
    insight:
      "After German bombers destroyed the Basque town of Gernika on 26 April 1937, Picasso painted Guernica in about five weeks for the Spanish Republic's pavilion at the Paris world's fair — and drained it of color. In blacks, whites and greys under a bare electric bulb, the atrocity arrives with the bluntness of a document: contrast does the screaming that color cannot.",
    tier: 3,
  },
  {
    id: "art.realism+hist.colonialism",
    pair: ["art.realism", "hist.colonialism"],
    title: "The Eyewitness Illusion",
    insight:
      "Gérôme's The Snake Charmer (c. 1879) renders its Orient tile by tile with the finish of an eyewitness report, yet it is a studio fantasy assembled from props and photographs. When Edward Said published Orientalism in 1978 the painting went on the cover; Linda Nochlin's 'The Imaginary Orient' (1983) argued that precision of surface is exactly what lent empire's fictions their air of fact.",
    tier: 2,
  },
  {
    id: "art.movement+hist.industrial-revolution",
    pair: ["art.movement", "hist.industrial-revolution"],
    title: "The Frozen Gallop",
    insight:
      "In 1878 the railroad magnate Leland Stanford set Eadweard Muybridge a question no eye could answer: does a galloping horse ever float free of the ground? Twelve cameras tripped by threads said yes — hooves gathered beneath the body, not stretched like a rocking horse. Centuries of painted gallops died in a second of photographs, and Degas soon drew horses from Muybridge's plates.",
    tier: 2,
  },

  // ── art × mathematics (continued) ───────────────────────────────────────
  {
    id: "art.symbolism+math.number-theory",
    pair: ["art.symbolism", "math.number-theory"],
    title: "Jupiter's Square",
    insight:
      "Dürer set a 4×4 magic square into Melencolia I: rows, columns and diagonals all sum to 34, and the middle of the bottom row spells the date, 1514. In Renaissance number-lore this was Jupiter's square, a charm against Saturn's melancholy — arithmetic worn as an amulet inside an allegory of a mind that cannot find peace.",
    tier: 2,
  },
  {
    id: "art.form+math.topology",
    pair: ["art.form", "math.topology"],
    title: "The One-Sided Parade",
    insight:
      "Escher's woodcut Möbius Strip II (1963) sends a file of red ants along a lattice band; follow one and it returns having walked what look like both sides, because the surface has only one. The strip Möbius and Listing described in 1858 let sculptural form carry a topological secret no single viewpoint can reveal — you must travel the form to know it.",
    tier: 2,
  },
  {
    id: "art.abstract-expression+math.fractals",
    pair: ["art.abstract-expression", "math.fractals"],
    title: "The Dimension of a Drip",
    insight:
      "In 1999 the physicist Richard Taylor reported in Nature that Pollock's drip skeins are fractal, their dimension climbing from around 1.1 in 1945 toward 1.7 in the late webs — order hiding in apparent abandon. Other physicists have disputed the analysis ever since, and the dispute is the tribute: the drips sit close enough to nature's geometry to be worth measuring.",
    tier: 2,
  },
  {
    id: "art.harmony+math.geometry",
    pair: ["art.harmony", "math.geometry"],
    title: "Penrose in Isfahan",
    insight:
      "Medieval Islamic craftsmen composed girih patterns from five puzzle-piece tiles, and on the Darb-i Imam shrine in Isfahan (1453) the result is nearly a perfect quasicrystalline tiling — geometry the West only formalized with Penrose in the 1970s, as Lu and Steinhardt showed in Science in 2007. Ornamental harmony ran five centuries ahead of the theorems.",
    tier: 3,
  },
  {
    id: "art.minimalism+math.set-theory",
    pair: ["art.minimalism", "math.set-theory"],
    title: "One Hundred Twenty-Two Cubes",
    insight:
      "Sol LeWitt's Incomplete Open Cubes (1974) exhibits all 122 admissible ways of leaving a cube unfinished — each variation still joined, still three-dimensional, still legibly a cube. The work is the exhaustive enumeration of a defined set, and its beauty is a theorem's kind of beauty: not in any one object, but in the completeness of the collection.",
    tier: 2,
    quote: {
      text: "The idea becomes a machine that makes the art.",
      source: "Sol LeWitt, Paragraphs on Conceptual Art (1967)",
    },
  },

  // ── art × music (continued) ─────────────────────────────────────────────
  {
    id: "art.harmony+music.musical-form",
    pair: ["art.harmony", "music.musical-form"],
    title: "Nocturnes for the Eye",
    insight:
      "Whistler filed his pictures under music — Symphonies, Arrangements, Harmonies, and, after his piano-loving patron Frederick Leyland suggested the Chopin term around 1872, Nocturnes. The renaming was an argument: a painting, like a nocturne, should be judged as arranged tone, not as a report on its subject.",
    tier: 1,
    quote: {
      text: "As music is the poetry of sound, so is painting the poetry of sight.",
      source: "James McNeill Whistler, 'The Red Rag', 1878",
    },
  },
  {
    id: "art.texture+music.counterpoint",
    pair: ["art.texture", "music.counterpoint"],
    title: "Fugue in Red",
    insight:
      "Klee, a violinist before he was a painter, set out to paint counterpoint: in Fugue in Red (1921) a shape enters and re-enters shifted in color and scale like a subject moving through voices, and his layered watercolor veils let several lines sound through one another. Polyphonic painting, he noted in his diary, even outdoes music — there, time itself becomes space.",
    tier: 2,
  },
  {
    id: "art.color-theory+music.modulation",
    pair: ["art.color-theory", "music.modulation"],
    title: "A Stave for Light",
    insight:
      "Scriabin's Prometheus: The Poem of Fire (1910) carries a stave for light — the clavier à lumières, tuned to his private mapping of keys to colors, meant to flood the hall with each harmony's hue. The Moscow premiere went unlit and the lights waited for New York in 1915, but the score survives as modulation made visible: key change as color change.",
    tier: 2,
  },
  {
    id: "art.movement+music.rhythm-patterns",
    pair: ["art.movement", "music.rhythm-patterns"],
    title: "The Promenade Pulse",
    insight:
      "Mussorgsky built Pictures at an Exhibition (1874) around the walking itself: the recurring Promenade sways between 5/4 and 6/4, an uneven stroll from frame to frame at Viktor Hartmann's memorial show, and Mussorgsky told Stasov the strolling figure was himself. Static pictures gained what canvas lacks — a pulse, and a viewer moving in time.",
    tier: 1,
  },
  {
    id: "art.light-and-shadow+music.timbre",
    pair: ["art.light-and-shadow", "music.timbre"],
    title: "The Dissolved Outline",
    insight:
      "Critics heard Monet in Debussy from the start; Debussy snapped back, in a 1908 letter, that 'impressionism' was a label abused by imbeciles. The kinship stuck anyway, because both arts work the seam of light and haze: Monet dissolves the drawn edge into vibrating strokes, Debussy dissolves the chord's edge into pedal blur and veiled instrumental color.",
    tier: 2,
  },
  {
    id: "art.form+music.melody-structure",
    pair: ["art.form", "music.melody-structure"],
    title: "The Glissando Pavilion",
    insight:
      "In Metastaseis (1954) Xenakis gave each string player a private glissando — dozens of straight lines in pitch and time whose massed sweep bends into a curve. Four years later, working in Le Corbusier's studio, he built the same figure in space: the Philips Pavilion at Expo 58, hyperbolic paraboloids swept from straight edges. Melodic line and architectural surface, one geometry.",
    tier: 3,
  },
  {
    id: "art.abstract-expression+music.syncopation",
    pair: ["art.abstract-expression", "music.syncopation"],
    title: "Boogie-Woogie on the Grid",
    insight:
      "When Mondrian reached New York in 1940 he fell for boogie-woogie piano and named his last paintings after it: in Broadway Boogie Woogie (1942–43) the austere black grid shatters into stuttering blocks of yellow, red and grey that land like accents off the beat. The most puritan of abstractionists ended as a painter of syncopation — rhythm with the melody removed.",
    tier: 2,
  },

  // ── art × philosophy (continued) ────────────────────────────────────────
  {
    id: "art.light-and-shadow+phil.reality",
    pair: ["art.light-and-shadow", "phil.reality"],
    title: "Shadows on the Wall",
    insight:
      "Plato's cave chains its prisoners before a wall of shadows they take for the world, and he had a word for painters' shading — skiagraphia — which he ranked near conjuring. European painting accepted the insult as a job description: from Masaccio to Rembrandt, cast shadow is precisely how a flat surface is made to confess depth, weight and presence.",
    tier: 3,
  },
  {
    id: "art.realism+phil.truth",
    pair: ["art.realism", "phil.truth"],
    title: "The Painted Curtain",
    insight:
      "Pliny records antiquity's favorite art contest: Zeuxis painted grapes so convincing that birds flew at them, then asked Parrhasius to draw the curtain off his rival entry — and the curtain was the painting. Zeuxis conceded: deceiving an artist outranks deceiving birds. Realism has carried the sting ever since — the truest image is the finest lie.",
    tier: 2,
  },
  {
    id: "art.balance+phil.beauty",
    pair: ["art.balance", "phil.beauty"],
    title: "Poise Before the Measureless",
    insight:
      "Kant's Critique of Judgment (1790) split aesthetics in two: beauty belongs to bounded, balanced form, while the sublime begins where form fails — the storm, the summit, the measureless. Caspar David Friedrich painted the frontier between them: Wanderer above the Sea of Fog (c. 1818) is perfect compositional poise facing what cannot be composed.",
    tier: 2,
  },
  {
    id: "art.minimalism+phil.ontology",
    pair: ["art.minimalism", "phil.ontology"],
    title: "The Chosen Object",
    insight:
      "In 1917 a urinal signed 'R. Mutt' arrived at a New York exhibition whose only rule was that every paying artist exhibits; the committee hid it anyway. Duchamp's Fountain pared art-making down to a single act — selection — and turned aesthetics into ontology: nothing about the object changed except its kind of being.",
    tier: 3,
    quote: {
      text: "Whether Mr Mutt with his own hands made the fountain or not has no importance. He CHOSE it.",
      source: "The Blind Man, no. 2 (1917)",
    },
  },
  {
    id: "art.perspective+phil.phenomenology",
    pair: ["art.perspective", "phil.phenomenology"],
    title: "The Lived Perspective",
    insight:
      "Merleau-Ponty's essay 'Cézanne's Doubt' (1945) reads the painter's splayed tabletops and doubled outlines not as errors but as fidelity: Cézanne traded the geometer's perspective for lived perspective, the way space actually assembles in perception before geometry tidies it. Phenomenology found its best evidence hanging in a frame.",
    tier: 2,
  },

  // ── art intra ───────────────────────────────────────────────────────────
  {
    id: "art.color-theory+art.contrast",
    pair: ["art.color-theory", "art.contrast"],
    title: "The Gobelins Complaint",
    insight:
      "Weavers at the Gobelins works complained that their blacks went feeble next to blues, so the chemist Chevreul tested the dyes — and found nothing wrong. The fault was in the eye: adjacent colors push each other toward their complements, the law of simultaneous contrast he published in 1839. Seurat read him and turned a defect of vision into a method.",
    tier: 2,
  },
  {
    id: "art.form+art.light-and-shadow",
    pair: ["art.form", "art.light-and-shadow"],
    title: "Struck from Darkness",
    insight:
      "In Caravaggio's Calling of Saint Matthew (1600) a blade of light crosses a dark tavern wall and bodies leap out of nothing: volume is not drawn but struck. Chiaroscuro works because sight itself is sculptural — the eye reads form from the gradient of illumination, so whoever controls the light controls what seems solid, and what seems chosen.",
    tier: 2,
  },

  // ── art × physics ───────────────────────────────────────────────────────
  {
    id: "art.surrealism+phys.particle-physics",
    pair: ["art.surrealism", "phys.particle-physics"],
    title: "Nuclear Mysticism",
    insight:
      "After Hiroshima, Dalí declared that physics had replaced psychoanalysis as his master science, and in Galatea of the Spheres (1952) Gala's face assembles from hovering spheres that never touch — matter as the physicists described it, discontinuous and mostly void, painted with an illusionist's calm. The unconscious had a rival: the dream logic of the atom itself.",
    tier: 2,
    quote: {
      text: "My father today is Dr. Heisenberg.",
      source: "Salvador Dalí, Anti-Matter Manifesto (1958)",
    },
  },
  {
    id: "art.color-theory+phys.electromagnetic-fields",
    pair: ["art.color-theory", "phys.electromagnetic-fields"],
    title: "Maxwell's Tartan Ribbon",
    insight:
      "In 1861, between writing the equations that made light electromagnetic, James Clerk Maxwell projected the first color photograph — a tartan ribbon shot three times through red, green and blue filters. The demonstration vindicated the three-receptor theory of color vision: every hue a painter mixes is the eye summing three signals from one continuous spectrum.",
    tier: 2,
  },
  {
    id: "art.light-and-shadow+phys.optics",
    pair: ["art.light-and-shadow", "phys.optics"],
    title: "The Darkened Room",
    insight:
      "Ibn al-Haytham analyzed the camera obscura around 1021, showing that light travels in straight lines through a pinhole into a darkened chamber. Seven centuries later Canaletto's notebooks record him tracing Venice through one — the physics of projection quietly became a drawing instrument, and painting's mastery of light owed optics a debt it rarely acknowledged.",
    tier: 2,
  },
  {
    id: "art.movement+phys.momentum",
    pair: ["art.movement", "phys.momentum"],
    title: "Sculpting Velocity",
    insight:
      "Boccioni's Unique Forms of Continuity in Space (1913) freezes a striding figure into flame-like sheets of bronze — not a body but its momentum, mass times velocity given contour. The Futurists said it outright: modern beauty was speed itself, and sculpture's task was to cast the trajectory rather than the thing.",
    tier: 2,
    quote: {
      text: "A roaring motor car... is more beautiful than the Victory of Samothrace.",
      source: "F. T. Marinetti, The Futurist Manifesto, 1909",
    },
  },
];
