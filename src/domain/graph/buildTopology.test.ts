import { describe, expect, it } from "vitest";
import { buildSessionFixture } from "../outcomes/testing/buildSessionFixture";
import { C, createFixtureLookup } from "../outcomes/testing/fixtureContent";
import { accreteWeb, buildTopology } from "./buildTopology";
import { conceptDegrees, createTopologyCache, wovenConceptIds } from "./selectors";

const lookup = createFixtureLookup();

/**
 * A deliberately shaped web: one four-cycle spanning Measure and Sound, one
 * detached Sound/Matter pair joined by a single thread, and two beads nobody
 * touched. Every selector has something non-trivial to say about it.
 */
const CONCEPTS = [
  C.fibonacci,
  C.primes,
  C.counterpoint,
  C.polyrhythm,
  C.overtones,
  C.standingWave,
  C.energy,
  C.perspective,
];

const woven = buildSessionFixture({
  conceptIds: CONCEPTS,
  threads: [
    { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
    { a: C.primes, b: C.polyrhythm, intention: "echo" },
    { a: C.counterpoint, b: C.polyrhythm, intention: "ground" },
    { a: C.overtones, b: C.standingWave, intention: "ground" },
    { a: C.fibonacci, b: C.primes, intention: "echo" },
  ],
});

const topology = buildTopology(woven.state, lookup);
const nodeFor = (id: string) => {
  const node = topology.nodes.find((entry) => entry.conceptId === id);
  if (node === undefined) throw new Error(`no node for ${id}`);
  return node;
};

describe("buildTopology — nodes and components", () => {
  it("counts distinct neighbours and incident threads", () => {
    expect(nodeFor(C.fibonacci).degree).toBe(2);
    expect(nodeFor(C.fibonacci).threadCount).toBe(2);
    expect(nodeFor(C.overtones).degree).toBe(1);
    expect(nodeFor(C.perspective).degree).toBe(0);
  });

  it("labels components and leaves untouched concepts outside them", () => {
    expect(topology.componentCount).toBe(2);
    expect(nodeFor(C.fibonacci).componentIndex).toBe(0);
    expect(nodeFor(C.overtones).componentIndex).toBe(1);
    expect(nodeFor(C.energy).componentIndex).toBe(-1);
    expect([...topology.untouchedConceptIds]).toEqual([C.energy, C.perspective]);
    expect([...(topology.components[0]?.faculties ?? [])]).toEqual(["measure", "sound"]);
    expect(topology.components[0]?.circuitRank).toBe(1);
    expect(topology.components[1]?.circuitRank).toBe(0);
  });

  it("reports each concept's reachable faculties in canonical order", () => {
    expect([...nodeFor(C.counterpoint).neighbourFaculties]).toEqual([
      "measure",
      "sound",
    ]);
    expect([...nodeFor(C.overtones).neighbourFaculties]).toEqual(["matter"]);
  });

  it("finds no articulation point in a cycle and none on a leaf", () => {
    expect(topology.nodes.filter((node) => node.isArticulation)).toEqual([]);
  });
});

describe("buildTopology — edges", () => {
  it("marks the single thread holding a component together as a graph bridge", () => {
    const bridges = topology.edges.filter((edge) => edge.isGraphBridge);
    expect(bridges).toHaveLength(1);
    expect(bridges[0]?.pair).toEqual([C.overtones, C.standingWave]);
  });

  it("marks faculty-crossing threads independently of graph bridges", () => {
    const crossing = topology.edges.filter((edge) => edge.isFacultyCrossing);
    expect(crossing.map((edge) => edge.order)).toEqual([0, 1, 3]);
  });

  it("does not call a thread a bridge when a parallel thread also holds the pair", () => {
    const parallel = buildSessionFixture({
      conceptIds: [C.overtones, C.standingWave],
      threads: [
        { a: C.overtones, b: C.standingWave, intention: "ground" },
        { a: C.overtones, b: C.standingWave, intention: "echo" },
      ],
    });
    const parallelTopology = buildTopology(parallel.state, lookup);

    expect(parallelTopology.edgeCount).toBe(1);
    expect(parallelTopology.threadCount).toBe(2);
    expect(parallelTopology.edges.map((edge) => edge.isParallel)).toEqual([false, true]);
    expect(parallelTopology.edges.every((edge) => !edge.isGraphBridge)).toBe(true);
  });
});

describe("buildTopology — cycles and triads", () => {
  it("finds the one independent cycle and names its concepts", () => {
    expect(topology.circuitRank).toBe(1);
    expect(topology.cycles).toHaveLength(1);
    expect(topology.cycles[0]?.length).toBe(4);
    expect([...(topology.cycles[0]?.conceptIds ?? [])].sort()).toEqual(
      [C.fibonacci, C.primes, C.counterpoint, C.polyrhythm].sort()
    );
    expect(topology.triads).toEqual([]);
  });

  it("finds triangles in ascending session order", () => {
    const triangle = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
      ],
    });
    const triangleTopology = buildTopology(triangle.state, lookup);

    expect(triangleTopology.triads).toHaveLength(1);
    expect([...(triangleTopology.triads[0]?.conceptIds ?? [])]).toEqual([
      C.just,
      C.equal,
      C.overtones,
    ]);
  });
});

