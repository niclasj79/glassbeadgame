import type { ReactNode } from "react";

/**
 * THE READING COLUMN — one law for anything that is read.
 *
 * The composition already reserves a column for reading: `scene/framing.ts`
 * holds `MARGIN_RESERVE` of the page clear of the instrument "whether or not
 * anything is written there", and the arena is seated off-centre because of it.
 * Two things were wrong with what the DOM then did with that bargain.
 *
 * TWO SURFACES, TWO LAWS (IMP-5). The margin took the reserved column and set
 * its readings against a ruled page. The bead inspection card — the same class
 * of thing, authored prose read at length — was pinned over the *instrument* at
 * the lower left in a rounded glass panel at 10–12px, so the surface that fires
 * first destroyed the world it describes while the column built for exactly
 * that content sat empty in the same frame. There is one column now, one
 * measure, one rule, one type scale; the two surfaces differ only in what they
 * say. Whichever is open takes the column, and `Marginalia` yields to an
 * inspection, because an inspection is something the player has just asked for
 * by name and a reading they set down is one control away.
 *
 * NO STANDING AT REST (IMP-4). The column was pure negative space until an
 * outcome fired: measured ink per vertical third on the opening frame was
 * 43/49/7, which reads as a camera that missed rather than as an asymmetry that
 * was chosen. So the column is ruled before it has content — a gutter rule and
 * a page-edge tint, present from the first frame.
 *
 * THE RULE IS THE SCENE'S RULE, NOT A NEW ONE. `scene/MarginRule.tsx` strikes
 * the page's inner ruling at `frameRuleShared` half-heights, which works out to
 * 5.75% of the *short* side of the viewport on every aspect (the derivation is
 * in `framing.ts`: the margin is a physical width measured against the short
 * side, so the band is the same on all four edges). `min(1vw, 1vh)` is one
 * percent of the short side, so the gutter rule below runs exactly between the
 * page's own top and bottom rules rather than near them. The number is restated
 * here rather than imported because this module must not reach into
 * `src/scene`; if the ornament's inset moves, this is the one line to move.
 */

/** 5.75% of the viewport's short side: where the page's inner ruling stands. */
const FRAME_RULE_GAP = "calc(5.75 * min(1vw, 1vh))";

/**
 * How much of a narrow page the column holds at rest. `framing.compositionBox`
 * keeps the instrument out of the bottom `MARGIN_RESERVE` of a portrait frame;
 * this is the DOM's side of the same bargain, so the tint and the rule have
 * somewhere to stand before a single word has been written.
 */
const FOOT_RESERVE = "min-h-[30vh] md:min-h-0";

/**
 * The measure a reading is set to, on either edge of the page. Identical for
 * both surfaces on purpose: a bead's description and an outcome's insight are
 * the same class of thing, and a difference in measure is a difference in
 * weight (CAV-006).
 */
export const READING_MEASURE =
  "m-0 w-full px-6 pb-20 pt-7 md:px-0 md:py-0 md:pl-10 md:pr-8";

/**
 * How the column holds a plate: it scrolls inside itself rather than off the
 * screen, and it never takes more than half a phone, so the arena's working
 * half is left alone.
 */
export const READING_PLATE =
  "pointer-events-auto max-h-[50vh] overflow-y-auto overscroll-contain md:max-h-full";

/** The recessed marks: engraved, faint, and never competing with the world. */
export const QUIET_CONTROL =
  "engraved pointer-events-auto rounded-full border border-line/40 px-3 py-1.5 normal-case tracking-[0.12em] transition-colors hover:border-brass/60 hover:text-vellum";

/**
 * The scribe's rule: the page is ruled before it is written in. Gold is spent
 * only on what is genuinely settled, so anything the Game is offering rather
 * than reporting rules in brass however confidently it is put.
 */
export function ReadingRule({ gilt = false }: { readonly gilt?: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-testid="reading-rule"
      className={"mb-3 h-px w-16 " + (gilt ? "bg-gold/70" : "bg-brass/50")}
    />
  );
}

/**
 * The page-edge tint is a *dye*, not a scrim, and it darkens rather than
 * lightens because that is what the frame ornament does: `scene/MarginRule.tsx`
 * lays "material depth at the very edge of vision — a dyed falloff kept tight
 * against the frame". Measured on the opening frame at 1440x810, this moves
 * mean luminance per vertical third from 37/40/23 to 39/43/19: enough for the
 * column to stop reading as spill from the instrument and start reading as a
 * margin the page has, and not enough for it to read as a panel laid over the
 * world. The rule does the rest of the work, and the rule is a mark.
 */
