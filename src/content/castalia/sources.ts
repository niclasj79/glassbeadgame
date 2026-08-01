import type { Source } from "./schema";

/**
 * THE SOURCE REGISTER
 *
 * Every entry here is a real, checkable publication: a specific book, article,
 * score, or primary text with an author, a title, and a year. Each one was
 * looked up during authoring; none was reconstructed from memory and none was
 * invented to make a relation look better dressed.
 *
 * The register exists so that the Game's non-`interpretive` claims can be
 * audited by a human. A relation graded `established`, `attested`, or
 * `contested` must name at least one entry here (see `validate.ts`), and the
 * citation is shown verbatim in the Codex so the player can go and check it.
 *
 * The corollary matters more than the rule: when no source could be verified,
 * the relation was authored as `interpretive` — which asserts nothing beyond
 * the two structures being compared — or it was not authored at all. Several
 * pairings that would have been attractive are absent for exactly that reason.
 *
 * `locator` says where in the work to actually look. It is deliberately coarse
 * where the authoring pass verified the work but not a page.
 */
const source = (value: Source): Source => Object.freeze(value);

export const CASTALIA_SOURCES: readonly Source[] = Object.freeze([
  // ── Bartók, proportion, and the argument about it ────────────────────────
  source({
    id: "src.lendvai-1971",
    citation:
      "Ernő Lendvai, Béla Bartók: An Analysis of His Music (London: Kahn & Averill, 1971)",
    kind: "book",
    locator: "chapters on the golden section and the Fibonacci series",
  }),
  source({
    id: "src.howat-1983",
    citation:
      "Roy Howat, “Bartók, Lendvai and the Principles of Proportional Analysis”, Music Analysis 2/1 (March 1983), 69–95",
    kind: "article",
  }),
  source({
    id: "src.somfai-1996",
    citation:
      "László Somfai, Béla Bartók: Composition, Concepts, and Autograph Sources (Berkeley: University of California Press, 1996)",
    kind: "book",
    locator: "the study of the surviving sketches and drafts",
  }),

  // ── Music: theory, temperament, technique ────────────────────────────────
  source({
    id: "src.messiaen-quatuor-1942",
    citation:
      "Olivier Messiaen, Quatuor pour la fin du Temps (Paris: Durand, 1942)",
    kind: "score",
    locator: "movement I, “Liturgie de cristal”; piano part",
  }),
  source({
    id: "src.pople-1998",
    citation:
      "Anthony Pople, Messiaen: Quatuor pour la fin du Temps, Cambridge Music Handbooks (Cambridge: Cambridge University Press, 1998)",
    kind: "book",
  }),
  source({
    id: "src.fux-1725",
    citation:
      "Johann Joseph Fux, Gradus ad Parnassum (Vienna, 1725); trans. Alfred Mann as The Study of Counterpoint (1943; New York: Norton, 1965)",
    kind: "primary",
  }),
  source({
    id: "src.bent-2008",
    citation:
      "Margaret Bent, “What is Isorhythm?”, in Quomodo cantabimus canticum? Studies in Honor of Edward H. Roesner (Middleton, WI: American Institute of Musicology, 2008), 121–143",
    kind: "article",
  }),
  source({
    id: "src.barbour-1951",
    citation:
      "J. Murray Barbour, Tuning and Temperament: A Historical Survey (East Lansing: Michigan State College Press, 1951)",
    kind: "book",
  }),
  source({
    id: "src.helmholtz-1863",
    citation:
      "Hermann von Helmholtz, Die Lehre von den Tonempfindungen als physiologische Grundlage für die Theorie der Musik (Braunschweig: Vieweg, 1863); trans. A. J. Ellis, On the Sensations of Tone (1875)",
    kind: "book",
  }),

  // ── Mathematics and formal structure ─────────────────────────────────────
  source({
    id: "src.euclid-elements",
    citation:
      "Euclid, Elements, c. 300 BCE; trans. T. L. Heath (Cambridge: Cambridge University Press, 1908)",
    kind: "primary",
    locator: "VII.30–32 and IX.20 (primes); VI def. 3 (extreme and mean ratio)",
  }),
  source({
    id: "src.fourier-1822",
    citation:
      "Joseph Fourier, Théorie analytique de la chaleur (Paris: Firmin Didot, 1822)",
    kind: "book",
  }),
  source({
    id: "src.cantor-1891",
    citation:
      "Georg Cantor, “Ueber eine elementare Frage der Mannigfaltigkeitslehre”, Jahresbericht der Deutschen Mathematiker-Vereinigung 1 (1891), 75–78",
    kind: "article",
  }),
  source({
    id: "src.noether-1918",
    citation:
      "Emmy Noether, “Invariante Variationsprobleme”, Nachrichten von der Gesellschaft der Wissenschaften zu Göttingen, Mathematisch-Physikalische Klasse (1918), 235–257",
    kind: "article",
  }),
  source({
    id: "src.hilbert-cohn-vossen-1932",
    citation:
      "David Hilbert and Stefan Cohn-Vossen, Anschauliche Geometrie (Berlin: Springer, 1932); trans. P. Neményi as Geometry and the Imagination (New York: Chelsea, 1952)",
    kind: "book",
    locator: "the chapter on one-sided surfaces",
  }),
  source({
    id: "src.senechal-1995",
    citation:
      "Marjorie Senechal, Quasicrystals and Geometry (Cambridge: Cambridge University Press, 1995)",
    kind: "book",
    locator: "“Order on the line”, on the Fibonacci chain; and the lattice restriction",
  }),
  source({
    id: "src.singh-1985",
    citation:
      "Parmanand Singh, “The So-called Fibonacci Numbers in Ancient and Medieval India”, Historia Mathematica 12 (1985), 229–244",
    kind: "article",
  }),

  // ── Physics and matter ───────────────────────────────────────────────────
  source({
    id: "src.chladni-1787",
    citation:
      "Ernst Florens Friedrich Chladni, Entdeckungen über die Theorie des Klanges (Leipzig: Breitkopf und Härtel, 1787)",
    kind: "book",
  }),
  source({
    id: "src.clausius-1865",
    citation:
      "Rudolf Clausius, “Ueber verschiedene für die Anwendung bequeme Formen der Hauptgleichungen der mechanischen Wärmetheorie”, Annalen der Physik und Chemie 201 (1865), 353–400",
    kind: "article",
    locator: "the section in which the term “entropy” is proposed",
  }),
  source({
    id: "src.bennett-2002",
    citation:
      "M. Bennett, M. F. Schatz, H. Rockwood and K. Wiesenfeld, “Huygens’s clocks”, Proceedings of the Royal Society of London A 458 (2002), 563–579",
    kind: "article",
  }),
  source({
    id: "src.shechtman-1984",
    citation:
      "D. Shechtman, I. Blech, D. Gratias and J. W. Cahn, “Metallic Phase with Long-Range Orientational Order and No Translational Symmetry”, Physical Review Letters 53 (1984), 1951–1953",
    kind: "article",
  }),
  source({
    id: "src.douady-couder-1992",
    citation:
      "S. Douady and Y. Couder, “Phyllotaxis as a Physical Self-Organized Growth Process”, Physical Review Letters 68 (1992), 2098–2101",
    kind: "article",
  }),
  source({
    id: "src.born-wolf-1959",
    citation:
      "Max Born and Emil Wolf, Principles of Optics (London: Pergamon Press, 1959)",
    kind: "book",
    locator: "the chapters on Fraunhofer diffraction and on diffraction gratings",
  }),
  source({
    id: "src.rayleigh-1891",
    citation:
      "Lord Rayleigh, “On Pin-hole Photography”, The London, Edinburgh, and Dublin Philosophical Magazine and Journal of Science 31/189 (1891), 87–99",
    kind: "article",
  }),

  // ── Image: optics, perspective, ornament, colour ─────────────────────────
  source({
    id: "src.ibn-al-haytham-optics",
    citation:
      "Ibn al-Haytham, Kitāb al-Manāẓir, c. 1011–1021; trans. A. I. Sabra, The Optics of Ibn al-Haytham, Books I–III: On Direct Vision, Studies of the Warburg Institute 40 (London: The Warburg Institute, 1989)",
    kind: "primary",
  }),
  source({
    id: "src.alberti-1435",
    citation:
      "Leon Battista Alberti, De pictura (1435); trans. Cecil Grayson as On Painting (London: Penguin, 1991)",
    kind: "primary",
    locator: "Book I, on the picture as an intersection of the visual pyramid",
  }),
  source({
    id: "src.niceron-1638",
    citation:
      "Jean-François Niceron, La Perspective curieuse, ou magie artificielle des effets merveilleux (Paris, 1638)",
    kind: "primary",
    locator: "Books II–III, on deformed perspective and mirror anamorphosis",
  }),
  source({
    id: "src.baltrusaitis-1977",
    citation:
      "Jurgis Baltrušaitis, Anamorphic Art, trans. W. J. Strachan (Cambridge: Chadwyck-Healey, 1977)",
    kind: "book",
    locator: "the chapter on Holbein’s The Ambassadors",
  }),
  source({
    id: "src.lambert-1760",
    citation:
      "Johann Heinrich Lambert, Photometria, sive de mensura et gradibus luminis, colorum et umbrae (Augsburg, 1760)",
    kind: "book",
  }),
  source({
    id: "src.necipoglu-1995",
    citation:
      "Gülru Necipoğlu, The Topkapı Scroll: Geometry and Ornament in Islamic Architecture (Santa Monica: Getty Center for the History of Art and the Humanities, 1995)",
    kind: "book",
  }),
  source({
    id: "src.lu-steinhardt-2007",
    citation:
      "Peter J. Lu and Paul J. Steinhardt, “Decagonal and Quasi-Crystalline Tilings in Medieval Islamic Architecture”, Science 315 (2007), 1106–1110",
    kind: "article",
  }),
  source({
    id: "src.makovicky-2007",
    citation:
      "Emil Makovicky, “Comment on ‘Decagonal and Quasi-Crystalline Tilings in Medieval Islamic Architecture’”, Science 318 (2007), 1383",
    kind: "article",
  }),
  source({
    id: "src.cromwell-2009",
    citation:
      "Peter R. Cromwell, “The Search for Quasi-Periodicity in Islamic 5-fold Ornament”, The Mathematical Intelligencer 31/1 (2009), 36–56",
    kind: "article",
  }),
  source({
    id: "src.hockney-2001",
    citation:
      "David Hockney, Secret Knowledge: Rediscovering the Lost Techniques of the Old Masters (2001)",
    kind: "book",
  }),
  source({
    id: "src.hockney-falco-2000",
    citation:
      "David Hockney and Charles M. Falco, “Optical Insights into Renaissance Art”, Optics & Photonics News 11 (July 2000)",
    kind: "article",
  }),
  source({
    id: "src.stork-2004",
    citation:
      "David G. Stork, “Optics and Realism in Renaissance Art”, Scientific American (December 2004)",
    kind: "article",
  }),
  source({
    id: "src.steadman-2001",
    citation:
      "Philip Steadman, Vermeer’s Camera: Uncovering the Truth Behind the Masterpieces (Oxford: Oxford University Press, 2001)",
    kind: "book",
  }),
  source({
    id: "src.lee-1987",
    citation: "Alan Lee, “Seurat and Science”, Art History 10/2 (June 1987), 203–226",
    kind: "article",
  }),
  source({
    id: "src.helmholtz-1867",
    citation:
      "Hermann von Helmholtz, Handbuch der physiologischen Optik (Leipzig: Voss, 1867)",
    kind: "book",
    locator: "the treatment of three-receptor colour vision",
  }),
]);

export const sourceById = new Map(CASTALIA_SOURCES.map((s) => [s.id, s]));
