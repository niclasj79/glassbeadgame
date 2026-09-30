import { describe, expect, it } from "vitest";
import {
  planAttention,
  planAttentionCleared,
  planAttunement,
  planPairLocked,
  planReadingPreviewed,
  planSighting,
  type PresentationCue,
} from "@/runtime/cues";
import { toConceptId, toEventId, toThreadId } from "@/domain/ids";
import { toFacetId } from "@/content/castalia/schema";
import {
  EMPTY_MARGIN,
  MARGIN_KEPT,
  RESUMES_COMPOSING,
  isExpanded,
  lastReading,
  leaveHeld,
  openReading,
  pendingReading,
  readLess,
  readMore,
  readingOfThread,
  receive,
  reopen,
  reopenThread,
  setAside,
  toggleIndex,
  type MarginState,
} from "./marginState";
import type { Note } from "./marginaliaNote";
import {
  documentedCue,
  motifCue,
  openThreadCue,
  unresolvedCue,
  wovenCue,
} from "./testing/cueFixtures";
import { GOLDEN_PAIR, reopenedCue } from "./testing/focusFixtures";

/**
 * GAP-B4(1). The margin used to remove a note on a timer 5.1–7.4 s after it
 * arrived, from a surface that could not be pointed at, with no history and no
 * way back. These are the rules that replaced the timer.
 *
 * The module deliberately takes no clock, so the invariant "nothing removes a
 * reading but the player" is a property of the type signature and not of a
 * carefully chosen delay.
 */

const attentionCue = () =>
  planAttention(
    { conceptId: toConceptId("measure.prime-numbers"), candidates: [] },
    null
  ).cues[0];

const withOne = (): MarginState =>
  receive(EMPTY_MARGIN, documentedCue("established"));

/** A distinct cue id, so a loop can stage more readings than the margin keeps. */
const renamed = (cue: PresentationCue, id: string): PresentationCue =>
  ({ ...cue, id }) as PresentationCue;

describe("what the margin keeps", () => {
  it("writes an outcome into the margin and keeps it there", () => {
    const state = withOne();
    expect(openReading(state)!.title).toBe("The Most Rational and the Least");
    expect(state.readings).toHaveLength(1);
  });

  it("hands a reading to no one who could take it away", () => {
    // There is no argument — elapsed time, frame count, tick — that closes a
    // reading. The only closers are the three below, and every one of them is
    // something the player did.
    const state = withOne();
    expect(openReading(receive(state, wovenCue()))).toBeNull();
    expect(openReading(setAside(state))).toBeNull();
    expect(openReading(receive(state, openThreadCue()))!.kind).toBe("open");
    expect(openReading(state)).not.toBeNull();
  });

  it("steps out of the way when the player begins another interpretation", () => {
    const state = receive(withOne(), attentionCue());
    expect(openReading(state)).toBeNull();
    // Cleared from the page, not discarded: the way back is still there.
    expect(state.readings).toHaveLength(1);
    expect(lastReading(state)!.title).toBe("The Most Rational and the Least");
  });

  it("re-opens a reading the player set aside (GAP-B4)", () => {
    const aside = setAside(withOne());
    const back = reopen(aside, lastReading(aside)!.id);
    expect(openReading(back)!.title).toBe("The Most Rational and the Least");
  });

  it("re-opens an earlier reading, not only the last one", () => {
    const first = withOne();
    const firstId = lastReading(first)!.id;
    const second = receive(first, openThreadCue());
    expect(second.readings).toHaveLength(2);
    expect(openReading(reopen(second, firstId))!.kind).toBe("documented");
  });

  it("refuses to open a reading this session never made", () => {
    const state = withOne();
    expect(reopen(state, "cue:nothing:0")).toBe(state);
  });

  it("does not enter the same reading twice under replay", () => {
    const twice = receive(withOne(), documentedCue("established"));
    expect(twice.readings).toHaveLength(1);
  });

  it("keeps a bounded history, oldest falling off the front", () => {
    let state = EMPTY_MARGIN;
    for (let index = 0; index < MARGIN_KEPT + 4; index += 1) {
      const cue = documentedCue("established");
      state = receive(state, renamed(cue, `${cue.id}:${index}`));
    }
    expect(state.readings).toHaveLength(MARGIN_KEPT);
    expect(state.readings[state.readings.length - 1].id).toMatch(
      new RegExp(`:${MARGIN_KEPT + 3}$`)
    );
  });

  it("opens the index only when there is something in it", () => {
    expect(toggleIndex(EMPTY_MARGIN)).toBe(EMPTY_MARGIN);
    expect(toggleIndex(withOne()).indexOpen).toBe(true);
  });

  it("ignores a cue the margin has nothing to say about", () => {
    const state = withOne();
    expect(receive(state, unresolvedCue()).readings).toHaveLength(2);
    expect(receive(EMPTY_MARGIN, wovenCue())).toBe(EMPTY_MARGIN);
  });
});

