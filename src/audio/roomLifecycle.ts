import type { Phase } from "../state/types";

/**
 * WHEN THE ROOM IS EMPTY.
 *
 * The ambient bed, the binaural layer and the semantic scheduler sound only
 * while a Game is in the room. The title, the threshold and the Studies list
 * hold no Game: whatever was playing when the player left must stop there,
 * or the last session's choir sings over a list of briefs (M9-001).
 */
export function roomIsEmpty(phase: Phase): boolean {
  return phase === "title" || phase === "threshold" || phase === "studies";
}

/**
 * The choir must be emptied before the session is seated again: a different
 * session has replaced the one in the room, or the same one began again (a
 * Study's Next Study and Again go from arena to arena, and Again keeps the
 * seed, so the session id alone cannot tell). A thread that was seated and is
 * no longer in the session is the sign; a replayed log keeps every thread.
 */
export function choirMustReset(
  seated: { readonly sessionId: string | null; readonly threadIds: readonly string[] },
  next: { readonly sessionId: string; readonly threadIds: readonly string[] }
): boolean {
  if (seated.sessionId === null) return false;
  if (seated.sessionId !== next.sessionId) return true;
  const present = new Set(next.threadIds);
  return seated.threadIds.some((id) => !present.has(id));
}
