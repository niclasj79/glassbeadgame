import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { installMotionDomStubs } from "../testing/domStubs";
import { MarginSurface } from "./Marginalia";
import {
  EMPTY_MARGIN,
  openReading,
  receive,
  reopen,
  setAside,
  toggleIndex,
  type MarginState,
} from "./marginState";
import { documentedCue, openThreadCue, relationFixture } from "./testing/cueFixtures";

/**
 * WHAT THE MARGIN PUTS ON THE GLASS.
 *
 * `MarginSurface` is the margin with no cue bus attached, so each of its states
 * can be rendered and read. The three defects this covers were all invisible to
 * a test of the note *model*: the citations were never printed, there was no
 * control anywhere that brought a reading back, and the plate could not receive
 * a pointer at all.
 */

const render = (state: MarginState): string =>
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

describe("the margin on the glass", () => {
  beforeAll(installMotionDomStubs);

  it("prints the citations with the claim (GAP-B4)", () => {
    const html = render(documented());
    expect(html).toContain('data-testid="citations"');
    expect(html).toContain("2 sources for this claim");
    // Verbatim from the register, so the player can go and check.
    expect(html).toContain("Physical Review Letters 68 (1992), 2098–2101");
    expect(html).toContain("Tuning and Temperament");
    // The Codex was cut. Nothing may point at it.
    expect(html).not.toMatch(/codex/i);
  });

  it("can be pointed at, so a reading can be held, scrolled and dismissed", () => {
    const plate = /<figure [^>]*data-testid="margin-plate"[^>]*>/.exec(
      render(documented())
    );
    expect(plate).not.toBeNull();
    const classes = /class="([^"]*)"/.exec(plate![0])![1].split(/\s+/);
    expect(classes).toContain("pointer-events-auto");
    expect(classes).toContain("overflow-y-auto");
    // The container stays transparent to the pointer: only the plate's own box
    // catches anything, so the arena is not covered by an invisible sheet.
    const container = /<div [^>]*data-testid="marginalia"[^>]*>/.exec(
      render(documented())
    );
    expect(/class="([^"]*)"/.exec(container![0])![1].split(/\s+/)).toContain(
      "pointer-events-none"
    );
  });

  it("offers a way back to a reading that was set aside (GAP-B4)", () => {
    const aside = setAside(documented());
    expect(openReading(aside)).toBeNull();
    const html = render(aside);
    expect(html).toContain('data-testid="margin-reopen"');
    // Named by the reading it brings back, not by a count of anything.
    expect(html).toContain("The Most Rational and the Least");
  });

  it("says nothing at all before the first outcome", () => {
    const html = render(EMPTY_MARGIN);
    expect(html).not.toContain('data-testid="margin-reopen"');
    expect(html).not.toContain('data-testid="margin-plate"');
  });

  it("indexes earlier readings once there is more than one", () => {
    const two = receive(documented(), openThreadCue());
    expect(render(two)).toContain('data-testid="margin-index-toggle"');
    const opened = toggleIndex(two);
    const html = render(opened);
    expect(html).toContain('data-testid="margin-index"');
    // The open thread is on the page; the documented relation is in the index.
    expect(html).toContain("The Most Rational and the Least");
  });

  it("keeps a set-aside reading reachable and re-openable", () => {
    const two = receive(documented(), openThreadCue());
    const back = reopen(two, two.readings[0].id);
    expect(render(back)).toContain("2 sources for this claim");
  });

  it("gives an Open Thread the same plate as a documented relation (CAV-006)", () => {
    const open = receive(EMPTY_MARGIN, openThreadCue());
    const openPlate = /<figure [^>]*data-testid="margin-plate"[^>]*>/.exec(
      render(open)
    )![0];
    const documentedPlate = /<figure [^>]*data-testid="margin-plate"[^>]*>/.exec(
      render(documented())
    )![0];
    expect(/class="([^"]*)"/.exec(openPlate)![1]).toBe(
      /class="([^"]*)"/.exec(documentedPlate)![1]
    );
    expect(render(open)).toContain('data-testid="margin-set-aside"');
  });
});
