import { describe, expect, it } from "vitest";
import { capitalise, countWord, formatList, pluralise } from "./prose";

describe("formatList", () => {
  it("uses the Oxford comma and reads deterministically", () => {
    expect(formatList([])).toBe("");
    expect(formatList(["a"])).toBe("a");
    expect(formatList(["a", "b"])).toBe("a and b");
    expect(formatList(["a", "b", "c"])).toBe("a, b, and c");
  });

  it("never names the same thing twice in one list", () => {
    // Regression: a thread that completed two Bridges was described as having
    // "completed the Bridge, and the Bridge" — a list that repeats an item
    // reads as a fault in the writing, not as a count.
    expect(formatList(["the Bridge", "the Bridge"])).toBe("the Bridge");
    expect(formatList(["the Bridge", "the Canon", "the Bridge"])).toBe(
      "the Bridge and the Canon"
    );
    expect(formatList(["a", "a", "a"])).toBe("a");
  });

  it("keeps first-occurrence order when it drops a repeat", () => {
    expect(formatList(["c", "a", "c", "b"])).toBe("c, a, and b");
  });

  it("never emits a dangling separator", () => {
    for (const items of [[], ["a"], ["a", "a"], ["a", "a", "a"], ["a", "b", "a"]]) {
      const text = formatList(items);
      expect(text).not.toMatch(/,\s*$/);
      expect(text).not.toMatch(/,\s*and\s*$/);
      expect(text).not.toMatch(/\band\s+and\b/);
    }
  });
});

describe("countWord and pluralise", () => {
  it("says none at zero and falls back to numerals past twelve", () => {
    expect(countWord(0)).toBe("none");
    expect(countWord(1)).toBe("one");
    expect(countWord(12)).toBe("twelve");
    expect(countWord(13)).toBe("13");
  });

  it("capitalises a numeral fallback without corrupting it", () => {
    expect(capitalise(countWord(41))).toBe("41");
  });

  it("agrees in number only at exactly one", () => {
    expect(pluralise(0, "thread", "threads")).toBe("threads");
    expect(pluralise(1, "thread", "threads")).toBe("thread");
    expect(pluralise(2, "thread", "threads")).toBe("threads");
  });
});
