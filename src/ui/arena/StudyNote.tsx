import { motion } from "framer-motion";
import {
  QUIET_CONTROL,
  READING_PLATE,
  ReadingRule,
} from "../components/ReadingColumn";
import { declareSilence, type StudyNoteModel } from "./studyMode";

/**
 * THE BRIEF, PINNED AT THE HEAD OF THE COLUMN (STUDIES-SPEC §7).
 *
 * A Study's first note is its brief, and it stays for the whole Study: above
 * the focus view's cards, above the thread card and the margin's readings,
 * and in every state of the column — roaming, the gap, a locked pair, a
 * reopened thread, a bead pinned open. It is written before the cards and
 * its box depends on nothing the cards do, so a card arriving or leaving
 * beneath it never moves it, and it never moves them. Only the player's own
 * act changes its height: setting the brief aside, or answering.
 *
 * SET ASIDE, NEVER GONE. On a phone the column is half the page, and a player
 * who has the brief by heart may want the room. So the brief can be set aside
 * like any reading in the margin, and the same control — which keeps its place,
 * so a keyboard player's focus stays where it was — reopens it, naming the brief
 * it will bring back.
 *
 * *IT CANNOT BE DONE* is the first control beneath the brief on every Study,
 * worded the same whether or not a Study can be done (§5). It is an answer,
 * not a surrender, so it is set as quietly as every other control in the
 * margin and asks for no confirmation: a declared silence that is not yet
 * right costs nothing.
 *
 * *NOT YET* IS A LINE, NEVER A PLATE. It is written under the controls in the
 * margin's own quiet italic, and each answer is a new line keyed by its
 * serial, so the same words given a second time arrive a second time. It is
 * what the eye reads; the ear is told by the world's voice, politely and once
 * per answer (`worldVoice`), so this line is not a live region of its own and
 * nothing is said twice.
 *
 * Hook-free, so what it puts on the page and what each control does can be
 * asserted directly; the fold is held by the column above it.
 */
export interface StudyNoteProps {
  readonly note: StudyNoteModel;
  readonly reducedMotion: boolean;
  readonly onToggleBrief: () => void;
  /** See the answer again: reopens the solved plate after *Keep weaving*. */
  readonly onOpenPlate?: () => void;
}

const NOTHING = (): void => undefined;

export function StudyNote({
  note,
  reducedMotion,
  onToggleBrief,
  onOpenPlate = NOTHING,
}: StudyNoteProps) {
  return (
    <section
      data-testid="study-note"
      data-open={note.open ? "true" : "false"}
      aria-label="The brief"
      className="pointer-events-none w-full"
    >
      {note.open && (
        <figure data-testid="study-brief-plate" className={READING_PLATE}>
          {/* Brass, not gold: a brief is an offer the Game makes, not a
              settled claim about anything. */}
          <ReadingRule />
          <p className="engraved mb-2">
            {note.chapter === null ? "Study" : `Study · ${note.chapter}`}
          </p>
          {/* Set as the compact card's name is: a lead on a phone, where the
              column is half the page, and a title in a wide margin. */}
          <p
            data-testid="study-brief"
            className="font-display text-lead font-medium leading-tight text-vellum md:text-title"
          >
            {note.brief}
          </p>
        </figure>
      )}

      <div
        className={
          "flex flex-wrap items-center gap-2 " + (note.open ? "mt-4" : "mt-0")
        }
      >
        <button
          type="button"
          data-testid="study-declare-silence"
          onClick={() => declareSilence()}
          className={QUIET_CONTROL}
        >
          It cannot be done
        </button>
        {/* A disclosure that keeps its place: "Set aside" while the brief is
            open, and the brief itself, named, while it is not. */}
        <button
          type="button"
          data-testid="study-brief-toggle"
          aria-expanded={note.open}
          onClick={onToggleBrief}
          className={`${QUIET_CONTROL} max-w-full truncate text-left`}
        >
          {note.open ? "Set aside" : `The brief · ${note.brief}`}
        </button>
      </div>

      {/* Solved, and set aside to keep weaving: the answer stays a press away
          (§7). A word and a control, never a count. */}
      {note.solved && (
        <p
          data-testid="study-solved"
          className="mt-3 flex flex-wrap items-center gap-2 font-display text-body italic leading-snug text-dim"
        >
          <span>Solved.</span>
          <button
            type="button"
            data-testid="study-see-answer"
            onClick={onOpenPlate}
            className={QUIET_CONTROL}
          >
            See the answer
          </button>
        </p>
      )}

      {note.notYet && (
        <motion.p
          key={note.notYet.serial}
          data-testid="study-not-yet"
          data-serial={note.notYet.serial}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0.14 : 0.42,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-3 font-display text-body italic leading-snug text-dim"
        >
          {note.notYet.line}
        </motion.p>
      )}
    </section>
  );
}
