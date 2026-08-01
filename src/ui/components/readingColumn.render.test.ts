import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { castaliaConceptById } from "@/content/castalia";
import { BeadPlate } from "../arena/BeadInspectCard";
import { MarginSurface } from "../arena/Marginalia";
import {
  EMPTY_MARGIN,
  receive,
  type MarginState,
} from "../arena/marginState";
import {
  documentedCue,
  relationFixture,
} from "../arena/testing/cueFixtures";
import { installMotionDomStubs } from "../testing/domStubs";
import { inspectedConcept } from "./inspection";

/**
 * THE RESERVED COLUMN, AND WHO IS ALLOWED IN IT.
 *
 * IMP-5. Two surfaces read authored prose at length. The margin took the
 * reserved column and set its readings against a ruled page; the bead
 * inspection card was pinned to the lower left *over the instrument*, in a
 * rounded glass panel at 10–12px, crossing outside the page's inner rule and
 * clipping the bead's own label to a fragment — while the column built for
 * exactly that content sat empty in the same frame. Two reading surfaces of the
 * same class obeyed two different layout laws, and the one that fired first
 * destroyed the world it described.
 *
 * IMP-4. The column also had no standing at rest: it was pure negative space
 * until an outcome fired, so the opening frame read as a camera that missed
 * rather than as an asymmetry that was chosen (measured ink per vertical third:
 * 43/49/7).
 *
 * Both are asserted against the real components' markup, because both defects
 * were invisible to every test of the note *model*.
 */

const CONCEPT = castaliaConceptById.get("measure.fibonacci-sequence")!;

const bead = (): string =>
  renderToStaticMarkup(
    createElement(BeadPlate, {
      concept: CONCEPT,
      lensActive: false,
      onClose: () => undefined,
      reducedMotion: true,
    })
  );

const margin = (state: MarginState): string =>
  renderToStaticMarkup(
    createElement(MarginSurface, {
      state,
      reducedMotion: true,
      onSetAside: () => undefined,
      onReopen: () => undefined,
      onToggleIndex: () => undefined,
    })
  );

const documented = (): MarginState =>
  receive(
    EMPTY_MARGIN,
    documentedCue(
      "established",
      "confirmed",
      relationFixture({ evidence: "established" })
    )
  );

/** The class list of the first element carrying `data-testid`. */
const classesOf = (html: string, testId: string): string => {
  const element = new RegExp(`<\\w+ [^>]*data-testid="${testId}"[^>]*>`).exec(
    html
  );
  expect(element).not.toBeNull();
  return /class="([^"]*)"/.exec(element![0])![1];
};

describe("the reading column", () => {
  beforeAll(installMotionDomStubs);

  it("docks the bead card in the same column as the margin (IMP-5)", () => {
    // The container: same edge, same reserve, same pointer law. Not a panel
    // floating over the instrument at the opposite corner.
    expect(classesOf(bead(), "bead-inspect")).toBe(
      classesOf(margin(documented()), "marginalia")
    );
    // The plate: same measure, same ceiling, same scroll behaviour.
    expect(classesOf(bead(), "bead-plate")).toBe(
      classesOf(margin(documented()), "margin-plate")
    );
  });

  it("sets the bead in the same type and rule system as a reading (IMP-5)", () => {
    const html = bead();
    // The scribe's rule, from the one definition both surfaces strike it from.
    expect(html).toContain('data-testid="reading-rule"');
    // The margin's title size, not a card heading of its own.
    expect(classesOf(html, "bead-name")).toContain("text-title");
    // Running prose in the reading face, at the reading's measure.
    expect(classesOf(html, "bead-description")).toContain("prose-castalia");
    // The engraved standing line, above the title, as every reading has.
    expect(html).toMatch(/class="engraved[^"]*"[^>]*>\s*Bead/);
    // Nothing left of the glass card that used to cover the world.
    expect(html).not.toContain("backdrop-blur-xl");
    expect(html).not.toContain("rounded-2xl");
    expect(html).not.toContain("left-5");
  });

  it("hands the column to exactly one surface at a time (IMP-5)", () => {
    // Both the card and the margin ask this. Two plates in one column is one
    // plate over another; no plate at all is a column that blinks out.
    expect(inspectedConcept(null)).toBeNull();
    expect(inspectedConcept("measure.fibonacci-sequence")?.id).toBe(
      CONCEPT.id
    );
    // A pinned id the pack cannot resolve is not an inspection: the card would
    // draw nothing, so the margin must not stand down for it.
    expect(inspectedConcept("no-such-bead")).toBeNull();
  });

  it("gives the column standing before it has anything to say (IMP-4)", () => {
    // The margin at rest: no reading, no re-open control, nothing written.
    const html = margin(EMPTY_MARGIN);
    expect(html).not.toContain('data-testid="margin-plate"');
    expect(html).not.toContain('data-testid="margin-reopen"');

    // And yet the column is on the page: ruled, and tinted at its outer edge.
    expect(html).toContain('data-testid="reading-column-standing"');
    expect(html).toContain('data-testid="reading-column-gutter"');

    // The rule is the page's own rule. `min(1vw,1vh)` is one percent of the
    // viewport's short side, which is the unit `scene/framing.frameRuleShared`
    // measures the manuscript's inner ruling in — so the gutter is struck
    // between the page's own top and bottom rules rather than near them.
    expect(html).toContain("min(1vw, 1vh)");

    // The standing is not just the ground turned up: the ground stays down
    // until something is written, which is the whole distinction.
    expect(html).toMatch(/backdrop-blur-\[2px\][^"]*opacity-0/);
    expect(margin(documented())).toMatch(
      /backdrop-blur-\[2px\][^"]*opacity-100/
    );
  });
});
