import type { MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ReadingBody } from "../components/ReadingBody";
import { QUIET_CONTROL, READING_PLATE } from "../components/ReadingColumn";
import type { MarginRegister } from "./columnPlan";
import { entranceMs, noteLayers, type Note } from "./marginaliaNote";
import {
  isExpanded,
  lastReading,
  openReading,
  pendingReading,
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
 * outcome takes its place, or until the player's next act — at which point the
 * margin gets out of the way of the arena, because it is the arena the player
 * has just reached for. Every reading is kept and every one can be re-opened.
 *
 * THE THREAD CARD (I-018).
 *
 * After a weave the two bead cards fold into one thread card, and that card is
 * this plate: the outcome's title, its evidence line and one sentence, with the
 * rest of the insight, the counterpoint and the citations behind "Read more".
 * The layering is decided in `marginaliaNote.noteLayers` and is only a length:
 * the evidence line is on the first layer of every card. When a committed thread
 * is reopened (I-019) the same card is written beneath the pair's two bead
 * cards, and the view it belongs to is left with the column's own Step back.
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
 *    being able to go and check, so the entries are printed verbatim, one
 *    request away on the thread card.
 *  - **An Open Thread is set at the same weight as a documented relation**
 *    (CAV-006). Same measure, same type size, same entrance — the entrance is
 *    one function in `marginaliaNote.ts` and it does not consult the kind. Only
 *    the closing mark differs: a documented note ends; an open one keeps a
 *    hanging rule.
 *  - **Every player gets it.** This surface used to be `hidden md:flex`, so a
 *    phone finished an entire Game without once being told whether a claim was
 *    documented, contested, or a reading. Below `md` the margin is the foot of
 *    the page: same words, same measure, same weight for an Open Thread.
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
 * THE MARGIN IS A SECTION OF THE COLUMN, NOT A COLUMN OF ITS OWN.
 *
 * The page, the measure, the rule and the quiet controls come from
 * `components/ReadingColumn`, and the column itself is drawn once, by
 * `FocusColumn`, with the bead cards above this section. The margin used to
 * draw a column of its own and stand down whenever the bead card drew another
 * over it; two absolutely-placed columns arbitrating who is drawn is how a
 * surface ends up over another, so there is one page now and this is written on
 * it. Its memory lives above the column (`arenaColumnHooks.useMarginState`), so
 * nothing the player has read is lost when the page has no room for it.
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
  /**
   * What the margin writes (`columnPlan.MarginRegister`):
   *
   *  - `page` (the default): the whole margin — the open reading, the index of
   *    earlier ones, a motif waiting its turn, and the way back in;
   *  - `held`: only the open reading, as the card of a reopened thread
   *    (I-019). It carries no index and no set-aside of its own; the view it
   *    belongs to is left with the column's Step back, which takes the card
   *    with it.
   */
  readonly register?: Exclude<MarginRegister, "none">;
  readonly onSetAside: () => void;
  readonly onReopen: (id: string) => void;
  readonly onToggleIndex: () => void;
  readonly onReadMore: () => void;
  readonly onReadLess: () => void;
}

/**
 * The margin with no bus attached, so what it renders in each of its states can
 * be asserted directly. The subscription lives in `arenaColumnHooks`.
 */
export function MarginSurface({
  state,
  reducedMotion,
  register = "page",
  onSetAside,
  onReopen,
  onToggleIndex,
  onReadMore,
  onReadLess,
}: MarginSurfaceProps) {
  const held = register === "held";
  const note = openReading(state);
  const last = lastReading(state);
  const earlier = state.readings.length > 1;
  /* A motif that arrived while this reading was open. It waits rather than
     taking the page, and it is offered here and opened when the reading is
     set aside — see marginState. */
  const pending = pendingReading(state);
  const layers = note === null ? null : noteLayers(note);
  const expanded = isExpanded(state);
  const whole = layers === null || !layers.more || expanded;
  const shown = note === null || layers === null ? null : whole ? note : layers.first;

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
    <div data-testid="marginalia" className="pointer-events-none w-full">
      <AnimatePresence mode="wait">
        {note && shown && layers && (
          <motion.figure
            key={note.id}
            data-testid="margin-plate"
            data-kind={note.kind}
            data-thread-id={note.threadId ?? undefined}
            data-layer={whole ? "whole" : "first"}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 0, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{
              duration: reducedMotion ? 0.14 : entranceMs(note) / 1000,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={READING_PLATE}
          >
            <div onClick={held ? undefined : dismissOnClick}>
              <ReadingBody
                reading={shown}
                titleTag="h2"
                titleClassName="font-display text-title font-medium leading-tight text-vellum"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {/* A disclosure, not a one-way door: the same control reads
                  "Read less" once opened, so a keyboard player's focus stays
                  where they left it instead of falling to the page. */}
              {layers.more && (
                <button
                  type="button"
                  data-testid="thread-card-more"
                  aria-expanded={expanded}
                  onClick={expanded ? onReadLess : onReadMore}
                  className={QUIET_CONTROL}
                >
                  {expanded ? "Read less" : "Read more"}
                </button>
              )}
              {!held && (
                <button
                  type="button"
                  data-testid="margin-set-aside"
                  onClick={onSetAside}
                  className={QUIET_CONTROL}
                >
                  Set aside
                </button>
              )}
              {!held && pending && (
                <button
                  type="button"
                  data-testid="margin-pending"
                  onClick={() => onReopen(pending.id)}
                  className={`${QUIET_CONTROL} border-brass/60 text-vellum`}
                >
                  {pending.title} · read it
                </button>
              )}
              {!held && earlier && (
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

            {!held && state.indexOpen && (
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
      {/* A motif that formed while the player was reading, and was never
          opened: still on offer once the margin is clear. */}
      {!held && !note && pending && (
        <div className="flex justify-start">
          <button
            type="button"
            data-testid="margin-pending"
            onClick={() => onReopen(pending.id)}
            className={`${QUIET_CONTROL} max-w-full truncate border-brass/60 text-left text-vellum`}
          >
            {pending.title} · read it
          </button>
        </div>
      )}
      {!held && !note && !pending && last && (
        <div className="flex justify-start">
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
  );
}
