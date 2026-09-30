import { describe, expect, it } from "vitest";
import { toEventId, toThreadId } from "@/domain/ids";
import { resolveThreadOutcome } from "@/domain/outcomes";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { threadRegister } from "../screens/threadRegister";
import {
  entranceMs,
  firstSentence,
  noteFor,
  noteForOutcome,
  noteLayers,
} from "./marginaliaNote";
import {
  documentedCue,
  motifCue,
  openThreadCue,
  relationFixture,
  unresolvedCue,
  wovenCue,
} from "./testing/cueFixtures";
import { GOLDEN_PAIR, UNSHARED_PAIR } from "./testing/focusFixtures";

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

  it("remembers which thread each outcome answers, and a motif none (I-019)", () => {
    for (const cue of [documentedCue("established"), openThreadCue(), unresolvedCue()]) {
      expect(noteFor(cue)!.threadId).toBe("thread:1:s:1");
    }
    // A motif belongs to several threads and to none of them alone.
    expect(noteFor(motifCue())!.threadId).toBeNull();
  });
});

/**
 * The thread card leads with one sentence of the insight (I-018). The pack's
 * insights are dense with what fools a naive splitter — dates, "c.", Roman
 * numerals, initials — so the rule is proved against every one of them.
 */
describe("one sentence of an insight", () => {
  it("stops at the first full stop that begins a new sentence", () => {
    expect(firstSentence("Both use proportion. One locks and one never does.")).toBe(
      "Both use proportion."
    );
    expect(firstSentence("Is it heard? Or only counted?")).toBe("Is it heard?");
  });

  it("does not stop at an abbreviation, an initial, or a date", () => {
    expect(firstSentence("Codified c. 1300 in motets. Then it spread.")).toBe(
      "Codified c. 1300 in motets."
    );
    expect(firstSentence("J. S. Bach wrote canons at every interval. Few did.")).toBe(
      "J. S. Bach wrote canons at every interval."
    );
    expect(firstSentence("It was known (e.g. to Kepler) early. Later too.")).toBe(
      "It was known (e.g. to Kepler) early."
    );
  });

  it("returns a single sentence whole rather than cutting it", () => {
    expect(firstSentence("  Nothing here ends early  ")).toBe("Nothing here ends early");
  });

  it("finds a whole first sentence in every authored insight", () => {
    for (const relation of CASTALIA_RELATIONS) {
      const insight = relation.insight.trim();
      const sentence = firstSentence(insight);
      expect(insight.startsWith(sentence)).toBe(true);
      expect(sentence).toMatch(/[.!?…]["'”’)\]]*$/);
      // Long enough to be a sentence, not a fragment cut at an abbreviation.
      expect(sentence.split(/\s+/).length).toBeGreaterThanOrEqual(8);
      // And what follows begins a sentence of its own.
      const rest = insight.slice(sentence.length).trimStart();
      if (rest.length > 0) expect(rest).toMatch(/^["'“‘(]?[A-Z0-9À-Þ]/);
    }
  });
});

describe("the thread card's two layers (I-018)", () => {
  const INSIGHT = "Proportion runs through both. One uses it to lock, the other never to lock.";

  it("leads a documented relation with its title, evidence line and one sentence", () => {
    const note = noteFor(
      documentedCue(
        "established",
        "confirmed",
        relationFixture({ evidence: "established", insight: INSIGHT })
      )
    )!;
    const { first, more } = noteLayers(note);
    expect(more).toBe(true);
    expect(first.title).toBe(note.title);
    // The standing is never "more": it says what kind of claim this is.
    expect(first.standing).toBe(note.standing);
    expect(first.body).toBe("Proportion runs through both.");
    expect(first.aside).toBeNull();
    expect(first.sourceLine).toBeNull();
    expect(first.citations).toHaveLength(0);
    // The note itself still carries everything, for the second layer.
    expect(note.body).toBe(INSIGHT);
    expect(note.aside).not.toBeNull();
    expect(note.citations).toHaveLength(2);
  });

  it("has nothing more to give when one sentence is all there is", () => {
    const note = noteFor(
      documentedCue(
        "established",
        "confirmed",
        relationFixture({
          evidence: "established",
          insight: "Proportion runs through both.",
          counterpoint: undefined,
          sources: [],
        })
      )
    )!;
    expect(noteLayers(note).more).toBe(false);
  });

  it("gives an Open Thread its whole question and an unlit thread its whole statement", () => {
    for (const cue of [openThreadCue(), unresolvedCue(), motifCue()]) {
      const note = noteFor(cue)!;
      const { first, more } = noteLayers(note);
      expect(more).toBe(false);
      expect(first).toBe(note);
    }
  });
});

describe("a thread's reading rebuilt from the log (I-019)", () => {
  const thread = (pair: typeof GOLDEN_PAIR) =>
    Object.freeze({
      id: toThreadId("thread:3:s:1"),
      pair,
      intention: "echo" as const,
      gesture: Object.freeze({ inputModality: "mouse" as const }),
      eventId: toEventId("event:3"),
      sequence: 3,
      committedAt: 0,
    });

  it("says exactly what the conclusion's register says of the same thread", () => {
    for (const pair of [GOLDEN_PAIR, UNSHARED_PAIR]) {
      const outcome = resolveThreadOutcome(thread(pair), castaliaLookup);
      const note = noteForOutcome(outcome);
      const [entry] = threadRegister([outcome]);
      expect(note.threadId).toBe("thread:3:s:1");
      expect(note.id).toBe("thread-reading:thread:3:s:1");
      expect(note.kind).toBe(entry.kind);
      expect(note.title).toBe(entry.title);
      expect(note.body).toBe(entry.body);
      expect(note.standing).toBe(entry.standing);
      expect(note.citations).toEqual(entry.citations);
      // Nothing of the register's own row label leaks into the note.
      expect(Object.keys(note)).not.toContain("reading");
    }
  });
});
