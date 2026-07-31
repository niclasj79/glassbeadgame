import { describe, expect, it } from "vitest";
import { toConceptId, toThreadId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import {
  ATTUNEMENT_THRESHOLDS,
  isAttunementEligible,
} from "./attunementEligibility";

const session = (
  pairs: readonly (readonly [string, string])[],
  options: { motifs?: number; concluded?: boolean } = {}
): SessionStateV1 =>
  ({
    threads: pairs.map((pair, index) => ({
      id: toThreadId(`t${index}`),
      pair: [toConceptId(pair[0]), toConceptId(pair[1])],
    })),
    completedMotifs: Array.from({ length: options.motifs ?? 0 }, (_, i) => ({
      completionId: `m${i}`,
    })),
    concluded: options.concluded ?? false,
  }) as unknown as SessionStateV1;

/** A connected chain a..z of the requested length. */
const chain = (links: number): readonly (readonly [string, string])[] =>
  Array.from({ length: links }, (_, i) => [`c${i}`, `c${i + 1}`] as const);

describe("attunement eligibility", () => {
  it("is unavailable on an empty web", () => {
    expect(isAttunementEligible(session([]))).toBe(false);
  });

  it("is never available after the session has concluded", () => {
    expect(
      isAttunementEligible(session(chain(9), { motifs: 2, concluded: true }))
    ).toBe(false);
  });

  it("opens sooner once a motif has formed, because the web has said something", () => {
    const threads = chain(ATTUNEMENT_THRESHOLDS.minThreadsWithMotif);
    expect(isAttunementEligible(session(threads))).toBe(false);
    expect(isAttunementEligible(session(threads, { motifs: 1 }))).toBe(true);
  });

  it("still opens for a broad web that never closes a motif", () => {
    expect(
      isAttunementEligible(session(chain(ATTUNEMENT_THRESHOLDS.minThreadsWithoutMotif)))
    ).toBe(true);
  });

  it("refuses scattered pairs however many there are", () => {
    // A handful of unrelated remarks is not something you can listen through,
    // so count alone must never be enough.
    const scattered = Array.from(
      { length: 10 },
      (_, i) => [`a${i}`, `b${i}`] as const
    );
    expect(isAttunementEligible(session(scattered))).toBe(false);
  });

  it("cannot be farmed by repeating one pairing", () => {
    // Repeating a pair adds threads but no shape. The reducer would reject the
    // duplicate thread id anyway; this asserts the rule does not reward it.
    const repeated = Array.from({ length: 9 }, () => ["x", "y"] as const);
    expect(isAttunementEligible(session(repeated))).toBe(false);
  });

  it("is monotone in a growing connected web", () => {
    // Once invited, it must not withdraw the invitation as the web grows.
    let sawEligible = false;
    for (let links = 1; links <= 12; links += 1) {
      const eligible = isAttunementEligible(session(chain(links)));
      if (eligible) sawEligible = true;
      else expect(sawEligible).toBe(false);
    }
    expect(sawEligible).toBe(true);
  });
});
