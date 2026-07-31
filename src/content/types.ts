/**
 * What is left of the prototype's content types.
 *
 * The pre-Castalia pack — ninety concepts, six disciplines, and the `Concept`,
 * `Discipline`, `Register` and `TimbreId` shapes they were authored in — has
 * been deleted. Every bead the game draws now comes from `@/content/castalia`,
 * which carries its own schema.
 *
 * `DisciplineId` outlives it because the six names are still the vocabulary of
 * the *draw*: `startSession` takes them, the legacy presentation projection
 * records them, and the deterministic browser harness selects a session with
 * them. It is a set of six strings and nothing more — no colour, no glyph, no
 * timbre, and nothing to look up.
 */
export type DisciplineId =
  | "mathematics"
  | "music"
  | "philosophy"
  | "physics"
  | "art"
  | "history";
