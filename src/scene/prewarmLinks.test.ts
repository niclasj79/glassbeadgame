import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { awaitLinks, programOf, type LinkingRenderer } from "./prewarmLinks";

interface Held {
  currentProgram?: { isReady(): boolean };
}

/**
 * A renderer's property store as three keeps it: a record per object, and a
 * fresh empty record for any object whose record was removed by a dispose.
 */
function rendererHolding(records: Map<object, Held>): LinkingRenderer {
  return { properties: { get: (object) => records.get(object as object) ?? {} } };
}

describe("awaitLinks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls until every program reports linked, then resolves", async () => {
    let linked = false;
    const glass = {};
    const label = {};
    const records = new Map<object, Held>([
      [glass, { currentProgram: { isReady: () => linked } }],
      [label, { currentProgram: { isReady: () => true } }],
    ]);
    let settled = false;
    void awaitLinks(rendererHolding(records), [glass, label]).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(settled).toBe(false);
    linked = true;
    await vi.advanceTimersByTimeAsync(10);
    expect(settled).toBe(true);
  });

  it("lets go of a material disposed while it links, instead of throwing", async () => {
    const glass = {};
    const bead = {};
    const records = new Map<object, Held>([
      [glass, { currentProgram: { isReady: () => true } }],
      [bead, { currentProgram: { isReady: () => false } }],
    ]);
    let settled = false;
    void awaitLinks(rendererHolding(records), [glass, bead]).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(30);
    expect(settled).toBe(false);
    // The bead's material is disposed: three removes its record.
    records.delete(bead);
    await vi.advanceTimersByTimeAsync(10);
    expect(settled).toBe(true);
  });

  it("resolves at once when there is nothing to link", async () => {
    let settled = false;
    void awaitLinks(rendererHolding(new Map()), []).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
  });

  it("reads a program only where three keeps one", () => {
    const material = {};
    const program = { isReady: () => true };
    expect(programOf(rendererHolding(new Map([[material, { currentProgram: program }]])), material)).toBe(program);
    expect(programOf(rendererHolding(new Map([[material, {}]])), material)).toBeUndefined();
    expect(programOf(rendererHolding(new Map()), material)).toBeUndefined();
    expect(
      programOf({ properties: { get: () => undefined } }, material)
    ).toBeUndefined();
  });
});
