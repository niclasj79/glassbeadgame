import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { castaliaConceptById } from "@/content/castalia";
import { BeadPlate } from "../arena/BeadInspectCard";
import { ColumnSurface, type ColumnSurfaceProps } from "../arena/FocusColumn";
import { planColumn, type ColumnPlan } from "../arena/columnPlan";
import {
  EMPTY_MARGIN,
  receive,
  type MarginState,
} from "../arena/marginState";
import {
  documentedCue,
  relationFixture,
} from "../arena/testing/cueFixtures";
import {
  COUNTERPOINT,
  FIBONACCI,
  focusView,
  roamingView,
} from "../arena/testing/focusFixtures";
import { installMotionDomStubs } from "../testing/domStubs";
import { inspectedConcept } from "./inspection";
import { READING_PLATE } from "./ReadingColumn";

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
 * I-018. The focus view writes more than one plate into the column at once, so
 * the surfaces no longer take turns drawing columns of their own: there is one
 * page, and every plate on it obeys the same law.
 *
 * All are asserted against the real components' markup, because every one of
 * these defects was invisible to a test of the note *model*.
 */

const CONCEPT = castaliaConceptById.get("measure.fibonacci-sequence")!;
const noop = (): void => undefined;

const column = (
  plan: ColumnPlan,
  margin: MarginState = EMPTY_MARGIN
): string =>
  renderToStaticMarkup(
    createElement(ColumnSurface, {
      plan,
      margin,
      hintShown: false,
      lensActive: false,
      reducedMotion: true,
      onCloseInspection: noop,
      onStepBack: noop,
      onSetAside: noop,
      onReopen: noop,
      onToggleIndex: noop,
      onReadMore: noop,
      onReadLess: noop,
    } satisfies ColumnSurfaceProps)
  );

const plan = (
  view: Parameters<typeof planColumn>[0]["view"],
  pinnedInspectId: string | null = null
): ColumnPlan => planColumn({ view, pinnedInspectId, lensActive: false });

const bead = (): string =>
  renderToStaticMarkup(
    createElement(BeadPlate, {
      concept: CONCEPT,
      lensActive: false,
      onClose: () => undefined,
      reducedMotion: true,
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
    // The container: the one column, whoever is written in it. Not a panel
    // floating over the instrument at the opposite corner.
    const pinned = column(plan(roamingView(), String(FIBONACCI)));
    const reading = column(plan(roamingView()), documented());
    expect(pinned).toContain('data-testid="bead-inspect"');
    expect(reading).toContain('data-testid="marginalia"');
    expect(classesOf(pinned, "focus-column")).toBe(classesOf(reading, "focus-column"));
    // The plate: same measure, same pointer law, same scroll.
    expect(classesOf(pinned, "bead-plate")).toBe(classesOf(reading, "margin-plate"));
    expect(classesOf(bead(), "bead-plate")).toBe(READING_PLATE);
  });

  it("sets every card of the focus view on the same plate (I-018)", () => {
    const html = column(plan(focusView(FIBONACCI, COUNTERPOINT)));
    expect(classesOf(html, "focus-card-top")).toBe(READING_PLATE);
    expect(classesOf(html, "focus-card-second")).toBe(READING_PLATE);
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

  it("hands the column to a pinned card alone, and never to a bead it cannot name (IMP-5)", () => {
    expect(inspectedConcept(null)).toBeNull();
    expect(inspectedConcept("measure.fibonacci-sequence")?.id).toBe(CONCEPT.id);
    // A pinned id the pack cannot resolve is not an inspection: the card would
    // draw nothing, so the margin must not stand down for it.
    expect(inspectedConcept("no-such-bead")).toBeNull();
    const unresolved = column(plan(roamingView(), "no-such-bead"), documented());
    expect(unresolved).toContain('data-testid="margin-plate"');
    // A pinned card the pack can name holds the column; the margin waits.
    const pinned = column(plan(roamingView(), String(FIBONACCI)), documented());
    expect(pinned).toContain('data-testid="bead-plate"');
    expect(pinned).not.toContain('data-testid="margin-plate"');
  });

  it("writes from the head of a wide page, and scrolls rather than running off it", () => {
    const html = column(plan(focusView(FIBONACCI, COUNTERPOINT)));
    const root = classesOf(html, "focus-column").split(/\s+/);
    // A card set at the top stays where it was set while more is written.
    expect(root).toContain("md:items-start");
    expect(root).not.toContain("md:items-center");
    // Still the reserved column on a wide page and the foot of a narrow one.
    expect(root).toContain("bottom-0");
    expect(root).toContain("md:right-0");
    expect(root).toContain("md:w-[min(27rem,32vw)]");
    // Never more than half a phone; one scroll for everything written.
    expect(html).toContain("max-h-[50vh]");
    expect(html).toContain("md:max-h-full");
    expect(html).toMatch(/class="pointer-events-none flex min-h-0[^"]*overflow-y-auto/);
  });

  it("gives the column standing before it has anything to say (IMP-4)", () => {
    // The margin at rest: no reading, no re-open control, nothing written.
    const html = column(plan(roamingView()));
    expect(html).not.toContain('data-testid="margin-plate"');
    expect(html).not.toContain('data-testid="margin-reopen"');

    // And yet the column is on the page: ruled, and tinted at its outer edge.
    expect(html).toContain('data-testid="reading-column-standing"');
    expect(html).toContain('data-testid="reading-column-gutter"');

    // Ruled *twice* (B5). One hairline is a divider, and a divider is what a
    // panel has; two rules a few points apart is a ruled margin, which is what
    // tells the eye the right of the page is waiting to be written in rather
    // than left over. The companion is struck at less than half the weight —
    // a second stroke, not a second rule.
    expect(html).toContain('data-testid="reading-column-gutter-companion"');
    expect(html).toContain("hsl(var(--line) / 0.9)");
    expect(html).toContain("hsl(var(--line) / 0.4)");

    // The rule is the page's own rule. `min(1vw,1vh)` is one percent of the
    // viewport's short side, which is the unit `scene/framing.frameRuleShared`
    // measures the manuscript's inner ruling in — so the gutter is struck
    // between the page's own top and bottom rules rather than near them.
    expect(html).toContain("min(1vw, 1vh)");

    // The standing is not just the ground turned up: the ground stays down
    // until something is written, which is the whole distinction.
    expect(html).toMatch(/backdrop-blur-\[2px\][^"]*opacity-0/);
    expect(column(plan(roamingView()), documented())).toMatch(
      /backdrop-blur-\[2px\][^"]*opacity-100/
    );
    // A bead card is writing too.
    expect(column(plan(focusView(FIBONACCI)))).toMatch(
      /backdrop-blur-\[2px\][^"]*opacity-100/
    );
  });
});
