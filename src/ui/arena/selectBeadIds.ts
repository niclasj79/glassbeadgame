const NO_BEAD_IDS: readonly string[] = Object.freeze([]);

/**
 * The draw's bead ids, or one frozen empty list when there is no session. A
 * selector that returned a fresh `[]` each call read as a new value on every
 * render once the session was gone, and React re-rendered without end: that
 * was the black page after leaving a Study, whose session is discarded while
 * the arena is still fading out.
 */
export const selectBeadIds = (state: {
  readonly session: { readonly beadIds: readonly string[] } | null;
}): readonly string[] => state.session?.beadIds ?? NO_BEAD_IDS;
