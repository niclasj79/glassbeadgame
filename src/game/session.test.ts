import { describe, expect, it } from "vitest";
import { conceptById } from "@/content/concepts";
import { connectionByPair } from "@/content/connections";
import { pairKey } from "@/content/types";
import { drawSession } from "./session";

describe("drawSession", () => {
  it("characterizes the stable draw for a fixed seed", () => {
    expect(drawSession(["mathematics", "music"], 12_345)).toMatchInlineSnapshot(`
      {
        "beadIds": [
          "math.infinite-series",
          "math.fibonacci-sequence",
          "music.musical-form",
          "music.improvisation",
          "music.overtones",
          "math.prime-numbers",
          "art.color-theory",
          "math.topology",
          "hist.industrial-revolution",
          "music.melody-structure",
          "music.modulation",
          "math.golden-ratio",
        ],
        "curatedAvailable": 5,
        "disciplines": [
          "mathematics",
          "music",
        ],
        "seed": 12345,
      }
    `);
  });

  it("honors selected-discipline quotas and reports the curated pairs in the draw", () => {
    const draw = drawSession(["mathematics", "music"], 12_345);
    const selectedCounts = new Map<string, number>();
    for (const id of draw.beadIds) {
      const discipline = conceptById.get(id)?.discipline;
      if (discipline === "mathematics" || discipline === "music") {
        selectedCounts.set(discipline, (selectedCounts.get(discipline) ?? 0) + 1);
      }
    }

    let curatedAvailable = 0;
    for (let i = 0; i < draw.beadIds.length; i++) {
      for (let j = i + 1; j < draw.beadIds.length; j++) {
        if (connectionByPair.has(pairKey(draw.beadIds[i], draw.beadIds[j]))) {
          curatedAvailable++;
        }
      }
    }

    expect(draw.beadIds).toHaveLength(12);
    expect(new Set(draw.beadIds).size).toBe(draw.beadIds.length);
    expect(selectedCounts).toEqual(new Map([["mathematics", 5], ["music", 5]]));
    expect(draw.curatedAvailable).toBe(curatedAvailable);
    expect(draw.curatedAvailable).toBeGreaterThanOrEqual(4);
  });
});