describe("buildTopology — aggregate measures", () => {
  it("computes faculty spread from what is actually woven", () => {
    expect([...topology.facultySpread.presentFaculties]).toEqual([
      "measure",
      "sound",
      "matter",
    ]);
    expect(topology.facultySpread.wovenByFaculty.sound).toBe(3);
    expect(topology.facultySpread.wovenByFaculty.image).toBe(0);
    expect(topology.facultySpread.crossingThreadCount).toBe(3);
    expect(topology.facultySpread.crossingShare).toBeCloseTo(0.6, 6);
    expect(topology.facultySpread.spread).toBeGreaterThan(0.7);
    expect(topology.facultySpread.spread).toBeLessThan(0.75);
  });

  it("computes the intention mix without inventing a winner on a tie", () => {
    expect(topology.intentionMix.counts.echo).toBe(3);
    expect(topology.intentionMix.counts.ground).toBe(2);
    expect(topology.intentionMix.dominant).toBe("echo");
    expect(topology.intentionMix.dominantIsTied).toBe(false);
    expect(topology.intentionMix.distinctCount).toBe(2);

    const tied = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
      ],
    });
    expect(buildTopology(tied.state, lookup).intentionMix.dominantIsTied).toBe(true);
  });

  it("computes coherence, openness, and density from real structure", () => {
    expect(topology.density).toBeCloseTo(5 / 15, 6);
    expect(topology.coherence).toBeCloseTo(0.7 * 0.8 + 0.3 * (1 / 3), 6);
    expect(topology.openness).toBeCloseTo(0.6 * (2 / 6) + 0.4 * (2 / 8), 6);
  });

  it("carries no tension load when no Tension was declared", () => {
    expect(topology.tensionLoad).toBe(0);
  });

  it("drops tension load once a third concept takes hold of the opposition", () => {
    const unheld = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [{ a: C.just, b: C.equal, intention: "tension" }],
    });
    const held = buildSessionFixture({
      conceptIds: [C.just, C.equal, C.overtones],
      threads: [
        { a: C.just, b: C.equal, intention: "tension" },
        { a: C.overtones, b: C.just, intention: "ground" },
        { a: C.overtones, b: C.equal, intention: "ground" },
      ],
    });

    const unheldLoad = buildTopology(unheld.state, lookup).tensionLoad;
    const heldLoad = buildTopology(held.state, lookup).tensionLoad;

    expect(unheldLoad).toBeCloseTo(1, 6);
    expect(heldLoad).toBeLessThan(unheldLoad);
    expect(heldLoad).toBeGreaterThan(0);
  });

  it("ranks a cut vertex above a leaf in centrality", () => {
    const path = buildSessionFixture({
      conceptIds: [C.fibonacci, C.counterpoint, C.polyrhythm],
      threads: [
        { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
        { a: C.counterpoint, b: C.polyrhythm, intention: "ground" },
      ],
    });
    const pathTopology = buildTopology(path.state, lookup);
    const middle = pathTopology.nodes.find(
      (node) => node.conceptId === C.counterpoint
    );
    const leaf = pathTopology.nodes.find((node) => node.conceptId === C.fibonacci);

    expect(middle?.isArticulation).toBe(true);
    expect(leaf?.isArticulation).toBe(false);
    expect(middle?.betweenness).toBe(1);
    expect(leaf?.betweenness).toBe(0);
    expect((middle?.centrality ?? 0) > (leaf?.centrality ?? 0)).toBe(true);
  });
});

