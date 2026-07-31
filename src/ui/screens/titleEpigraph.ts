/**
 * THE EPIGRAPH — the first sentence anyone reads.
 *
 * It sat on the title screen in straight ASCII quotes, attributed to a bare
 * "Heraclitus" with no fragment and no edition. On the first frame of a game
 * whose entire content model is built on the difference between a documented
 * claim and a reading, an uncited quotation is not a small typographic slip: it
 * is the Game breaking its own rule before the player has touched anything.
 *
 * Two things are fixed here and they are separate.
 *
 *  - **Typography.** Curly quotes, because this is set type and not a code
 *    listing, and an en dash in the editors' names.
 *  - **Citation.** The line is fragment 54 in the Diels–Kranz numbering of the
 *    presocratics, which is the reference an actual reader can follow. No
 *    translator is named, and that is deliberate: this English wording is the
 *    common rendering and attributing it to a particular translator without
 *    holding the edition would be exactly the fabricated citation the pack's
 *    own validator refuses elsewhere. Naming the fragment is verifiable;
 *    naming a translator would not be.
 *
 * Lives outside the component so the copy is assertable without a DOM, and so
 * the component file exports nothing but a component.
 */
export interface Epigraph {
  /** Already carrying its own typographic quotation marks. */
  readonly quotation: string;
  /** Author and fragment. Never a bare name. */
  readonly attribution: string;
}

export const TITLE_EPIGRAPH: Epigraph = Object.freeze({
  quotation: "“The hidden harmony is better than the obvious.”",
  attribution: "Heraclitus, fragment 54 (Diels–Kranz)",
});