const STANDING_TINT_FOOT =
  "linear-gradient(to top, hsl(var(--void) / 0.24) 0%, hsl(var(--void) / 0.08) 46%, hsl(var(--void) / 0) 100%)";
const STANDING_TINT_SIDE =
  "linear-gradient(to left, hsl(var(--void) / 0.24) 0%, hsl(var(--void) / 0.08) 46%, hsl(var(--void) / 0) 100%)";

const GROUND_FOOT =
  "linear-gradient(to top, hsl(var(--void)) 0%, hsl(var(--void) / 0.97) 68%, hsl(var(--void) / 0.72) 88%, hsl(var(--void) / 0) 100%)";
const GROUND_SIDE =
  "linear-gradient(to left, hsl(var(--void)) 0%, hsl(var(--void) / 0.92) 55%, hsl(var(--void) / 0) 100%)";

/**
 * THE PAGE BENEATH THE COLUMN.
 *
 * Two layers answering different questions. The *standing* is always there and
 * says the column exists; the *ground* comes up under a reading and says the
 * column is being written in. Without the second, prose competes with the arena
 * for the same pixels and both become unreadable; without the first, the
 * composition has a hole in it for the whole of the opening.
 *
 * Two of each rather than one gradient with a direction swapped: a plate is
 * roughly 430px tall on a phone and roughly 300px in a desktop margin, so a
 * single ramp tuned for a narrow column reaches barely a third of the way up a
 * tall sheet — which is how bead labels ended up running straight through "your
 * reading runs with the record".
 */
function Page({ lit }: { readonly lit: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        data-testid="reading-column-standing"
        className="absolute inset-0 -z-20 md:hidden"
        style={{ background: STANDING_TINT_FOOT }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 hidden md:block"
        style={{ background: STANDING_TINT_SIDE }}
      />

      {/* The gutter rule: across the head of the foot on a narrow page, down
          the column's inner edge on a wide one, struck between the page's own
          rules on both. */}
      <div
        aria-hidden="true"
        data-testid="reading-column-gutter"
        className="absolute top-0 -z-20 h-px md:hidden"
        style={{
          left: FRAME_RULE_GAP,
          right: FRAME_RULE_GAP,
          background:
            "linear-gradient(90deg, transparent, hsl(var(--line) / 0.85) 22%, hsl(var(--line) / 0.85) 78%, transparent)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute left-0 -z-20 hidden w-px md:block"
        style={{
          top: FRAME_RULE_GAP,
          bottom: FRAME_RULE_GAP,
          background:
            "linear-gradient(180deg, transparent, hsl(var(--line) / 0.85) 16%, hsl(var(--line) / 0.85) 84%, transparent)",
        }}
      />

      <div
        aria-hidden="true"
        className={
          "absolute inset-0 -z-10 backdrop-blur-[2px] transition-opacity duration-700 md:hidden " +
          (lit ? "opacity-100" : "opacity-0")
        }
        style={{ background: GROUND_FOOT }}
      />
      <div
        aria-hidden="true"
        className={
          "absolute inset-0 -z-10 hidden transition-opacity duration-700 md:block " +
          (lit ? "opacity-100" : "opacity-0")
        }
        style={{ background: GROUND_SIDE }}
      />
    </>
  );
}

export interface ReadingColumnProps {
  /** Names the landmark. Says what is read here, never "panel". */
  readonly label: string;
  readonly testId: string;
  /** True while something is written in the column. */
  readonly lit: boolean;
  readonly children: ReactNode;
}

/**
 * The reserved column, as a landmark.
 *
 * The container stays `pointer-events-none` so only a plate's own box catches
 * anything: the arena is never covered by an invisible sheet, which is the
 * whole difference between a margin and a modal.
 */
export function ReadingColumn({
  label,
  testId,
  lit,
  children,
}: ReadingColumnProps) {
  return (
    <div
      role="region"
      aria-label={label}
      data-testid={testId}
      className={
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end md:inset-y-0 md:left-auto md:right-0 md:w-[min(27rem,32vw)] md:items-center " +
        FOOT_RESERVE
      }
    >
      <Page lit={lit} />
      <div className="w-full">{children}</div>
    </div>
  );
}
