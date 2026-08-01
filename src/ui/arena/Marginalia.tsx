import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cueBus } from "@/runtime/cues";
import { useStore } from "@/state/store";
import { ReadingBody } from "../components/ReadingBody";
import { inspectedConcept } from "../components/inspection";
import {
  QUIET_CONTROL,
  READING_MEASURE,
  READING_PLATE,
  ReadingColumn,
} from "../components/ReadingColumn";
import { entranceMs, type Note } from "./marginaliaNote";
import {
  EMPTY_MARGIN,
  lastReading,
  openReading,
  receive,
  reopen,
  setAside,
  toggleIndex,
  type MarginState,
} from "./marginState";

/**
 * MARGINALIA — where an outcome is read.
 *
 * The prototype answered every documented connection with a modal card that
 * stopped the world, and the audit lists "modal ceremony for every curated
 * connection" for removal. The replacement is the behaviour of an actual
 * manuscript: a hand writes in the margin while the page stays open. Play is
 * never blocked and the world is never dimmed.
 *
 * WHAT WAS WRONG WITH IT.
 *
 * It also behaved like a manuscript that sets itself on fire. The note was
 * removed by a timer 5.1–7.4 s after it arrived, carrying 88–139 measured words
 * — between 710 and 1630 words per minute — and the surface was
 * `pointer-events-none` throughout, so there was no pin, no hover-hold, no
 * history, and no way to get a note back once it had gone. The reading a player
 * had begun was taken from them mid-sentence and could not be recovered
 * anywhere in the game.
 *
 * The timer is gone. `marginState.ts` holds the rule that replaced it and has
 * no clock in it: a reading stays until the player sets it aside, until another
 * outcome takes its place, or until the player begins another interpretation —
 * at which point the margin gets out of the arena's way, because it is the
 * arena the player has just reached for. Every reading is kept and every one can
 * be re-opened.
 *
 * WHAT THE MARKUP STILL COMMITS TO.
 *
 *  - **Epistemic status is set in the type, not in colour.** The evidence line
 *    is always present and always says which kind of claim this is. A player
 *    with no colour vision, reading a monochrome screenshot, still knows
 *    whether the Game is asserting a fact or offering a reading.
 *  - **The citations are on the page with the claim.** The plate used to end on
 *    "3 sources in the Codex" — a pointer to a screen that was cut, and the
 *    only consumer the source register had. Spec §10 wants a source reference
 *    in a documented result and the content model's honesty rests on a player
 *    being able to go and check, so the entries are printed verbatim.
 *  - **An Open Thread is set at the same weight as a documented relation**
 *    (CAV-006). Same measure, same type size, same entrance — the entrance is
 *    one function in `marginaliaNote.ts` and it does not consult the kind. Only
 *    the closing mark differs: a documented note ends; an open one keeps a
 *    hanging rule.
 *  - **Every player gets it.** This surface used to be `hidden md:flex`, so a
 *    phone finished an entire Game without once being told whether a claim was
 *    documented, contested, or a reading. Below `md` the margin becomes the
 *    foot of the page: same words, same measure, same weight for an Open Thread.
 *
 * ON POINTER EVENTS, WHICH IS A REAL TRADE.
 *
 * A plate that can be held open, scrolled, selected and dismissed has to
 * receive pointer events, and while it is open the beads beneath it cannot be
 * clicked. Three things keep that from taking the world away: the container
 * stays `pointer-events-none` so only the plate's own box catches anything;
 * beginning an interpretation anywhere else clears the plate immediately; and a
 * plain click on the plate sets it aside, so a bead underneath is one extra
 * click away rather than unreachable. It is a margin, not a modal — nothing is
 * dimmed, nothing is blocked, and the Game does not wait for it.
 *
 * It is no longer `aria-hidden`. It carries real controls now, and a focusable
 * control inside a hidden subtree is a defect; the note's prose reaches assistive
 * technology twice over — live through `CueCaptions` as it happens, and as
 * static text here for anyone who wants to go back to it.
 *
 * THE COLUMN IS NOT THE MARGIN'S PRIVATE PROPERTY.
 *
 * The page, the measure, the rule and the quiet controls now come from
 * `components/ReadingColumn`, which the bead inspection card is set in too. The
 * margin used to own all four, which is how the other surface that reads
 * authored prose at length ended up pinned over the instrument in a rounded
 * glass panel at 10px while this column stood empty in the same frame (IMP-5).
 */

/**
 * How a reading is named in the index. Never a count, never a rank, and never
 * "An open thread" three times over — an undocumented pairing is named by the
 * question it actually raised, which is the only thing that tells two of them
 * apart.
 */
function indexLabel(note: Note): string {
  return note.kind === "documented" ? note.title : note.body;
}

export interface MarginSurfaceProps {
  readonly state: MarginState;
  readonly reducedMotion: boolean;
  readonly onSetAside: () => void;
  readonly onReopen: (id: string) => void;
  readonly onToggleIndex: () => void;
}

/**
 * The margin with no bus attached, so what it renders in each of its states can
 * be asserted directly. `Marginalia` is the subscription and nothing else.
 */
