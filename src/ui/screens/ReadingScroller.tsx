import { useEffect, useRef, type ReactNode } from "react";
import { scrollAffordance } from "./readingScroll";

/**
 * A PAGE THAT SAYS WHEN IT CONTINUES.
 *
 * The conclusion was already scrollable. What it had no way of saying was that
 * it was scrollable: on a 1440x810 desktop the last two readings were cut
 * mid-heading against the viewport edge, and the only indication was a 6px
 * hairline scrollbar the platform may not draw until the wheel moves. A player
 * reaching the end of a contemplative game does not go hunting for hidden
 * content; they read what is on the glass and conclude that is the reading.
 *
 * Three things make the page honest, and none of them is a bouncing arrow:
 *
 *  - **The edges fade.** A line of type that dissolves into the ground is the
 *    oldest signal in printing that the column continues. It appears only when
 *    something is genuinely hidden, so it never lies.
 *  - **It is said in words too.** A gradient is a graphic cue and graphic cues
 *    are read unevenly; an engraved line states the same fact in type. Both are
 *    `aria-hidden`, and deliberately: a screen reader is already given the whole
 *    panel regardless of where it is scrolled, so announcing "the reading
 *    continues" would describe a limitation that reader does not have.
 *  - **The region is focusable.** A keyboard player can reach the panel and
 *    page through it; before this the only way to scroll was a pointer.
 *
 * Per-frame work stays off React. The scroll handler mutates two opacities
 * directly through refs; nothing here re-renders while the page moves.
 */
export interface ReadingScrollerProps {
  /** Names the landmark. Should say what is being read, not "scroll area". */
  readonly label: string;
  /** Said in words when the page continues past the bottom edge. */
  readonly moreBelowLabel: string;
  readonly children: ReactNode;
}

/**
 * The stops are written out rather than left to `from`/`via`/`to`, which place
 * their middle stop at 50% and therefore ramp far too gently over a veil this
 * deep: the engraved line ended up printed across the sentence it was fading
 * out. The foot of the lower veil is effectively solid, so the line stands on
 * ground; the fade happens above it, where the fade is the message.
 */
const EDGE_BELOW =
  "linear-gradient(to top, hsl(var(--void)) 0%, hsl(var(--void) / 0.98) 45%, hsl(var(--void) / 0.45) 78%, hsl(var(--void) / 0) 100%)";

const EDGE_ABOVE =
  "linear-gradient(to bottom, hsl(var(--void)) 0%, hsl(var(--void) / 0.55) 60%, hsl(var(--void) / 0) 100%)";

/**
 * An engraved chevron rather than a glyph: the same drawn hairline as the
 * armillary's graduations, so the cue belongs to the instrument.
 */
function Continues() {
  return (
    <svg
      width="18"
      height="8"
      viewBox="0 0 18 8"
      fill="none"
      aria-hidden="true"
      className="mt-2"
    >
      <path
        d="M1 1L9 7L17 1"
        stroke="hsl(var(--brass))"
        strokeOpacity="0.8"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ReadingScroller({
  label,
  moreBelowLabel,
  children,
}: ReadingScrollerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const above = useRef<HTMLDivElement>(null);
  const below = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const sync = (): void => {
      const state = scrollAffordance({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      });
      if (above.current) above.current.style.opacity = state.above ? "1" : "0";
      if (below.current) below.current.style.opacity = state.below ? "1" : "0";
    };

    sync();
    element.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);

    /*
     * The annotation and the six readings fade in on a stagger, so the panel's
     * height is still changing for a second after mount. Without observing the
     * content the cue would be computed once, against a page that had not
     * finished arriving, and a full session's conclusion would silently claim
     * to fit.
     */
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    if (observer && content.current) observer.observe(content.current);
    if (observer) observer.observe(element);

    return () => {
      element.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div
        ref={scroller}
        data-testid="reading-scroller"
        role="region"
        aria-label={label}
        tabIndex={0}
        /* The focus ring is kept — a focusable region that shows nothing when
           focused is worse than one that cannot be focused at all — but drawn
           inside the box, because the global 2px offset would put it off the
           edge of a region that fills the viewport. */
        className="h-full overflow-y-auto overscroll-contain focus-visible:[outline-offset:-4px]"
      >
        {/* Clears the bottom veil, so no line of the reading is ever left
            permanently under the fade it is being warned about. */}
        <div ref={content} className="pb-28">
          {children}
        </div>
      </div>

      <div
        ref={above}
        aria-hidden="true"
        data-testid="reading-scroller-above"
        className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-0 transition-opacity duration-500"
        style={{ background: EDGE_ABOVE }}
      />
      <div
        ref={below}
        aria-hidden="true"
        data-testid="reading-scroller-below"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-28 flex-col items-center justify-end pb-4 opacity-0 transition-opacity duration-500"
        style={{ background: EDGE_BELOW }}
      >
        <p className="engraved">{moreBelowLabel}</p>
        <Continues />
      </div>
    </div>
  );
}
