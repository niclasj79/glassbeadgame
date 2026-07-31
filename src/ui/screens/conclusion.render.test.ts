import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { buildAnnotation } from "@/domain/annotation";
import { toConceptId } from "@/domain/ids";
import { resolveSessionOutcomes } from "@/domain/outcomes";
import { buildSessionFixture } from "@/domain/outcomes/testing/buildSessionFixture";
import { buildPortrait } from "@/domain/portrait";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { installMotionDomStubs } from "../testing/domStubs";
import { ConclusionReading } from "./ConclusionScreen";
import { threadRegister } from "./threadRegister";

/**
 * THE LAST IMAGE THE GAME LEAVES.
 *
 * On a 1440x810 desktop the plate was cut mid-heading at the viewport edge and
 * nothing on the page said so — the panel scrolled, but a 6px hairline
 * scrollbar the platform may not draw is not an affordance. And the single flat
 * veil behind it was sheer enough that a bloomed bead, the gold armillary and a
 * troika bead label all read through the middle of a sentence.
 *
 * Rendered statically from a real replayed session, so the assertions are about
 * what the page *is* — where the ground is, whether the region can be reached
 * from a keyboard, whether the continuation is stated — rather than about a
 * particular viewport height.
 *
 * `ConclusionReading` rather than `ConclusionScreen`: zustand serves a store's
 * *initial* state as its server snapshot, so a store-connected shell renders
 * null under `renderToStaticMarkup` no matter what has been loaded. The shell
 * is three lines of plumbing over this component.
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

let html = "";

describe("the conclusion", () => {
  beforeAll(() => {
    installMotionDomStubs();
    html = renderToStaticMarkup(
      createElement(ConclusionReading, {
        portrait: buildPortrait(FIXTURE.state, castaliaLookup),
        annotation: buildAnnotation(FIXTURE.state, castaliaLookup),
        threadCount: FIXTURE.state.threads.length,
        threads: threadRegister(
          resolveSessionOutcomes(FIXTURE.state, castaliaLookup)
        ),
        onAnother: () => undefined,
        onLeave: () => undefined,
      })
    );
  });

  it("reads against ground, not against the arena (B3)", () => {
    // The veil is cut to the text column rather than turned up everywhere, so
    // the arena stays present in the margins and cannot reach the type.
    const scrim = /<div [^>]*data-testid="conclusion-column-scrim"[^>]*>/.exec(
      html
    );
    expect(scrim).not.toBeNull();
    expect(scrim![0]).toMatch(/linear-gradient/);
    expect(scrim![0]).toMatch(/var\(--void\)\s*\/\s*0\.9/);
  });

  it("says when the reading continues past the bottom edge (B3)", () => {
    expect(html).toContain('data-testid="reading-scroller-below"');
    // Stated in type as well as drawn as a fade: a gradient alone is one
    // channel, and one channel is how this got missed the first time.
    expect(html).toContain("The reading continues");
  });

  it("can be scrolled from a keyboard", () => {
    const region = /<div [^>]*data-testid="reading-scroller"[^>]*>/.exec(html);
    expect(region).not.toBeNull();
    expect(region![0]).toContain('role="region"');
    expect(region![0]).toContain('tabindex="0"');
    expect(region![0]).toContain("overflow-y-auto");
    expect(region![0]).toMatch(/aria-label="[^"]+"/);
  });

  it("leaves no line permanently under the fade", () => {
    expect(html).toMatch(/class="pb-28"/);
  });

  it("still shows the reading it was given", () => {
    expect(html).toContain("The Game concludes");
    expect(html).toContain("six readings, no total");
    expect(html).toContain("Coherence");
  });

  /**
   * GAP. Six readings and a five-sentence annotation described the shape of the
   * session without naming one thing in it. With the margin's note gone the
   * moment play resumed, a player had nowhere left to re-read what they said.
   */
  it("lists the threads the player actually made (GAP)", () => {
    expect(html).toContain('data-testid="thread-register"');
    expect(html).toContain("The threads, in the order you wove them");
    expect(html).toContain("Fibonacci Sequence · Echo · Counterpoint");
    expect(html).toContain("Prime Numbers · Tension · Polyrhythm");
  });

  /**
   * GAP-B4(2). `sources.ts` says the citation "is shown verbatim in the Codex
   * so the player can go and check it". There is no Codex, and until this pass
   * no file in the application rendered `source.citation` at all.
   */
  it("shows the citations, and points at no Codex (GAP-B4)", () => {
    expect(html).toContain('data-testid="citations"');
    expect(html).toMatch(/\d sources? for this claim/);
    expect(html).toContain("Music Analysis 2/1 (March 1983)");
    expect(html).not.toMatch(/codex/i);
  });

  /**
   * A list of what you said is a record, not a reward — but only if every entry
   * is set the same way. The instant one thread is given a mark another is not,
   * the register becomes something to do better at next time (ADR-010).
   */
  it("sets every thread at the same weight (CAV-006)", () => {
    const entries = [
      ...html.matchAll(/<li [^>]*data-testid="thread-reading"[^>]*>/g),
    ].map((match) => /class="([^"]*)"/.exec(match[0])![1]);
    expect(entries).toHaveLength(2);
    expect(new Set(entries).size).toBe(1);
    // No ordinal, no total, no per-thread number of any kind.
    expect(html).not.toMatch(/thread-reading[^>]*>\s*<[^>]*>\s*\d+\s*\./);
  });
});
