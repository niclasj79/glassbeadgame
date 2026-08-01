import { castaliaConceptById } from "@/content/castalia/concepts";
import { facultyById } from "@/content/castalia/faculties";
import type {
  ConceptSigil,
  FacultyId,
  SigilFamily,
} from "@/content/castalia/schema";

/**
 * WHAT THE SCENE IS ALLOWED TO KNOW ABOUT A BEAD
 *
 * Every bead the arena draws comes from the Castalia pack, so every figure,
 * faculty, ink and collar on screen is authored. This module is the single
 * narrow, pure seam through which the scene reads them.
 *
 * It used to carry a second branch: a bead from the pre-Castalia pack got a
 * hash-derived placeholder figure and a faculty read off a discipline table.
 * That branch is gone with the pack it served, and with it the risk it managed
 * — nothing here can now put an unauthored figure on screen.
 *
 * What remains is the rule that made the branch safe in the first place, and it
 * is still worth stating because it governs the one case left. An id the pack
 * does not know is **not** given a figure, a faculty, or gold leaf. It resolves
 * to a neutral, unattributed bead: a plain graduated collar, the world's
 * engraving ink, and no claim of any kind. In ordinary play that case is
 * unreachable — the draw comes from the pack — but a function the scene calls
 * every frame must not throw on a stale id from a persisted session, so it
 * returns something honest instead.
 */
export interface BeadIdentity {
  readonly id: string;
  readonly name: string;
  /** True when the pack authored this bead's sigil and faculty. */
  readonly authored: boolean;
  /** `null` only when the pack does not know this bead. Never guessed. */
  readonly faculty: FacultyId | null;
  /**
   * The construction geometry cut into the bead's metal setting — the
   * faculty's, when there is one. This is the colour-independent carrier of
   * faculty identity (VERTICAL-SLICE-SPEC §19): `lattice`, `wave`, `orbit`,
   * `ray` are four visibly different collars before any hue is applied.
   */
  readonly setting: SigilFamily;
  /** The figure drawn inside the glass. */
  readonly sigil: ConceptSigil;
  /** Faculty ink, or the world's neutral engraving ink when unattributed. */
  readonly ink: string;
  /** Position of this bead's faculty around the armillary, in turns [0,1). */
  readonly bearing: number;
}

/** The collar of an unattributed bead: graduated, saying only "a bead". */
const UNATTRIBUTED_SETTING: SigilFamily = "arc";

/** Neutral ink for an unattributed bead; the world's engraving colour. */
export const NEUTRAL_INK = "#9fadd0";

/**
 * The figure drawn in a bead the pack does not know: a single sparse arc, no
 * rotational order, no gold leaf. It says "a bead" and nothing else, which is
 * the only true thing there is to say about it.
 */
const NEUTRAL_SIGIL: ConceptSigil = Object.freeze({
  family: UNATTRIBUTED_SETTING,
  symmetry: 1,
  density: 0.35,
  turbulence: 0,
  gilded: false,
});

export function resolveBeadIdentity(id: string): BeadIdentity {
  const concept = castaliaConceptById.get(id);
  if (!concept) {
    return {
      id,
      name: id,
      authored: false,
      faculty: null,
      setting: UNATTRIBUTED_SETTING,
      sigil: NEUTRAL_SIGIL,
      ink: NEUTRAL_INK,
      bearing: 0,
    };
  }
  const faculty = facultyById.get(concept.faculty);
  return {
    id,
    name: concept.name,
    authored: true,
    faculty: concept.faculty,
    setting: faculty?.geometry ?? UNATTRIBUTED_SETTING,
    sigil: concept.sigil,
    ink: faculty?.ink ?? NEUTRAL_INK,
    bearing: faculty?.bearing ?? 0,
  };
}

const cache = new Map<string, BeadIdentity>();

/** Memoised resolution — the scene asks for these every time a session opens. */
export function beadIdentity(id: string): BeadIdentity {
  const hit = cache.get(id);
  if (hit) return hit;
  const resolved = resolveBeadIdentity(id);
  cache.set(id, resolved);
  return resolved;
}

/**
 * Session order for the armillary: faculties become contiguous zones between
 * two parallels instead of a scatter. Ties break on id so the arrangement is
 * identical for a given draw on every machine.
 */
export function armillaryOrder(beadIds: readonly string[]): string[] {
  return [...beadIds].sort((a, b) => {
    const ia = beadIdentity(a);
    const ib = beadIdentity(b);
    if (ia.bearing !== ib.bearing) return ia.bearing - ib.bearing;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
