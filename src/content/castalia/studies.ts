import { toConceptId, type ConceptId } from "@/domain/ids";
import { studyIdFor } from "@/domain/studies/goal";
import {
  toFacetId,
  type FacultyId,
  type StudyAnswer,
  type StudyChapter,
  type StudyDefinition,
  type StudyGoal,
} from "./schema";

/**
 * THE STUDIES OF CASTALIA
 *
 * Twelve authored problems in three chapters, each posed over eight beads and
 * solved with the Free Game's own verbs (STUDIES-SPEC). The goals and the
 * Magister's answers are fixed by the Studies spike (M9-001); the bead sets are
 * authored here, and every one is proved at build by the solver: the
 * Magister's line is an answer of the brief's exact count, no shorter answer
 * exists, a passage has at most four answers, and a silence has none — a
 * passage silence keeps a way one thread longer, so the count can be learned.
 *
 * A set is fair when it can be read. Every bead shares a facet with another,
 * so none is inert, and every set holds near misses: beads that touch one end
 * of a passage and not the other, canons of a different facet through as many
 * faculties, threads that cross into the brief's faculty carrying something
 * else. A silence Study holds the beads its brief names — the facet and the
 * faculty — so it can only be declared by looking, never guessed from the set.
 *
 * Nothing here may name a relation, an evidence class or an Open Thread (R1):
 * a Study is decided by beads, facets and faculties alone.
 */

const beads = (...ids: string[]): readonly ConceptId[] =>
  Object.freeze(ids.map(toConceptId));

/** The Magister's line, written bead to bead in the order it is read. */
const line = (...ids: string[]): StudyAnswer => {
  const conceptIds = ids.map(toConceptId);
  return Object.freeze({
    kind: "threads" as const,
    pairs: Object.freeze(
      conceptIds
        .slice(1)
        .map((to, index) => Object.freeze([conceptIds[index] as ConceptId, to] as const))
    ),
  });
};

const SILENCE: StudyAnswer = Object.freeze({ kind: "silence" as const });

const passage = (from: string, to: string, threads: number): StudyGoal =>
  Object.freeze({
    kind: "passage" as const,
    from: toConceptId(from),
    to: toConceptId(to),
    threads,
  });

const canon = (facet: string, faculties: number): StudyGoal =>
  Object.freeze({ kind: "canon" as const, facet: toFacetId(facet), faculties });

const carry = (facet: string, into: FacultyId): StudyGoal =>
  Object.freeze({ kind: "carry" as const, facet: toFacetId(facet), into });

const study = (
  chapter: StudyChapter,
  ordinal: number,
  conceptIds: readonly ConceptId[],
  goal: StudyGoal,
  answer: StudyAnswer
): StudyDefinition =>
  Object.freeze({ id: studyIdFor(chapter, ordinal), chapter, ordinal, conceptIds, goal, answer });

