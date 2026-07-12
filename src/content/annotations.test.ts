import { describe, expect, it } from "vitest";
import { connections } from "./connections";
import { composeAnnotation } from "./annotations";
import { makeSession } from "@/test/fixtures";
import type { Discovery } from "@/state/types";

function discoveryAt(index: number): Discovery {
  const connection = connections[index];
  return {
    id: connection.id,
    a: connection.pair[0],
    b: connection.pair[1],
    kind: "curated",
    tier: connection.tier,
    title: connection.title,
    insight: connection.insight,
    quote: connection.quote,
    newToCodex: true,
    points: connection.tier === 3 ? 21 : connection.tier === 2 ? 13 : 8,
  };
}

describe("legacy Annotation", () => {
  it("is stable for the same seed and session result", () => {
    const session = makeSession({
      seed: 9_001,
      discoveries: [discoveryAt(0), discoveryAt(1)],
      motifs: [{ motifId: "triad", name: "Triad", points: 15, at: 100 }],
      score: 54,
    });

    expect(composeAnnotation(session)).toBe(composeAnnotation(session));
    expect(composeAnnotation(session)).toMatchInlineSnapshot(`"What began as scattered lights now hangs together, a small constellation of thought. In "Brunelleschi's Window" the Game sounded one of its deepest chords, the kind that goes on ringing after the beads are still. "The Sacrament of Proportion" gave the web its strength — a true correspondence, honestly earned. A triad closed upon itself — theme, counter-theme, and their reconciliation. A worthy Game. The pattern earns its place in the Archive, and the player earns rest."`);
  });

  it("honestly records an empty web", () => {
    expect(composeAnnotation(makeSession({ seed: 11 }))).toContain(
      "No threads were woven; the beads kept their silence."
    );
  });
});