/**
 * A motif is staged after the outcome of the commit that completed it, so it
 * arrives while the player is reading that outcome. It must not take the page
 * — that was the timer's defect in a new coat — and it must not be lost to the
 * index either, which is what happened to the Bridge in the recorded playtest.
 */
describe("a motif that arrives over an open reading", () => {
  it("waits rather than taking the page", () => {
    const reading = withOne();
    const state = receive(reading, motifCue());
    expect(openReading(state)?.id).toBe(openReading(reading)?.id);
    expect(pendingReading(state)?.kind).toBe("motif");
    expect(state.readings.map((note) => note.kind)).toEqual(["documented", "motif"]);
  });

  it("opens the moment the reading it waited under is set aside", () => {
    const state = setAside(receive(withOne(), motifCue()));
    expect(openReading(state)?.kind).toBe("motif");
    expect(pendingReading(state)).toBeNull();
  });

  it("can be read at once from under the open reading", () => {
    const waiting = receive(withOne(), motifCue());
    const state = reopen(waiting, pendingReading(waiting)!.id);
    expect(openReading(state)?.kind).toBe("motif");
    expect(pendingReading(state)).toBeNull();
  });

  it("keeps waiting while the player composes, and through the next outcome", () => {
    const waiting = receive(withOne(), motifCue());
    const composing = receive(waiting, wovenCue());
    expect(openReading(composing)).toBeNull();
    expect(pendingReading(composing)?.kind).toBe("motif");
    const next = receive(composing, renamed(documentedCue("established"), "cue:next"));
    expect(openReading(next)?.id).toBe("cue:next");
    expect(pendingReading(next)?.kind).toBe("motif");
  });

  it("takes the page when nothing is open to be taken away", () => {
    const state = receive(EMPTY_MARGIN, motifCue());
    expect(openReading(state)?.kind).toBe("motif");
    expect(pendingReading(state)).toBeNull();
  });
});

const withDocumented = (): MarginState =>
  receive(EMPTY_MARGIN, documentedCue("established"));

/** A reading of another thread, arriving after the first. */
const otherThreadOutcome = (): PresentationCue => {
  const cue = unresolvedCue();
  if (cue.type !== "outcome.unresolved") throw new Error("fixture drifted");
  return {
    ...cue,
    id: "cue:other:outcome.unresolved:1",
    payload: { ...cue.payload, threadId: toThreadId("thread:2:s:1") },
  };
};

const recovered = (threadId: string): Note => ({
  kind: "unresolved",
  title: "An unlit thread",
  body: "Nothing is grounded here yet.",
  aside: null,
  standing: "Your reading alone · Castalia adds nothing here",
  interpretive: false,
  sourceLine: null,
  citations: [],
  id: `thread-reading:${threadId}`,
  seconds: 0,
  threadId,
});

/**
 * I-018: after a weave the thread card stays until the player's next act —
 * and looking is not an act. Nothing the lens, a hovered sigil, a released
 * attention, or the world's own answers publish may close it.
 */
describe("the thread card stays until the player's next act", () => {
  it("is not closed by looking, hearing, or the world answering", () => {
    const state = withDocumented();
    const looking: readonly PresentationCue[] = [
      planSighting({
        attendedConceptId: GOLDEN_PAIR[0],
        sighted: {
          conceptId: GOLDEN_PAIR[1],
          band: "high",
          sharedFacets: [toFacetId("recursion")],
        },
      }).cues[0],
      planReadingPreviewed({ pair: GOLDEN_PAIR, intention: "echo", chosen: false }).cues[0],
      planAttentionCleared().cues[0],
      planAttunement({ active: true }, toEventId("event:9")).cues[0],
    ];
    for (const cue of looking) {
      expect(openReading(receive(state, cue))?.id).toBe(openReading(state)?.id);
    }
  });

  it("is closed by attending, locking or weaving — the player's next act", () => {
    expect([...RESUMES_COMPOSING].sort()).toEqual(
      ["attention.enter", "pair.locked", "thread.woven"].sort()
    );
    const locked = planPairLocked({ pair: GOLDEN_PAIR, sharedFacets: [] }).cues[0];
    expect(openReading(receive(withDocumented(), locked))).toBeNull();
    expect(openReading(receive(withDocumented(), wovenCue()))).toBeNull();
  });
});

