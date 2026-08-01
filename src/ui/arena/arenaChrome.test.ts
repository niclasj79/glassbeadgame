import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { OPENING_DEPARTURE_MS, arenaChromeVisible } from "@/scene/opening";
import { installMotionDomStubs } from "../testing/domStubs";
import { ArenaHud } from "./ArenaHud";

/**
 * BLOCK-3 — THE ARENA'S CHROME WAS DRAWN OVER THE DEPARTING TITLE
 *
 * Measured from a CDP screencast of a real BEGIN press at 1280x720: a DOM trace
 * of the arena's nav pill put it at 0.144 opacity 132 ms after the press and
 * fully struck at 412 ms, while the title block's own departure does not finish
 * for nearly a second. The frame at 288 ms carried THE LENS and CONCLUDE top
 * right, twelve beads at full size, and the words "The Glass Bead Game" behind
 * all of it. Two screens, rendered simultaneously.
 *
 * `renderToStaticMarkup` runs no effects, so what it produces is exactly the
 * arena's *first* commit — the one the trace caught — and that is the frame
 * this asserts on. The gate opens from an effect; the first commit is therefore
 * always the held one, on every machine, whatever the frame rate.
 */
describe("the arena's chrome on its first commit", () => {
  beforeAll(installMotionDomStubs);

  it("is held out of sight while the title is still leaving", () => {
    const html = renderToStaticMarkup(createElement(ArenaHud));
    const chrome = /<div [^>]*data-testid="arena-chrome"[^>]*>/.exec(html);
    expect(chrome).not.toBeNull();
    // Hidden, not merely transparent: `visibility` takes it out of hit testing
    // and out of the accessibility tree at the same time, and while this is
    // held the title screen still owns both.
    expect(chrome![0]).toContain("visibility:hidden");
    expect(chrome![0]).toContain('data-shown="false"');
  });

  it("holds the two verbs the critic photographed over the title", () => {
    const html = renderToStaticMarkup(createElement(ArenaHud));
    const gate = html.indexOf('data-testid="arena-chrome"');
    expect(gate).toBeGreaterThan(-1);
    expect(html.indexOf("The Lens")).toBeGreaterThan(gate);
    expect(html.indexOf("Conclude")).toBeGreaterThan(gate);
  });

  it("keeps the surfaces in the tree so nothing moves when they arrive", () => {
    // Held, not unmounted. A chrome that is added to the page a second in is a
    // second layout, and the arena would visibly reflow under the player.
    const html = renderToStaticMarkup(createElement(ArenaHud));
    expect(html).toContain("Conclude");
    expect(html).toContain('data-testid="marginalia"');
  });

  it("never holds the live region, which is not drawn at all", () => {
    // `CueCaptions` is `sr-only`: nothing of it is ever drawn over the title,
    // and a world that cannot speak for the first second of the Game is a
    // worse defect than the one being fixed.
    const html = renderToStaticMarkup(createElement(ArenaHud));
    const gate = html.indexOf('data-testid="arena-chrome"');
    const chromeEnd = html.indexOf("Conclude");
    const captions = html.indexOf('aria-label="What the Game answered"');
    expect(gate).toBeGreaterThan(-1);
    expect(captions).toBeGreaterThan(-1);
    expect(captions).toBeGreaterThan(chromeEnd);
    expect(gate).toBeLessThan(captions);
    // Nothing inside the hidden wrapper carries the live region with it.
    const hidden = html.slice(gate, chromeEnd);
    expect(hidden).not.toContain("What the Game answered");
  });

  it("agrees with the departure the title is actually cut to", () => {
    expect(arenaChromeVisible(0)).toBe(false);
    expect(arenaChromeVisible(OPENING_DEPARTURE_MS)).toBe(true);
  });
});
