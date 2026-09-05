import { describe, expect, it } from "vitest";
import { planAttention, type PresentationCue } from "@/runtime/cues";
import { toConceptId } from "@/domain/ids";
import {
  EMPTY_MARGIN,
  MARGIN_KEPT,
  lastReading,
  openReading,
  pendingReading,
  receive,
  reopen,
  setAside,
  toggleIndex,
  type MarginState,
} from "./marginState";
import {
  documentedCue,
  motifCue,
  openThreadCue,
  unresolvedCue,
  wovenCue,
} from "./testing/cueFixtures";

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
