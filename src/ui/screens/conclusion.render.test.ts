import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { buildAnnotation } from "@/domain/annotation";
import { toConceptId } from "@/domain/ids";
import { buildSessionFixture } from "@/domain/outcomes/testing/buildSessionFixture";
import { buildPortrait } from "@/domain/portrait";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { installMotionDomStubs } from "../testing/domStubs";
import { ConclusionReading } from "./ConclusionScreen";

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
});
