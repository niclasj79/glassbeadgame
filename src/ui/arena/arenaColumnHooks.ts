import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveThreadOutcome } from "@/domain/outcomes";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { cueBus } from "@/runtime/cues";
import { domainSessionStore } from "@/state/domainSession";
import { createGapHint } from "./columnPlan";
import { noteForOutcome, type Note } from "./marginaliaNote";
import {
  EMPTY_MARGIN,
  readLess,
  readMore,
  receive,
  reopen,
  setAside,
  toggleIndex,
  type MarginState,
} from "./marginState";

/**
 * The gap's line, on the gap's clock. `gapFor` is the attended bead while the
 * gap is open and null otherwise; the clock (`createGapHint`) decides when the
 * line may appear, and this only carries its answer into React.
 *
 * One clock per mounted column, created once. Disposing it on unmount stops
 * its timer; a remount (React's development double-mount included) observes
 * the gap afresh and starts the three seconds again rather than resuming them.
 */
export function useGapHint(gapFor: string | null): boolean {
  const [shown, setShown] = useState(false);
  const [hint] = useState(() => createGapHint(setShown));
  useEffect(() => {
    hint.observe(gapFor);
  }, [hint, gapFor]);
  useEffect(() => () => hint.dispose(), [hint]);
  return shown && gapFor !== null;
}

/**
 * A committed thread's reading, rebuilt from the canonical log when the margin
 * no longer keeps it. Reads the log; never writes it.
 */
function recoverThreadReading(threadId: string): Note | null {
  const session = domainSessionStore.getState().session;
  const thread = session?.threads.find((entry) => String(entry.id) === threadId);
  if (thread === undefined) return null;
  return noteForOutcome(resolveThreadOutcome(thread, castaliaLookup));
}

export interface MarginActions {
  readonly setAside: () => void;
  readonly reopen: (id: string) => void;
  readonly toggleIndex: () => void;
  readonly readMore: () => void;
  readonly readLess: () => void;
}

/**
 * THE MARGIN'S MEMORY LIVES ABOVE THE COLUMN.
 *
 * It used to live inside the margin component, which the arena unmounted
 * whenever the Lens opened — so opening the Lens once threw away every reading
 * the player had kept. It is held here, by the column that stays mounted for
 * the whole arena, and the margin is drawn from it or not as the page
 * requires. The rule for what closes a reading is still `marginState`'s alone.
 */
export function useMarginState(): readonly [MarginState, MarginActions] {
  const [state, setState] = useState<MarginState>(EMPTY_MARGIN);

  useEffect(
    () =>
      cueBus.subscribe("ui", (cue) =>
        setState((previous) => receive(previous, cue, recoverThreadReading))
      ),
    []
  );

  const handleSetAside = useCallback(() => setState((previous) => setAside(previous)), []);
  const handleReopen = useCallback(
    (id: string) => setState((previous) => reopen(previous, id)),
    []
  );
  const handleToggleIndex = useCallback(
    () => setState((previous) => toggleIndex(previous)),
    []
  );
  const handleReadMore = useCallback(() => setState((previous) => readMore(previous)), []);
  const handleReadLess = useCallback(() => setState((previous) => readLess(previous)), []);

  const actions = useMemo<MarginActions>(
    () =>
      Object.freeze({
        setAside: handleSetAside,
        reopen: handleReopen,
        toggleIndex: handleToggleIndex,
        readMore: handleReadMore,
        readLess: handleReadLess,
      }),
    [handleSetAside, handleReopen, handleToggleIndex, handleReadMore, handleReadLess]
  );

  return [state, actions] as const;
}
