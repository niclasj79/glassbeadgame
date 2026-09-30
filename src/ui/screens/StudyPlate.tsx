import { type KeyboardEvent, type RefObject, useCallback, useEffect, useRef } from "react";
import { motion, useIsPresent } from "framer-motion";
import { studies, type StudyPlateModel } from "@/runtime/studies";
import { useStore } from "@/state/store";
import { studyStore, useStudy } from "@/state/studies";
import { useHeldWhileLeaving } from "../arena/presence";
import { ReadingRule } from "../components/ReadingColumn";

/**
 * THE SOLVED PLATE (STUDIES-SPEC §6, §7).
 *
 * *Solved* is one coordinated moment — the scene, the sound, the caption and
 * this plate together — and the plate is the part that can be read. It sets
 * the player's answer beside the Magister's: the player's line of beads with
 * what each thread carried, or, for a silence, the reason the brief cannot be
 * met, stated in the structure of the beads; the Magister's line; the count
 * the brief asked for beside the number the session wove, said plainly; and
 * up to three marks of form.
 *
 * EVERY WORD COMES FROM THE RUNTIME. The model is `studies.plate()`, rendered
 * there from the domain's structured answer, so this file composes no Study
 * sentence and derives nothing: it only sets what it is given, in the order it
 * is given, under labels that say whose answer is whose.
 *
 * MARKS ARE WORDS, NOT POINTS (§6). Economical, Wide, Varied: set as words in
 * the reading's own italic, under a label that says they describe the form of
 * an answer. They are not gilded, not badged, not counted and not totalled, and
 * a solve with none of them is set exactly as a solve with three — the marks
 * line is simply absent. Gold is spent on nothing here: a Study solved is a
 * form made, not a claim settled (CAV-006).
 *
 * FOUR WAYS ON, AND NO OTHER (§7): *Keep weaving* sets the plate aside and
 * the session goes on — the director's first play wanted to linger on a solved
 * Study, and weaving beyond the brief is allowed (R3) — and Escape does the
 * same; *Again* begins this Study afresh; *Next Study* the one after it (absent
 * after the last); *Back to the Studies* returns to the list. All are set
 * alike, so the plate suggests none of them, and none is a highlighted default.
 *
 * A DIALOG THAT TAKES FOCUS. The plate is modal over the arena: it is
 * labelled by its state and its brief, described by the player's answer, and
 * takes focus when it opens, so a screen reader is told what was solved and
 * how at once. Tab stays among its ways on. When it closes, focus goes
 * back where it was if that is still on the page. Reduced motion shortens the
 * entrance and removes its travel; it never removes the moment.
 */

/** How the plate arrives. One entrance for everything on it. */
function entrance(reducedMotion: boolean) {
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? 0.2 : 0.9,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  };
}

/** The ground the plate is read against: the world stays, the type stands clear of it. */
const GROUND =
  "radial-gradient(ellipse 64% 90% at 50% 50%, hsl(var(--void) / 0.94) 0%, hsl(var(--void) / 0.82) 55%, hsl(var(--void) / 0.4) 100%)";

const NOTHING = (): void => undefined;

/** The ways on share one mark, so none of them is the plate's suggestion. */
const WAY_ON =
  "rounded-full border border-line/50 px-7 py-3 font-ui text-caption uppercase tracking-engraved text-dim transition-colors hover:border-brass/60 hover:text-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-glow/60";

/** Tab and Shift+Tab stay among the plate's own controls while it is open. */
function holdFocus(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
  );
  if (controls.length === 0) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export interface StudyPlateSurfaceProps {
  /** Keep weaving: the plate is set aside and the session goes on (§7). Escape does the same. */
  readonly onKeep?: () => void;
  readonly model: StudyPlateModel;
  readonly reducedMotion: boolean;
  /** The dialog itself, so the connected plate can give it focus. */
  readonly dialogRef?: RefObject<HTMLDivElement>;
  /**
   * A way on has been taken and the plate is fading: it keeps what it said,
   * and takes no second answer.
   */
  readonly leaving?: boolean;
}

/**
 * The plate with no store attached, so every field and every way on can be
 * read and pressed. `StudyPlate` is the subscription and the focus.
 */
