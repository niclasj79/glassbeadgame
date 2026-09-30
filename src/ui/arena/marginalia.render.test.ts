import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { installMotionDomStubs } from "../testing/domStubs";
import { MarginSurface, type MarginSurfaceProps } from "./Marginalia";
import {
  EMPTY_MARGIN,
  openReading,
  readMore,
  receive,
  reopen,
  setAside,
  toggleIndex,
  type MarginState,
} from "./marginState";
import {
  documentedCue,
  motifCue,
  openThreadCue,
  relationFixture,
  unresolvedCue,
} from "./testing/cueFixtures";
import { byTestId, press } from "./testing/elementTree";
import { reopenedCue } from "./testing/focusFixtures";

/**
 * WHAT THE MARGIN PUTS ON THE GLASS.
 *
 * `MarginSurface` is the margin with no cue bus attached, so each of its states
 * can be rendered and read. The three defects this covers were all invisible to
 * a test of the note *model*: the citations were never printed, there was no
 * control anywhere that brought a reading back, and the plate could not receive
 * a pointer at all. The thread card's two layers (I-018) are asserted here too:
 * what arrives first, and what "Read more" adds.
 */

const noop = (): void => undefined;

const surfaceProps = (
  state: MarginState,
  overrides: Partial<MarginSurfaceProps> = {}
): MarginSurfaceProps => ({
  state,
  reducedMotion: true,
  onSetAside: noop,
  onReopen: noop,
  onToggleIndex: noop,
  onReadMore: noop,
  onReadLess: noop,
  ...overrides,
});

const render = (state: MarginState, overrides: Partial<MarginSurfaceProps> = {}): string =>
  renderToStaticMarkup(createElement(MarginSurface, surfaceProps(state, overrides)));

const INSIGHT_FIRST = "Proportion runs through both.";
const INSIGHT_REST = "One uses it to lock, the other never to lock.";

const documented = (): MarginState =>
  receive(
    EMPTY_MARGIN,
    documentedCue(
      "established",
      "confirmed",
      relationFixture({
        evidence: "established",
        insight: `${INSIGHT_FIRST} ${INSIGHT_REST}`,
      })
    )
  );

const decode = (text: string): string =>
  text.split("&#x27;").join("'").split("&quot;").join('"').split("&amp;").join("&");

describe("the margin on the glass", () => {
  beforeAll(installMotionDomStubs);

  it("prints the citations with the claim, one request away (GAP-B4)", () => {
    const html = render(readMore(documented()));
    expect(html).toContain('data-testid="citations"');
    expect(html).toContain("2 sources for this claim");
    // Verbatim from the register, so the player can go and check.
    expect(html).toContain("Physical Review Letters 68 (1992), 2098–2101");
    expect(html).toContain("Tuning and Temperament");
    // The Codex was cut. Nothing may point at it.
    expect(html).not.toMatch(/codex/i);
  });

  it("can be pointed at, so a reading can be held, selected and dismissed", () => {
    const plate = /<figure [^>]*data-testid="margin-plate"[^>]*>/.exec(
      render(documented())
    );
    expect(plate).not.toBeNull();
    const classes = /class="([^"]*)"/.exec(plate![0])![1].split(/\s+/);
    expect(classes).toContain("pointer-events-auto");
    // The section stays transparent to the pointer: only the plate's own box
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
    const back = readMore(reopen(two, two.readings[0].id));
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

/**
 * I-018. After a weave the two bead cards fold into one thread card: title,
 * evidence line, one sentence — and the rest on request. It stays until the
 * player's next act; the layer is a length, never the standing.
 */
describe("the thread card", () => {
  beforeAll(installMotionDomStubs);

  it("arrives with its title, its evidence line and one sentence", () => {
    const html = decode(render(documented()));
    expect(html).toContain("The Most Rational and the Least");
    expect(html).toContain("Documented · standard in the field");
    expect(html).toContain(INSIGHT_FIRST);
    // The rest waits for the player to ask.
    expect(html).not.toContain(INSIGHT_REST);
    expect(html).not.toContain("The opposition is the Game's own reading.");
    expect(html).not.toContain('data-testid="citations"');
    expect(html).toMatch(/data-testid="thread-card-more"[^>]*aria-expanded="false"[^>]*>Read more</);
    expect(html).toContain('data-layer="first"');
    expect(html).toContain('data-thread-id="thread:1:s:1"');
  });

  it("reveals the insight, the counterpoint and the sources on request", () => {
    const html = decode(render(readMore(documented())));
    expect(html).toContain(`${INSIGHT_FIRST} ${INSIGHT_REST}`);
    expect(html).toContain("The opposition is the Game's own reading.");
    expect(html).toContain('data-testid="citations"');
    expect(html).toContain('data-layer="whole"');
    // The same control, now closing what it opened: focus has somewhere to stay.
    expect(html).toMatch(/data-testid="thread-card-more"[^>]*aria-expanded="true"[^>]*>Read less</);
  });

  it("asks for more, and for less, through its own control", () => {
    const asked: string[] = [];
    const handlers = {
      onReadMore: () => asked.push("more"),
      onReadLess: () => asked.push("less"),
    };
    press(byTestId(MarginSurface(surfaceProps(documented(), handlers)), "thread-card-more")[0]);
    press(
      byTestId(MarginSurface(surfaceProps(readMore(documented()), handlers)), "thread-card-more")[0]
    );
    expect(asked).toEqual(["more", "less"]);
  });

  it("gives an Open Thread its whole question and an unlit thread its whole statement", () => {
    for (const state of [
      receive(EMPTY_MARGIN, openThreadCue()),
      receive(EMPTY_MARGIN, unresolvedCue()),
    ]) {
      const html = render(state);
      expect(html).toContain('data-layer="whole"');
      expect(html).not.toContain('data-testid="thread-card-more"');
    }
    expect(render(receive(EMPTY_MARGIN, openThreadCue()))).toContain(
      "Does either proportion survive being heard rather than counted?"
    );
  });

  it("reads a motif whole: it is not a thread card", () => {
    const html = render(receive(EMPTY_MARGIN, motifCue()));
    expect(html).not.toContain('data-testid="thread-card-more"');
    expect(html).not.toContain("data-thread-id");
  });

  it("keeps the evidence line on the first layer of an interpretive relation", () => {
    const html = decode(render(receive(EMPTY_MARGIN, documentedCue("interpretive"))));
    expect(html).toContain("A reading the Game offers");
    expect(html).not.toMatch(/record/i);
  });

  it("is written beneath a reopened pair with no index and no set-aside of its own (I-019)", () => {
    const held = receive(documented(), reopenedCue());
    const html = render(held, { register: "held" });
    expect(html).toContain('data-testid="margin-plate"');
    expect(html).toContain('data-testid="thread-card-more"');
    expect(html).not.toContain('data-testid="margin-set-aside"');
    expect(html).not.toContain('data-testid="margin-index-toggle"');
    expect(html).not.toContain('data-testid="margin-reopen"');
  });
});
