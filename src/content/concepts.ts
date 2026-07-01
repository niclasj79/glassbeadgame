import type { Concept } from "./types";

/**
 * The ninety beads of the Game — fifteen per discipline.
 * Populated in M1 from v1's conceptData + conceptDescriptions (ported verbatim),
 * enriched with transcendental coordinates, pitch degrees, and keywords.
 */
export const concepts: Concept[] = [
  // ── Mathematics ─────────────────────────────────────────────────────────
  {
    id: "math.fibonacci-sequence",
    name: "Fibonacci Sequence",
    discipline: "mathematics",
    description:
      "A series where each number is the sum of the two preceding ones. Found throughout nature — in sunflower spirals, pine cones, and galaxy arms — it reveals a deep mathematical order underlying organic growth.",
    tbg: [0.9, 0.7, 0.1],
    pitchDegree: 0,
    keywords: ["recursive growth", "nature's spiral", "organic order"],
    bridge: true,
  },
  {
    id: "math.golden-ratio",
    name: "Golden Ratio",
    discipline: "mathematics",
    description:
      "The irrational number φ ≈ 1.618, found when a line is divided so the ratio of the whole to the larger part equals the ratio of the larger to the smaller. Revered since antiquity for its appearance in art, architecture, and nature.",
    tbg: [0.75, 0.95, 0.15],
    pitchDegree: 3,
    keywords: ["divine proportion", "sacred geometry", "hidden measure"],
    bridge: true,
  },
  {
    id: "math.infinite-series",
    name: "Infinite Series",
    discipline: "mathematics",
    description:
      "The sum of infinitely many terms. Some converge to finite values (like 1 + ½ + ¼ + ⅛… = 2), others diverge to infinity. They are the foundation of calculus and our ability to approximate the continuous from the discrete.",
    tbg: [0.85, 0.55, 0],
    pitchDegree: 4,
    keywords: ["endless sum", "converging steps", "taming infinity"],
  },
  {
    id: "math.topology",
    name: "Topology",
    discipline: "mathematics",
    description:
      "The study of properties preserved under continuous deformation — stretching, bending, but not tearing. A coffee mug and a donut are topologically identical. It reveals the deep structure of space itself.",
    tbg: [0.8, 0.6, -0.05],
    pitchDegree: 2,
    keywords: ["stretched space", "invariant essence", "shape without measure"],
  },
  {
    id: "math.prime-numbers",
    name: "Prime Numbers",
    discipline: "mathematics",
    description:
      "Numbers divisible only by 1 and themselves. The atoms of arithmetic — every integer is a unique product of primes. Their distribution remains one of mathematics' deepest mysteries.",
    tbg: [0.95, 0.5, 0.05],
    pitchDegree: 0,
    keywords: ["atoms of arithmetic", "indivisible core", "scattered mystery"],
  },
  {
    id: "math.chaos-theory",
    name: "Chaos Theory",
    discipline: "mathematics",
    description:
      'The study of systems where tiny changes in initial conditions produce vastly different outcomes. The "butterfly effect." Deterministic yet unpredictable, it bridges order and randomness.',
    tbg: [0.7, 0.45, -0.15],
    pitchDegree: 1,
    keywords: ["butterfly wings", "sensitive fate", "order in turbulence"],
    bridge: true,
  },
  {
    id: "math.fractals",
    name: "Fractals",
    discipline: "mathematics",
    description:
      "Geometric shapes that exhibit self-similarity at every scale. Zoom into a coastline, a fern, or the Mandelbrot set and you find the same patterns repeating infinitely. They measure the roughness of reality.",
    tbg: [0.6, 0.85, 0.05],
    pitchDegree: 3,
    keywords: ["infinite recursion", "self-similar depths", "rough edges of reality"],
    bridge: true,
  },
  {
    id: "math.set-theory",
    name: "Set Theory",
    discipline: "mathematics",
    description:
      "The foundation of modern mathematics, studying collections of objects and their relationships. From it arise the concepts of infinity, cardinality, and the very language in which all mathematics is expressed.",
    tbg: [0.9, 0.3, 0],
    pitchDegree: 0,
    keywords: ["collections of thought", "nested infinities", "foundation stones"],
  },
  {
    id: "math.number-theory",
    name: "Number Theory",
    discipline: "mathematics",
    description:
      'The "queen of mathematics" — the study of integers and their properties. From ancient Greek puzzles about perfect numbers to modern cryptography, it spans millennia of human curiosity.',
    tbg: [0.88, 0.65, 0.1],
    pitchDegree: 0,
    keywords: ["integer secrets", "perfect numbers", "ancient puzzles"],
  },
  {
    id: "math.geometry",
    name: "Geometry",
    discipline: "mathematics",
    description:
      "The study of shape, size, and spatial relationships. From Euclid's axioms to Riemannian manifolds, geometry gives us the language to describe the fabric of space itself.",
    tbg: [0.85, 0.75, 0.1],
    pitchDegree: 3,
    keywords: ["measured space", "axiom and proof", "fabric of form"],
  },
  {
    id: "math.calculus",
    name: "Calculus",
    discipline: "mathematics",
    description:
      "The mathematics of change and accumulation. Differentiation captures instantaneous rates; integration totals continuous quantities. It gave humanity the power to model the physical world.",
    tbg: [0.9, 0.55, 0.3],
    pitchDegree: 1,
    keywords: ["instantaneous change", "accumulated flow", "motion captured"],
  },
  {
    id: "math.statistics",
    name: "Statistics",
    discipline: "mathematics",
    description:
      "The science of learning from data. It transforms uncertainty into knowledge, enabling us to find patterns, test hypotheses, and make decisions in the face of incomplete information.",
    tbg: [0.8, 0.15, 0.45],
    pitchDegree: 2,
    keywords: ["signal from noise", "patterns in data", "informed uncertainty"],
  },
  {
    id: "math.probability",
    name: "Probability",
    discipline: "mathematics",
    description:
      "The mathematics of uncertainty. It quantifies likelihood, from coin flips to quantum mechanics, and underpins our understanding of risk, randomness, and the nature of information.",
    tbg: [0.85, 0.35, 0.25],
    pitchDegree: 4,
    keywords: ["weighted chance", "dice of nature", "quantified doubt"],
    bridge: true,
  },
  {
    id: "math.graph-theory",
    name: "Graph Theory",
    discipline: "mathematics",
    description:
      "The study of networks — nodes connected by edges. From social networks to neural pathways to the internet, it reveals the hidden structure of connected systems.",
    tbg: [0.75, 0.4, 0.2],
    pitchDegree: 1,
    keywords: ["nodes and edges", "hidden networks", "webs of relation"],
  },
  {
    id: "math.abstract-algebra",
    name: "Abstract Algebra",
    discipline: "mathematics",
    description:
      "The study of algebraic structures — groups, rings, fields — that generalize arithmetic. It reveals the deep symmetries underlying physics, chemistry, and geometry.",
    tbg: [0.87, 0.7, 0],
    pitchDegree: 3,
    keywords: ["deep symmetry", "structure of structures", "generalized arithmetic"],
  },

  // ── Music ───────────────────────────────────────────────────────────────
  {
    id: "music.harmonic-resonance",
    name: "Harmonic Resonance",
    discipline: "music",
    description:
      "When frequencies align in simple ratios, they reinforce each other, producing the rich, full sound we perceive as harmony. It's the physics behind why certain notes sound beautiful together.",
    tbg: [0.7, 0.9, 0.25],
    pitchDegree: 4,
    keywords: ["aligned frequencies", "sympathetic vibration", "physics of beauty"],
    bridge: true,
  },
  {
    id: "music.counterpoint",
    name: "Counterpoint",
    discipline: "music",
    description:
      "The art of combining independent melodic lines into a unified whole. Perfected by Bach, it represents one of humanity's most sophisticated intellectual achievements in organizing sound.",
    tbg: [0.55, 0.92, 0.2],
    pitchDegree: 2,
    keywords: ["independent voices", "woven melodies", "conversation in sound"],
    bridge: true,
  },
  {
    id: "music.modulation",
    name: "Modulation",
    discipline: "music",
    description:
      "The process of changing from one key to another within a piece. It creates emotional journeys — tension, surprise, homecoming — and is the harmonic engine of musical narrative.",
    tbg: [0.3, 0.75, 0.1],
    pitchDegree: 1,
    keywords: ["shifting keys", "harmonic journey", "departure and homecoming"],
  },
  {
    id: "music.rhythm-patterns",
    name: "Rhythm Patterns",
    discipline: "music",
    description:
      "The organization of sound in time. From the heartbeat to polyrhythmic African drumming to electronic beats, rhythm is the most primal and universal element of music.",
    tbg: [0.45, 0.7, 0.35],
    pitchDegree: 0,
    keywords: ["primal pulse", "time organized", "heartbeat of music"],
  },
  {
    id: "music.melody-structure",
    name: "Melody Structure",
    discipline: "music",
    description:
      "The horizontal dimension of music — a sequence of pitches that forms a recognizable, singable line. Melody is how music speaks most directly to human emotion and memory.",
    tbg: [0.25, 0.88, 0.3],
    pitchDegree: 4,
    keywords: ["singable line", "horizontal arc", "memory in pitch"],
  },
  {
    id: "music.timbre",
    name: "Timbre",
    discipline: "music",
    description:
      'The "color" of sound — what makes a violin sound different from a flute playing the same note. It arises from the complex mixture of overtones unique to each instrument and voice.',
    tbg: [0.4, 0.8, 0.05],
    pitchDegree: 2,
    keywords: ["color of sound", "sonic fingerprint", "voice among voices"],
  },
  {
    id: "music.dynamics",
    name: "Dynamics",
    discipline: "music",
    description:
      "The variation of loudness in music. From the whispered pianissimo to thundering fortissimo, dynamics give music its emotional intensity and dramatic arc.",
    tbg: [0.2, 0.65, 0],
    pitchDegree: 3,
    keywords: ["whisper to thunder", "emotional intensity", "breathing loudness"],
  },
  {
    id: "music.consonance",
    name: "Consonance",
    discipline: "music",
    description:
      "The perception of stability and rest when certain intervals sound together. Rooted in the physics of simple frequency ratios, it's the anchor point from which all musical tension departs and returns.",
    tbg: [0.5, 0.85, 0.4],
    pitchDegree: 0,
    keywords: ["stable intervals", "point of rest", "anchor of harmony"],
  },
  {
    id: "music.dissonance",
    name: "Dissonance",
    discipline: "music",
    description:
      'The perception of tension or instability in sound combinations. Far from being "wrong," dissonance is the engine of musical expression — it creates the desire for resolution that drives music forward.',
    tbg: [0.3, 0.45, -0.1],
    pitchDegree: 1,
    keywords: ["tension seeking rest", "expressive friction", "engine of longing"],
    bridge: true,
  },
  {
    id: "music.musical-form",
    name: "Musical Form",
    discipline: "music",
    description:
      "The large-scale architecture of a composition. Sonata, rondo, fugue, blues — these templates organize musical time into comprehensible narratives of departure and return.",
    tbg: [0.6, 0.6, 0.15],
    pitchDegree: 0,
    keywords: ["sonic architecture", "departure and return", "shaped time"],
  },
  {
    id: "music.improvisation",
    name: "Improvisation",
    discipline: "music",
    description:
      "Real-time composition — the art of creating music in the moment. It demands deep knowledge internalized so completely that it becomes spontaneous expression, a dialogue between structure and freedom.",
    tbg: [0.15, 0.7, 0.45],
    pitchDegree: 4,
    keywords: ["composed in the moment", "spontaneous order", "structure meeting freedom"],
  },
  {
    id: "music.polyrhythm",
    name: "Polyrhythm",
    discipline: "music",
    description:
      "The simultaneous use of contrasting rhythmic patterns. Found in West African drumming, Indian classical music, and modern jazz, it creates a rich, multidimensional temporal fabric.",
    tbg: [0.35, 0.72, 0.3],
    pitchDegree: 3,
    keywords: ["layered time", "interlocking pulses", "temporal fabric"],
  },
  {
    id: "music.modal-scales",
    name: "Modal Scales",
    discipline: "music",
    description:
      "Ancient scale systems — Dorian, Phrygian, Lydian — each with a distinct emotional color. They predate major/minor tonality and offer a vast palette of melodic and harmonic possibilities.",
    tbg: [0.4, 0.78, 0.1],
    pitchDegree: 2,
    keywords: ["ancient colors", "emotional palettes", "before major and minor"],
  },
  {
    id: "music.overtones",
    name: "Overtones",
    discipline: "music",
    description:
      "The hidden frequencies that vibrate above any fundamental tone. They determine timbre and create the harmonic series — nature's own chord, present in every musical sound.",
    tbg: [0.8, 0.75, 0.05],
    pitchDegree: 4,
    keywords: ["hidden frequencies", "nature's chord", "spectrum above"],
    bridge: true,
  },
  {
    id: "music.syncopation",
    name: "Syncopation",
    discipline: "music",
    description:
      "Emphasis on unexpected beats, creating rhythmic surprise and forward momentum. It's the swing in jazz, the groove in funk, the spark that makes music feel alive and unpredictable.",
    tbg: [0.1, 0.68, 0.25],
    pitchDegree: 2,
    keywords: ["unexpected accent", "rhythmic surprise", "the offbeat spark"],
  },

  // ── Philosophy ──────────────────────────────────────────────────────────
  {
    id: "phil.consciousness",
    name: "Consciousness",
    discipline: "philosophy",
    description:
      'The "hard problem" — why does subjective experience exist? Why is there something it is like to see red or feel pain? It remains the deepest unsolved question about the nature of mind.',
    tbg: [0.6, 0.5, 0.45],
    pitchDegree: 4,
    keywords: ["inner light", "the hard problem", "felt experience"],
    bridge: true,
  },
  {
    id: "phil.free-will",
    name: "Free Will",
    discipline: "philosophy",
    description:
      "Do we truly choose our actions, or are they determined by prior causes? This question sits at the intersection of physics, neuroscience, ethics, and our deepest intuitions about what it means to be human.",
    tbg: [0.35, 0.2, 0.6],
    pitchDegree: 1,
    keywords: ["chosen path", "causal chains", "the open future"],
  },
  {
    id: "phil.ethics",
    name: "Ethics",
    discipline: "philosophy",
    description:
      "The philosophical study of right and wrong, good and evil. From Aristotle's virtue ethics to Kant's categorical imperative to utilitarian calculus, it asks: how should we live?",
    tbg: [0.2, 0.1, 0.95],
    pitchDegree: 1,
    keywords: ["how to live", "weight of action", "moral compass"],
    bridge: true,
  },
  {
    id: "phil.truth",
    name: "Truth",
    discipline: "philosophy",
    description:
      "What makes a statement true? Correspondence with reality? Internal coherence? Practical usefulness? The nature of truth is foundational to logic, science, and our ability to communicate meaning.",
    tbg: [0.95, 0.2, 0.35],
    pitchDegree: 3,
    keywords: ["correspondence with reality", "unveiled world", "ground of meaning"],
    bridge: true,
  },
  {
    id: "phil.beauty",
    name: "Beauty",
    discipline: "philosophy",
    description:
      "Is beauty in the object or the eye of the beholder? From Plato's Forms to Kant's aesthetics to neuroscience of perception, the nature of beauty connects art, mathematics, and human experience.",
    tbg: [0.15, 0.95, 0.3],
    pitchDegree: 4,
    keywords: ["beholder's eye", "radiant form", "aesthetic pull"],
    bridge: true,
  },
  {
    id: "phil.justice",
    name: "Justice",
    discipline: "philosophy",
    description:
      "What do we owe each other? From Rawls' veil of ignorance to Nozick's libertarianism, theories of justice shape our institutions, laws, and vision of a fair society.",
    tbg: [0.3, 0.25, 0.9],
    pitchDegree: 2,
    keywords: ["fair shares", "veil of ignorance", "what we owe"],
  },
  {
    id: "phil.reality",
    name: "Reality",
    discipline: "philosophy",
    description:
      "What exists, and what is its fundamental nature? Are we in a simulation? Is matter fundamental, or consciousness? The question of reality underpins all other philosophical inquiry.",
    tbg: [0.9, 0.35, 0.1],
    pitchDegree: 0,
    keywords: ["what exists", "bedrock of being", "beneath appearances"],
  },
  {
    id: "phil.knowledge",
    name: "Knowledge",
    discipline: "philosophy",
    description:
      "What can we know, and how can we know it? From Plato's justified true belief to Gettier problems to Bayesian epistemology, the study of knowledge shapes science, education, and rational inquiry.",
    tbg: [0.88, 0.25, 0.4],
    pitchDegree: 2,
    keywords: ["justified belief", "limits of knowing", "earned certainty"],
  },
  {
    id: "phil.existence",
    name: "Existence",
    discipline: "philosophy",
    description:
      "Why is there something rather than nothing? The most fundamental question of metaphysics, it confronts us with the sheer mystery of being — that anything exists at all.",
    tbg: [0.7, 0.5, 0.2],
    pitchDegree: 0,
    keywords: ["something not nothing", "sheer being", "the primal fact"],
  },
  {
    id: "phil.meaning",
    name: "Meaning",
    discipline: "philosophy",
    description:
      "What gives life meaning? Is meaning discovered or created? From existentialism's radical freedom to religious frameworks to absurdism, this question drives our deepest personal and collective quests.",
    tbg: [0.4, 0.55, 0.7],
    pitchDegree: 4,
    keywords: ["reason to live", "created purpose", "the deepest quest"],
  },
  {
    id: "phil.dialectics",
    name: "Dialectics",
    discipline: "philosophy",
    description:
      "The method of reasoning through contradiction — thesis, antithesis, synthesis. From Socratic dialogue to Hegel to Marx, dialectical thinking reveals truth through the collision of opposing ideas.",
    tbg: [0.65, 0.35, 0.25],
    pitchDegree: 1,
    keywords: ["thesis and antithesis", "productive conflict", "truth through collision"],
    bridge: true,
  },
  {
    id: "phil.phenomenology",
    name: "Phenomenology",
    discipline: "philosophy",
    description:
      "The study of experience as it is lived, before theoretical interpretation. Founded by Husserl, developed by Heidegger and Merleau-Ponty, it returns philosophy to the texture of direct experience.",
    tbg: [0.55, 0.65, 0.15],
    pitchDegree: 2,
    keywords: ["lived experience", "texture of the given", "return to things"],
  },
  {
    id: "phil.ontology",
    name: "Ontology",
    discipline: "philosophy",
    description:
      "The study of what exists and the categories of being. What kinds of things are real? Do numbers exist? Do possibilities? Ontology provides the inventory of reality.",
    tbg: [0.85, 0.3, 0.05],
    pitchDegree: 3,
    keywords: ["inventory of being", "categories of the real", "what there is"],
  },
  {
    id: "phil.epistemology",
    name: "Epistemology",
    discipline: "philosophy",
    description:
      "The theory of knowledge — its nature, sources, and limits. How do we distinguish genuine knowledge from mere belief? What role do perception, reason, and testimony play?",
    tbg: [0.92, 0.1, 0.25],
    pitchDegree: 1,
    keywords: ["sources of knowing", "belief and evidence", "maps of certainty"],
  },
  {
    id: "phil.metaphysics",
    name: "Metaphysics",
    discipline: "philosophy",
    description:
      "The study of the fundamental nature of reality — what exists beyond the physical. It asks about causation, time, identity, and the ultimate structure of everything that is.",
    tbg: [0.75, 0.45, 0.15],
    pitchDegree: 4,
    keywords: ["beyond the physical", "ultimate structure", "roots of reality"],
  },

  // ── Physics ─────────────────────────────────────────────────────────────
  {
    id: "phys.quantum-entanglement",
    name: "Quantum Entanglement",
    discipline: "physics",
    description:
      'When two particles become entangled, measuring one instantly determines the state of the other, regardless of distance. Einstein called it "spooky action at a distance." It challenges our deepest intuitions about locality and reality.',
    tbg: [0.85, 0.6, -0.05],
    pitchDegree: 4,
    keywords: ["spooky action", "correlated fates", "nonlocal bond"],
    bridge: true,
  },
  {
    id: "phys.wave-particle-duality",
    name: "Wave-Particle Duality",
    discipline: "physics",
    description:
      "Light and matter behave as both waves and particles, depending on how they're observed. This fundamental mystery of quantum mechanics reveals that reality at its smallest scale defies classical categories.",
    tbg: [0.8, 0.55, 0],
    pitchDegree: 1,
    keywords: ["two faces of light", "observer's choice", "quantum ambiguity"],
    bridge: true,
  },
  {
    id: "phys.relativity",
    name: "Relativity",
    discipline: "physics",
    description:
      "Einstein's twin revolutions: special relativity unites space and time; general relativity reveals gravity as the curvature of spacetime itself. They reshaped our understanding of the cosmos.",
    tbg: [0.95, 0.7, 0.05],
    pitchDegree: 3,
    keywords: ["curved spacetime", "elastic time", "unified cosmos"],
    bridge: true,
  },
  {
    id: "phys.thermodynamics",
    name: "Thermodynamics",
    discipline: "physics",
    description:
      "The science of heat, energy, and entropy. Its laws govern everything from engines to black holes to the arrow of time itself. The second law — entropy always increases — may be the most universal law in physics.",
    tbg: [0.9, 0.25, -0.05],
    pitchDegree: 0,
    keywords: ["arrow of time", "entropy rising", "heat and order"],
    bridge: true,
  },
  {
    id: "phys.electromagnetic-fields",
    name: "Electromagnetic Fields",
    discipline: "physics",
    description:
      "Electric and magnetic fields are two aspects of a single force, unified by Maxwell's equations. This unification revealed that light is an electromagnetic wave and launched the modern technological era.",
    tbg: [0.92, 0.5, 0.4],
    pitchDegree: 3,
    keywords: ["invisible forces", "unified light", "maxwell's dance"],
  },
  {
    id: "phys.string-theory",
    name: "String Theory",
    discipline: "physics",
    description:
      "A theoretical framework proposing that fundamental particles are actually tiny vibrating strings. Different vibration patterns produce different particles. It promises to unify quantum mechanics and gravity.",
    tbg: [0.35, 0.8, 0],
    pitchDegree: 4,
    keywords: ["vibrating strings", "hidden dimensions", "unheard harmonies"],
  },
  {
    id: "phys.dark-matter",
    name: "Dark Matter",
    discipline: "physics",
    description:
      "An invisible substance that makes up ~27% of the universe. We know it exists from its gravitational effects on galaxies, but its nature remains one of physics' greatest mysteries.",
    tbg: [0.55, 0.3, 0],
    pitchDegree: 1,
    keywords: ["invisible scaffold", "gravitational ghost", "missing mass"],
  },
  {
    id: "phys.energy-conservation",
    name: "Energy Conservation",
    discipline: "physics",
    description:
      "Energy cannot be created or destroyed, only transformed. This principle, connected to time symmetry by Noether's theorem, is one of the deepest and most universal laws of nature.",
    tbg: [0.97, 0.6, 0.1],
    pitchDegree: 0,
    keywords: ["nothing lost", "eternal transformation", "symmetry of time"],
  },
  {
    id: "phys.momentum",
    name: "Momentum",
    discipline: "physics",
    description:
      "The quantity of motion — mass times velocity. Its conservation in isolated systems reflects the fundamental symmetry of space itself: physics works the same everywhere.",
    tbg: [0.9, 0.35, 0.05],
    pitchDegree: 1,
    keywords: ["motion carried", "conserved thrust", "symmetry of space"],
  },
  {
    id: "phys.gravity",
    name: "Gravity",
    discipline: "physics",
    description:
      "The most familiar force, yet the most mysterious. Newton described it as attraction between masses; Einstein revealed it as the curvature of spacetime. Quantum gravity remains physics' holy grail.",
    tbg: [0.88, 0.65, 0.15],
    pitchDegree: 0,
    keywords: ["universal pull", "curved paths", "the shaping force"],
  },
  {
    id: "phys.nuclear-forces",
    name: "Nuclear Forces",
    discipline: "physics",
    description:
      "The strong force binds quarks into protons and neutrons, and holds atomic nuclei together. The weak force governs radioactive decay. Together, they shape the heart of matter.",
    tbg: [0.85, 0.2, -0.35],
    pitchDegree: 3,
    keywords: ["binding strength", "heart of matter", "fire of stars"],
  },
  {
    id: "phys.particle-physics",
    name: "Particle Physics",
    discipline: "physics",
    description:
      "The study of nature's smallest constituents. The Standard Model describes 17 fundamental particles and their interactions — quarks, leptons, bosons — painting a remarkably complete picture of reality's building blocks.",
    tbg: [0.9, 0.4, 0.1],
    pitchDegree: 2,
    keywords: ["smallest constituents", "standard model", "building blocks"],
  },
  {
    id: "phys.cosmology",
    name: "Cosmology",
    discipline: "physics",
    description:
      "The study of the universe's origin, structure, and fate. From the Big Bang to cosmic inflation to dark energy, cosmology addresses the grandest questions: where did everything come from, and where is it going?",
    tbg: [0.7, 0.75, 0.2],
    pitchDegree: 3,
    keywords: ["cosmic origin", "expanding universe", "fate of everything"],
  },
  {
    id: "phys.fluid-dynamics",
    name: "Fluid Dynamics",
    discipline: "physics",
    description:
      "The physics of flowing substances — air, water, plasma. From weather patterns to blood flow to star formation, fluid dynamics reveals the beautiful complexity that emerges from simple physical laws.",
    tbg: [0.8, 0.7, 0.25],
    pitchDegree: 2,
    keywords: ["flowing patterns", "turbulent grace", "rivers of air"],
  },
  {
    id: "phys.optics",
    name: "Optics",
    discipline: "physics",
    description:
      "The study of light and its interactions with matter. From lenses and mirrors to fiber optics to quantum optics, understanding light has driven both fundamental physics and transformative technology.",
    tbg: [0.87, 0.68, 0.4],
    pitchDegree: 1,
    keywords: ["bent light", "lens and mirror", "captured rainbow"],
    bridge: true,
  },

  // ── Art ─────────────────────────────────────────────────────────────────
  {
    id: "art.color-theory",
    name: "Color Theory",
    discipline: "art",
    description:
      "The science and art of how colors interact, complement, and contrast. From Newton's color wheel to Albers' interactions, it reveals how perception transforms wavelengths of light into emotional experience.",
    tbg: [0.6, 0.85, 0.2],
    pitchDegree: 2,
    keywords: ["wavelengths into feeling", "complementary tension", "chromatic language"],
    bridge: true,
  },
  {
    id: "art.composition",
    name: "Composition",
    discipline: "art",
    description:
      "The arrangement of visual elements within a frame. Rule of thirds, golden ratio, dynamic symmetry — composition guides the eye and creates meaning through spatial relationships.",
    tbg: [0.5, 0.8, 0.1],
    pitchDegree: 0,
    keywords: ["guided eye", "spatial rhythm", "arranged meaning"],
  },
  {
    id: "art.perspective",
    name: "Perspective",
    discipline: "art",
    description:
      "The technique of representing three-dimensional space on a flat surface. Invented in the Renaissance, it revolutionized art and changed how humans understand their relationship to space.",
    tbg: [0.75, 0.7, 0.15],
    pitchDegree: 3,
    keywords: ["vanishing point", "depth on flatness", "geometry of seeing"],
    bridge: true,
  },
  {
    id: "art.light-and-shadow",
    name: "Light and Shadow",
    discipline: "art",
    description:
      "Chiaroscuro — the interplay of light and dark that creates depth, drama, and emotion. From Caravaggio's theatrical lighting to Rembrandt's golden glow, it is painting's most powerful tool.",
    tbg: [0.45, 0.92, 0.1],
    pitchDegree: 4,
    keywords: ["chiaroscuro drama", "sculpted darkness", "painted illumination"],
    bridge: true,
  },
  {
    id: "art.texture",
    name: "Texture",
    discipline: "art",
    description:
      "The visual and tactile quality of a surface. From Van Gogh's thick impasto to smooth glazing, texture adds a physical dimension to visual art that engages both eye and imagination.",
    tbg: [0.35, 0.75, 0.05],
    pitchDegree: 2,
    keywords: ["tactile surface", "thick impasto", "skin of the canvas"],
  },
  {
    id: "art.form",
    name: "Form",
    discipline: "art",
    description:
      "The three-dimensional quality of objects in art — how shape, volume, and mass create presence. Form transforms flat marks into objects that seem to occupy real space.",
    tbg: [0.55, 0.72, 0],
    pitchDegree: 0,
    keywords: ["volume and mass", "occupied space", "presence in three dimensions"],
  },
  {
    id: "art.movement",
    name: "Movement",
    discipline: "art",
    description:
      "The suggestion of motion and energy in static art. From Duchamp's descending nude to Futurism's speed lines, capturing movement challenges art to transcend its own stillness.",
    tbg: [0.25, 0.68, 0.15],
    pitchDegree: 1,
    keywords: ["frozen motion", "implied energy", "stillness transcended"],
  },
  {
    id: "art.balance",
    name: "Balance",
    discipline: "art",
    description:
      "The distribution of visual weight in a composition. Symmetrical or asymmetrical, balance creates harmony or tension, stability or dynamism — the foundation of visual order.",
    tbg: [0.4, 0.82, 0.35],
    pitchDegree: 2,
    keywords: ["visual weight", "poised tension", "equilibrium of parts"],
  },
  {
    id: "art.contrast",
    name: "Contrast",
    discipline: "art",
    description:
      "The juxtaposition of opposing elements — light/dark, rough/smooth, large/small. Contrast creates visual interest, directs attention, and generates the energy that makes art compelling.",
    tbg: [0.35, 0.6, -0.05],
    pitchDegree: 1,
    keywords: ["opposites juxtaposed", "light against dark", "directed attention"],
  },
  {
    id: "art.harmony",
    name: "Harmony",
    discipline: "art",
    description:
      "The pleasing arrangement of parts into a coherent whole. In visual art, harmony emerges from consistent use of color, form, and rhythm — creating unity without monotony.",
    tbg: [0.45, 0.9, 0.5],
    pitchDegree: 4,
    keywords: ["unified whole", "unity without monotony", "coherent parts"],
    bridge: true,
  },
  {
    id: "art.symbolism",
    name: "Symbolism",
    discipline: "art",
    description:
      "The use of images, objects, and forms to represent ideas beyond their literal meaning. From religious iconography to modern semiotics, symbolism is how art communicates the invisible.",
    tbg: [0.5, 0.65, 0.25],
    pitchDegree: 4,
    keywords: ["visible metaphor", "encoded meaning", "the invisible spoken"],
    bridge: true,
  },
  {
    id: "art.abstract-expression",
    name: "Abstract Expression",
    discipline: "art",
    description:
      "Art that communicates through pure form, color, and gesture rather than representation. Pioneered by Kandinsky, perfected by Pollock and Rothko, it seeks direct emotional and spiritual expression.",
    tbg: [0.1, 0.85, 0.2],
    pitchDegree: 4,
    keywords: ["pure gesture", "color as emotion", "spirit without image"],
  },
  {
    id: "art.realism",
    name: "Realism",
    discipline: "art",
    description:
      "The faithful representation of the visible world. From Courbet's radical insistence on depicting ordinary life to photorealism, it asks: what does it mean to truly see?",
    tbg: [0.85, 0.55, 0.3],
    pitchDegree: 3,
    keywords: ["faithful eye", "ordinary dignity", "the world as seen"],
  },
  {
    id: "art.surrealism",
    name: "Surrealism",
    discipline: "art",
    description:
      "Art that explores the unconscious mind, dreams, and irrational juxtaposition. Founded by Breton, realized by Dalí and Magritte, it reveals the strange logic beneath rational surfaces.",
    tbg: [-0.25, 0.75, 0.05],
    pitchDegree: 1,
    keywords: ["dream logic", "irrational juxtaposition", "the unconscious unveiled"],
  },
  {
    id: "art.minimalism",
    name: "Minimalism",
    discipline: "art",
    description:
      'The reduction of art to its essential elements. "Less is more." From Malevich\'s Black Square to Judd\'s boxes, minimalism strips away everything non-essential to reveal pure presence.',
    tbg: [0.65, 0.62, 0.05],
    pitchDegree: 2,
    keywords: ["essential reduction", "less is more", "pure presence"],
  },

  // ── History ─────────────────────────────────────────────────────────────
  {
    id: "hist.cultural-evolution",
    name: "Cultural Evolution",
    discipline: "history",
    description:
      "How ideas, beliefs, technologies, and practices change and spread across societies over time. Unlike biological evolution, cultural evolution is Lamarckian — acquired traits can be passed on.",
    tbg: [0.7, 0.4, 0.3],
    pitchDegree: 0,
    keywords: ["ideas that spread", "inherited memory", "lamarckian change"],
    bridge: true,
  },
  {
    id: "hist.social-movements",
    name: "Social Movements",
    discipline: "history",
    description:
      "Collective efforts to bring about social change — from abolition to suffrage to civil rights to environmentalism. They reveal how ordinary people, organized, can reshape the world.",
    tbg: [0.4, 0.3, 0.8],
    pitchDegree: 1,
    keywords: ["collective voice", "organized hope", "people in motion"],
  },
  {
    id: "hist.power-structures",
    name: "Power Structures",
    discipline: "history",
    description:
      "The systems — political, economic, social — through which authority is exercised and maintained. Understanding power structures reveals who decides, who benefits, and who is marginalized.",
    tbg: [0.6, -0.2, -0.4],
    pitchDegree: 0,
    keywords: ["invisible hierarchies", "who decides", "architecture of authority"],
  },
  {
    id: "hist.revolution",
    name: "Revolution",
    discipline: "history",
    description:
      "The rapid, fundamental transformation of political or social order. From the French Revolution to the Arab Spring, revolutions are history's most dramatic moments of rupture and renewal.",
    tbg: [0.3, 0.4, 0],
    pitchDegree: 4,
    keywords: ["sudden rupture", "old orders falling", "history accelerated"],
  },
  {
    id: "hist.democracy",
    name: "Democracy",
    discipline: "history",
    description:
      "Government by the people. Born in Athens, evolved through centuries, still contested today. Democracy is both a set of institutions and an ideal — the ongoing experiment of collective self-governance.",
    tbg: [0.5, 0.3, 0.85],
    pitchDegree: 3,
    keywords: ["rule by the people", "collective experiment", "contested ideal"],
  },
  {
    id: "hist.civilization",
    name: "Civilization",
    discipline: "history",
    description:
      "The complex social organization that emerges when humans settle, specialize, and build. Writing, cities, laws, art — civilization is humanity's grandest collective project.",
    tbg: [0.6, 0.55, 0.5],
    pitchDegree: 0,
    keywords: ["cities and writing", "grand collective project", "settled complexity"],
  },
  {
    id: "hist.trade-routes",
    name: "Trade Routes",
    discipline: "history",
    description:
      "The arteries of cultural exchange — the Silk Road, maritime spice routes, trans-Saharan trade. Along with goods, they carried ideas, religions, technologies, and diseases that shaped the world.",
    tbg: [0.65, 0.45, 0.4],
    pitchDegree: 2,
    keywords: ["silk and spice", "arteries of exchange", "traveling ideas"],
    bridge: true,
  },
  {
    id: "hist.diplomacy",
    name: "Diplomacy",
    discipline: "history",
    description:
      "The art of negotiation between nations. From ancient treaty-making to modern international institutions, diplomacy is how humanity attempts to resolve conflicts without violence.",
    tbg: [0.45, 0.25, 0.75],
    pitchDegree: 2,
    keywords: ["words before weapons", "negotiated peace", "the long table"],
  },
  {
    id: "hist.warfare",
    name: "Warfare",
    discipline: "history",
    description:
      "Organized armed conflict between groups. While destructive, warfare has been a primary driver of technological innovation, political change, and the formation of states throughout history.",
    tbg: [-0.1, -0.5, -0.85],
    pitchDegree: 1,
    keywords: ["organized violence", "engine of states", "terrible innovation"],
  },
  {
    id: "hist.renaissance",
    name: "Renaissance",
    discipline: "history",
    description:
      'The "rebirth" of classical learning in 14th-17th century Europe. It produced Leonardo, Michelangelo, Shakespeare, and Galileo — and transformed art, science, and the very concept of the individual.',
    tbg: [0.6, 0.9, 0.45],
    pitchDegree: 4,
    keywords: ["classical rebirth", "art meets science", "the individual awakened"],
    bridge: true,
  },
  {
    id: "hist.enlightenment",
    name: "Enlightenment",
    discipline: "history",
    description:
      "The 18th-century intellectual movement championing reason, science, and individual rights. It gave us democracy, human rights, and the scientific method — the intellectual foundation of the modern world.",
    tbg: [0.85, 0.5, 0.7],
    pitchDegree: 3,
    keywords: ["age of reason", "daring to know", "rights declared"],
    bridge: true,
  },
  {
    id: "hist.industrial-revolution",
    name: "Industrial Revolution",
    discipline: "history",
    description:
      "The transformation from agrarian to industrial economies, beginning in 18th-century Britain. Steam power, factories, and railways reshaped not just economies but the entire human relationship with time, space, and nature.",
    tbg: [0.55, -0.15, 0.1],
    pitchDegree: 3,
    keywords: ["steam and steel", "mechanized time", "reshaped landscapes"],
    bridge: true,
  },
  {
    id: "hist.globalization",
    name: "Globalization",
    discipline: "history",
    description:
      "The increasing interconnection of the world's economies, cultures, and populations. Accelerated by technology and trade, it creates both unprecedented opportunities and profound challenges of inequality and identity.",
    tbg: [0.5, 0.1, 0.2],
    pitchDegree: 2,
    keywords: ["shrinking world", "entangled economies", "borderless currents"],
  },
  {
    id: "hist.colonialism",
    name: "Colonialism",
    discipline: "history",
    description:
      "The practice of establishing control over foreign peoples and territories. Its legacy — economic exploitation, cultural destruction, and institutional racism — continues to shape the modern world.",
    tbg: [-0.2, -0.35, -0.9],
    pitchDegree: 0,
    keywords: ["imposed dominion", "extracted wealth", "enduring scars"],
  },
  {
    id: "hist.human-rights",
    name: "Human Rights",
    discipline: "history",
    description:
      "The idea that all people possess inherent dignity and fundamental freedoms. From the Magna Carta to the Universal Declaration, human rights represent humanity's aspirational moral framework.",
    tbg: [0.4, 0.35, 0.95],
    pitchDegree: 3,
    keywords: ["inherent dignity", "universal claims", "moral horizon"],
  },
];

export const conceptById = new Map<string, Concept>(concepts.map((c) => [c.id, c]));
