import { useStore as useVanillaStore } from "zustand";
import { domainSessionStore } from "@/state/domainSession";

/**
 * HOW THE ROOM LEANS INTO ATTUNEMENT
 *
 * One ease for everything that belongs to the room rather than to the web —
 * the vault, the drawn sky and the air between the beads — so they enter and
 * leave the held state together. The threads keep their own, faster ease
 * (`Attunement.ts`), because a thread's turn is a different event.
 */

/**
 * How fast the room enters and leaves the held state of Attunement. Seconds.
 * Slow, so it reads as attention changing rather than as a light switch.
 */
export const SKY_ATTUNED_EASE_SECONDS = 0.9;

/** One frame of the room's ease toward `target`. */
export function easeToward(current: number, target: number, dt: number): number {
  return current + (target - current) * Math.min(1, dt / SKY_ATTUNED_EASE_SECONDS);
}

/** Whether the canonical session is currently held in Attunement. */
export function useAttuned(): boolean {
  return useVanillaStore(
    domainSessionStore,
    (state) => state.session?.attunementActive ?? false
  );
}
