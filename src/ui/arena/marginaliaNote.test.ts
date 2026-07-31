import { describe, expect, it } from "vitest";
import { dwellMs, noteFor } from "./marginaliaNote";
import {
  documentedCue,
  motifCue,
  openThreadCue,
  relationFixture,
  unresolvedCue,
  wovenCue,
} from "./testing/cueFixtures";

/**
 * The margin is the surface a sighted player reads an outcome on. What it may
 * and may not say about a relation is the content model, not styling.
 */
describe("the marginal note", () => {
  it("never lets an interpretive relation speak as a record (B5)", () => {
    for (const reception of ["confirmed", "refined", "complicated"] as const) {
      const note = noteFor(documentedCue("interpretive", reception));
      expect(note).not.toBeNull();
      expect(note!.interpretive).toBe(true);
      expect(note!.standing).toContain("not a claim of influence");
      // "the record" in any form is an authority this relation does not hold.
      expect(note!.standing).not.toMatch(/record/i);
      expect(note!.sourceLine).not.toMatch(/Codex/);
    }
  });

  it("names sources as evidence for the material when the relation is a reading", () => {
    const reading = noteFor(documentedCue("interpretive"));
    expect(reading!.sourceLine).toBe("2 sources for the material compared");

    const documented = noteFor(
      documentedCue(
        "established",
        "confirmed",
        relationFixture({ evidence: "established" })
      )
    );
    expect(documented!.sourceLine).toBe("2 sources in the Codex");
    expect(documented!.interpretive).toBe(false);
    expect(documented!.standing).toContain("Documented");
  });

  it("says nothing about sources when the pack cites none", () => {
    const note = noteFor(
      documentedCue(
        "established",
        "confirmed",
        relationFixture({ evidence: "established", sources: [] })
      )
    );
    expect(note!.sourceLine).toBeNull();
  });

  it("gives an Open Thread the same dwell as a documented relation (CAV-006)", () => {
    const documented = noteFor(documentedCue("established"));
    const open = noteFor(openThreadCue());
    expect(dwellMs(open!)).toBe(dwellMs(documented!));
  });

  it("states epistemic standing in type for every outcome shape", () => {
    expect(noteFor(openThreadCue())!.standing).toContain(
      "No documented relation here"
    );
    expect(noteFor(unresolvedCue())!.standing).toBe(
      "The Game is not asserting anything here"
    );
    expect(noteFor(motifCue())).not.toBeNull();
  });

  it("writes nothing in the margin for a cue that is not an outcome", () => {
    expect(noteFor(wovenCue())).toBeNull();
  });
});
