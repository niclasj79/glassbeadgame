import { describe, expect, it } from "vitest";
import { concepts } from "./concepts";
import { connectionByPair, connections } from "./connections";
import { disciplines } from "./disciplines";
import { pairKey, type CuratedConnection } from "./types";
import { validateContent } from "./validate";

describe("authored content", () => {
  it("passes the canonical content gate", () => {
    expect(validateContent().errors).toEqual([]);
  });

  it("indexes every curated connection by its canonical unordered pair", () => {
    for (const connection of connections) {
      expect(connection.id).toBe(pairKey(connection.pair[0], connection.pair[1]));
      expect(connectionByPair.get(pairKey(connection.pair[1], connection.pair[0]))).toBe(connection);
    }
  });

  it("rejects malformed fixture data without mutating authored content", () => {
    const invalidConnection: CuratedConnection = {
      id: "invalid-id",
      pair: ["missing.concept", "missing.concept"],
      title: "x",
      insight: "too short",
      tier: 1,
    };
    const report = validateContent({
      disciplines,
      concepts: [...concepts, concepts[0]],
      connections: [...connections, invalidConnection],
    });

    expect(report.errors).toEqual(expect.arrayContaining([
      `duplicate concept id: ${concepts[0].id}`,
      "connection invalid-id: self-pair",
      "connection invalid-id: unknown concept missing.concept",
      "connection invalid-id: title length out of bounds",
    ]));
    expect(validateContent().errors).toEqual([]);
  });
});