export const CASTALIA_STUDIES: readonly StudyDefinition[] = Object.freeze([
  // ── Eschholz ────────────────────────────────────────────────────────────
  /*
   * From The Möbius Band to Counterpoint in two threads. Only Continuous
   * Symmetry meets both ends. The Möbius Band's other neighbours, Cantor's
   * Diagonal Argument and Chiaroscuro, never reach Counterpoint; Fibonacci
   * Sequence, Just Intonation and Conservation of Energy all reach Counterpoint
   * and never the Möbius Band. The only two-thread way in the pack.
   */
  study(
    "eschholz",
    1,
    beads(
      "measure.fibonacci-sequence",
      "measure.continuous-symmetry",
      "measure.mobius-band",
      "measure.cantor-diagonal",
      "sound.counterpoint",
      "sound.just-intonation",
      "matter.conservation-of-energy",
      "image.chiaroscuro"
    ),
    passage("measure.mobius-band", "sound.counterpoint", 2),
    line("measure.mobius-band", "measure.continuous-symmetry", "sound.counterpoint")
  ),
  /*
   * Carry Superposition through three faculties. One bead carries it in each of
   * Measure, Sound and Matter. Return, Decomposition and Discreteness also run
   * through three faculties here, so a canon of the wrong facet is easy to
   * weave and the brief has to be read.
   */
  study(
    "eschholz",
    2,
    beads(
      "measure.prime-numbers",
      "measure.fourier-series",
      "sound.counterpoint",
      "sound.isorhythm",
      "matter.standing-wave",
      "matter.entropy",
      "matter.crystal-lattice",
      "image.divisionism"
    ),
    canon("superposition", 3),
    line("measure.fourier-series", "sound.counterpoint", "matter.standing-wave")
  ),
  /*
   * Carry Threshold into Matter. Three beads carry Threshold and only
   * Diffraction is Matter. Cantor's Diagonal Argument to Anamorphosis carries
   * Threshold and stays out of Matter; The Fourier Series, The Standing Wave
   * and Coupled Pendulums reach Diffraction by other facets.
   */
  study(
    "eschholz",
    3,
    beads(
      "measure.fourier-series",
      "measure.cantor-diagonal",
      "sound.equal-temperament",
      "matter.standing-wave",
      "matter.coupled-pendulums",
      "matter.diffraction",
      "image.anamorphosis",
      "image.divisionism"
    ),
    carry("threshold", "matter"),
    line("measure.cantor-diagonal", "matter.diffraction")
  ),
  /*
   * Carry Proportion into Matter — silence. Proportion is carried in Measure,
   * Sound and Image, and six threads run from those beads into Matter, each
   * carrying something else: Discreteness, Quantisation, Superposition,
   * Decomposition, Tiling. No Matter bead carries Proportion, here or anywhere
   * in the pack.
   */
  study(
    "eschholz",
    4,
    beads(
      "measure.fibonacci-sequence",
      "measure.cantor-diagonal",
      "sound.equal-temperament",
      "sound.overtone-series",
      "matter.standing-wave",
      "matter.entropy",
      "matter.crystal-lattice",
      "image.girih-tiling"
    ),
    carry("proportion", "matter"),
    SILENCE
  ),

  // ── Waldzell ────────────────────────────────────────────────────────────
  /*
   * From The Möbius Band to Polyrhythm in three threads: one way here, of the
   * four in the pack. The Möbius Band can also leave by Chiaroscuro, and
   * Polyrhythm is also met by The Fourier Series and The Standing Wave, but
   * those threads only make ways of four.
   */
  study(
    "waldzell",
    1,
    beads(
      "measure.prime-numbers",
      "measure.fourier-series",
      "measure.mobius-band",
      "measure.cantor-diagonal",
      "sound.polyrhythm",
      "matter.standing-wave",
      "image.chiaroscuro",
      "image.camera-obscura"
    ),
    passage("measure.mobius-band", "sound.polyrhythm", 3),
    line(
      "measure.mobius-band",
      "measure.cantor-diagonal",
      "measure.prime-numbers",
      "sound.polyrhythm"
    )
  ),
  /*
   * Carry Decomposition through all four faculties. Each faculty holds one bead
   * that carries it and one that does not. Discreteness and Invariance run
   * through three faculties here as well; only Decomposition reaches four.
   */
  study(
    "waldzell",
    2,
    beads(
      "measure.prime-numbers",
      "measure.continuous-symmetry",
      "sound.just-intonation",
      "sound.overtone-series",
      "matter.conservation-of-energy",
      "matter.crystal-lattice",
      "image.girih-tiling",
      "image.divisionism"
    ),
    canon("decomposition", 4),
    line(
      "measure.prime-numbers",
      "sound.overtone-series",
      "matter.conservation-of-energy",
      "image.divisionism"
    )
  ),
  /*
   * From Just Intonation to Polyrhythm in two threads — silence. Just
   * Intonation meets Fibonacci Sequence, Counterpoint and Girih Tiling;
   * Polyrhythm meets Coupled Pendulums, Diffraction and The Crystal Lattice; no
   * bead meets both, here or in the pack. Three ways of three threads remain,
   * so the longer way can be found and the count understood.
   */
  study(
    "waldzell",
    3,
    beads(
      "measure.fibonacci-sequence",
      "sound.counterpoint",
      "sound.polyrhythm",
      "sound.just-intonation",
      "matter.coupled-pendulums",
      "matter.diffraction",
      "matter.crystal-lattice",
      "image.girih-tiling"
    ),
    passage("sound.just-intonation", "sound.polyrhythm", 2),
    SILENCE
  ),
  /*
   * From Girih Tiling to Polyrhythm in two threads. Girih Tiling meets three
   * beads here by Proportion and none of them reaches Polyrhythm; the one way
   * of two goes by Recursion, through Isorhythm. The pack's other way, through
   * The Crystal Lattice, is not in the set.
   */
  study(
    "waldzell",
    4,
    beads(
      "measure.fourier-series",
      "sound.polyrhythm",
      "sound.isorhythm",
      "sound.just-intonation",
      "sound.overtone-series",
      "matter.standing-wave",
      "image.linear-perspective",
      "image.girih-tiling"
    ),
    passage("image.girih-tiling", "sound.polyrhythm", 2),
    line("image.girih-tiling", "sound.isorhythm", "sound.polyrhythm")
  ),

  // ── Vicus Lusorum ───────────────────────────────────────────────────────
  /*
   * From Coupled Pendulums to The Möbius Band in three threads: one way of
   * three and three ways of four. Counterpoint and The Camera Obscura sit
   * between the two ends and make every other way one thread too long.
   */
  study(
    "vicus-lusorum",
    1,
    beads(
      "measure.continuous-symmetry",
      "measure.mobius-band",
      "measure.cantor-diagonal",
      "sound.counterpoint",
      "sound.isorhythm",
      "matter.coupled-pendulums",
      "matter.diffraction",
      "image.camera-obscura"
    ),
    passage("matter.coupled-pendulums", "measure.mobius-band", 3),
    line(
      "matter.coupled-pendulums",
      "matter.diffraction",
      "measure.cantor-diagonal",
      "measure.mobius-band"
    )
  ),
  /*
   * Carry Return through three faculties. Only The Fourier Series, Polyrhythm
   * and Coupled Pendulums carry it. Decomposition and Superposition also run
   * through Measure, Sound and Matter here, and Interference joins Polyrhythm
   * to two Matter beads: near canons to tell from the one the brief names.
   */
  study(
    "vicus-lusorum",
    2,
    beads(
      "measure.prime-numbers",
      "measure.fourier-series",
      "sound.polyrhythm",
      "sound.overtone-series",
      "matter.conservation-of-energy",
      "matter.coupled-pendulums",
      "matter.diffraction",
      "matter.entropy"
    ),
    canon("periodicity", 3),
    line("measure.fourier-series", "sound.polyrhythm", "matter.coupled-pendulums")
  ),
  /*
   * Carry No Common Measure into Image — silence. Prime Numbers and Isorhythm
   * carry it, and both reach Image: Prime Numbers to Divisionism by Discreteness
   * and Decomposition, Isorhythm to Girih Tiling by Recursion. No Image bead
   * carries No Common Measure, here or anywhere in the pack.
   */
  study(
    "vicus-lusorum",
    3,
    beads(
      "measure.fibonacci-sequence",
      "measure.prime-numbers",
      "measure.cantor-diagonal",
      "sound.isorhythm",
      "matter.diffraction",
      "image.chiaroscuro",
      "image.girih-tiling",
      "image.divisionism"
    ),
    carry("incommensurability", "image"),
    SILENCE
  ),
  /*
   * Carry Discreteness through all four faculties. Return, Decomposition and
   * Proportion each run through three faculties here; Discreteness is the only
   * facet that reaches the fourth, and every faculty holds a bead that does
   * not carry it.
   */
  study(
    "vicus-lusorum",
    4,
    beads(
      "measure.fibonacci-sequence",
      "measure.fourier-series",
      "sound.polyrhythm",
      "sound.equal-temperament",
      "matter.conservation-of-energy",
      "matter.crystal-lattice",
      "image.linear-perspective",
      "image.divisionism"
    ),
    canon("discreteness", 4),
    line(
      "measure.fibonacci-sequence",
      "sound.equal-temperament",
      "matter.crystal-lattice",
      "image.divisionism"
    )
  ),
]);
