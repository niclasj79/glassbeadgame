import { describe, expect, it } from "vitest";
import type { SessionStateV1 } from "@/domain/model";
import { standingOf, threadStandings } from "./threadStanding";

type Outcome = SessionStateV1["outcomes"][number];

const documented = (threadId: string): Outcome =>
  ({
    type: "documented-relation",
    threadId,
    eventId: `event:${threadId}`,
    documentedRelationId: "rel.fibonacci-counterpoint",
    sequence: 1,
  }) as unknown as Outcome;

const open = (threadId: string): Outcome =>
  ({
    type: "open-thread",
    threadId,
    eventId: `event:${threadId}`,
    openThreadId: `open:${threadId}`,
    sequence: 2,
  }) as unknown as Outcome;

/**
 * Schell #7. An unresolved thread used to be drawn exactly like an Open
 * Thread, so the world could not show the difference between "the Game asks a
 * question here" and "the Game has nothing to add here". These are the three
 * standings the ribbon reads, and the rule that nothing else decides them.
 */
describe("threadStandings", () => {
  it("closes and lights a thread the record answered", () => {
    const standings = threadStandings([documented("t1")]);
    expect(standingOf(standings, "t1")).toEqual({ closed: true, lit: true });
  });

  it("lights an Open Thread without closing it", () => {
    const standings = threadStandings([open("t2")]);
    expect(standingOf(standings, "t2")).toEqual({ closed: false, lit: true });
  });

  it("leaves a thread with no outcome open and unlit", () => {
    const standings = threadStandings([documented("t1"), open("t2")]);
    expect(standingOf(standings, "t3")).toEqual({ closed: false, lit: false });
  });

  it("reads the log alone, so a replayed session draws what the live one drew", () => {
    const outcomes = [documented("t1"), open("t2")];
    const first = threadStandings(outcomes);
    const again = threadStandings([...outcomes]);
    for (const id of ["t1", "t2", "t3"]) {
      expect(standingOf(again, id)).toEqual(standingOf(first, id));
    }
  });
});