describe("'Read more'", () => {
  it("opens the second layer of the reading on the page", () => {
    const state = withDocumented();
    expect(isExpanded(state)).toBe(false);
    const more = readMore(state);
    expect(isExpanded(more)).toBe(true);
    expect(readMore(more)).toBe(more);
    // Nothing to expand on an empty page.
    expect(readMore(EMPTY_MARGIN)).toBe(EMPTY_MARGIN);
  });

  it("closes the second layer again without closing the reading", () => {
    const more = readMore(withDocumented());
    const less = readLess(more);
    expect(isExpanded(less)).toBe(false);
    expect(openReading(less)?.id).toBe(openReading(more)?.id);
    expect(readLess(less)).toBe(less);
  });

  it("starts every new page on its first layer", () => {
    const more = readMore(withDocumented());
    expect(isExpanded(receive(more, openThreadCue()))).toBe(false);
    expect(isExpanded(setAside(more))).toBe(false);
    expect(isExpanded(receive(more, wovenCue()))).toBe(false);
    // Re-opening the same page keeps the layer the player had it on.
    expect(isExpanded(reopen(more, openReading(more)!.id))).toBe(true);
  });
});

/**
 * I-019. Reopening a committed thread returns to the focus view held on that
 * pair, with the thread's own card; leaving returns to roaming. Reading it
 * changes nothing durable, and nothing kept is lost.
 */
describe("a reopened thread's reading", () => {
  it("finds the kept reading of the thread and puts it on the page", () => {
    const aside = setAside(withDocumented());
    expect(openReading(aside)).toBeNull();
    const held = receive(aside, reopenedCue());
    expect(openReading(held)?.threadId).toBe("thread:1:s:1");
    expect(held.heldId).toBe(openReading(held)?.id);
    // Found, not duplicated.
    expect(held.readings).toHaveLength(1);
  });

  it("takes the page from another thread's reading", () => {
    const two = receive(withDocumented(), otherThreadOutcome());
    expect(openReading(two)?.threadId).toBe("thread:2:s:1");
    const held = receive(two, reopenedCue());
    expect(openReading(held)?.threadId).toBe("thread:1:s:1");
    expect(readingOfThread(held, "thread:2:s:1")?.threadId).toBe("thread:2:s:1");
  });

  it("sets exactly that reading aside when the reopened view is left", () => {
    const held = receive(setAside(withDocumented()), reopenedCue());
    const left = receive(held, planAttentionCleared().cues[0]);
    expect(openReading(left)).toBeNull();
    expect(left.heldId).toBeNull();
    // Still kept, still re-openable.
    expect(lastReading(left)?.threadId).toBe("thread:1:s:1");
    expect(leaveHeld(left)).toBe(left);
  });

  it("leaves a reading the player opened since in place", () => {
    const two = receive(withDocumented(), otherThreadOutcome());
    const held = receive(two, reopenedCue());
    const other = reopen(held, readingOfThread(held, "thread:2:s:1")!.id);
    const left = receive(other, planAttentionCleared().cues[0]);
    expect(openReading(left)?.threadId).toBe("thread:2:s:1");
    expect(left.heldId).toBeNull();
  });

  it("ends with the player's next act like any reading", () => {
    const held = receive(setAside(withDocumented()), reopenedCue());
    const composing = receive(
      held,
      planAttention({ conceptId: GOLDEN_PAIR[0], candidates: [] }, null).cues[0]
    );
    expect(openReading(composing)).toBeNull();
    expect(composing.heldId).toBeNull();
  });

  it("rebuilds a reading the margin no longer keeps, from the log", () => {
    const held = reopenThread(EMPTY_MARGIN, "thread:7:s:1", recovered);
    expect(openReading(held)?.threadId).toBe("thread:7:s:1");
    expect(held.heldId).toBe("thread-reading:thread:7:s:1");
    expect(held.readings).toHaveLength(1);
    // Asked only when nothing is kept: a kept reading always wins.
    let asked = 0;
    receive(setAside(withDocumented()), reopenedCue(), (threadId) => {
      asked += 1;
      return recovered(threadId);
    });
    expect(asked).toBe(0);
  });

  it("clears the page rather than show another thread's reading under this pair", () => {
    const open = withDocumented();
    const nothing = reopenThread(open, "thread:7:s:1", () => null);
    expect(openReading(nothing)).toBeNull();
    expect(nothing.readings).toHaveLength(1);
    const wrong = reopenThread(open, "thread:7:s:1", () => recovered("thread:8:s:1"));
    expect(openReading(wrong)).toBeNull();
    expect(wrong.readings).toHaveLength(1);
  });

  it("finds a thread's latest reading, keyed by thread rather than by cue", () => {
    const again = receive(withDocumented(), {
      ...documentedCue("established"),
      id: "cue:replayed:outcome.documented:1",
    });
    expect(readingOfThread(again, "thread:1:s:1")?.id).toBe(
      "cue:replayed:outcome.documented:1"
    );
    expect(readingOfThread(again, "thread:9:s:1")).toBeNull();
  });
});
