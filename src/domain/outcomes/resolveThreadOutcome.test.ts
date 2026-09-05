import { describe, expect, it } from "vitest";
import { toEventId, toThreadId } from "../ids";
import type { CommittedThreadV1 } from "../model/sessionState";
import {
  resolveSessionOutcomes,
  resolveThreadOutcome,
  sharedFacetsOf,
  stanceForFit,
} from "./resolveThreadOutcome";
import type {
  DocumentedThreadOutcome,
  OpenThreadOutcome,
  UnresolvedThreadOutcome,
} from "./types";
import { buildSessionFixture } from "./testing/buildSessionFixture";
import { C, createFixtureLookup } from "./testing/fixtureContent";
import type { RelationIntention } from "../events";

const lookup = createFixtureLookup();

function singleThread(
  a = C.fibonacci,
  b = C.counterpoint,
  intention: RelationIntention = "echo"
): CommittedThreadV1 {
  const fixture = buildSessionFixture({
    conceptIds: [a, b],
    threads: [{ a, b, intention }],
  });
  const thread = fixture.state.threads[0];
  if (thread === undefined) throw new Error("fixture must commit one thread");
  return thread;
}

describe("resolveThreadOutcome — documented relations", () => {
  it("confirms the intention the relation is authored around", () => {
    const outcome = resolveThreadOutcome(singleThread(), lookup);

    expect(outcome.kind).toBe("documented");
    const documented = outcome as DocumentedThreadOutcome;
    expect(documented.relation.id).toBe("rel.spiral-canon");
    expect(documented.fit).toBe("primary");
    expect(documented.stance).toBe("confirmed");
    expect(documented.statement).toContain("Echo");
    expect(documented.statement).toContain("structural correspondence");
  });

  it("refines a supported reading and refines a partial one, without ranking them apart", () => {
    const supported = resolveThreadOutcome(
      singleThread(C.fibonacci, C.counterpoint, "ground"),
      lookup
    ) as DocumentedThreadOutcome;
    const partial = resolveThreadOutcome(
      singleThread(C.fibonacci, C.counterpoint, "passage"),
      lookup
    ) as DocumentedThreadOutcome;

    expect(supported.fit).toBe("supported");
    expect(supported.stance).toBe("refined");
    expect(partial.fit).toBe("partial");
    expect(partial.stance).toBe("refined");
  });

  it("complicates an unsupported reading and never says the player was wrong", () => {
    const outcome = resolveThreadOutcome(
      singleThread(C.fibonacci, C.counterpoint, "tension"),
      lookup
    ) as DocumentedThreadOutcome;

    expect(outcome.stance).toBe("complicated");
    // The commitment is that the reading survives, not that one phrase is used.
    // Asserting the exact wording made this test fail when the interpretive
    // branch said the same thing in the Game's own voice.
    expect(outcome.statement.toLowerCase()).toMatch(
      /(stands as yours|yours stands)/
    );
    expect(outcome.statement.toLowerCase()).not.toContain("wrong");
    expect(outcome.statement.toLowerCase()).not.toContain("incorrect");
  });

  it("never lets an interpretive relation speak as though it were a record", () => {
    // Twelve of the forty-four authored relations are readings the Game offers,
    // asserting nothing beyond the structures compared. Calling one of those a
    // record invents an authority the pack does not carry — the exact failure
    // CAV-009 exists to prevent.
    const interpretiveLookup: typeof lookup = {
      ...lookup,
      findRelation: (a, b) => {
        const relation = lookup.findRelation(a, b);
        return relation === null
          ? null
          : { ...relation, evidence: "interpretive" as const };
      },
    };
    for (const intention of ["echo", "passage", "tension", "ground"] as const) {
      const outcome = resolveThreadOutcome(
        singleThread(C.fibonacci, C.counterpoint, intention),
        interpretiveLookup
      ) as DocumentedThreadOutcome;
      const said = outcome.statement.toLowerCase();
      expect(said).not.toContain("the record");
      expect(said).not.toContain("is documented");
      expect(said).not.toContain("what is recorded");
      expect(said).toMatch(/reading|reads/);
    }
  });

  it("still speaks of the record when the evidence supports one", () => {
    for (const evidence of ["established", "attested", "contested"] as const) {
      const recordLookup: typeof lookup = {
        ...lookup,
        findRelation: (a, b) => {
          const relation = lookup.findRelation(a, b);
          return relation === null ? null : { ...relation, evidence };
        },
      };
      const outcome = resolveThreadOutcome(
        singleThread(C.fibonacci, C.counterpoint, "echo"),
        recordLookup
      ) as DocumentedThreadOutcome;
      expect(outcome.statement.toLowerCase()).toMatch(/record|documented/);
    }
  });

  it("maps every fit to exactly one stance", () => {
    expect(stanceForFit("primary")).toBe("confirmed");
    expect(stanceForFit("supported")).toBe("refined");
    expect(stanceForFit("partial")).toBe("refined");
    expect(stanceForFit("unsupported")).toBe("complicated");
  });

  it("reports the relation's authored shared facets rather than widening the claim", () => {
    const outcome = resolveThreadOutcome(
      singleThread(C.primes, C.polyrhythm, "echo"),
      lookup
    ) as DocumentedThreadOutcome;

    expect([...outcome.sharedFacets]).toEqual(["incommensurability"]);
  });

  it("resolves a documented pair even when the two concepts share no facet", () => {
    const outcome = resolveThreadOutcome(
      singleThread(C.just, C.equal, "tension"),
      lookup
    ) as DocumentedThreadOutcome;

    expect(sharedFacetsOf(C.just, C.equal, lookup)).toEqual([]);
    expect(outcome.kind).toBe("documented");
    expect(outcome.stance).toBe("confirmed");
  });

  it("does not depend on the order the player wove the pair", () => {
    const forward = resolveThreadOutcome(
      singleThread(C.symmetry, C.energy, "ground"),
      lookup
    ) as DocumentedThreadOutcome;
    const reverse = resolveThreadOutcome(
      singleThread(C.energy, C.symmetry, "ground"),
      lookup
    ) as DocumentedThreadOutcome;

    expect(reverse.relation.id).toBe(forward.relation.id);
    expect(reverse.stance).toBe(forward.stance);
  });
});

