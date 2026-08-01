import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_STATIONS, stationAnchors, type StationThread } from "./stations";

const armillarySource = (): string =>
  readFileSync(new URL("./Armillary.tsx", import.meta.url), "utf8");

const thread = (a: string, b: string): StationThread => ({ pair: [a, b] });

/** Source with comments removed — prose describing a fix is not the fix. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * Extract the bodies of every call to `hook` in a source file by matching
 * parentheses. Crude, and entirely sufficient: it answers the one question
 * these tests need to ask — is this read happening in the frame loop, or in
 * render?
 */
function callBodies(source: string, hook: string): string {
  let out = "";
  let from = 0;
  for (;;) {
    const start = source.indexOf(`${hook}(`, from);
    if (start < 0) return out;
    let depth = 0;
    let i = start + hook.length;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    out += `${source.slice(start, i + 1)}\n`;
    from = i + 1;
  }
}

describe("armillary station anchors", () => {
  it("weights a bead by how much of the web meets there", () => {
    const anchors = stationAnchors([
      thread("a", "b"),
      thread("a", "c"),
      thread("a", "d"),
      thread("b", "c"),
    ]);
    expect(anchors[0].id).toBe("a");
    expect(anchors[0].weight).toBeGreaterThan(anchors[3].weight);
    expect(anchors.every((anchor) => anchor.weight <= 1)).toBe(true);
  });

  it("is deterministic: ties break on id, in any input order", () => {
    const forward = stationAnchors([thread("b", "c"), thread("d", "a")]);
    const backward = stationAnchors([thread("a", "d"), thread("c", "b")]);
    expect(forward).toEqual(backward);
    expect(forward.map((anchor) => anchor.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("never exceeds the ring material's fixed array", () => {
    const many: StationThread[] = [];
    for (let i = 0; i < 40; i++) many.push(thread(`c${i}`, `c${i + 1}`));
    expect(stationAnchors(many).length).toBe(MAX_STATIONS);
    expect(stationAnchors([])).toEqual([]);
    expect(stationAnchors(null)).toEqual([]);
  });
});

/**
 * Two defects lived in one `useMemo`:
 *
 *  - the gold went stale, because the effect that uploaded the stations was
 *    keyed on the `Float32Array` they were staged in — an array that was
 *    refilled in place, so React saw the same identity and never re-ran it;
 *  - the longitudes were sampled from `frameState` *during render* and never
 *    refreshed, so the stations stayed where the beads had been when the
 *    thread was committed, even after a Lens morph moved every bead.
 *
 * AGENTS.md forbids React state for per-frame animation; the mirror of that
 * rule is that per-frame state may not be read during render. These assertions
 * check the structure rather than the symptom, because the symptom only
 * appears on a frame nobody is looking at.
 */
describe("the armillary reads per-frame state only in the frame loop", () => {
  it("samples every position and index inside useFrame", () => {
    const source = code(armillarySource());
    const inLoop = callBodies(source, "useFrame");
    const total = (source.match(/frameState\./g) ?? []).length;
    const looped = (inLoop.match(/frameState\./g) ?? []).length;
    expect(total).toBeGreaterThan(0);
    expect(looped).toBe(total);
  });

  it("uploads the stations from the frame loop, not from an effect", () => {
    const source = code(armillarySource());
    const inLoop = callBodies(source, "useFrame");
    expect(inLoop).toContain("uStations");
    expect(inLoop).toContain("uStationCount");
    // No effect may own the station upload again: an effect cannot see a
    // buffer change its contents without changing its identity. (The material
    // factory legitimately *declares* the uniforms in a memo; what may not
    // happen outside the frame loop is writing to them.)
    const inEffects = callBodies(source, "useEffect");
    expect(inEffects).not.toContain("uStations");
    expect(inEffects).not.toContain("uStationCount");
    const writes = (source.match(/uniforms\.uStations\.value/g) ?? []).length;
    const loopWrites = (inLoop.match(/uniforms\.uStations\.value/g) ?? []).length;
    expect(writes).toBeGreaterThan(0);
    expect(loopWrites).toBe(writes);
  });

  it("derives which beads are anchored from domain state alone", () => {
    const source = code(armillarySource());
    expect(source).toContain("useMemo(() => stationAnchors(threads), [threads])");
    // A Float32Array staged across render and effects is what made the stale
    // read possible; the ring's pooled uniform vectors are written directly.
    expect(source).not.toContain("Float32Array");
  });
});
