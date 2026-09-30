import { afterEach, describe, expect, it, vi } from "vitest";
import { toThreadId } from "@/domain/ids";
import { RELATION_INTENTIONS } from "@/domain/events";
import { castaliaConceptById } from "@/content/castalia";
import {
  GAP_HINT,
  GAP_HINT_DELAY_MS,
  NOTHING_SHARED,
  ROLE_LEAD,
  createGapHint,
  planColumn,
  readingLine,
  reopenWovenThread,
  wovenThreadLabel,
  type ColumnPlan,
} from "./columnPlan";
import {
  COUNTERPOINT,
  FIBONACCI,
  GOLDEN_PAIR,
  UNSHARED_PAIR,
  focusView,
  heldView,
  lockedView,
  readingView,
  roamingView,
} from "./testing/focusFixtures";

/**
 * THE COLUMN'S PLAN — every state of the focus view, with no DOM attached.
 *
 * The cards say only what `deriveFocusView` already decided they are about;
 * what this module adds is which authored concept each slot shows and how much
 * of it, which facets both beads carry, the one reading line, and what the
 * margin may write beneath the cards.
 */

type Slots = Extract<ColumnPlan, { kind: "slots" }>;

const slots = (plan: ColumnPlan): Slots => {
  if (plan.kind !== "slots") throw new Error(`expected slots, got ${plan.kind}`);
  return plan;
};

const plan = (
  view: Parameters<typeof planColumn>[0]["view"],
  pinnedInspectId: string | null = null,
  lensActive = false
): ColumnPlan => planColumn({ view, pinnedInspectId, lensActive });

describe("what the column holds in each state of the focus view", () => {
  it("holds nothing but the margin while roaming at rest", () => {
    const rest = slots(plan(roamingView()));
    expect(rest.top).toBeNull();
    expect(rest.second).toBeNull();
    expect(rest.shared).toBeNull();
    expect(rest.margin).toBe("page");
    expect(rest.stepBack).toBe(false);
  });

  it("opens a dwelt-on bead's card at the top while roaming, as a glance (I-015)", () => {
    const dwell = slots(plan(roamingView(FIBONACCI)));
    expect(dwell.top?.concept.id).toBe(String(FIBONACCI));
    expect(dwell.top?.role).toBe("dwell");
    expect(dwell.top?.detail).toBe("glance");
    // A glance holds the page while the look lasts, so the margin's reading
    // is not pushed down it and pulled back up; it is not closed either.
    expect(dwell.margin).toBe("none");
    // And it closes when the dwell ends — the view says so, not a timer here —
    // and the margin is back in place.
    const after = slots(plan(roamingView()));
    expect(after.top).toBeNull();
    expect(after.margin).toBe("page");
  });

  it("locks the attended card at the top and opens the gap beneath it (I-018)", () => {
    const focus = slots(plan(focusView(FIBONACCI)));
    expect(focus.mode).toBe("focus");
    expect(focus.top?.role).toBe("attended");
    expect(focus.top?.detail).toBe("compact");
    expect(focus.second).toBe("gap");
    // Nothing to compare yet, so nothing is lit and nothing is said.
    expect(focus.shared).toBeNull();
    // The column is about the pair now; the margin waits.
    expect(focus.margin).toBe("none");
    expect(focus.stepBack).toBe(true);
  });

  it("fills the gap with the sighted bead and lights what both carry", () => {
    const sighted = slots(plan(focusView(FIBONACCI, COUNTERPOINT)));
    expect(sighted.top?.concept.id).toBe(String(FIBONACCI));
    expect(sighted.second).not.toBe("gap");
    const second = sighted.second === "gap" ? null : sighted.second;
    expect(second?.role).toBe("sighted");
    expect(second?.concept.id).toBe(String(COUNTERPOINT));
    // Recursion is the one facet the golden pair shares (castalia concepts).
    expect(sighted.shared).toEqual(["recursion"]);
    for (const facet of sighted.shared ?? []) {
      expect(castaliaConceptById.get(String(FIBONACCI))?.facets).toContain(facet);
      expect(castaliaConceptById.get(String(COUNTERPOINT))?.facets).toContain(facet);
    }
  });

  it("says a pair shares nothing with an empty list, not with silence", () => {
    const [a, b] = UNSHARED_PAIR;
    const unshared = slots(plan(focusView(a, b)));
    expect(unshared.shared).toEqual([]);
    expect(slots(plan(lockedView(UNSHARED_PAIR))).shared).toEqual([]);
  });

  it("keeps both cards when the pair is locked, and names only the reading heard", () => {
    const locked = slots(plan(lockedView()));
    expect(locked.mode).toBe("locked");
    expect(locked.top?.role).toBe("attended");
    expect(locked.second === "gap" ? null : locked.second?.role).toBe("candidate");
    expect(locked.shared).toEqual(["recursion"]);
    // No reading is named until one is heard.
    expect(locked.reading).toBeNull();
    expect(slots(plan(lockedView(GOLDEN_PAIR, "tension"))).reading).toBe("tension");
    // A chosen reading is the one being heard.
    expect(slots(plan(readingView("ground"))).reading).toBe("ground");
  });

  it("holds a reopened thread: both beads, and the thread's own card (I-019)", () => {
    const held = slots(plan(heldView()));
    expect(held.mode).toBe("held");
    expect(held.top?.role).toBe("held");
    expect(held.second === "gap" ? null : held.second?.role).toBe("held");
    expect(held.shared).toEqual(["recursion"]);
    expect(held.margin).toBe("held");
    expect(held.reading).toBeNull();
    expect(held.stepBack).toBe(true);
  });

  it("is deterministic: the same view plans the same column", () => {
    expect(plan(focusView(FIBONACCI, COUNTERPOINT))).toEqual(
      plan(focusView(FIBONACCI, COUNTERPOINT))
    );
  });
});

