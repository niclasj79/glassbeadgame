import { describe, expect, it } from "vitest";
import { scrollAffordance } from "./readingScroll";

describe("whether the reading continues", () => {
  it("says a page that overflows has more below", () => {
    expect(
      scrollAffordance({ scrollTop: 0, scrollHeight: 1400, clientHeight: 810 })
    ).toEqual({ above: false, below: true });
  });

  it("says nothing about a page that fits", () => {
    expect(
      scrollAffordance({ scrollTop: 0, scrollHeight: 700, clientHeight: 810 })
    ).toEqual({ above: false, below: false });
  });

  it("reverses at the end of the page", () => {
    expect(
      scrollAffordance({ scrollTop: 590, scrollHeight: 1400, clientHeight: 810 })
    ).toEqual({ above: true, below: false });
  });

  it("says both while the reader is in the middle", () => {
    expect(
      scrollAffordance({ scrollTop: 300, scrollHeight: 1400, clientHeight: 810 })
    ).toEqual({ above: true, below: true });
  });

  it("does not send a reader looking for a sub-pixel of nothing", () => {
    // Layout rounding routinely leaves a fraction of a pixel of overflow on a
    // panel that plainly fits. A cue that lies once is never trusted again.
    expect(
      scrollAffordance({
        scrollTop: 0.5,
        scrollHeight: 810.4,
        clientHeight: 810,
      })
    ).toEqual({ above: false, below: false });
  });
});
