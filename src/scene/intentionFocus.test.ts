import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A KEYBOARD PLAYER MUST ARRIVE ON THE PLATE THEY JUST OPENED
 *
 * Found while re-composing the arena, and it is a real defect rather than a
 * consequence of the composition: opening an intention from the keyboard moved
 * focus to the plate's first verb by calling `focus()` on the first frame the
 * control existed — and then returning, whether or not the focus had been
 * taken.
 *
 * It usually had not been. The plate is carried by drei's `Html`, which mounts
 * its wrapper with `display: none` and reveals it from its own frame callback,
 * and `focus()` on a display-none element does nothing and reports nothing. The
 * retry loop that exists for exactly this case was never reached, because
 * "the element exists" was being treated as "the focus succeeded".
 *
 * Traced on the running build: `focus(intention-control-echo)` was called with
 * an ancestor at `display: none` and a 0x0 box, no `focusin` followed, and the
 * player was left standing on the bead they had just opened.
 */

const source = (): string =>
  readFileSync(new URL("./IntentionConstellation.tsx", import.meta.url), "utf8");

describe("opening an intention from the keyboard", () => {
  it("keeps trying until the focus is actually taken", () => {
    const text = source();
    expect(text).toContain("control.focus();");
    // The check that was missing. Existing is not focusable.
    expect(text).toContain("if (document.activeElement === control) return;");
  });

  it("does not treat the element existing as the focus succeeding", () => {
    // The shape of the old bug, stated so it cannot come back by tidying: a
    // bare `focus()` followed straight by `return` inside the retry.
    const text = source().replace(/\/\*[\s\S]*?\*\//g, "");
    expect(text).not.toMatch(/control\.focus\(\);\s*return;/);
  });

  it("still gives up rather than spinning forever", () => {
    // A retry with no bound is a leak on any path where the plate never opens.
    expect(source()).toMatch(/attempts < \d+/);
  });
});
