import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { installMotionDomStubs } from "../testing/domStubs";
import { ArenaHud } from "./ArenaHud";
import { CueCaptions } from "./CueCaptions";
import { Marginalia } from "./Marginalia";

/**
 * Markup-level guards for the two ways the epistemic label used to be withheld:
 * a phone never saw it, and a screen reader was never told it.
 *
 * These render the real components rather than reading their source. `vitest`
 * runs in `node`, so this is a static render: effects do not run and no note is
 * on the page yet. What it can assert is exactly what was broken — where the
 * surfaces are allowed to exist and what shape the live region has.
 */
describe("the arena's reading surfaces", () => {
  beforeAll(installMotionDomStubs);

  it("writes the margin on a phone as well as a desktop (B4)", () => {
    const html = renderToStaticMarkup(createElement(Marginalia));
    const container = /<div [^>]*data-testid="marginalia"[^>]*>/.exec(html);
    expect(container).not.toBeNull();
    const classes = /class="([^"]*)"/.exec(container![0])![1].split(/\s+/);

    // `hidden md:flex` is what kept every phone player from ever being told
    // whether a claim was documented, contested, or a reading.
    expect(classes).not.toContain("hidden");
    expect(classes).toContain("flex");
    // Below md it is the foot of the page; from md it is the right margin.
    expect(classes).toContain("bottom-0");
    expect(classes).toContain("md:right-0");
  });

  it("gives the world a live region of its own", () => {
    const html = renderToStaticMarkup(createElement(CueCaptions));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    // Never a second visible panel: the world is the primary interface.
    expect(html).toContain("sr-only");
  });

  it("mounts the captions inside the arena, and outside the Lens gate", () => {
    const html = renderToStaticMarkup(createElement(ArenaHud));
    expect(html).toContain('aria-label="What the Game answered"');
    expect(html).toContain('data-testid="marginalia"');
  });
});
