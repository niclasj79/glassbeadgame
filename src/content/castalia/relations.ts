import { toFacetId, type DocumentedRelation, type FacetId } from "./schema";

/**
 * THE DOCUMENTED RELATIONS OF CASTALIA
 *
 * Forty-three claims about twenty-four beads, each one obliged by the schema to
 * say what kind of claim it is making and how well that claim is evidenced.
 *
 * Three authoring rules governed this file, in this order of priority:
 *
 *  1. **Never assert influence without a verified source.** Exactly one relation
 *     is typed `historical-transmission` — perspective into anamorphosis, which
 *     Niceron's 1638 treatise derives explicitly. Everything else is a
 *     correspondence the Game notices, a ground it can demonstrate, or an
 *     opposition it can stage. The Hockney–Falco reading of the camera obscura
 *     and the Bartók/Fibonacci reading are both authored as `contested`, with
 *     the disagreement stated, because that is what the evidence supports.
 *
 *  2. **`interpretive` is not a demotion.** Where no citation could be verified,
 *     the relation either became interpretive — which asserts nothing beyond the
 *     two structures compared — or was dropped. Fifteen relations are
 *     interpretive on purpose; several of them are the best writing here.
 *
 *  3. **Every relation admits something.** All but a handful carry a
 *     `counterpoint`, because a relation that concedes nothing is nearly always
 *     overstated. Where a reading genuinely fails, `fit` says `unsupported`
 *     rather than inventing support; that grade is what turns the reading into a
 *     specific Open Thread instead of a shrug.
 *
 * `pair` is stored in sorted order, which puts the faculties in the fixed
 * sequence image < matter < measure < sound. That is an artefact of the id
 * prefixes and carries no meaning; the validator enforces it so that
 * `relationKey` is stable and the reveal is deterministic.
 */
const f = (...ids: string[]): readonly FacetId[] =>
  Object.freeze(ids.map(toFacetId));

/** Contextual typing: literals narrow to the schema's unions instead of widening. */
const relation = (value: DocumentedRelation): DocumentedRelation =>
  Object.freeze(value);