describe("resolveThreadOutcome — Open Threads", () => {
  it("builds a specific question from a shared facet and the declared intention", () => {
    const outcome = resolveThreadOutcome(
      singleThread(C.fibonacci, C.girih, "echo"),
      lookup
    ) as OpenThreadOutcome;

    expect(outcome.kind).toBe("open-thread");
    expect([...outcome.sharedFacets]).toEqual(["proportion", "recursion"]);
    expect(outcome.facet).toBe("recursion");
    expect(outcome.promptId).toBe("ot.echo.recursion");
    expect(outcome.question).toBe(
      "Does Recursion take the same form in Fibonacci Sequence that it takes in Girih Tiling, or only the same name?"
    );
    expect(outcome.question.endsWith("?")).toBe(true);
  });

  it("changes the question when the declared intention changes", () => {
    const echo = resolveThreadOutcome(
      singleThread(C.primes, C.divisionism, "echo"),
      lookup
    ) as OpenThreadOutcome;
    const passage = resolveThreadOutcome(
      singleThread(C.primes, C.divisionism, "passage"),
      lookup
    ) as OpenThreadOutcome;

    expect(echo.question).not.toBe(passage.question);
    expect(passage.question).toContain("What record would show the transmission?");
  });

  it("states plainly that nothing documented is being asserted", () => {
    const outcome = resolveThreadOutcome(
      singleThread(C.fibonacci, C.girih, "echo"),
      lookup
    ) as OpenThreadOutcome;

    expect(outcome.disclosure).toContain("cannot settle it");
    // Leads with the edge of the record, never with an absence (Schell #5).
    expect(outcome.disclosure.toLowerCase()).not.toMatch(/^castalia has no/);
    expect(outcome.disclosure.toLowerCase()).not.toContain("well done");
  });

  it("chooses the same facet on every run", () => {
    const runs = Array.from({ length: 8 }, () =>
      resolveThreadOutcome(
        singleThread(C.fibonacci, C.girih, "echo"),
        lookup
      ) as OpenThreadOutcome
    );
    expect(new Set(runs.map((run) => run.facet)).size).toBe(1);
    expect(new Set(runs.map((run) => run.question)).size).toBe(1);
  });

  it("falls back to a domain question and flags the content gap when no prompt exists", () => {
    const bare = createFixtureLookup({ withoutOpenThreadPrompts: true });
    const outcome = resolveThreadOutcome(
      singleThread(C.fibonacci, C.girih, "ground"),
      bare
    ) as OpenThreadOutcome;

    expect(outcome.promptId).toBeNull();
    expect(outcome.question).toContain("Fibonacci Sequence");
    expect(outcome.question).toContain("Girih Tiling");
    expect(outcome.question.endsWith("?")).toBe(true);
  });

  it("appears wherever a documented relation is withdrawn but a facet is still shared", () => {
    const bare = createFixtureLookup({ withoutRelations: true });
    const outcome = resolveThreadOutcome(singleThread(C.primes, C.polyrhythm), bare);

    expect(outcome.kind).toBe("open-thread");
  });
});

