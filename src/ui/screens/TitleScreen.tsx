import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { startSession } from "@/runtime/session";
import {
  OPENING_DURATION_MS,
  OPENING_LINES,
  openingStep,
} from "@/scene/opening";
import { Button } from "../components/Button";
import { TITLE_EPIGRAPH } from "./titleEpigraph";

/**
 * One door.
 *
 * The prototype's title offered four: Begin, Today's Draw, the Codex, and a
 * progress menu carrying a rank. Three of them were entrances to systems that
 * no longer exist — the daily draw seeded a discipline pick the slice does not
 * make, and the Codex and rank both counted curated connections against a
 * corpus that has been deleted. What is left is the only choice the Game ever
 * needed the player to make: start.
 *
 * WHAT HAPPENS WHEN IT IS PRESSED.
 *
 * `startSession` builds a draw, resets three stores and mounts the whole arena
 * — materials, shaders, a font — synchronously. The browser cannot paint until
 * that returns, so on the shipped build the first 808 ms after the press
 * changed 0.3% of the frame and the title did not begin to dim for 2.6 seconds.
 * The player pressed a button and the world did nothing.
 *
 * So the acknowledgement is painted *first*: a rule is struck under the door by
 * a style write in the click handler itself, the draw is built two animation
 * frames later, and the type leaves in between. The work did not get faster; it
 * stopped being in front of the answer.
 *
 * And the type is carried out by the move rather than dissolved: each line
 * leaves along the axis the camera is travelling, in order from the top, so the
 * block unthreads as the instrument swings into view behind it. See
 * `scene/opening.ts`, which holds the phrasing both halves are cut to.
 */

const enter = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

/** How a line leaves: lifted and grown a little, as though passing the lens. */
function leaving(index: number) {
  const step = openingStep(index);
  return {
    opacity: 0,
    y: `-${step.lift}rem`,
    scale: step.scale,
    transition: {
      duration: step.duration,
      delay: step.delay,
      ease: [0.32, 0, 0.24, 1] as [number, number, number, number],
    },
  };
}

export function TitleScreen() {
  const [opening, setOpening] = useState(false);
  const pressed = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const strike = useRef<HTMLDivElement>(null);

  /**
   * THE PRESS IS ANSWERED BY THE DOM, NOT BY THE FRAMEWORK.
   *
   * Measured four ways, and every route through React or the motion library
   * lost the frame. Scheduling `startSession` from the handler answered the
   * press after 741 ms; deferring it two animation frames, 725 ms; waiting for
   * the library's own Web Animation to be running, 600 ms. The reason is always
   * the same: the thing that would have carried the answer is created on a
   * frame the session build is already sitting in.
   *
   * So the rule under the door is struck here, synchronously, in the click
   * handler itself — one style write on a plain element the motion library does
   * not own. The browser starts the transition at the next style flush and runs
   * it on the compositor, and nothing that happens on the main thread
   * afterwards can delay it. The React state that follows only keeps the tree
   * honest about what has already been drawn.
   */
  const begin = useCallback(() => {
    if (pressed.current) return;
    pressed.current = true;
    const rule = strike.current;
    if (rule) {
      rule.style.transform = "scaleX(1)";
      rule.style.opacity = "1";
    }
    setOpening(true);
  }, []);

  /**
   * The draw is built two frames after the leaving state is committed — long
   * enough for the browser to have painted the acknowledgement, short enough
   * that the arena is not kept waiting.
   */
  useEffect(() => {
    if (!opening) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => startSession());
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [opening]);

  const line = (index: number, delay: number) => ({
    ...enter,
    animate: opening ? leaving(index) : enter.animate,
    transition: { duration: 0.9, delay },
  });

  return (
    <motion.div
      ref={root}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
      data-opening={opening ? "true" : "false"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // The block has already carried itself out of frame by the time this
      // runs; it is here so AnimatePresence has something to wait on.
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      /**
       * THE ACKNOWLEDGEMENT IS A CSS TRANSITION, NOT AN ANIMATION LIBRARY.
       *
       * Measured three ways, this is the only thing that answers the press in
       * time. The per-line departure below is a Web Animation the motion
       * library creates on its own frame — and the frame it creates it on is
       * the same one `startSession` takes the main thread in, so the press was
       * still going unanswered for 725 ms with the work deferred by two frames.
       *
       * A transition declared on the element itself needs no JavaScript at all
       * after the style lands: React commits the leaving state synchronously
       * with the click, the browser starts the transition at the next paint,
       * and it runs on the compositor however long the main thread is busy
       * afterwards. The whole block lifts by a line's height — small, but
       * unmistakably an answer, and it is under way before the draw is built.
       */
      style={{
        pointerEvents: opening ? "none" : undefined,
        transform: opening ? "translateY(-1.1rem) scale(1.014)" : undefined,
        transition: `transform ${OPENING_DURATION_MS}ms cubic-bezier(.32,0,.24,1)`,
        willChange: "transform",
      }}
    >
      <motion.p
        {...line(0, 0.15)}
        className="font-ui text-[11px] uppercase tracking-[0.6em] text-dim/70"
      >
        Das Glasperlenspiel
      </motion.p>

      <motion.h1
        {...line(1, 0.3)}
        className="mt-5 text-center font-display text-6xl font-medium tracking-wide text-bright md:text-8xl"
      >
        The Glass Bead Game
      </motion.h1>

      <motion.div
        {...line(2, 0.45)}
        className="mt-7 h-px w-24 bg-gradient-to-r from-transparent via-glow/60 to-transparent"
      />

      <motion.blockquote
        {...line(3, 0.55)}
        className="mt-7 max-w-xl text-center font-display text-lg italic leading-relaxed text-dim text-balance"
      >
        {TITLE_EPIGRAPH.quotation}
        {/* Cited, not merely name-dropped. See titleEpigraph.ts for why the
            fragment number is given and a translator is not. */}
        <footer className="mx-auto mt-3 max-w-xs font-ui text-[10px] uppercase not-italic leading-relaxed tracking-[0.22em] text-dim/60">
          {TITLE_EPIGRAPH.attribution}
        </footer>
      </motion.blockquote>

      <motion.div
        {...line(OPENING_LINES - 1, 0.75)}
        className="mt-12 flex flex-col items-center"
      >
        <Button onClick={begin}>Begin</Button>
        {/* The door opening. A plain element, so nothing schedules it. */}
        <div
          ref={strike}
          aria-hidden
          className="mt-5 h-px w-56 origin-center bg-gradient-to-r from-transparent via-glow to-transparent"
          style={{
            transform: "scaleX(0)",
            opacity: 0,
            transition:
              "transform 460ms cubic-bezier(.22,1,.36,1), opacity 220ms ease",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
