import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motion } from "framer-motion";
import { useStore } from "@/state/store";
import {
  ACKNOWLEDGE_LIFT_REM,
  ACKNOWLEDGE_SCALE,
  DEPARTURE_EASING,
  OPENING_DOOR_DEADLINE_MS,
  OPENING_DOOR_DELAY_S,
  OPENING_DURATION_MS,
  OPENING_LINES,
  STRIKE_EASING,
  STRIKE_FADE_MS,
  STRIKE_MS,
  openingStep,
  openingWorld,
} from "@/scene/opening";
import { Button } from "../components/Button";
import { KeptGamesShelf } from "./KeptGames";
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
 * So the acknowledgement is painted *first*: a rule is struck under the door on
 * the pointer's way *down*, by a Web Animation the compositor owns, the draw is
 * built two animation frames later, and the type leaves in between. The work
 * did not get faster; it stopped being in front of the answer. `scene/opening.ts`
 * carries the trace that shows why neither a click handler nor a CSS transition
 * could do this, and holds the numbers both halves are cut to.
 *
 * And the type is carried out by the move rather than dissolved: each line
 * leaves along the axis the camera is travelling, in order from the top, so the
 * block unthreads as the instrument swings into view behind it.
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

/**
 * START THE ANIMATION AT THE PRESS, NOT AT THE NEXT COMMIT.
 *
 * A new Web Animation is *pending* until the compositor takes it, and until
 * then it has no `startTime` and contributes nothing. Traced on the running
 * build: two frames were painted, 8 ms and 257 ms after the press, with both
 * animations reporting `playState: "running"` and `startTime: null`, and they
 * were only given a start time around 475 ms — when the main thread came back
 * from building the draw. Anchoring the start time to the document's own
 * timeline resolves the pending play immediately, so the first frame that does
 * get painted already shows the answer under way.
 */
function anchored(animation: Animation): Animation {
  const now = document.timeline.currentTime;
  if (now !== null && animation.startTime === null) animation.startTime = now;
  return animation;
}

/** A compositor-owned answer, or nothing at all where WAAPI is unavailable. */
function strikeNow(element: HTMLElement | null): boolean {
  if (!element || typeof element.animate !== "function") return false;
  anchored(
    element.animate(
      { transform: ["scaleX(0)", "scaleX(1)"] },
      { duration: STRIKE_MS, easing: STRIKE_EASING, fill: "forwards" }
    )
  );
  anchored(
    element.animate(
      { opacity: [0, 1] },
      { duration: STRIKE_FADE_MS, easing: "ease", fill: "forwards" }
    )
  );
  return true;
}

function liftNow(element: HTMLElement | null): boolean {
  if (!element || typeof element.animate !== "function") return false;
  anchored(
    element.animate(
      {
        transform: [
          "translateY(0rem) scale(1)",
          `translateY(-${ACKNOWLEDGE_LIFT_REM}rem) scale(${ACKNOWLEDGE_SCALE})`,
        ],
      },
      {
        duration: OPENING_DURATION_MS,
        easing: DEPARTURE_EASING,
        fill: "forwards",
      }
    )
  );
  return true;
}

/**
 * THE DOOR WAITS FOR THE WORLD BEHIND IT.
 *
 * The acknowledgement above answers the press; it does not make the press work.
 * On a cold profile the first BEGIN still took the main thread for about two
 * seconds while the driver linked the bead glass — every frame of the opening
 * lost, and with it the only thing the arena had to say for itself. That build
 * has been moved into the title (`scene/ArenaCanvas.tsx`), and this is the
 * other half: the door is not offered until there is something behind it.
 *
 * It holds silently. There is no progress bar, no spinner and no word for it —
 * the door simply arrives with the rest of the title's stagger, a little later
 * than the epigraph on a cold load and not noticeably later on a warm one, and
 * a player reading Hesse does not experience the wait as one. What they would
 * experience is a press that did nothing, which is what this refuses.
 *
 * And it cannot jam shut. A world that never reports ready opens the door on a
 * deadline anyway: the worst that costs is the freeze, and a title screen with
 * no way into the Game is worse than any freeze.
 */
function useDoorArmed(): boolean {
  const ready = useSyncExternalStore(
    openingWorld.subscribe,
    openingWorld.isReady,
    openingWorld.isReady
  );
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(
      () => setExpired(true),
      OPENING_DOOR_DEADLINE_MS
    );
    return () => window.clearTimeout(timer);
  }, [ready]);
  return ready || expired;
}