export function MarginSurface({
  state,
  reducedMotion,
  onSetAside,
  onReopen,
  onToggleIndex,
}: MarginSurfaceProps) {
  const note = openReading(state);
  const last = lastReading(state);
  const earlier = state.readings.length > 1;

  /* A plain click on the prose sets the reading aside, so the arena underneath
     is one click away instead of being held hostage by a plate the player has
     finished with. A click that ends a text selection is a player reading, not
     a player leaving, and is left alone. */
  const dismissOnClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented) return;
    const selection =
      typeof window === "undefined" ? null : window.getSelection();
    if (selection && !selection.isCollapsed) return;
    onSetAside();
  };

  return (
    <ReadingColumn label="The margin" testId="marginalia" lit={note !== null}>
      <>
        <AnimatePresence mode="wait">
          {note && (
            <motion.figure
              key={note.id}
              data-testid="margin-plate"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 0, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{
                duration: reducedMotion ? 0.14 : entranceMs(note) / 1000,
                ease: [0.22, 1, 0.36, 1],
              }}
              /* Same measure on both edges: the note is a column of running
                 prose either way, and pb-20 keeps the last line clear of the
                 sound control in the corner. It scrolls inside itself rather
                 than off the screen — a five-source relation with an 85-word
                 insight is taller than a laptop margin, and a citation that
                 falls off the bottom edge is a citation nobody can check.

                 The phone ceiling is half the screen and not more. A plate
                 that can be pointed at is a plate that catches taps, and on a
                 414px screen the arena has no side margin to retreat to: at
                 78vh the note sat over the intention sigils and the player had
                 to clear it before they could arm anything. Half a screen
                 leaves the world's working half alone, and the citations
                 scroll inside the half they have. */
              className={`${READING_PLATE} ${READING_MEASURE}`}
            >
              <div onClick={dismissOnClick}>
                <ReadingBody
                  reading={note}
                  titleTag="h2"
                  titleClassName="font-display text-title font-medium leading-tight text-vellum"
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="margin-set-aside"
                  onClick={onSetAside}
                  className={QUIET_CONTROL}
                >
                  Set aside
                </button>
                {earlier && (
                  <button
                    type="button"
                    data-testid="margin-index-toggle"
                    aria-expanded={state.indexOpen}
                    onClick={onToggleIndex}
                    className={QUIET_CONTROL}
                  >
                    Earlier readings
                  </button>
                )}
              </div>

              {state.indexOpen && (
                <ul data-testid="margin-index" className="mt-3 space-y-1">
                  {[...state.readings]
                    .reverse()
                    .filter((entry) => entry.id !== note.id)
                    .map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => onReopen(entry.id)}
                          className="pointer-events-auto block w-full truncate text-left font-ui text-caption leading-relaxed text-dim transition-colors hover:text-vellum"
                        >
                          {indexLabel(entry)}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </motion.figure>
          )}
        </AnimatePresence>

        {/* THE WAY BACK IN. Without this the margin is still a surface a player
            can lose: one recessed line, present only once there is something to
            return to, naming the reading it will bring back rather than
            counting anything. */}
        {!note && last && (
          <div className={`flex justify-start ${READING_MEASURE}`}>
            <button
              type="button"
              data-testid="margin-reopen"
              onClick={() => onReopen(last.id)}
              className={`${QUIET_CONTROL} max-w-full truncate text-left`}
            >
              Read again · {last.title}
            </button>
          </div>
        )}
      </>
    </ReadingColumn>
  );
}

export function Marginalia() {
  const [state, setState] = useState<MarginState>(EMPTY_MARGIN);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  /*
   * ONE READING IN THE COLUMN AT A TIME (IMP-5).
   *
   * The bead card is set in the same column now, and two plates in one column
   * is one plate over another. The arbitration is `inspectedConcept`, asked
   * here and by the card itself, so the two can never disagree about who holds
   * the column and leave it empty between them.
   *
   * Nothing is lost by standing down: this returns null, which keeps the
   * component mounted, so the cue subscription stays live, every reading is
   * still kept, and closing the card puts the margin back exactly as it was.
   * `marginState` is not consulted or mutated here — the rule that a reading
   * closes only when the player closes it is still the only rule it has.
   */
  const pinned = useStore((s) => s.pinnedInspectId);
  const inspecting = inspectedConcept(pinned) !== null;

  useEffect(
    () => cueBus.subscribe("ui", (cue) => setState((prev) => receive(prev, cue))),
    []
  );

  const handleSetAside = useCallback(
    () => setState((prev) => setAside(prev)),
    []
  );
  const handleReopen = useCallback(
    (id: string) => setState((prev) => reopen(prev, id)),
    []
  );
  const handleToggleIndex = useCallback(
    () => setState((prev) => toggleIndex(prev)),
    []
  );

  if (inspecting) return null;

  return (
    <MarginSurface
      state={state}
      reducedMotion={reducedMotion}
      onSetAside={handleSetAside}
      onReopen={handleReopen}
      onToggleIndex={handleToggleIndex}
    />
  );
}