const CASTALIA_ID_OUTSIDE_THE_PAIR = [...castaliaConceptById.keys()].find(
  (id) => id !== String(FIBONACCI) && id !== String(COUNTERPOINT)
)!;

describe("a card the player asked for by name", () => {
  it("wins over a dwell card (I-015)", () => {
    const pinned = plan(roamingView(FIBONACCI), String(COUNTERPOINT));
    expect(pinned.kind).toBe("inspection");
    expect(pinned.kind === "inspection" ? pinned.concept.id : null).toBe(
      String(COUNTERPOINT)
    );
  });

  it("opens in full where it stands when it is one of the pair", () => {
    const attended = slots(plan(lockedView(), String(FIBONACCI)));
    expect(attended.top?.detail).toBe("full");
    expect(attended.second === "gap" ? null : attended.second?.detail).toBe("compact");
    const second = slots(plan(focusView(FIBONACCI, COUNTERPOINT), String(COUNTERPOINT)));
    expect(second.second === "gap" ? null : second.second?.detail).toBe("full");
    // Still lit: opening a card does not unlight what the pair shares.
    expect(second.shared).toEqual(["recursion"]);
  });

  it("takes the column alone when it is any other bead", () => {
    const other = CASTALIA_ID_OUTSIDE_THE_PAIR;
    expect(plan(lockedView(), other).kind).toBe("inspection");
    expect(plan(heldView(), other).kind).toBe("inspection");
  });

  it("is not an inspection when the pack cannot resolve it", () => {
    expect(plan(roamingView(FIBONACCI), "no-such-bead").kind).toBe("slots");
  });
});

describe("the Lens", () => {
  it("silences the margin but still lets a bead be read", () => {
    const lens = slots(plan(roamingView(FIBONACCI), null, true));
    expect(lens.margin).toBe("none");
    expect(lens.top?.detail).toBe("glance");
  });
});

describe("the reading line", () => {
  it("names each reading in the words its sigil uses, and nothing else (I-007)", () => {
    expect(readingLine("echo")).toEqual({ glyph: "◌", text: "Echo — shares a form" });
    expect(readingLine("passage").text).toBe("Passage — carries or transforms");
    expect(readingLine("tension").text).toBe("Tension — opposes or complicates");
    expect(readingLine("ground").text).toBe("Ground — supports or embodies");
  });
});

/**
 * I-013: text only after hesitation. The gap asks for a second bead by its
 * shape; its one line waits three seconds of the gap standing open, and never
 * appears sooner.
 */