describe("resolveThreadOutcome — unresolved", () => {
  it("says only what is true when nothing is documented and nothing is shared", () => {
    const outcome = resolveThreadOutcome(
      singleThread(C.equal, C.energy, "echo"),
      lookup
    ) as UnresolvedThreadOutcome;

    expect(outcome.kind).toBe("unresolved");
    expect(outcome.statement).toBe(
      "Equal Temperament and Conservation of Energy share no facet Castalia knows, and nothing written joins them. The thread stands on your Echo reading alone."
    );
  });

  it("carries no praise, no filler, and no invented significance", () => {
    const outcome = resolveThreadOutcome(
      singleThread(C.fibonacci, C.energy, "passage"),
      lookup
    ) as UnresolvedThreadOutcome;

    for (const forbidden of [
      "everything is connected",
      "beautiful",
      "interesting",
      "influenced",
      "inspired",
      "perhaps",
    ]) {
      expect(outcome.statement.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("refuses to read a concept against itself", () => {
    const thread: CommittedThreadV1 = {
      id: toThreadId("thread:self"),
      pair: [C.fibonacci, C.fibonacci],
      intention: "echo",
      gesture: { inputModality: "keyboard" },
      eventId: toEventId("event:self"),
      sequence: 4,
      committedAt: 4000,
    };

    const outcome = resolveThreadOutcome(thread, lookup) as UnresolvedThreadOutcome;
    expect(outcome.kind).toBe("unresolved");
    expect(outcome.statement).toContain("against itself");
  });
});

describe("resolveSessionOutcomes", () => {
  const fixture = buildSessionFixture({
    conceptIds: [C.fibonacci, C.counterpoint, C.girih, C.energy],
    threads: [
      { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
      { a: C.fibonacci, b: C.girih, intention: "echo" },
      { a: C.girih, b: C.energy, intention: "ground" },
    ],
  });

  it("resolves every thread in creation order", () => {
    const outcomes = resolveSessionOutcomes(fixture.state, lookup);

    expect(outcomes.map((outcome) => outcome.kind)).toEqual([
      "documented",
      "open-thread",
      "unresolved",
    ]);
    expect(outcomes.map((outcome) => outcome.sequence)).toEqual(
      [...outcomes].map((outcome) => outcome.sequence).sort((a, b) => a - b)
    );
  });

  it("is stable under replay", () => {
    const replayed = buildSessionFixture({
      conceptIds: [C.fibonacci, C.counterpoint, C.girih, C.energy],
      threads: [
        { a: C.fibonacci, b: C.counterpoint, intention: "echo" },
        { a: C.fibonacci, b: C.girih, intention: "echo" },
        { a: C.girih, b: C.energy, intention: "ground" },
      ],
    });

    expect(resolveSessionOutcomes(replayed.state, lookup)).toEqual(
      resolveSessionOutcomes(fixture.state, lookup)
    );
  });
});
