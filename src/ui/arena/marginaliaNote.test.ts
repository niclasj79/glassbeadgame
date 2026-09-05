import { describe, expect, it } from "vitest";
import { entranceMs, noteFor } from "./marginaliaNote";
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
      expect(note!.sourceLine).not.toMatch(/claim/);
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
    expect(documented!.sourceLine).toBe("2 sources for this claim");
    expect(documented!.interpretive).toBe(false);
    expect(documented!.standing).toContain("Documented");
  });

  /**
   * GAP-B4(2). The line used to read "N sources in the Codex". The Codex was
   * removed along with the title screen's entry point, `sources.ts` had exactly
   * one consumer in the whole application — this module, reading `.length` —
   * and no file rendered `source.citation` anywhere. The plate told a player to
   * go and check, in a place that does not exist.
   */
  it("sends nobody to a Codex, and carries the citations itself (GAP-B4)", () => {
    const note = noteFor(
      documentedCue(
        "established",
        "confirmed",
        relationFixture({ evidence: "established" })
      )
    )!;
    expect(note.sourceLine).not.toMatch(/codex/i);
    expect(note.citations.map((source) => source.id)).toEqual([
      "src.douady-couder-1992",
      "src.barbour-1951",
    ]);
    expect(note.citations[0].citation).toContain(
      "Phyllotaxis as a Physical Self-Organized Growth Process"
    );
    expect(note.citations[1].citation).toContain("Tuning and Temperament");
  });

  it("counts only the citations it can actually show", () => {
    const note = noteFor(
      documentedCue(
        "established",
        "confirmed",
        relationFixture({
          evidence: "established",
          sources: ["src.barbour-1951", "src.not-in-the-register"],
        })
      )
    )!;
    // The heading may never promise more evidence than the page prints.
    expect(note.citations).toHaveLength(1);
    expect(note.sourceLine).toBe("1 source for this claim");
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
    expect(note!.citations).toHaveLength(0);
  });

  it("gives an Open Thread the same entrance as a documented relation (CAV-006)", () => {
    const documented = noteFor(documentedCue("established"));
    const open = noteFor(openThreadCue());
    expect(entranceMs(open!)).toBe(entranceMs(documented!));
  });

  /**
   * GAP-B4(1). `dwellMs` was an *exit*: max(4200, seconds * 1000 + 3400), so a
   * plate carrying 88–139 measured words was removed after 5.1–7.4 s — between
   * 710 and 1630 words per minute — from a `pointer-events-none` surface with no
   * pin, no hover-hold and no re-open path anywhere in the game.
   *
   * Whatever timing this module hands the margin must therefore be short enough
   * that it can only be an entrance. Nothing here may ever be long enough to be
   * mistaken for a reading budget, because nothing may take the words away.
   */
  it("times the note's entrance, and never its exit (GAP-B4)", () => {
    for (const cue of [
      documentedCue("established"),
      documentedCue("interpretive"),
      openThreadCue(),
      unresolvedCue(),
      motifCue(),
    ]) {
      const note = noteFor(cue)!;
      expect(entranceMs(note)).toBeGreaterThan(0);
      expect(entranceMs(note)).toBeLessThanOrEqual(900);
    }
  });

  it("states epistemic standing in type for every outcome shape", () => {
    // Leads with what the thread is, never with what the record lacks
    // (Schell #5): the limit is still stated, after the standing.
    expect(noteFor(openThreadCue())!.standing).toMatch(/^Open thread/);
    expect(noteFor(openThreadCue())!.standing).toContain("nothing written settles it");
    expect(noteFor(unresolvedCue())!.standing).toBe(
      "Your reading alone · Castalia adds nothing here"
    );
    expect(noteFor(motifCue())).not.toBeNull();
  });

  it("writes nothing in the margin for a cue that is not an outcome", () => {
    expect(noteFor(wovenCue())).toBeNull();
  });
});
