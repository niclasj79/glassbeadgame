import { describe, expect, it } from "vitest";
import { toConceptId } from "@/domain/ids";
import { resolveSessionOutcomes } from "@/domain/outcomes";
import { buildSessionFixture } from "@/domain/outcomes/testing/buildSessionFixture";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { threadRegister } from "./threadRegister";

/**
 * GAP. The conclusion is the only place a whole web can be reviewed, and it
 * listed nothing the player had actually said. This is the register that fixes
 * it — and the assertions below are as much about what it must *not* become.
 */

const FIXTURE = buildSessionFixture({
  conceptIds: [
    toConceptId("measure.fibonacci-sequence"),
    toConceptId("sound.counterpoint"),
    toConceptId("measure.prime-numbers"),
    toConceptId("sound.polyrhythm"),
  ],
  threads: [
    {
      a: toConceptId("measure.fibonacci-sequence"),
      b: toConceptId("sound.counterpoint"),
      intention: "echo",
    },
    {
      a: toConceptId("measure.prime-numbers"),
      b: toConceptId("sound.polyrhythm"),
      intention: "tension",
    },
  ],
  concluded: true,
});

const register = () =>
  threadRegister(resolveSessionOutcomes(FIXTURE.state, castaliaLookup));

describe("the register of threads", () => {
  it("reads every thread back in the order it was woven", () => {
    const entries = register();
    expect(entries).toHaveLength(2);
    expect(entries[0].reading).toBe(
      "Fibonacci Sequence · Echo · Counterpoint"
    );
    expect(entries[1].reading).toBe("Prime Numbers · Tension · Polyrhythm");
  });

  it("carries the citations, so a documented claim can be checked (GAP-B4)", () => {
    const documented = register().filter((entry) => entry.kind === "documented");
    expect(documented.length).toBeGreaterThan(0);
    for (const entry of documented) {
      if (entry.citations.length === 0) continue;
      expect(entry.sourceLine).not.toBeNull();
      expect(entry.sourceLine).not.toMatch(/codex/i);
      expect(entry.sourceLine).toContain(String(entry.citations.length));
      for (const source of entry.citations) {
        // Verbatim from the register: an author, a title and a year, not an id.
        expect(source.citation.length).toBeGreaterThan(20);
        expect(source.citation).not.toContain(source.id);
      }
    }
  });

  it("states the standing in type, in the margin's own words", () => {
    for (const entry of register()) {
      expect(entry.standing.length).toBeGreaterThan(0);
      if (entry.interpretive) {
        // An interpretive relation may never be spoken of as a record.
        expect(entry.standing).not.toMatch(/record/i);
        expect(entry.standing).toContain("not a claim of influence");
      }
    }
  });

  it("is a record and not a scorecard", () => {
    for (const entry of register()) {
      expect(Object.keys(entry).sort()).toEqual([
        "aside",
        "body",
        "citations",
        "interpretive",
        "kind",
        "reading",
        "sourceLine",
        "standing",
        "threadId",
        "title",
      ]);
      // Not one number on an entry — no value, no strength, no ordinal. There
      // is nothing here to sum, to rank, or to beat next time (ADR-010).
      for (const value of Object.values(entry)) {
        expect(typeof value).not.toBe("number");
      }
    }
  });

  it("holds nothing at all for a session with no threads", () => {
    const empty = buildSessionFixture({
      conceptIds: [
        toConceptId("measure.fibonacci-sequence"),
        toConceptId("sound.counterpoint"),
      ],
      threads: [],
      concluded: true,
    });
    expect(
      threadRegister(resolveSessionOutcomes(empty.state, castaliaLookup))
    ).toEqual([]);
  });
});
