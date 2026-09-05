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
import type { RevealState } from "./conclusionReveal";
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

const PORTRAIT = buildPortrait(FIXTURE.state, castaliaLookup);
const ANNOTATION = buildAnnotation(FIXTURE.state, castaliaLookup);
const THREADS = threadRegister(
  resolveSessionOutcomes(FIXTURE.state, castaliaLookup)
);

const render = (
  reveal: RevealState | null,
  onTakeWhole?: () => void
): string =>
  renderToStaticMarkup(
    createElement(ConclusionReading, {
      portrait: PORTRAIT,
      annotation: ANNOTATION,
      threadCount: FIXTURE.state.threads.length,
      threads: THREADS,
      reveal,
      onTakeWhole,
      onAnother: () => undefined,
      onLeave: () => undefined,
    })
  );

let html = "";

describe("the conclusion", () => {
  beforeAll(() => {
    installMotionDomStubs();
    html = render(null);
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
    expect(html).toContain("seven readings, no total");
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

  /**
   * GAP-14. Six filled arcs struck at one radius on one shared circular track
   * are a comparable scale however the header disclaims one: the eye reads six
   * values against each other and ranks them, which is exactly the
   * cross-dimension comparison `Portrait` carries no total in order to prevent.
   * The phrases and the evidence lines are the reading; the gauge was a picture
   * of a number.
   */
  it("draws no dial, and keeps the evidence (GAP-14)", () => {
    const readings = [
      ...html.matchAll(/<div [^>]*data-testid="portrait-reading"[^>]*>/g),
    ].map((match) => /class="([^"]*)"/.exec(match[0])![1]);
    expect(readings).toHaveLength(PORTRAIT.dimensions.length);
    // Set identically, like the register's entries: no dimension is drawn
    // larger, fuller, or further along anything than another.
    expect(new Set(readings).size).toBe(1);

    // The arc and its track. Nothing on this plate may draw either again.
    expect(html).not.toMatch(/stroke-dasharray/i);
    expect(html).not.toMatch(/<circle/i);

    // The evidence survives, verbatim and checkable.
    for (const dimension of PORTRAIT.dimensions) {
      expect(html).toContain(dimension.phrase);
      for (const line of dimension.evidence) expect(html).toContain(line);
    }
    expect(PORTRAIT.dimensions.some((d) => d.evidence.length > 0)).toBe(true);
  });

  /**
   * GAP-4. The reading is assembled by the compiled performance rather than
   * stamped complete at t = 0, so a partial state has to render a partial page
   * — the first thread on the glass, the second still to come, and the web not
   * yet characterised.
   */
  it("writes only what the performance has reached (GAP-4)", () => {
    const partial: RevealState = {
      sentences: 1,
      threads: 1,
      readings: 0,
      closed: false,
    };
    const page = render(partial, () => undefined);
    expect(page).toContain("Fibonacci Sequence · Echo · Counterpoint");
    expect(page).not.toContain("Prime Numbers · Tension · Polyrhythm");
    expect(page).toContain(ANNOTATION.sentences[0]);
    expect(page).not.toContain(ANNOTATION.sentences[1]);
    expect(page).not.toContain('data-testid="portrait-reading"');
    expect(page).not.toContain("seven readings, no total");
    // One line per compiled entry, never a hole waiting to be filled.
    expect([...page.matchAll(/data-testid="thread-reading"/g)]).toHaveLength(1);
  });

  /**
   * GAP-4, the other half: a reading that assembles over its own performance
   * must never become a cutscene. The way out stands from the first frame, and
   * the whole reading is one control away for as long as there is more to come.
   */
  it("never withholds the way out while it is still being written (GAP-4)", () => {
    const partial: RevealState = {
      sentences: 0,
      threads: 0,
      readings: 0,
      closed: false,
    };
    const page = render(partial, () => undefined);
    expect(page).toContain("Another Game");
    expect(page).toContain("Leave");
    expect(page).toContain('data-testid="conclusion-take-whole"');

    // And it stops offering it once there is nothing left to skip.
    expect(html).not.toContain('data-testid="conclusion-take-whole"');
    expect(html).toContain("Another Game");
    expect(html).toContain("Leave");
  });
});
