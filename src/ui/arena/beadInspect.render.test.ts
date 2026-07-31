import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS, castaliaConceptById } from "@/content/castalia";
import { installMotionDomStubs } from "../testing/domStubs";
import { BeadDetails } from "./BeadInspectCard";

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
    const html = render("measure.fibonacci-sequence");
    const description = /<p [^>]*data-testid="bead-description"[^>]*>/.exec(html)![0];
    const name = /<h3 [^>]*data-testid="bead-name"[^>]*>/.exec(html)![0];
    for (const element of [description, name]) {
      const classes = /class="([^"]*)"/.exec(element)![1].split(/\s+/);
      expect(classes.filter((c) => c.startsWith("line-clamp"))).toEqual([]);
      expect(classes).not.toContain("truncate");
      expect(classes).not.toContain("text-ellipsis");
    }
  });
});
