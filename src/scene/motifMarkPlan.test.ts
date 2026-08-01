import { describe, expect, it } from "vitest";
import type { CompletedMotifV1 } from "@/domain/model";
import {
  toConceptId,
  toEventId,
  toMotifCompletionId,
  toMotifKindId,
  toThreadId,
} from "@/domain/ids";
import { MOTIF_KINDS } from "@/domain/motifs";
import { MAX_MOTIF_MARKS, planMotifMarks } from "./motifMarkPlan";

/**
 * "Completion changes the score and world, not merely a badge" (spec §12).
 *
 * It did neither. `scene/MotifMarks.tsx` matched `motifId` against
 * `useStore().session.motifs` — a projection published empty, with no writer
 * since the legacy scoring model was retired — and switched on `triad`,
 * `symposium` and `fugue` while the domain has detected `dialectic`, `canon`
 * and `bridge` for a long time. Two independent reasons for the same silence.
 */

let sequence = 0;

function completion(kind: string, conceptIds: readonly string[]): CompletedMotifV1 {
  sequence += 1;
  return {
    eventId: toEventId(`event-0000-0000-0000-00000000000${sequence % 10}`),
    sequence,
    completedAt: sequence,
    completionId: toMotifCompletionId(`completion:${sequence}`),
    motifKindId: toMotifKindId(kind),
    conceptIds: conceptIds.map(toConceptId),
    threadIds: [toThreadId(`thread:${sequence}`)],
  };
}

const A = "measure.fibonacci-sequence";
const B = "sound.counterpoint";
const C = "measure.prime-numbers";

describe("planMotifMarks", () => {
  it("marks every family the domain actually detects", () => {
    const marks = planMotifMarks([
      completion("dialectic", [A, B, C]),
      completion("canon", [A, B, C]),
      completion("bridge", [A, B, C]),
    ]);
    expect(marks.map((mark) => mark.kind)).toEqual([
      "dialectic",
      "canon",
      "bridge",
    ]);
    for (const kind of MOTIF_KINDS) {
      expect(marks.some((mark) => mark.kind === kind)).toBe(true);
    }
  });

  /**
   * The prototype's families. Silence beats a mark that means something else:
   * a completion this build cannot name earns nothing rather than a guess.
   */
  it("refuses to mark a family it cannot name", () => {
    expect(
      planMotifMarks([
        completion("triad", [A, B, C]),
        completion("symposium", [A, B, C]),
        completion("fugue", [A, B, C]),
      ])
    ).toEqual([]);
  });

  it("carries the concepts the motif was formed from", () => {
    const [mark] = planMotifMarks([completion("canon", [A, B, C])]);
    expect(mark.beads).toEqual([A, B, C]);
  });

  it("keys a mark by its completion, so two of a family are two marks", () => {
    const marks = planMotifMarks([
      completion("canon", [A, B, C]),
      completion("canon", [B, C, A]),
    ]);
    expect(marks).toHaveLength(2);
    expect(new Set(marks.map((mark) => mark.key)).size).toBe(2);
  });

  it("draws no figure through fewer concepts than a figure needs", () => {
    expect(planMotifMarks([completion("bridge", [A])])).toEqual([]);
  });

  it("stays bounded however many motifs a long session completes", () => {
    const many = Array.from({ length: 30 }, () => completion("canon", [A, B, C]));
    expect(planMotifMarks(many)).toHaveLength(MAX_MOTIF_MARKS);
  });

  it("marks nothing before a motif has completed", () => {
    expect(planMotifMarks([])).toEqual([]);
  });
});
