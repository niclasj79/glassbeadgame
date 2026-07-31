import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cueBus } from "@/runtime/cues";
import { useStore } from "@/state/store";
import { ReadingBody } from "../components/ReadingBody";
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
 */

const MEASURE = "m-0 w-full px-6 pb-20 pt-7 md:px-0 md:py-0 md:pl-10 md:pr-8";

/** The recessed marks: engraved, faint, and never competing with the world. */
const QUIET_CONTROL =
  "engraved pointer-events-auto rounded-full border border-line/40 px-3 py-1.5 normal-case tracking-[0.12em] transition-colors hover:border-brass/60 hover:text-vellum";

function Ground({ open }: { open: boolean }) {
  /* THE PAGE BENEATH THE MARGIN.

     Without it the note competes with the arena for the same pixels and both
     become unreadable — a margin is only a margin if something is holding it.
     It rises from the foot of a phone and in from the side of a desktop: the
     same gesture against the two different edges the note is written along.

     Two grounds rather than one gradient with a direction swapped. The note is
     roughly 430px tall on a phone and roughly 300px on a desktop margin, so a
     single ramp that reads correctly across a narrow column reaches barely a
     third of the way up a tall sheet — which is how bead labels ended up
     running straight through "your reading runs with the record". Each edge
     gets stops chosen for the run it actually has. */
  return (
    <>
      <div
        aria-hidden="true"
        className={
          "absolute inset-0 -z-10 backdrop-blur-[2px] transition-opacity duration-700 md:hidden " +
          (open ? "opacity-100" : "opacity-0")
        }
        style={{
          background:
            "linear-gradient(to top, hsl(var(--void)) 0%, hsl(var(--void) / 0.97) 68%, hsl(var(--void) / 0.72) 88%, hsl(var(--void) / 0) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className={
          "absolute inset-0 -z-10 hidden transition-opacity duration-700 md:block " +
          (open ? "opacity-100" : "opacity-0")
        }
        style={{
          background:
            "linear-gradient(to left, hsl(var(--void)) 0%, hsl(var(--void) / 0.92) 55%, hsl(var(--void) / 0) 100%)",
        }}
      />
    </>
  );
}

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
    <div
      role="region"
      aria-label="The margin"
      data-testid="marginalia"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end md:inset-y-0 md:left-auto md:right-0 md:w-[min(27rem,32vw)] md:items-center"
    >
      <Ground open={note !== null} />
      <div className="w-full">
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
              className={`pointer-events-auto max-h-[50vh] overflow-y-auto overscroll-contain md:max-h-full ${MEASURE}`}
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
          <div className={`flex justify-start ${MEASURE}`}>
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
      </div>
    </div>
  );
}

export function Marginalia() {
  const [state, setState] = useState<MarginState>(EMPTY_MARGIN);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);

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
