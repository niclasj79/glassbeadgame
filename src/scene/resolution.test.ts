import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RESOLUTION,
  threadInkCoverage,
  totalThreadInk,
} from "./resolution";

const DOCUMENTED = 1;
const OPEN = 0;

const ribbonSource = (): string =>
  readFileSync(new URL("./ribbon.ts", import.meta.url), "utf8");

/** Source with comments removed — prose about a uniform is not a use of it. */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * CAV-006: "An Open Thread is rendered at the same brightness and the same
 * musical weight but stays unclosed… No outcome type may be given more bloom,
 * more gain, or more camera than another; the player must never learn to
 * prefer one kind of truth because it pays better."
 *
 * The shader used to multiply an unresolved thread's alpha by
 * `0.82 + 0.18 * sin(t)` along its entire length, so an Open Thread was on
 * average dimmer than a documented one everywhere — the exact hierarchy the
 * decision it cited forbids. These tests measure the replacement instead of
 * describing it.
 */
describe("CAV-006 — outcomes differ in resolution, not in reward", () => {
  it("draws the two at exactly the same strength along the spine", () => {
    // Away from the closing point, every sample of an Open Thread is as strong
    // as the same sample of a documented one. Not "close to": identical.
    for (let c = 0; c <= RESOLUTION.holdStart; c += 0.01) {
      for (let a = 0; a <= RESOLUTION.dryInner; a += 0.05) {
        expect(threadInkCoverage(a, c, OPEN)).toBe(
          threadInkCoverage(a, c, DOCUMENTED)
        );
      }
    }
  });

  it("gives neither outcome a brighter peak", () => {
    let openPeak = 0;
    let documentedPeak = 0;
    for (let c = 0; c <= 1; c += 0.005) {
      for (let a = 0; a <= 1; a += 0.005) {
        openPeak = Math.max(openPeak, threadInkCoverage(a, c, OPEN));
        documentedPeak = Math.max(
          documentedPeak,
          threadInkCoverage(a, c, DOCUMENTED)
        );
      }
    }
    expect(openPeak).toBe(documentedPeak);
    expect(openPeak).toBe(1);
  });

  it("lays down the same quantity of ink in total", () => {
    // The wet spread is solved so that the coverage it gains is exactly the
    // coverage the unclosed terminal gives up. Equal total ink is the
    // machine-checkable form of "equally luminous".
    const open = totalThreadInk(OPEN);
    const documented = totalThreadInk(DOCUMENTED);
    expect(open).toBeCloseTo(documented, 5);
  });

  it("differs only by remaining open — a wider, wetter stroke that stops short", () => {
    // Wet ink has spread past the dry contour…
    const nearEdge = (RESOLUTION.dryInner + RESOLUTION.wetInner) / 2;
    expect(threadInkCoverage(nearEdge, 0.5, OPEN)).toBeGreaterThan(
      threadInkCoverage(nearEdge, 0.5, DOCUMENTED)
    );
    // …and the figure has not closed.
    expect(threadInkCoverage(0, 1, OPEN)).toBe(0);
    expect(threadInkCoverage(0, 1, DOCUMENTED)).toBe(1);
    // The spread is outward, never a narrowing, and stays inside the ribbon.
    expect(RESOLUTION.wetInner).toBeGreaterThan(RESOLUTION.dryInner);
    expect(RESOLUTION.wetInner).toBeLessThan(RESOLUTION.edge);
  });

  it("keeps the ribbon shader's only use of uResolved inside that model", () => {
    // The precedent is threadGrammar.test.ts, which reads ribbon.ts to guard
    // the torsion bound: a rule the shader can restate locally is not a rule.
    const source = code(ribbonSource());
    expect(source).toContain(
      "float body = gbgThreadInk(across, closure, uResolved);"
    );
    const uses = source.match(/uResolved/g) ?? [];
    // Exactly three: the uniform declaration, the gbgThreadInk call, and the
    // uniform's seed. A fourth would be a shader deciding for itself what an
    // Open Thread is worth.
    expect(uses).toHaveLength(3);
    // Nothing may scale luminance, opacity or width by the outcome again.
    expect(source).not.toMatch(/mix\([^)]*uResolved\s*\)/);
    expect(source).not.toMatch(/[*/]\s*uResolved/);
  });
});
