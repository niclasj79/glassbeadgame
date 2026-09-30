import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { productionInterpretation } from "@/runtime/interpretation";
import { sessionProgression } from "@/runtime/progression";
import { LENS_DISCLOSURE, LENS_VIEWS } from "@/game/layout";
import { useStore } from "@/state/store";
import { useStudy } from "@/state/studies";
import { OPENING_DEPARTURE_MS, arenaChromeVisible } from "@/scene/opening";
import { CueCaptions } from "./CueCaptions";
import { ArenaColumn } from "./FocusColumn";
import { InterpretationControls } from "./InterpretationControls";
import { useHeldWhileLeaving } from "./presence";
import { leaveStudy, sessionPage } from "./studyMode";

/**
 * THE CHROME WAITS FOR THE TITLE TO LEAVE.
 *
 * Measured from a screencast of a real press: the nav pill was at 0.144 opacity
 * 132 ms after BEGIN and fully struck at 412 ms, over a title block whose
 * authored departure does not finish for nearly a second. The Game's furniture
 * was drawn on top of the door it had just come through.
 *
 * `phase` cannot answer this on its own — it flips two animation frames after
 * the press, which is the beginning of the departure and not the end of it — so
 * the arena's own age is measured here and read against the one number that
 * knows how long the type takes to go (`scene/opening.ts`).
 *
 * It gates *visibility*, not existence. The surfaces stay in the tree so
 * nothing below them moves when they arrive, and `visibility: hidden` takes
 * them out of hit testing and out of the accessibility tree together — a
 * control that cannot be seen must not be clickable or announced either, and
 * while this is held the title screen still owns both.
 */
