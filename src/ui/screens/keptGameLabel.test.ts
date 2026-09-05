import { describe, expect, it } from "vitest";
import { firstSentence, keptGameLabel } from "./keptGameLabel";

describe("how a kept Game is named on the shelf", () => {
  it("is named by the first thing its annotation said", () => {
    const label = keptGameLabel(
      {
        endedAt: Date.UTC(2026, 8, 5, 12, 0, 0),
        annotation:
          "You opened with Fibonacci Sequence and Counterpoint, read as Echo, and Castalia had a record to set beside it: Proportion Claimed in a Fugue. Fibonacci Sequence became the point everything turned on.",
      },
      "en-GB"
    );
    expect(label.said).toBe(
      "You opened with Fibonacci Sequence and Counterpoint, read as Echo, and Castalia had a record to set beside it: Proportion Claimed in a Fugue."
    );
    expect(label.when).toContain("2026");
  });

  it("never names a Game by a count", () => {
    const label = keptGameLabel({ endedAt: 0, annotation: "Nothing has been woven yet." }, "en-GB");
    expect(label.said).toBe("Nothing has been woven yet.");
    expect(label.said).not.toMatch(/\d/);
  });

  it("still has a name when the annotation is missing", () => {
    expect(keptGameLabel({ endedAt: 0 }, "en-GB").said).toBe("A kept Game.");
    expect(firstSentence(undefined)).toBe("");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
  });
});