export function StudyPlateSurface({
  model,
  reducedMotion,
  dialogRef,
  leaving = false,
  onKeep = NOTHING,
}: StudyPlateSurfaceProps) {
  const arrive = entrance(reducedMotion);
  /** A way on, taken once: a plate on its way out answers nothing more. */
  const wayOn = (verb: () => void) => () => {
    if (!leaving) verb();
  };
  return (
    <motion.div
      className="fixed inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.2 : 0.6 }}
      style={{ pointerEvents: leaving ? "none" : undefined }}
    >
      {/* The veil catches the pointer: while the plate is open the arena
          beneath it waits, and the ways on are the only ways on. */}
      <div
        aria-hidden="true"
        className="pointer-events-auto absolute inset-0 backdrop-blur-[2px]"
        style={{ background: GROUND }}
      />
      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-center justify-center px-6 py-12">
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="study-plate-state study-plate-brief"
            aria-describedby="study-plate-player-line"
            tabIndex={-1}
            data-testid="study-plate"
            data-by={model.by}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                wayOn(onKeep)();
                return;
              }
              holdFocus(event);
            }}
            initial={arrive.initial}
            animate={arrive.animate}
            transition={arrive.transition}
            className="relative w-full max-w-2xl focus:outline-none"
          >
            <p id="study-plate-state" className="engraved">
              Solved
            </p>
            <h2
              id="study-plate-brief"
              className="mt-3 font-display text-title font-medium leading-tight text-vellum"
            >
              {model.brief}
            </h2>

            <div className="rule-engraved my-7" />

            <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
              <div className="min-w-0">
                <ReadingRule />
                <p className="engraved mb-2">Your answer</p>
                <p
                  id="study-plate-player-line"
                  data-testid="study-plate-player-line"
                  className="prose-castalia max-w-none text-body leading-relaxed"
                >
                  {model.playerLine}
                </p>
              </div>
              <div className="min-w-0">
                <ReadingRule />
                <p className="engraved mb-2">The Magister&rsquo;s answer</p>
                <p
                  data-testid="study-plate-magister-line"
                  className="prose-castalia max-w-none text-body leading-relaxed"
                >
                  {model.magisterLine}
                </p>
              </div>
            </div>

            {model.counts !== null && (
              <p
                data-testid="study-plate-counts"
                className="mt-7 font-display text-lead italic leading-snug text-vellum"
              >
                {model.counts}
              </p>
            )}

            {model.marks.length > 0 && (
              <div className="mt-6">
                <p className="engraved mb-2">The form of your answer</p>
                <p
                  data-testid="study-plate-marks"
                  className="font-display text-lead italic leading-snug text-vellum"
                >
                  {model.marks.map((mark, index) => (
                    <span key={mark}>
                      {index > 0 && <span aria-hidden="true"> · </span>}
                      <span data-testid="study-plate-mark">{mark}</span>
                    </span>
                  ))}
                </p>
              </div>
            )}

            <div className="rule-engraved my-7" />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="study-plate-keep"
                onClick={wayOn(onKeep)}
                className={WAY_ON}
              >
                Keep weaving
              </button>
              <button
                type="button"
                data-testid="study-plate-again"
                onClick={wayOn(() => studies.restart())}
                className={WAY_ON}
              >
                Again
              </button>
              {model.hasNext && (
                <button
                  type="button"
                  data-testid="study-plate-next"
                  onClick={wayOn(() => studies.next())}
                  className={WAY_ON}
                >
                  Next Study
                </button>
              )}
              <button
                type="button"
                data-testid="study-plate-back"
                onClick={wayOn(() => studies.leave())}
                className={WAY_ON}
              >
                Back to the Studies
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * The plate's words, read from the runtime. `studies.plate()` returns the same
 * object until the evaluator's word changes, so it is read as a selector.
 */
const selectPlate = (): StudyPlateModel | null => studies.plate();

/**
 * The plate as the arena shows it. Whether it is shown is the Study runtime's
 * `plateOpen` alone, set on the solved moment (App); this reads what it says,
 * takes focus as it opens and gives it back as it closes. When a way on is
 * taken the next session has nothing solved to show, so the plate keeps its
 * words while it fades rather than blanking under the player's eye.
 */
export function StudyPlate() {
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const model = useHeldWhileLeaving(useStudy(selectPlate));
  const leaving = !useIsPresent();
  const dialog = useRef<HTMLDivElement>(null);
  const open = model !== null;

  useEffect(() => {
    if (!open) return;
    const before =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => {
      if (before !== null && before.isConnected) before.focus();
    };
  }, [open]);

  const keep = useCallback(() => studyStore.getState().closePlate(), []);

  if (model === null) return null;
  return (
    <StudyPlateSurface
      model={model}
      reducedMotion={reducedMotion}
      dialogRef={dialog}
      leaving={leaving}
      onKeep={keep}
    />
  );
}