function useChromeShown(): boolean {
  const [shown, setShown] = useState(() => arenaChromeVisible(0));
  useEffect(() => {
    if (shown) return;
    const timer = window.setTimeout(() => setShown(true), OPENING_DEPARTURE_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);
  return shown;
}

/**
 * The world remains primary; these controls mirror its interpretation actions accessibly.
 *
 * IN A STUDY (STUDIES-SPEC §7) the arena has one verb of its own, a quiet
 * *Leave*, where the Free Game has the Lens and Conclude: the specification
 * shows neither in Study mode, and a Study never concludes and is never kept
 * (§10). The Attunement invitation is the world's, not the HUD's, and the
 * Study runtime does not surface it. Everything else — the column, the
 * captions and the mirror — is the Free Game's, with the brief written at the
 * head of the column. With no Study being played this is the Free Game's HUD,
 * unchanged (R4). Leaving a Study forgets it in the same act that changes the
 * phase, so while this page fades out it keeps the Study it was showing
 * (`useHeldWhileLeaving`) and never redraws itself as a Free Game on the way.
 */
export function ArenaHud() {
  const lensActive = useStore((state) => state.lensActive);
  const lensView = useStore((state) => state.lensView);
  const cycleLens = useStore((state) => state.cycleLens);
  const session = useHeldWhileLeaving(useStore((state) => state.session));
  const studying = useHeldWhileLeaving(useStudy((state) => state.studyId !== null));
  const shown = useChromeShown();

  /**
   * THE ONLY WAY OUT.
   *
   * Until this existed `sessionProgression.conclude()` had no caller anywhere
   * in the application: the arena could weave indefinitely and the log never
   * received `session.concluded`, so the portrait and the annotation — both
   * compiled from the concluded log — were unreachable in play. "Leave arena"
   * used to abandon the session instead, which threw the Game away rather than
   * finishing it.
   *
   * Concluding is deliberately one plain word rather than a highlighted button.
   * The player decides when the composition has said what they meant it to say
   * (spec §14); the HUD must not imply that the Game is waiting to be completed.
   */
  const conclude = () => {
    productionInterpretation.reset();
    sessionProgression.conclude();
    useStore.getState().finishConcluding();
  };

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Everything the arena *draws*. A plain wrapper: it establishes no
          containing block and no stacking context, so the surfaces inside keep
          the positions they had. */}
      <div
        data-testid="arena-chrome"
        data-shown={shown ? "true" : "false"}
        style={{ visibility: shown ? undefined : "hidden" }}
      >
        <motion.div
          className="pointer-events-auto absolute right-4 top-4 flex gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: shown ? 1 : 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {studying ? (
            <LeaveStudy />
          ) : (
            <>
              <button
                type="button"
                aria-pressed={lensActive}
                title={
                  lensActive
                    ? `${LENS_VIEWS[lensView - 1]?.label ?? ""} — ${LENS_DISCLOSURE} Press again for the next pair.`
                    : `The Lens — lays the beads out along True, Beautiful and Good. ${LENS_DISCLOSURE}`
                }
                onClick={() => {
                  productionInterpretation.reset();
                  cycleLens();
                }}
                className="rounded-full border border-line/40 bg-surface/60 px-4 py-2 font-ui text-[11px] uppercase tracking-[0.2em] text-dim backdrop-blur-md"
              >
                {lensActive ? "Close Lens" : "The Lens"}
              </button>
              <button
                type="button"
                onClick={conclude}
                title="End this Game and read what it made"
                className="rounded-full border border-line/40 bg-surface/60 px-4 py-2 font-ui text-[11px] uppercase tracking-[0.2em] text-dim backdrop-blur-md transition-colors hover:border-brass/60 hover:text-bright"
              >
                Conclude
              </button>
            </>
          )}
        </motion.div>
        {/*
          The Lens is the one arrangement in this game that cannot be sourced —
          it places a bead where the Game would place it, which is a reading and
          not a measurement. So it says so while it is open, in the same margin
          the outcomes use, rather than hiding the admission in a tooltip.
        */}
        {lensActive && (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-8">
            <p className="max-w-[46ch] text-center">
              <span className="engraved block">
                {LENS_VIEWS[lensView - 1]?.label ?? ""}
              </span>
              <span className="mt-2 block font-ui text-caption leading-relaxed text-faint">
                {LENS_DISCLOSURE}
              </span>
            </p>
          </div>
        )}
        {/* The one reading column: the focus view's bead cards, a pinned
            inspection and the margin, written on one page. It stays mounted
            while the Lens is open — the Lens silences the margin rather than
            unmounting it, so no reading kept this Game is lost to a glance at
            the triptych. In a Study it is keyed on the session, so Again and
            Next Study each open on a clean page (`studyMode.sessionPage`). */}
        <ArenaColumn key={studying ? sessionPage(session) : undefined} />
      </div>
      {/* Outside the Lens gate on purpose. The Lens hides the interpretation
          controls because there is nothing to interpret while it is open, but
          the world still resolves motifs and attunement behind it, and a player
          who cannot see the arena is precisely the one who must still be told
          what it answered.

          Outside the chrome gate too, and for the same kind of reason: both of
          these are `sr-only`. Nothing of them is ever drawn over the departing
          title, and a live region that is hidden for the first second of the
          Game is a world that cannot speak while it arrives. */}
      <CueCaptions />
      {!lensActive && <InterpretationControls />}
    </motion.div>
  );
}

/**
 * A STUDY'S WAY OUT: one plain word where the Free Game has two.
 *
 * It returns to the Studies, and says so where the pointer and the keyboard
 * look for it — nothing is lost that a Study would have kept, because a Study
 * keeps nothing (§10). Same mark and same place as Conclude, which it replaces.
 * Hook-free, so what it does can be pressed in a test.
 */
export function LeaveStudy() {
  return (
    <button
      type="button"
      data-testid="study-leave"
      onClick={() => leaveStudy()}
      title="Leave this Study and return to the Studies"
      className="rounded-full border border-line/40 bg-surface/60 px-4 py-2 font-ui text-[11px] uppercase tracking-[0.2em] text-dim backdrop-blur-md transition-colors hover:border-brass/60 hover:text-bright"
    >
      Leave
    </button>
  );
}