describe("buildTopology — totality and determinism", () => {
  it("never throws on an empty web", () => {
    const empty = buildSessionFixture({ conceptIds: CONCEPTS });
    const emptyTopology = buildTopology(empty.state, lookup);

    expect(emptyTopology.threadCount).toBe(0);
    expect(emptyTopology.componentCount).toBe(0);
    expect(emptyTopology.wovenConceptIds).toEqual([]);
    expect(emptyTopology.coherence).toBe(0);
    expect(emptyTopology.density).toBe(0);
    expect(emptyTopology.tensionLoad).toBe(0);
    expect(emptyTopology.openness).toBe(1);
    expect(emptyTopology.intentionMix.dominant).toBeNull();
    expect(emptyTopology.cycles).toEqual([]);
    expect(emptyTopology.maxDegree).toBe(0);
  });

  it("produces an identical structure for an identical replay", () => {
    const replayed = buildSessionFixture({
      conceptIds: CONCEPTS,
      threads: [
        { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
        { a: C.primes, b: C.polyrhythm, intention: "echo" },
        { a: C.counterpoint, b: C.polyrhythm, intention: "ground" },
        { a: C.overtones, b: C.standingWave, intention: "ground" },
        { a: C.fibonacci, b: C.primes, intention: "echo" },
      ],
    });

    expect(buildTopology(replayed.state, lookup)).toEqual(topology);
  });
});

describe("accreteWeb", () => {
  const steps = accreteWeb(woven.state, lookup);

  it("reports growth in creation order", () => {
    expect(steps.map((step) => step.order)).toEqual([0, 1, 2, 3, 4]);
    expect(steps.map((step) => step.wovenCount)).toEqual([2, 4, 4, 6, 6]);
    expect(steps.map((step) => step.componentCount)).toEqual([1, 2, 1, 2, 2]);
  });

  it("marks the thread that closed a loop and the ones that joined regions", () => {
    expect(steps.map((step) => step.joinedComponents)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(steps.map((step) => step.closedCycle)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(steps.map((step) => step.bothEndpointsAlreadyWoven)).toEqual([
      false,
      false,
      true,
      false,
      true,
    ]);
  });

  it("agrees with the full topology at the final step", () => {
    const last = steps[steps.length - 1];
    expect(last?.componentCount).toBe(topology.componentCount);
    expect(last?.edgeCount).toBe(topology.edgeCount);
    expect(last?.wovenCount).toBe(topology.wovenConceptIds.length);
  });
});

describe("cheap selectors", () => {
  it("agree with the full topology", () => {
    const degrees = conceptDegrees(woven.state);
    for (const node of topology.nodes) {
      expect(degrees.get(node.conceptId)).toBe(node.degree);
    }
    expect([...wovenConceptIds(woven.state)]).toEqual([...topology.wovenConceptIds]);
  });

  it("memoise topology on state identity", () => {
    const cache = createTopologyCache(lookup);
    const first = cache(woven.state);
    expect(cache(woven.state)).toBe(first);

    const other = buildSessionFixture({ conceptIds: CONCEPTS });
    expect(cache(other.state)).not.toBe(first);
  });
});