describe("the gap's one line, on the gap's own clock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("appears after three seconds of an open gap, and not a moment sooner", () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const hint = createGapHint((shown) => changes.push(shown));
    hint.observe(String(FIBONACCI));
    vi.advanceTimersByTime(GAP_HINT_DELAY_MS - 1);
    expect(hint.shown()).toBe(false);
    expect(changes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(hint.shown()).toBe(true);
    expect(changes).toEqual([true]);
  });

  it("goes the moment a bead fills the gap, and starts again from nothing", () => {
    vi.useFakeTimers();
    const hint = createGapHint(() => undefined);
    hint.observe(String(FIBONACCI));
    vi.advanceTimersByTime(GAP_HINT_DELAY_MS);
    expect(hint.shown()).toBe(true);
    // A sighting fills the gap.
    hint.observe(null);
    expect(hint.shown()).toBe(false);
    // The lens moves off again: a sweep is looking, not hesitating.
    hint.observe(String(FIBONACCI));
    vi.advanceTimersByTime(GAP_HINT_DELAY_MS - 1);
    expect(hint.shown()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(hint.shown()).toBe(true);
  });

  it("restarts for a newly attended bead, and a sighting before three seconds keeps it silent", () => {
    vi.useFakeTimers();
    const hint = createGapHint(() => undefined);
    hint.observe(String(FIBONACCI));
    vi.advanceTimersByTime(2000);
    hint.observe(String(COUNTERPOINT));
    vi.advanceTimersByTime(2000);
    expect(hint.shown()).toBe(false);
    hint.observe(null);
    vi.advanceTimersByTime(GAP_HINT_DELAY_MS * 3);
    expect(hint.shown()).toBe(false);
  });

  it("leaves no timer behind when the column goes", () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const hint = createGapHint((shown) => changes.push(shown));
    hint.observe(String(FIBONACCI));
    hint.dispose();
    vi.advanceTimersByTime(GAP_HINT_DELAY_MS * 2);
    expect(changes).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("the mirror's list of woven threads", () => {
  it("names the reading as the player composed it (I-019)", () => {
    expect(wovenThreadLabel({ pair: GOLDEN_PAIR, intention: "echo" })).toBe(
      "Fibonacci Sequence · Echo · Counterpoint"
    );
    // In the direction the player drew it.
    expect(
      wovenThreadLabel({ pair: [COUNTERPOINT, FIBONACCI], intention: "tension" })
    ).toBe("Counterpoint · Tension · Fibonacci Sequence");
  });

  it("reopens the thread it names, unless a weave is being held", () => {
    const reopened: string[] = [];
    const idle = {
      isHolding: () => false,
      reopenThread: (threadId: ReturnType<typeof toThreadId>) => {
        reopened.push(String(threadId));
      },
    };
    reopenWovenThread(idle, toThreadId("thread:1:s:1"));
    expect(reopened).toEqual(["thread:1:s:1"]);
    reopenWovenThread({ ...idle, isHolding: () => true }, toThreadId("thread:2:s:1"));
    expect(reopened).toEqual(["thread:1:s:1"]);
  });
});

/**
 * THE COLUMN'S OWN WORDS. Nothing here may count, score, rank, correct, or say
 * "documented" — the column speaks before any commit, when nothing about the
 * record may be known (I-018, CAV-004, spec §19).
 */
describe("the column's copy", () => {
  const FORBIDDEN =
    /\d|%|\bscore|\bpoints?\b|\brank|\bwrong\b|\bcorrect|\bdocumented\b|\bresonan|\blikely\b|\brecommend/i;

  it("never numbers, scores, ranks or anticipates the record", () => {
    const copy = [
      GAP_HINT,
      NOTHING_SHARED,
      ...Object.values(ROLE_LEAD),
      ...RELATION_INTENTIONS.map((intention) => readingLine(intention).text),
      wovenThreadLabel({ pair: GOLDEN_PAIR, intention: "echo" }),
    ];
    for (const line of copy) expect(line).not.toMatch(FORBIDDEN);
  });

  it("uses the accepted words", () => {
    expect(GAP_HINT).toBe("Find a second bead.");
    expect(NOTHING_SHARED).toBe("These two share no facet Castalia knows.");
    expect(GAP_HINT_DELAY_MS).toBe(3000);
  });
});
