/**
 * Curated connections filed under history (lexicographically-first of each
 * pair). Style: 2–3 sentences, ≥1 concrete true anchor, no mush.
 */
import type { CuratedConnection } from "../types";

export const historyConnections: CuratedConnection[] = [
  // ── history × philosophy ────────────────────────────────────────────────
  {
    id: "hist.revolution+phil.dialectics",
    pair: ["hist.revolution", "phil.dialectics"],
    title: "History's Engine",
    insight:
      "Marx claimed to stand Hegel's dialectic on its feet: contradiction still drives development, but the contending terms are classes, not concepts. The Communist Manifesto appeared in February 1848, weeks before revolutions swept Europe — theory and upheaval arriving almost on the same mail coach.",
    tier: 2,
  },
  {
    id: "hist.human-rights+phil.ethics",
    pair: ["hist.human-rights", "phil.ethics"],
    title: "The Categorical Declaration",
    insight:
      "Kant's 1785 formula — treat humanity never merely as a means but always as an end — waited a century and a half for its treaty. The 1948 Universal Declaration opens with 'the inherent dignity of all members of the human family': a philosopher's imperative, countersigned by states still ash-stained from disregarding it.",
    tier: 2,
  },

  // ── history × mathematics ───────────────────────────────────────────────
  {
    id: "hist.democracy+math.statistics",
    pair: ["hist.democracy", "math.statistics"],
    title: "The Average Citizen",
    insight:
      "In 1835 Quetelet invented l'homme moyen — the average man — and taught states to see their peoples as distributions. Census, poll, and margin of error followed: modern democracy governs partly by arithmetic, a body politic that knows itself through its own statistics.",
    tier: 1,
  },

  // ── history × music ─────────────────────────────────────────────────────
  {
    id: "hist.enlightenment+music.musical-form",
    pair: ["hist.enlightenment", "music.musical-form"],
    title: "The Sonata of Reason",
    insight:
      "Sonata form crystallized in the same decades as the Encyclopédie, and it argues like the age that made it: themes exposed, sent through development's trials, and recapitulated in a higher agreement. Charles Rosen read Haydn's wit and Mozart's balance as Enlightenment rhetoric in sound — persuasion by form.",
    tier: 1,
  },

  // ── history × mathematics (continued) ───────────────────────────────────
  {
    id: "hist.warfare+math.probability",
    pair: ["hist.warfare", "math.probability"],
    title: "Decibans Against Enigma",
    insight:
      "To break naval Enigma, Turing's hut at Bletchley Park scored rotor hypotheses in decibans — tenths of the logarithmic 'ban', named for the town of Banbury where the method's punched sheets were printed. Banburismus weighed evidence sequentially until a guess crossed the threshold of belief: Bayesian inference run as a war industry, years before the theory had a textbook.",
    tier: 3,
  },
  {
    id: "hist.trade-routes+math.graph-theory",
    pair: ["hist.trade-routes", "math.graph-theory"],
    title: "Seven Bridges, One Graph",
    insight:
      "Königsberg, a Hanseatic trading port on the Pregel, posed a stroller's puzzle: cross each of its seven bridges once and only once. Euler proved it impossible in 1736 by forgetting everything except landmasses and links — inventing graph theory in the act. The abstraction now runs in reverse: historians redraw the Silk Road as nodes and edges and ask which cities were the bridges.",
    tier: 2,
  },
  {
    id: "hist.industrial-revolution+math.statistics",
    pair: ["hist.industrial-revolution", "math.statistics"],
    title: "Dots Around a Pump",
    insight:
      "In September 1854 John Snow plotted Soho's cholera deaths on a street map and watched them cluster around the Broad Street pump, whose handle the parish removed on the 8th. The industrial city had made an epidemic countable — dense, gridded, documented — and counting struck back: epidemiology was born as dots on a map contradicting the official theory of bad air.",
    tier: 2,
  },
  {
    id: "hist.colonialism+math.geometry",
    pair: ["hist.colonialism", "math.geometry"],
    title: "The Navigator's Projection",
    insight:
      "Mercator's 1569 chart was engineered, its title says, 'for the use of navigators': it bends the globe so a fixed compass bearing runs straight, and empires sailed along those lines. The price is paid at the equator — Africa, about fourteen times Greenland's area, prints barely larger — so the map that guided colonial fleets still hangs in classrooms, quietly swelling the North.",
    tier: 2,
  },
  {
    id: "hist.cultural-evolution+math.fibonacci-sequence",
    pair: ["hist.cultural-evolution", "math.fibonacci-sequence"],
    title: "The Customs-House Numerals",
    insight:
      "Leonardo of Pisa met Hindu-Arabic numerals in the customs house at Bugia where his father served Pisan merchants; his Liber Abaci (1202), home of the rabbit problem, carried them into Europe. Florence's bankers banned the strange digits from ledgers in 1299, fearing forgery — and the merchants' faster arithmetic won anyway. Ideas spread like his rabbits: each generation breeding the next.",
    tier: 2,
  },

  // ── history × music (continued) ─────────────────────────────────────────
  {
    id: "hist.renaissance+music.counterpoint",
    pair: ["hist.renaissance", "music.counterpoint"],
    title: "Master of the Notes",
    insight:
      "When Ottaviano Petrucci perfected music printing in Venice, his 1502 volume of masses was devoted to a single living composer — Josquin des Prez, polyphony's first name-brand author. Luther said the notes did as Josquin willed, while other composers did as the notes willed: the Renaissance cult of the individual arriving inside counterpoint, the most collective of arts.",
    tier: 2,
  },
  {
    id: "hist.social-movements+music.improvisation",
    pair: ["hist.social-movements", "music.improvisation"],
    title: "Freedom Now, in Real Time",
    insight:
      "Months after the Greensboro lunch-counter sit-ins, Max Roach recorded We Insist! Freedom Now Suite (1960), its cover restaging the protest at a counter. In 'Triptych' Abbey Lincoln improvises prayer, then open screaming, then calm — the movement's discipline and fury given a form no written score could have fixed in advance.",
    tier: 2,
  },
  {
    id: "hist.revolution+music.musical-form",
    pair: ["hist.revolution", "music.musical-form"],
    title: "The Torn Dedication",
    insight:
      "Beethoven headed his third symphony 'intitolata Bonaparte'; when word came in 1804 that Napoleon had crowned himself emperor, Ferdinand Ries watched him scratch the name out so violently the paper tore. Published instead as a 'heroic symphony... to celebrate the memory of a great man', the Eroica burst form's frame — nearly twice the customary length, a funeral march at its heart, the dedication left blank.",
    tier: 3,
  },
  {
    id: "hist.power-structures+music.melody-structure",
    pair: ["hist.power-structures", "music.melody-structure"],
    title: "One Tune, Four Regimes",
    insight:
      "In 1797 Haydn gave Emperor Franz a hymn, 'Gott erhalte Franz den Kaiser', consciously answering the effect of Britain's God Save the King. The melody outlived its master: reset as the Deutschlandlied in 1841, the same notes have served Habsburg emperors, the Weimar Republic, the Third Reich and today's Federal Republic. Anthems change their words; power keeps the tune.",
    tier: 1,
  },
  {
    id: "hist.warfare+music.rhythm-patterns",
    pair: ["hist.warfare", "music.rhythm-patterns"],
    title: "The Janissary Beat",
    insight:
      "The Ottoman mehter — the massed kettledrums, bass drums and shawms of the Janissary corps — was signaling system and psychological weapon in one, keeping columns in step and defenders awake outside Vienna. Europe's answer was theft: regiments hired 'Turkish' percussion, and by the 1780s Mozart could fold the war-beat into a sonata as the Rondo alla turca.",
    tier: 1,
  },

  // ── history × philosophy (continued) ────────────────────────────────────
  {
    id: "hist.enlightenment+phil.epistemology",
    pair: ["hist.enlightenment", "phil.epistemology"],
    title: "The Courage to Know",
    insight:
      "Answering a question posed in a Berlin monthly in 1784, Kant defined enlightenment as release from self-incurred immaturity — the inability to use one's own understanding without another's guidance. His motto, lifted from Horace, made epistemology a civic program: knowledge is not a stock of doctrines but a posture of the knower, and its precondition is nerve.",
    tier: 2,
    quote: {
      text: "Sapere aude! Have courage to use your own understanding!",
      source: "Immanuel Kant, 'What Is Enlightenment?' (1784)",
    },
  },
  {
    id: "hist.democracy+phil.justice",
    pair: ["hist.democracy", "phil.justice"],
    title: "The Gadfly's Verdict",
    insight:
      "In 399 BC a jury of 501 Athenian citizens tried Socrates for impiety and corrupting the young; he told them a shift of thirty votes would have acquitted him, and likened himself to a gadfly set upon a noble but sluggish horse. Democracy executed its questioner by due procedure, leaving political philosophy its founding wound: majority is not yet justice.",
    tier: 3,
  },
  {
    id: "hist.human-rights+phil.truth",
    pair: ["hist.human-rights", "phil.truth"],
    title: "Axioms of 1776",
    insight:
      "Locke's Second Treatise (1689) grounded government in rights no ruler grants — life, liberty, property; Jefferson tuned the triad to 'the pursuit of happiness' and prefaced it with an epistemic wager: 'we hold these truths to be self-evident.' Rights entered history in the grammar of geometry, claimed as axioms — needing no proof, only the nerve to state them.",
    tier: 2,
  },
  {
    id: "hist.civilization+phil.dialectics",
    pair: ["hist.civilization", "phil.dialectics"],
    title: "The Wheel of Asabiyyah",
    insight:
      "Ibn Khaldun's Muqaddimah (1377) runs history on a contradiction: asabiyyah, the solidarity bred in hard country, wins cities whose luxury then dissolves it — within about four generations, by his reckoning — until the next hungry margin arrives. Toynbee called it the greatest work of its kind ever created: four centuries before Hegel, civilization already moved by the collision of opposites.",
    tier: 2,
  },
  {
    id: "hist.industrial-revolution+phil.consciousness",
    pair: ["hist.industrial-revolution", "phil.consciousness"],
    title: "The Manufactured Mind",
    insight:
      "Engels documented Manchester's mills in The Condition of the Working Class in England (1845); Marx generalized the lesson — the factory does not only make goods, it makes minds. Clock discipline, wage labor and the crowding of strangers bred new forms of awareness, which is why he inverted philosophy's usual direction of explanation.",
    tier: 2,
    quote: {
      text: "It is not the consciousness of men that determines their being, but their social being that determines their consciousness.",
      source: "Karl Marx, preface to A Contribution to the Critique of Political Economy (1859)",
    },
  },
  {
    id: "hist.colonialism+phil.ethics",
    pair: ["hist.colonialism", "phil.ethics"],
    title: "The Trial at Valladolid",
    insight:
      "In 1550 Charles V suspended new conquests in the Americas and summoned a junta to Valladolid, where Las Casas argued against Sepúlveda over whether war on the peoples of the Indies could be just. No verdict was announced and the conquests resumed — but for a moment an empire had put its own legitimacy on trial and let ethics hold the floor.",
    tier: 2,
  },

  // ── history × physics ───────────────────────────────────────────────────
  {
    id: "hist.warfare+phys.nuclear-forces",
    pair: ["hist.warfare", "phys.nuclear-forces"],
    title: "Brighter Than Daybreak",
    insight:
      "At 5:29 in the morning of 16 July 1945, the Trinity test loosed the binding energy of the atomic nucleus over the New Mexico desert — the strong force cashed out by a wartime project that had mobilized well over a hundred thousand workers. Oppenheimer reached for the Bhagavad Gita because no secular register seemed to fit what physics had become.",
    tier: 3,
    quote: {
      text: "Now I am become Death, the destroyer of worlds.",
      source: "J. Robert Oppenheimer, recalling the Trinity test",
    },
  },
  {
    id: "hist.power-structures+phys.cosmology",
    pair: ["hist.power-structures", "phys.cosmology"],
    title: "The Medicean Stars",
    insight:
      "Galileo named Jupiter's moons the Medicean Stars in 1610 and won a Medici court post within months — cosmology was patronage before it was heresy. Then the same telescope turned on authority itself: moons circling another world made Earth's centrality negotiable, and in 1633 the Inquisition made him kneel and renounce the moving Earth.",
    tier: 3,
  },
  {
    id: "hist.industrial-revolution+phys.thermodynamics",
    pair: ["hist.industrial-revolution", "phys.thermodynamics"],
    title: "The Engine Before the Law",
    insight:
      "Britain ran on steam for half a century before anyone knew why the engines worked. Sadi Carnot's Réflexions (1824) analyzed an idealized engine and found that work comes only from heat falling between temperatures — the seed Clausius and Kelvin grew into the second law. Thermodynamics was reverse-engineered from industry: the machines came first, and the deepest law of physics was found inside them.",
    tier: 3,
  },
  {
    id: "hist.globalization+phys.electromagnetic-fields",
    pair: ["hist.globalization", "phys.electromagnetic-fields"],
    title: "A Whisper Through the Seabed",
    insight:
      "In August 1858 Queen Victoria telegraphed President Buchanan through a cable lying on the Atlantic floor; some ninety words took sixteen hours, and the line died within weeks. But ten days of ocean had collapsed into hours: with Kelvin's mirror galvanometer reading the cable's faint pulses and a durable line laid in 1866, the field Faraday imagined became the world's nervous system.",
    tier: 2,
  },
  {
    id: "hist.globalization+phys.relativity",
    pair: ["hist.globalization", "phys.relativity"],
    title: "Einstein in Your Pocket",
    insight:
      "Every GPS satellite carries clocks that would run fast by about 38 microseconds a day — special relativity slows them, general relativity speeds them more — so the system corrects for both. Left uncorrected, positions would drift by kilometers each day: the container ship, the airliner and the phone in your hand all navigate by Einstein.",
    tier: 2,
  },
  {
    id: "hist.diplomacy+phys.nuclear-forces",
    pair: ["hist.diplomacy", "phys.nuclear-forces"],
    title: "Strontium Diplomacy",
    insight:
      "St. Louis researchers collected hundreds of thousands of baby teeth and found strontium-90, a bone-seeking fission product, rising in children born through the 1950s; the fallout evidence fed the negotiations that produced the Partial Test Ban Treaty of 1963. The treaty banned tests in air, sea and space but spared those underground — precisely the line seismographs could police without trust.",
    tier: 2,
  },

  // ── history intra ────────────────────────────────────────────────────────
  {
    id: "hist.enlightenment+hist.renaissance",
    pair: ["hist.enlightenment", "hist.renaissance"],
    title: "The Bridge of Movable Type",
    insight:
      "The Renaissance recovered the ancient texts; Gutenberg's press (c. 1450) made the recovery irreversible — by 1500, workshops in some 270 European towns had issued on the order of 28,000 editions. On that infrastructure the Republic of Letters assembled, and what began as a rebirth of the old compounded into the Enlightenment's wager that knowledge accumulates.",
    tier: 2,
  },
  {
    id: "hist.globalization+hist.trade-routes",
    pair: ["hist.globalization", "hist.trade-routes"],
    title: "Fifty-Eight Boxes",
    insight:
      "For millennia routes were adventures: caravans, monsoons, pirates. On 26 April 1956 Malcom McLean's converted tanker Ideal X left Newark for Houston with fifty-eight containers on deck, and the economics of distance broke — loading costs collapsed from dollars to cents per ton. Containerization did to goods what the telegraph did to words: it made the route disappear into infrastructure.",
    tier: 2,
  },
];
