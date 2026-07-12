import { describe, expect, it } from "vitest";
import { hashString } from "@/lib/utils";
import { parseTestMode } from "./testMode";

describe("test-mode boundary", () => {
  it("accepts an explicit development-only stable seed", () => {
    expect(parseTestMode("?testMode=1&seed=castalia-golden-001", true)).toEqual({
      enabled: true,
      seedText: "castalia-golden-001",
      seed: hashString("castalia-golden-001"),
    });
  });

  it("fails closed outside development or without a nonempty seed", () => {
    expect(parseTestMode("?testMode=1&seed=castalia-golden-001", false).enabled).toBe(false);
    expect(parseTestMode("?testMode=1", true).enabled).toBe(false);
    expect(parseTestMode("?seed=castalia-golden-001", true).enabled).toBe(false);
  });
});