export const CASTALIA_RELATIONS: readonly DocumentedRelation[] = Object.freeze([
  // ── Measure ↔ Sound ──────────────────────────────────────────────────────
  relation({
    id: "rel.fibonacci-counterpoint",
    pair: ["measure.fibonacci-sequence", "sound.counterpoint"],
    title: "Proportion Claimed in a Fugue",
    relationType: "structural-correspondence",
    evidence: "contested",
    fit: { echo: "primary", ground: "supported", passage: "partial", tension: "partial" },
    insight:
      "Ernő Lendvai argued from the 1950s onward that Bartók placed climaxes at golden-section points and built cells from Fibonacci intervals, citing the fugue that opens Music for Strings, Percussion and Celesta (1936). Roy Howat's 1983 re-examination found the bar counts unstable — bars begun confused with bars completed — and no sketch or statement of Bartók's documents the method. What is not in dispute is the bare structural rhyme: a rule that feeds its own output back in, and voices that re-enter displaced against themselves.",
    sharedFacets: f("recursion"),
    counterpoint:
      "Howat and Somfai both read the proportions as found in the scores rather than composed into them. Treat the Bartók attribution as disputed, not as evidence.",
    sources: ["src.lendvai-1971", "src.howat-1983", "src.somfai-1996"],
  }),
  relation({
    id: "rel.primes-polyrhythm",
    pair: ["measure.prime-numbers", "sound.polyrhythm"],
    title: "Cycles That Refuse to Coincide",
    relationType: "structural-correspondence",
    evidence: "attested",
    fit: { echo: "primary", ground: "supported", passage: "partial", tension: "partial" },
    insight:
      "In the first movement of Messiaen's Quatuor pour la fin du Temps, premiered at Stalag VIII-A on 15 January 1941, the piano repeats a rhythm of seventeen durations underneath a sequence of twenty-nine chords. Seventeen and twenty-nine share no factor, so the two cycles would need 493 chords to return together — far more than the movement contains. The composite therefore never audibly repeats.",
    sharedFacets: f("incommensurability"),
    counterpoint:
      "Primality is not what does the work. The cello's five pitches against fifteen durations are not co-prime and realign quickly; sharing no common factor is the operative property, and primes are only the reliable way to get it.",
    sources: ["src.messiaen-quatuor-1942", "src.pople-1998"],
  }),
  relation({
    id: "rel.fourier-overtones",
    pair: ["measure.fourier-series", "sound.overtone-series"],
    title: "Why a Timbre Can Be Taken Apart",
    relationType: "formal-ground",
    evidence: "established",
    fit: { ground: "primary", echo: "supported", passage: "supported", tension: "partial" },
    insight:
      "Fourier's Théorie analytique de la chaleur (1822) showed that a periodic function is a sum of sinusoids at whole-number multiples of one fundamental. A string fixed at both ends is constrained to exactly those frequencies, so its partials fall where the series says. Helmholtz's Die Lehre von den Tonempfindungen (1863) then made that decomposition the basis of a theory of timbre.",
    sharedFacets: f("decomposition", "superposition"),
    counterpoint:
      "Real instruments are only approximately periodic, and their partials are measurably inharmonic — piano strings stretch sharp, bells much further. The series is an idealisation the physical body departs from.",
    sources: ["src.fourier-1822", "src.helmholtz-1863"],
  }),
  relation({
    id: "rel.primes-isorhythm",
    pair: ["measure.prime-numbers", "sound.isorhythm"],
    title: "Talea Against Color",
    relationType: "formal-ground",
    evidence: "established",
    fit: { ground: "primary", echo: "supported", passage: "partial", tension: "unsupported" },
    insight:
      "In fourteenth-century motets a repeating rhythmic talea and a repeating melodic color are commonly of different lengths, so each restatement of the rhythm carries different pitches and the two realign only at their least common multiple. That arithmetic is governed by shared factors: the fewer the two lengths hold in common, the longer the piece must run before it can close.",
    sharedFacets: f("incommensurability"),
    counterpoint:
      "“Isorhythm” is a modern coinage — Friedrich Ludwig's, 1904 — rather than a medieval category, and Margaret Bent has questioned how much analytic weight the term can carry.",
    sources: ["src.bent-2008"],
  }),
  relation({
    id: "rel.symmetry-just-intonation",
    pair: ["measure.continuous-symmetry", "sound.just-intonation"],
    title: "A Symmetry Just Intonation Lacks",
    relationType: "opposition",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "Pitch can be shifted by any amount at all, and under that continuous symmetry the intervals of a melody survive untouched. Just intonation does not possess it. Its ratios are fixed against one tonic, so moving the music moves the tuning with it, and a passage that travels far enough arrives audibly wrong — which is the whole reason temperament exists.",
    sharedFacets: f("invariance", "continuity"),
    counterpoint:
      "Absolute pitch is not symmetric in practice either. Instrument bodies, string lengths and voices all have preferred registers, so transposition is never quite the free operation the geometry describes.",
    sources: ["src.barbour-1951", "src.helmholtz-1863"],
  }),
  relation({
    id: "rel.fourier-counterpoint",
    pair: ["measure.fourier-series", "sound.counterpoint"],
    title: "The Parts Found Are Not the Voices",
    relationType: "opposition",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "A four-voice texture reaches the ear as one pressure wave, and Fourier's decomposition of that wave returns sinusoids — never the four lines. Helmholtz (1863) established that the ear does perform such a spectral analysis, yet a listener still hears voices. The parts counterpoint is written in are not the parts the mathematics recovers.",
    sharedFacets: f("superposition"),
    counterpoint:
      "Neither description is wrong. A voice is a bundle of partials that begin and move together, so the two decompositions are both exact and simply cut the same signal along different seams.",
    sources: ["src.fourier-1822", "src.helmholtz-1863", "src.fux-1725"],
  }),
  relation({
    id: "rel.fibonacci-just-intonation",
    pair: ["measure.fibonacci-sequence", "sound.just-intonation"],
    title: "The Most Rational and the Least",
    relationType: "opposition",
    evidence: "interpretive",
    fit: { tension: "primary", echo: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "Just intonation is built from the simplest whole-number ratios — 3:2, 5:4 — because coinciding partials stop the beating. The limit of consecutive Fibonacci ratios is the golden ratio, the number worst approximated by any fraction, which is why Douady and Couder's 1992 experiments found it selected where a growing system must avoid periodic alignment. Both use proportion; one to lock, one never to lock.",
    sharedFacets: f("proportion"),
    counterpoint:
      "The opposition is the Game's own reading. No tuning tradition is known to have reasoned from irrationality, and the two ratios belong to different problems.",
    sources: ["src.douady-couder-1992", "src.barbour-1951"],
  }),
  relation({
    id: "rel.primes-overtones",
    pair: ["measure.prime-numbers", "sound.overtone-series"],
    title: "Why No Circle of Fifths Closes",
    relationType: "formal-ground",
    evidence: "established",
    fit: { ground: "primary", tension: "supported", passage: "supported", echo: "partial" },
    insight:
      "The octave is the ratio between the first two partials, 2:1, and the fifth the ratio between the next pair, 3:2. Because two and three are distinct primes, unique factorisation — Euclid, Elements VII — forbids any power of 3/2 from landing on a power of 2. Twelve fifths therefore overshoot seven octaves by the Pythagorean comma, about 23.5 cents, and no tuning closes that gap.",
    sharedFacets: f("decomposition"),
    counterpoint:
      "The obstruction is arithmetic; what to do about it is not. Meantone, the well temperaments and equal temperament distribute the same comma differently, and each was standard practice somewhere.",
    sources: ["src.euclid-elements", "src.barbour-1951", "src.helmholtz-1863"],
  }),
  relation({
    id: "rel.fourier-polyrhythm",
    pair: ["measure.fourier-series", "sound.polyrhythm"],
    title: "A Rhythm Read as a Spectrum",
    relationType: "formal-ground",
    evidence: "established",
    fit: { passage: "primary", ground: "supported", echo: "partial", tension: "unsupported" },
    insight:
      "A polyrhythm repeats at the least common multiple of its parts, so however long it takes, the composite is periodic — and any periodic pattern can be written as a sum of sinusoids at multiples of that composite rate. Fourier's translation is exact and reversible in both directions, which makes a three-against-two figure and its spectrum two descriptions of one object.",
    sharedFacets: f("periodicity"),
    counterpoint:
      "The translation preserves everything except what a player hears. Perceived metre depends on accent, grouping and expectation, none of which survives as a distinct component of the spectrum.",
    sources: ["src.fourier-1822"],
  }),

  // ── Measure ↔ Matter ─────────────────────────────────────────────────────
  relation({
    id: "rel.symmetry-conservation",
    pair: ["matter.conservation-of-energy", "measure.continuous-symmetry"],
    title: "Noether's Theorem",
    relationType: "formal-ground",
    evidence: "established",
    fit: { ground: "primary", passage: "supported", echo: "supported", tension: "unsupported" },
    insight:
      "Emmy Noether's “Invariante Variationsprobleme” (Göttingen, 1918) proved that every continuous symmetry of a system's action yields a conserved quantity. Invariance of the laws under a shift in time is precisely what yields conservation of energy; a shift in space yields momentum. Conservation is therefore a consequence of a symmetry, not a separate empirical coincidence.",
    sharedFacets: f("invariance"),
    counterpoint:
      "The theorem needs an action principle and a symmetry that is exact. In general relativity, time-translation symmetry is not available globally, and energy conservation becomes correspondingly delicate.",
    sources: ["src.noether-1918"],
  }),
  relation({
    id: "rel.fourier-standing-wave",
    pair: ["matter.standing-wave", "measure.fourier-series"],
    title: "The Modes a Bounded String Allows",
    relationType: "formal-ground",
    evidence: "established",
    fit: { ground: "primary", echo: "supported", passage: "partial", tension: "unsupported" },
    insight:
      "Fixing a string at both ends admits only those sine shapes with nodes at the ends, so the allowed wavelengths are quantised and every motion of the string is a superposition of them. Chladni's plates (1787) made the two-dimensional version visible in sand: the nodal lines are where the sum of the modes cancels.",
    sharedFacets: f("superposition"),
    counterpoint:
      "The decomposition holds only while the system is linear. Bow a string hard, or drive a plate strongly, and the modes exchange energy — which is a large part of what makes real instruments sound alive.",
    sources: ["src.fourier-1822", "src.chladni-1787"],
  }),
  relation({
    id: "rel.fourier-diffraction",
    pair: ["matter.diffraction", "measure.fourier-series"],
    title: "The Aperture and Its Transform",
    relationType: "formal-ground",
    evidence: "established",
    fit: { passage: "primary", ground: "supported", echo: "partial", tension: "unsupported" },
    insight:
      "In the far field, the pattern a slit or grating throws onto a screen is the Fourier transform of the aperture itself — narrow the opening and the pattern spreads, in exactly the reciprocal way a short pulse spreads in frequency. Born and Wolf's Principles of Optics (1959) sets this out as the standard account of Fraunhofer diffraction.",
    sharedFacets: f("superposition"),
    counterpoint:
      "The identity is a far-field approximation. Close to the aperture the Fresnel regime applies, the simple transform relation fails, and the pattern must be computed rather than read off.",
    sources: ["src.born-wolf-1959"],
  }),
  relation({
    id: "rel.primes-crystal-lattice",
    pair: ["matter.crystal-lattice", "measure.prime-numbers"],
    title: "Which Rotations a Lattice Permits",
    relationType: "formal-ground",
    evidence: "established",
    fit: { ground: "primary", tension: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "A rotation can map a lattice onto itself only if 2 cos θ is a whole number, which leaves rotations of order one, two, three, four and six — and forbids five. The restriction is arithmetic, not chemical: it follows from the integers alone, and it is why a five-fold diffraction pattern was for a century taken as proof of experimental error.",
    sharedFacets: f("discreteness"),
    counterpoint:
      "Shechtman's 1984 alloy diffracted with icosahedral symmetry and sharp peaks. The theorem was not broken — the material simply is not a lattice, which forced the definition of a crystal to be rewritten.",
    sources: ["src.senechal-1995", "src.shechtman-1984"],
  }),
  relation({
    id: "rel.cantor-entropy",
    pair: ["matter.entropy", "measure.cantor-diagonal"],
    title: "Two Arguments From Counting",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { echo: "primary", tension: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "Boltzmann's account of entropy is a counting argument: overwhelmingly more arrangements of the parts look disordered, so that is where a system is found. Cantor's diagonal is also a counting argument, reaching the opposite kind of conclusion — that some collections cannot be enumerated at all. The Game offers the pairing as a structural reading and claims no more.",
    sharedFacets: f("threshold"),
    counterpoint:
      "The two counts are not the same kind. Boltzmann counts a finite, physically bounded set of microstates; Cantor's result concerns infinite sets, and no thermodynamic argument requires uncountability.",
    sources: [],
  }),
  relation({
    id: "rel.fibonacci-crystal-lattice",
    pair: ["matter.crystal-lattice", "measure.fibonacci-sequence"],
    title: "The One-Dimensional Quasicrystal",
    relationType: "formal-ground",
    evidence: "established",
    fit: { passage: "primary", ground: "supported", echo: "supported", tension: "partial" },
    insight:
      "Take two segment lengths and repeatedly substitute long → long-short and short → long, and the counts of segments are Fibonacci numbers. The resulting chain never repeats, yet it diffracts into sharp peaks indexed by the golden ratio. After Shechtman's 1984 alloy, this construction became the standard one-dimensional model of a quasicrystal — a mathematical object carried into materials science.",
    sharedFacets: f("discreteness"),
    counterpoint:
      "The chain is a model, not a specimen. Real quasicrystals are three-dimensional, defective, and their long-range order remains harder to establish than the idealised substitution suggests.",
    sources: ["src.senechal-1995", "src.shechtman-1984"],
  }),
  relation({
    id: "rel.fourier-entropy",
    pair: ["matter.entropy", "measure.fourier-series"],
    title: "The Equation That Only Runs Forwards",
    relationType: "structural-correspondence",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", passage: "partial", echo: "unsupported" },
    insight:
      "The heat equation Fourier solved in 1822 damps each component at a rate growing with the square of its frequency, so fine structure vanishes first and the temperature profile smooths. The decomposition is perfectly reversible; the evolution it describes is not. Run it backwards and the high components explode, which is why the problem is called ill-posed.",
    sharedFacets: f("decomposition"),
    counterpoint:
      "The irreversibility belongs to the diffusion equation, not to Fourier analysis. The same series applied to the wave equation runs backwards without difficulty.",
    sources: ["src.fourier-1822", "src.clausius-1865"],
  }),

  // ── Measure ↔ Image ──────────────────────────────────────────────────────
  relation({
    id: "rel.fibonacci-girih",
    pair: ["image.girih-tiling", "measure.fibonacci-sequence"],
    title: "Extreme and Mean Ratio in the Rosette",
    relationType: "structural-correspondence",
    evidence: "established",
    fit: { echo: "primary", ground: "supported", passage: "partial", tension: "unsupported" },
    insight:
      "Girih strapwork is built from decagons and pentagons, and in a regular pentagon the diagonal stands to the side in exactly the ratio Euclid calls extreme and mean — the same number the ratios of consecutive Fibonacci terms approach. The proportion is therefore present in the geometry by construction, before anyone counts anything.",
    sharedFacets: f("recursion", "proportion"),
    counterpoint:
      "Presence is not intention. The Topkapı scroll records these patterns as compass-and-straightedge templates, and no surviving treatise shows a craftsman reasoning from a number sequence.",
    sources: ["src.euclid-elements", "src.necipoglu-1995", "src.singh-1985"],
  }),
  relation({
    id: "rel.fourier-divisionism",
    pair: ["image.divisionism", "measure.fourier-series"],
    title: "Two Decompositions, One Exact",
    relationType: "opposition",
    evidence: "established",
    fit: { tension: "primary", echo: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "Fourier's components are independent and their sum returns the original without loss. Seurat's separated pigments do not: the recombination happens in the eye, not on the canvas, and Alan Lee's “Seurat and Science” (1987) showed the colour theory the technique relied on was substantially mistaken. One decomposition is invertible; the other only looks like one.",
    sharedFacets: f("decomposition"),
    counterpoint:
      "The paintings work regardless, which is the awkward part. Whatever divisionism achieves optically, its success cannot be used as evidence for the theory that produced it.",
    sources: ["src.lee-1987", "src.helmholtz-1867"],
  }),
  relation({
    id: "rel.cantor-anamorphosis",
    pair: ["image.anamorphosis", "measure.cantor-diagonal"],
    title: "One Deformation Undoes, One Does Not",
    relationType: "opposition",
    evidence: "interpretive",
    fit: { tension: "primary", echo: "partial", ground: "partial", passage: "unsupported" },
    insight:
      "An anamorphic stretch is a projective map: lines stay lines, cross-ratio is preserved, and Niceron's 1638 treatise gives the ruler-and-compass recipe for undoing it. Nothing is lost — the skull is the same information in other coordinates. Cantor's diagonal is not a change of coordinates, and no relisting recovers the number it produces.",
    sharedFacets: f("threshold"),
    counterpoint:
      "The pairing turns on the word “deformation” doing two jobs. Set-theoretic diagonalisation and projective distortion belong to different branches, and the contrast is the Game's construction rather than a shared history.",
    sources: ["src.niceron-1638"],
  }),
  relation({
    id: "rel.mobius-chiaroscuro",
    pair: ["image.chiaroscuro", "measure.mobius-band"],
    title: "A Surface With No Side to Light",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "Shading a form assumes a consistent outward normal: Lambert's Photometria (1760) makes brightness the cosine of the angle between that normal and the light. A Möbius band admits no consistent normal, so the rule that separates lit from unlit cannot be applied to it globally. The band is a surface chiaroscuro cannot describe.",
    sharedFacets: f("continuity"),
    counterpoint:
      "Painters shade objects, not manifolds, and the difficulty is invisible on any patch small enough to paint. Locally the band shades perfectly well; only the tour around it fails.",
    sources: ["src.lambert-1760"],
  }),

  // ── Sound ↔ Matter ───────────────────────────────────────────────────────
  relation({
    id: "rel.overtones-standing-wave",
    pair: ["matter.standing-wave", "sound.overtone-series"],
    title: "The Partials Are the Modes",
    relationType: "material-ground",
    evidence: "established",
    fit: { ground: "primary", echo: "supported", passage: "partial", tension: "unsupported" },
    insight:
      "The partials of a string are not an analogy for its standing waves — they are the same physical fact heard rather than seen. Each mode has a fixed number of nodes and a frequency at a whole-number multiple of the fundamental, and Helmholtz (1863) showed the relative strengths of those modes are most of what the ear registers as timbre.",
    sharedFacets: f("superposition"),
    counterpoint:
      "The identity is exact only for an ideal one-dimensional string. Stiffness, end conditions and the body of the instrument all shift the modes away from whole-number multiples.",
    sources: ["src.helmholtz-1863", "src.chladni-1787"],
  }),
  relation({
    id: "rel.equal-temperament-standing-wave",
    pair: ["matter.standing-wave", "sound.equal-temperament"],
    title: "Cut by Nature, Cut by Decision",
    relationType: "opposition",
    evidence: "interpretive",
    fit: { tension: "primary", echo: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "A bounded string permits only the wavelengths that fit its ends; the quantisation is imposed by a boundary condition and cannot be negotiated. Equal temperament also cuts a continuum into fixed portions, but the twelve steps are a decision, and Barbour's survey (1951) records the many other divisions that were tried and abandoned.",
    sharedFacets: f("quantisation"),
    counterpoint:
      "Calling both “quantisation” risks flattening the difference the pair exists to expose: one set of steps is discovered, the other is agreed. The word is shared; the authority behind it is not.",
    sources: ["src.barbour-1951", "src.chladni-1787"],
  }),
  relation({
    id: "rel.polyrhythm-pendulums",
    pair: ["matter.coupled-pendulums", "sound.polyrhythm"],
    title: "What Coupling Would Undo",
    relationType: "opposition",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "Huygens noticed in 1665 that two clocks on a shared beam settle into antiphase and stay there; Bennett and colleagues reproduced the effect in 2002 and located the coupling in momentum passed through the support. A polyrhythm depends on the opposite outcome — the cycles must not lock — which is why holding one against another is work rather than drift.",
    sharedFacets: f("periodicity", "interference"),
    counterpoint:
      "Entrainment between players is not the same mechanism as between clocks: it runs through hearing and intention, and can be resisted deliberately in a way a pendulum cannot.",
    sources: ["src.bennett-2002"],
  }),
  relation({
    id: "rel.overtones-diffraction",
    pair: ["matter.diffraction", "sound.overtone-series"],
    title: "The Grating and the Ear",
    relationType: "structural-correspondence",
    evidence: "established",
    fit: { echo: "primary", ground: "supported", passage: "partial", tension: "unsupported" },
    insight:
      "A diffraction grating sends each wavelength to its own angle, so a mixed beam arrives at the screen already separated into components. The ear does something formally similar with a mixed sound, resolving it into partials. Both are physical analysers: the separation happens in the apparatus, before any interpretation.",
    sharedFacets: f("superposition"),
    counterpoint:
      "The grating separates by geometry and the cochlea by mechanical resonance along a tapered membrane. Their resolving power and their failure modes are quite different, and neither explains the other.",
    sources: ["src.born-wolf-1959", "src.helmholtz-1863"],
  }),
  relation({
    id: "rel.polyrhythm-diffraction",
    pair: ["matter.diffraction", "sound.polyrhythm"],
    title: "Fringes in Space, Fringes in Time",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { echo: "primary", ground: "supported", tension: "partial", passage: "unsupported" },
    insight:
      "Two slits write their agreement and disagreement across a screen as bright and dark bands, spaced by the ratio of wavelength to slit separation. Three beats against two write the same arithmetic across a bar: coincidence, near-miss, opposition, coincidence again. The pattern in both cases is the beat between two periods.",
    sharedFacets: f("interference"),
    counterpoint:
      "Light amplitudes add and can cancel to nothing. Drum strokes do not cancel; a polyrhythm's “dark fringe” is a moment when nothing coincides, which is not the same as a moment when nothing sounds.",
    sources: ["src.born-wolf-1959"],
  }),
  relation({
    id: "rel.counterpoint-standing-wave",
    pair: ["matter.standing-wave", "sound.counterpoint"],
    title: "What Superposition Does Not Explain",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { echo: "primary", tension: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "Two travelling waves occupy one string and simply add, and the sum holds still. Two voices occupy one texture and each keeps its line, but what they make together is not a sum: Fux's rules govern which vertical intervals may occur, so the combination is constrained from outside rather than computed from the parts.",
    sharedFacets: f("superposition"),
    counterpoint:
      "Acoustically the two lines do add — the pressure waves superpose exactly. It is the musical result, not the physics, that fails to be a sum, and confusing the two levels is the standard error here.",
    sources: ["src.helmholtz-1863", "src.fux-1725"],
  }),

  // ── Sound ↔ Image ────────────────────────────────────────────────────────
  relation({
    id: "rel.just-intonation-perspective",
    pair: ["image.linear-perspective", "sound.just-intonation"],
    title: "Exact From One Place Only",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { echo: "primary", ground: "supported", tension: "supported", passage: "unsupported" },
    insight:
      "Alberti's construction (1435) is geometrically exact for a single eye position and degrades continuously as the viewer steps aside. Just intonation is exact for a single tonic and degrades as the music travels from it. Both buy precision by fixing a reference, and both pay for it in the same currency: movement.",
    sharedFacets: f("proportion"),
    counterpoint:
      "Perspective's error is a visible distortion the eye largely forgives; just intonation's is audible beating that does not go away. The parallel is structural and the perceptual consequences are not comparable.",
    sources: ["src.alberti-1435", "src.barbour-1951"],
  }),
  relation({
    id: "rel.equal-temperament-perspective",
    pair: ["image.linear-perspective", "sound.equal-temperament"],
    title: "One Right Place, or No Right Place",
    relationType: "opposition",
    evidence: "interpretive",
    fit: { tension: "primary", echo: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "Alberti's construction is exactly right from a single station point and accepts being wrong from every other; equal temperament refuses to have a right key and is slightly wrong in all of them. Both meet the same difficulty — a proportional system cannot be exact everywhere at once — and answer it in opposite directions.",
    sharedFacets: f("proportion"),
    counterpoint:
      "Painters broke the construction wherever it looked wrong and tuners rarely tempered exactly. Treating either as a system strictly obeyed is a convenience of hindsight.",
    sources: ["src.alberti-1435", "src.barbour-1951"],
  }),
  relation({
    id: "rel.overtones-divisionism",
    pair: ["image.divisionism", "sound.overtone-series"],
    title: "The Ear Resolves, the Eye Does Not",
    relationType: "opposition",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "Helmholtz established two facts that pull against each other. The ear analyses a mixed sound into partials, so a chord can be heard as several pitches at once; the eye has three receptor types, so a mixture of wavelengths collapses to one sensation and cannot be taken apart again. Divisionism therefore cannot work the way a chord works.",
    sharedFacets: f("decomposition"),
    counterpoint:
      "Divisionism does not depend on the eye resolving the dots — it depends on the dots staying just below resolution. Read that way the technique is consistent with trichromacy rather than refuted by it.",
    sources: ["src.helmholtz-1863", "src.helmholtz-1867", "src.lee-1987"],
  }),
  relation({
    id: "rel.isorhythm-girih",
    pair: ["image.girih-tiling", "sound.isorhythm"],
    title: "Small Vocabulary, Large Surface",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { echo: "primary", ground: "partial", tension: "partial", passage: "unsupported" },
    insight:
      "Girih covers an enormous wall from five decorated polygons; an ars nova motet covers a whole movement from one talea and one color. In both, the elements are few and fixed and the interest lies in how their restatements fall out of step, so that the eye or ear meets a familiar unit in an unfamiliar position.",
    sharedFacets: f("recursion"),
    counterpoint:
      "Cromwell warns specifically against reading structural sophistication into ornament from a modern vantage. The two traditions had no contact, and the resemblance is a resemblance.",
    sources: ["src.necipoglu-1995", "src.cromwell-2009"],
  }),

  // ── Matter ↔ Image ───────────────────────────────────────────────────────
  relation({
    id: "rel.crystal-lattice-divisionism",
    pair: ["image.divisionism", "matter.crystal-lattice"],
    title: "Discrete Units, Regular and Not",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { echo: "primary", tension: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "Both cover a surface with countable units and let the whole appear only from their arrangement. The crystal's units are identical and sit on positions that repeat by translation; Seurat's touches vary in size, hue and spacing and sit on no grid at all. The Game offers this as a reading of two ways to fill a plane, and claims nothing further.",
    sharedFacets: f("discreteness"),
    counterpoint:
      "The difference is what carries the pictures. A mechanically regular field of dots reads as printing rather than painting, so divisionism depends on the irregularity the analogy tends to erase.",
    sources: ["src.lee-1987", "src.senechal-1995"],
  }),
  relation({
    id: "rel.girih-crystal-lattice",
    pair: ["image.girih-tiling", "matter.crystal-lattice"],
    title: "Five-Fold Order on a Wall",
    relationType: "structural-correspondence",
    evidence: "contested",
    fit: { echo: "primary", ground: "supported", tension: "partial", passage: "partial" },
    insight:
      "Lu and Steinhardt argued in Science (2007) that by the fifteenth century girih patterns — the Darb-i Imam shrine at Isfahan, 1453 — were being built by subdividing decorated polygons, a rule that generates a nearly perfect quasi-crystalline tiling with the five-fold symmetry a lattice forbids. Emil Makovicky's published comment holds that the pattern is periodic and that the artisans sought a large repeating domain rather than quasiperiodicity.",
    sharedFacets: f("tiling"),
    counterpoint:
      "Cromwell has since shown how easily near-misses are discounted when a quasiperiodic model is expected. Specialists disagree, and the Game does not settle it.",
    sources: [
      "src.lu-steinhardt-2007",
      "src.makovicky-2007",
      "src.cromwell-2009",
      "src.shechtman-1984",
    ],
  }),
  relation({
    id: "rel.diffraction-camera-obscura",
    pair: ["image.camera-obscura", "matter.diffraction"],
    title: "The Limit on a Pinhole",
    relationType: "material-ground",
    evidence: "established",
    fit: { ground: "primary", tension: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "Shrinking the hole sharpens the projected image, until it does not: below a certain diameter diffraction spreads each point faster than geometry tightens it. Rayleigh's 1891 paper on pinhole photography gave the optimum as roughly 1.9 times the square root of wavelength times distance — a hard limit on how good a lensless image can be.",
    sharedFacets: f("threshold"),
    counterpoint:
      "The limit is real but generous. At the room-sized geometries the historical camera obscura used, the optimum aperture is around a millimetre, so most surviving complaints about softness are about light level rather than diffraction.",
    sources: ["src.rayleigh-1891", "src.born-wolf-1959"],
  }),
  relation({
    id: "rel.diffraction-chiaroscuro",
    pair: ["image.chiaroscuro", "matter.diffraction"],
    title: "Why a Shadow's Edge Is Soft",
    relationType: "opposition",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "The gradient a painter models at the edge of a shadow is almost entirely geometric: a light source of finite size casts a penumbra whose width scales with the source. Diffraction also softens edges, but at visible wavelengths its contribution over studio distances is a fraction of a millimetre. The two are routinely conflated and are not the same effect.",
    sharedFacets: f("threshold"),
    counterpoint:
      "Diffraction is not absent, merely small; at a knife edge in coherent light it is the whole story. The claim is about scale, not about which physics applies.",
    sources: ["src.born-wolf-1959", "src.lambert-1760"],
  }),

  // ── Within Measure ───────────────────────────────────────────────────────
  relation({
    id: "rel.mobius-cantor",
    pair: ["measure.cantor-diagonal", "measure.mobius-band"],
    title: "Structures That Turn on Themselves",
    relationType: "structural-correspondence",
    evidence: "attested",
    fit: { echo: "primary", tension: "supported", ground: "partial", passage: "unsupported" },
    insight:
      "Cantor's 1891 construction runs down the diagonal of a list and changes each entry, producing something the list cannot contain. The Möbius band runs once around itself and returns mirrored, so it cannot contain a consistent handedness. Both are arguments in which travelling through a structure exhaustively is what breaks it.",
    sharedFacets: f("self-reference"),
    counterpoint:
      "One is a proof and the other is an object. The diagonal establishes an impossibility; the band merely exhibits a property, and no theorem follows from walking around it.",
    sources: ["src.cantor-1891", "src.hilbert-cohn-vossen-1932"],
  }),
  relation({
    id: "rel.mobius-symmetry",
    pair: ["measure.continuous-symmetry", "measure.mobius-band"],
    title: "Local Agreement, Global Disagreement",
    relationType: "structural-correspondence",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "On any small patch of a Möbius band an orientation can be chosen consistently, and continuous rotation moves it smoothly. Carry that choice all the way around and it comes back reversed. The obstruction is invisible locally and unavoidable globally, which is the standard demonstration that some structure lives only in the whole.",
    sharedFacets: f("continuity"),
    counterpoint:
      "Continuity is doing different work on each side. A continuous group is a space of transformations; the band is a space being transformed, and the shared word conceals that difference.",
    sources: ["src.hilbert-cohn-vossen-1932"],
  }),

  // ── Within Sound ─────────────────────────────────────────────────────────
  relation({
    id: "rel.just-intonation-equal-temperament",
    pair: ["sound.equal-temperament", "sound.just-intonation"],
    title: "Locked in One Key, or Free in All",
    relationType: "opposition",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", passage: "supported", echo: "unsupported" },
    insight:
      "A just major third at 5:4 has coinciding partials and no beating; the tempered third is about fourteen cents wide and beats audibly. Equal temperament pays that price to make every key alike, and the trade is not resolvable — Barbour's survey (1951) is largely a catalogue of attempts to have both, none of which succeeded.",
    sharedFacets: f("proportion"),
    counterpoint:
      "The opposition is sharpest on sustained keyboard harmony. Singers and string players adjust continuously, so in much practice the two systems are less rivals than reference points.",
    sources: ["src.barbour-1951", "src.helmholtz-1863"],
  }),
  relation({
    id: "rel.just-intonation-overtones",
    pair: ["sound.just-intonation", "sound.overtone-series"],
    title: "Where the Simple Ratios Come From",
    relationType: "material-ground",
    evidence: "established",
    fit: { ground: "primary", echo: "supported", passage: "partial", tension: "partial" },
    insight:
      "The just intervals are the low partials read as ratios: the fifth is partials two and three, the major third partials four and five. Helmholtz (1863) explained why they sound settled — when the ratio is simple the partials coincide instead of beating, so consonance is a fact about spectra rather than a matter of taste.",
    sharedFacets: f("proportion"),
    counterpoint:
      "The explanation depends on harmonic partials. On instruments whose spectra are inharmonic — gongs, many gamelan metallophones — the settled intervals are elsewhere, and the tunings that grew around them are not just intonation.",
    sources: ["src.helmholtz-1863"],
  }),
  relation({
    id: "rel.polyrhythm-isorhythm",
    pair: ["sound.isorhythm", "sound.polyrhythm"],
    title: "Non-Coincidence, Felt and Written",
    relationType: "structural-correspondence",
    evidence: "established",
    fit: { echo: "primary", ground: "supported", tension: "partial", passage: "unsupported" },
    insight:
      "Both keep two spans of unequal length running so that they meet rarely. A polyrhythm holds them in the body, at a rate a player can feel; an isorhythmic motet writes them across minutes, at a rate no listener can count. Same arithmetic, opposite time-scales, and therefore opposite demands on attention.",
    sharedFacets: f("periodicity", "incommensurability"),
    counterpoint:
      "Whether a fourteenth-century listener perceived the talea at all is unsettled, which makes the parallel with felt polyrhythm partly a claim about hearing that the sources cannot support.",
    sources: ["src.bent-2008"],
  }),

  // ── Within Matter ────────────────────────────────────────────────────────
  relation({
    id: "rel.conservation-entropy",
    pair: ["matter.conservation-of-energy", "matter.entropy"],
    title: "The Total Holds, the Direction Does Not",
    relationType: "structural-correspondence",
    evidence: "established",
    fit: { tension: "primary", ground: "supported", echo: "partial", passage: "unsupported" },
    insight:
      "Clausius stated both laws together in 1865: the energy of the universe is constant, its entropy tends to a maximum. The first says nothing changes in total, the second says everything changes in one direction, and they are not in conflict — energy is conserved while becoming progressively less able to do work.",
    sharedFacets: f("irreversibility"),
    counterpoint:
      "Conservation is exact and entropy increase is statistical. A fluctuation reducing entropy is allowed and vanishingly improbable, so the two laws do not have the same standing.",
    sources: ["src.clausius-1865"],
  }),
  relation({
    id: "rel.standing-wave-pendulums",
    pair: ["matter.coupled-pendulums", "matter.standing-wave"],
    title: "Normal Modes",
    relationType: "formal-ground",
    evidence: "established",
    fit: { ground: "primary", echo: "supported", passage: "partial", tension: "unsupported" },
    insight:
      "Two coupled pendulums have exactly two normal modes — swinging together and swinging opposite — at different frequencies, and any motion is a superposition of them, which is why the energy appears to slosh between the bobs. A string is the same construction with many more degrees of freedom, and its modes are the standing waves.",
    sharedFacets: f("interference"),
    counterpoint:
      "Modes only stay independent while the system is linear and lightly damped. In Huygens's clocks the escapements pump energy in, and the pair settles into one mode instead of preserving both.",
    sources: ["src.bennett-2002", "src.chladni-1787"],
  }),

  // ── Within Image ─────────────────────────────────────────────────────────
  relation({
    id: "rel.perspective-anamorphosis",
    pair: ["image.anamorphosis", "image.linear-perspective"],
    title: "The Construction Turned Against Itself",
    relationType: "historical-transmission",
    evidence: "attested",
    direction: ["image.linear-perspective", "image.anamorphosis"],
    fit: { tension: "primary", ground: "supported", passage: "supported", echo: "partial" },
    insight:
      "Niceron's La Perspective curieuse (Paris, 1638) derives anamorphosis directly from the perspective construction: the same projection, taken from an extreme station point or onto a curved surface. Holbein's skull of 1533 precedes the treatise, but the technique is the costruzione legittima applied where it was not meant to be used, and the treatise says so.",
    sharedFacets: f("projection", "viewpoint"),
    counterpoint:
      "The transmission runs from method to method, not from Alberti to Holbein. What painters knew in 1533 and how they learned it is not settled by a treatise published a century later.",
    sources: ["src.niceron-1638", "src.alberti-1435", "src.baltrusaitis-1977"],
  }),
  relation({
    id: "rel.camera-obscura-perspective",
    pair: ["image.camera-obscura", "image.linear-perspective"],
    title: "Did the Instrument Do the Drawing?",
    relationType: "structural-correspondence",
    evidence: "contested",
    fit: { passage: "primary", ground: "supported", tension: "supported", echo: "partial" },
    insight:
      "The camera obscura performs the same projection Alberti describes, and Ibn al-Haytham had documented it around 1020. Hockney and Falco argued from 2000 that European painters used such projections far earlier and more widely than the record admits; David Stork replied that the pictures lack the distortions real mirrors and lenses would impose.",
    sharedFacets: f("projection", "viewpoint"),
    counterpoint:
      "The argument is unsettled and the cases differ. Steadman's reconstruction of Vermeer's room is far better evidenced than the general claim, and accepting one does not commit you to the other.",
    sources: [
      "src.hockney-2001",
      "src.hockney-falco-2000",
      "src.stork-2004",
      "src.steadman-2001",
      "src.ibn-al-haytham-optics",
    ],
  }),
  relation({
    id: "rel.chiaroscuro-camera-obscura",
    pair: ["image.camera-obscura", "image.chiaroscuro"],
    title: "A Dark Room and a Single Light",
    relationType: "structural-correspondence",
    evidence: "interpretive",
    fit: { ground: "primary", echo: "supported", tension: "partial", passage: "partial" },
    insight:
      "A camera obscura works only when the room is dark and one aperture admits light, and the image it throws is dim, low in detail in the shadows, and strongest where contrast is greatest. That is the lighting condition chiaroscuro depicts — a single source in a dark interior — described from the inside of the box rather than the outside.",
    sharedFacets: f("threshold", "viewpoint"),
    counterpoint:
      "That painters worked from such projections is a separate and disputed claim. The Game asserts only that the two describe the same optical situation, not that either caused the other.",
    sources: ["src.steadman-2001", "src.lambert-1760"],
  }),
]);

export const relationById = new Map(CASTALIA_RELATIONS.map((r) => [r.id, r]));
