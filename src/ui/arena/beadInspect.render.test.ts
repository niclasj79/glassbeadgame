import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS, castaliaConceptById } from "@/content/castalia";
import { toFacetId } from "@/content/castalia/schema";
import { installMotionDomStubs } from "../testing/domStubs";
import { BeadCompact, BeadDetails, FacetLine } from "./BeadInspectCard";

/**
 * GAP-B4(3). This card is the only surface in the game that renders a concept
 * description, and it clamped that description to four lines with no expand
 * control. On Fibonacci the clipped sentence was the over-claiming caveat — the
 * one sentence a pack whose whole discipline is refusing to overstate cannot
 * afford to hide.
 *
 * The assertion is not "it fits". It is that the authored text is on the page
 * whole, for every concept in the pack, with nothing in the markup that cuts it.
 */

/** The five entities `renderToStaticMarkup` writes for text content. */
const decode = (text: string): string =>
  text
    .split("&quot;")
    .join('"')
    .split("&#x27;")
    .join("'")
    .split("&lt;")
    .join("<")
    .split("&gt;")
    .join(">")
    .split("&amp;")
    .join("&");

const render = (id: string): string =>
  renderToStaticMarkup(
    createElement(BeadDetails, {
      concept: castaliaConceptById.get(id)!,
      lensActive: false,
      onClose: () => undefined,
    })
  );

describe("the inspection card", () => {
  beforeAll(installMotionDomStubs);

  it("prints the caveat the clamp used to cut (GAP-B4)", () => {
    const html = render("measure.fibonacci-sequence");
    expect(html).toContain(
      "It is also badly over-claimed, which makes it a good test of how carefully one is willing to look."
    );
  });

  it("prints every concept's description in full", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      const html = render(concept.id);
      const description = /data-testid="bead-description"[^>]*>([^<]*)</.exec(html);
      expect(description).not.toBeNull();
      expect(decode(description![1])).toBe(concept.description);
    }
  });

  it("cuts neither the description nor the name", () => {
    // Tag-agnostic: the card is set in the reading column's type system now
    // (IMP-5), so the title is the same `h2` the margin's reading carries. What
    // must never come back is a clamp, whatever element it is put on.
    const description = /<\w+ [^>]*data-testid="bead-description"[^>]*>/;
    const name = /<\w+ [^>]*data-testid="bead-name"[^>]*>/;
    const html = render("measure.fibonacci-sequence");
    for (const pattern of [description, name]) {
      const element = pattern.exec(html);
      expect(element).not.toBeNull();
      const classes = /class="([^"]*)"/.exec(element![0])![1].split(/\s+/);
      expect(classes.filter((c) => c.startsWith("line-clamp"))).toEqual([]);
      expect(classes).not.toContain("truncate");
      expect(classes).not.toContain("text-ellipsis");
    }
  });
});

/**
 * I-018: the facets both beads carry are lit in both cards. Lit is public
 * structure, said in weight and a mark rather than colour alone, and it leads
 * the line so the same words stand at the head of each card.
 */
describe("the facet line", () => {
  beforeAll(installMotionDomStubs);

  const line = (
    shared: readonly string[] | null,
    interactive = true,
    facets = ["recursion", "proportion", "discreteness"]
  ): string =>
    renderToStaticMarkup(
      createElement(FacetLine, {
        facets: facets.map(toFacetId),
        shared: shared === null ? null : shared.map(toFacetId),
        interactive,
      })
    );

  const order = (html: string): string[] =>
    [...html.matchAll(/data-testid="facet-([^"]+)"/g)].map((match) => match[1]);

  it("keeps the pack's order when there is no pair to compare", () => {
    const html = line(null);
    expect(order(html)).toEqual(["recursion", "proportion", "discreteness"]);
    expect(html).not.toContain("focus-shared-facets");
    expect(html).not.toContain("✦");
  });

  it("lights what both carry, first, and leaves the rest in the pack's order", () => {
    const html = line(["discreteness", "recursion"]);
    expect(order(html)).toEqual(["discreteness", "recursion", "proportion"]);
    const group = /<span data-testid="focus-shared-facets"[^>]*>(.*?)<\/span><span aria-hidden="true"> · <\/span><span class="sr-only">Also: /.exec(
      html
    );
    expect(group).not.toBeNull();
    expect(group![1]).toContain("Discreteness");
    expect(group![1]).toContain("Recursion");
    expect(group![1]).not.toContain("Proportion");
    // Weight and a mark, and a screen reader is told which are shared.
    expect(html.match(/data-shared="true"/g)).toHaveLength(2);
    expect(html.match(/✦/g)).toHaveLength(2);
    expect(html).toContain("Both carry: ");
  });

  it("lights only facets this bead actually carries", () => {
    const html = line(["recursion", "imitation"]);
    expect(html).not.toContain('data-testid="facet-imitation"');
    expect(html.match(/data-shared="true"/g)).toHaveLength(1);
  });

  it("gives a glance nothing to focus and a pinned card its glosses", () => {
    expect(line(null, false)).not.toContain("tabindex");
    expect(line(null, true).match(/tabindex="0"/g)).toHaveLength(3);
    // The gloss travels with the name either way.
    expect(line(null, false)).toContain(
      "Recursion. A rule applied again to its own result, so the whole reappears inside the part."
    );
  });

  it("sets a compact card from the same authored lines, without description or dates", () => {
    const concept = castaliaConceptById.get("sound.counterpoint")!;
    const html = renderToStaticMarkup(
      createElement(BeadCompact, {
        concept,
        role: "sighted",
        shared: [toFacetId("recursion")],
      })
    );
    expect(html).toContain(concept.name);
    expect(html).toContain(concept.caption);
    expect(html).toContain("Sound");
    expect(html).toContain(concept.kind);
    expect(html).not.toContain(concept.era);
    expect(html).not.toContain('data-testid="bead-description"');
    // Its role is said to a screen reader; to the eye, position says it.
    expect(html).toMatch(/<span class="sr-only">Under the lens · <\/span>/);
    expect(html).toContain('data-testid="focus-shared-facets"');
  });

  it("closes only a card the player pinned", () => {
    const concept = castaliaConceptById.get("sound.counterpoint")!;
    const glance = renderToStaticMarkup(
      createElement(BeadDetails, { concept, lensActive: false })
    );
    expect(glance).not.toContain('data-testid="bead-close"');
    expect(glance).toContain(concept.description);
  });
});
