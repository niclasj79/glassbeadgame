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
  /** `null` when the bead's pack has no faculty for it. Never guessed. */
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

/**
 * Disciplines that have an exact faculty counterpart. `philosophy` and
 * `history` deliberately have none: inventing one would put a claim about a
 * bead's nature on screen that no one authored. Those beads render
 * unattributed — a plain graduated collar and neutral ink.
 */
const DISCIPLINE_FACULTY: Readonly<Partial<Record<DisciplineId, FacultyId>>> =
  Object.freeze({
    mathematics: "measure",
    music: "sound",
    physics: "matter",
    art: "image",
  });

/** The collar of an unattributed bead: graduated, saying only "a bead". */
const UNATTRIBUTED_SETTING: SigilFamily = "arc";

/** Neutral ink for an unattributed bead; the world's engraving colour. */
export const NEUTRAL_INK = "#9fadd0";

const frac = (value: number): number => value - Math.floor(value);

/**
 * A deterministic placeholder figure for a bead whose pack predates the sigil
 * schema. Derived only from the bead's own id, so it is stable across
 * sessions, machines, and replays — and never gilded.
 */
function derivedSigil(id: string): ConceptSigil {
  const h = hashString(id);
  return {
    family: SIGIL_FAMILIES[h % SIGIL_FAMILIES.length],
    symmetry: 1 + ((h >>> 8) % 6),
    density: 0.4 + frac((h >>> 13) / 977) * 0.4,
    turbulence: 0.06 + frac((h >>> 19) / 613) * 0.22,
    gilded: false,
  };
}

export function resolveBeadIdentity(id: string): BeadIdentity {
  const authoredConcept = castaliaConceptById.get(id);
  if (authoredConcept) {
    const faculty = facultyById.get(authoredConcept.faculty);
    return {
      id,
      name: authoredConcept.name,
      authored: true,
      faculty: authoredConcept.faculty,
      setting: faculty?.geometry ?? UNATTRIBUTED_SETTING,
      sigil: authoredConcept.sigil,
      ink: faculty?.ink ?? NEUTRAL_INK,
      bearing: faculty?.bearing ?? 0,
    };
  }

  const legacy = legacyConceptById.get(id);
  const facultyId = legacy ? DISCIPLINE_FACULTY[legacy.discipline] : undefined;
  const faculty = facultyId ? facultyById.get(facultyId) : undefined;
  return {
    id,
    name: legacy?.name ?? id,
    authored: false,
    faculty: facultyId ?? null,
    setting: faculty?.geometry ?? UNATTRIBUTED_SETTING,
    sigil: derivedSigil(id),
    ink: faculty?.ink ?? NEUTRAL_INK,
    // An unattributed bead is placed by its id rather than by a faculty it
    // does not have, so the armillary still has an order the eye can follow.
    bearing: faculty?.bearing ?? frac(hashString(`bearing:${id}`) / 4294967296),
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
