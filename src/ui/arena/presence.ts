import { useRef } from "react";
import { useIsPresent } from "framer-motion";

/**
 * A PAGE LEAVES AS THE PAGE IT WAS.
 *
 * Leaving a Study discards its session, forgets the Study and changes the
 * phase in one act, and the page plays its exit after all three. Read live,
 * the fading arena would redraw itself as a Free Game on the way out — the Lens
 * and Conclude struck for the length of the fade over a Study they never belong
 * to (STUDIES-SPEC §7), and the brief lifted off the column under the player's
 * eye — and a plate closed by *Again* would blank rather than fade, because
 * the new session has nothing solved to show.
 *
 * So a value read through this hook follows the stores while its page is
 * present, and keeps what it last showed while the page leaves. Outside a
 * presence group — a static render in a test — a page is always present and
 * the value is simply the live one. It holds a value; it decides nothing.
 */
export function useHeldWhileLeaving<T>(live: T): T {
  const held = useRef(live);
  return holdWhileLeaving(held, live, useIsPresent());
}

/** The hold itself, with no React attached: follow while present, keep while leaving. */
export function holdWhileLeaving<T>(
  held: { current: T },
  live: T,
  present: boolean
): T {
  if (present) held.current = live;
  return held.current;
}