export function TitleScreen() {
  const [opening, setOpening] = useState(false);
  const pressed = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const strike = useRef<HTMLDivElement>(null);
  const armed = useDoorArmed();
  const mountedAt = useRef(0);
  if (mountedAt.current === 0) mountedAt.current = performance.now();

  /**
   * THE PRESS IS ANSWERED ON THE WAY DOWN, BY THE COMPOSITOR.
   *
   * Measured six ways against the running build, and every route that went
   * through React, the motion library, or a CSS transition lost the frame:
   * scheduling `startSession` from the handler answered after 741 ms, deferring
   * it two animation frames 725 ms, waiting for the library's own Web Animation
   * 600 ms, and a plain inline-style transition committed alongside
   * `setOpening(true)` still had not started two painted frames and 467 ms
   * after the style landed. A transition is begun by the main thread during a
   * rendering update, and the rendering update is exactly what the session
   * build is standing on.
   *
   * `Element.animate()` is not: the animation is timed from the moment it is
   * created and handed to the compositor, so it is already under way — and
   * stays under way — however long the main thread is taken afterwards. Firing
   * it from `pointerdown` recovers the rest: a click cannot be dispatched until
   * the finger comes up, which on the traced build was a further 227 ms of
   * silence in answer to a decision the player had already made.
   *
   * The React state that follows only keeps the tree honest about what has
   * already been drawn, and there is deliberately no inline `transition` left
   * on any of it for a later revision to lean on again.
   */
  const answer = useCallback(() => {
    if (pressed.current) return;
    pressed.current = true;
    strikeNow(strike.current);
    liftNow(root.current);
    setOpening(true);
  }, []);

  /**
   * The threshold is opened two frames after the leaving state is committed —
   * long enough for the browser to have painted the acknowledgement, short
   * enough that nothing is kept waiting.
   *
   * This used to call `startSession()` here, which built the draw and put the
   * player straight into the arena. The draw now happens one screen later, when
   * they leave the threshold, because a page explaining what the Game is for
   * cannot be read by someone the Game has already started. What has NOT moved
   * is the shader warm-up: `useDoorArmed` still holds this door shut until the
   * world reports ready, so the expensive half is paid before either press.
   */
  useEffect(() => {
    if (!opening) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        useStore.getState().crossToThreshold()
      );
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [opening]);

  const line = (index: number, delay: number, held = false) => ({
    ...enter,
    animate: opening ? leaving(index) : held ? enter.initial : enter.animate,
    transition: { duration: 0.9, delay },
  });

  /**
   * The door keeps its place in the stagger when the world was ready before the
   * title finished arriving, and takes none of it when the world was not: a
   * cold load has already spent the delay waiting, and spending it twice would
   * make the hold visible, which is the one thing it must not be.
   */
  const doorDelay = (): number =>
    Math.max(
      0,
      OPENING_DOOR_DELAY_S - (performance.now() - mountedAt.current) / 1000
    );

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
      // The lift is a Web Animation started in the pointerdown handler above.
      // Nothing here may become a transition: a transition is the thing that
      // could not be started in time.
      style={{ pointerEvents: opening ? "none" : undefined }}
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

      {/* The block keeps its place in the layout whether or not the door is
          open, so nothing above it moves when the world finishes building. */}
      <motion.div
        {...line(OPENING_LINES - 1, doorDelay(), !armed)}
        className="mt-12 flex flex-col items-center"
      >
        {/* The press is taken on the way down; the click is the keyboard's
            door, and the ref above makes the second arrival a no-op. */}
        <Button
          disabled={!armed}
          tabIndex={armed ? undefined : -1}
          aria-hidden={armed ? undefined : true}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            answer();
          }}
          onClick={answer}
        >
          Begin
        </Button>
        {/* The door opening. A plain element, so nothing schedules it. */}
        <div
          ref={strike}
          aria-hidden
          className="mt-5 h-px w-56 origin-center bg-gradient-to-r from-transparent via-glow to-transparent"
          style={{ transform: "scaleX(0)", opacity: 0 }}
        />
        {/* The shelf. Absent until a Game has been kept; leaves with the door. */}
        <KeptGamesShelf />
      </motion.div>
    </motion.div>
  );
}
