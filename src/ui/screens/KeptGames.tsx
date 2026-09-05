import { useEffect, useState } from "react";
import type { PersistedSessionRecord } from "@/platform/indexeddb/schema";
import { sessionArchive } from "@/runtime/persistence";
import { openKeptGame } from "@/runtime/session";
import { QUIET_CONTROL } from "../components/ReadingColumn";
import { keptGameLabel } from "./keptGameLabel";

/** How many Games the shelf shows. Older ones are kept; they are simply not listed. */
const SHELF_LENGTH = 12;

/**
 * THE SHELF.
 *
 * It does not exist until there is something on it, it lives under the door
 * rather than beside it, and it says nothing about how many Games there are.
 * Opening a Game from here loads its log and shows the reading it left, whole:
 * the conclusion is a performance of a session that just happened, and a
 * kept Game is being read again, not concluded twice.
 */
export function KeptGamesShelf() {
  const [games, setGames] = useState<readonly PersistedSessionRecord[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    sessionArchive
      .listKept(SHELF_LENGTH)
      .then((list) => {
        if (live) setGames(list);
      })
      .catch(() => {
        if (live) setGames([]);
      });
    return () => {
      live = false;
    };
  }, []);

  if (games === null || games.length === 0) return null;

  return (
    <div data-testid="kept-games" className="mt-8 flex w-full max-w-md flex-col items-center">
      <button
        type="button"
        data-testid="kept-games-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={QUIET_CONTROL}
      >
        {open ? "Close the shelf" : "Kept Games"}
      </button>
      {open && (
        <ul data-testid="kept-games-list" className="mt-4 w-full space-y-1">
          {games.map((record) => {
            const label = keptGameLabel(record);
            return (
              <li key={record.id}>
                <button
                  type="button"
                  data-testid={`kept-game-${record.id}`}
                  onClick={() => openKeptGame(record)}
                  className="block w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-elevated/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-glow/60"
                >
                  <span className="engraved block normal-case tracking-[0.12em]">
                    {label.when}
                  </span>
                  <span className="mt-0.5 block truncate font-display text-lead text-dim">
                    {label.said}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
