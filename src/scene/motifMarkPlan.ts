import type { CompletedMotifV1 } from "@/domain/model";
import { MOTIF_KINDS, type MotifKind } from "@/domain/motifs";

/**
 * WHICH PERSISTENT MARK A COMPLETED MOTIF EARNS.
 *
 * Pure, so "does completing a motif change the world?" is a unit test rather
 * than a screenshot argument — which matters, because the answer was *no* for
 * the whole life of the campaign. `scene/MotifMarks.tsx` matched its motifs
 * against `useStore().session.motifs`, the legacy presentation projection, which
 * is published empty and has had no writer since the legacy scoring model was
 * removed. It also switched on `triad`, `symposium` and `fugue`, and the
 * domain's families have been `dialectic`, `canon` and `bridge` for a long time,
 * so even a populated projection would have fallen through every branch. Against
 * spec §12: "Completion changes the score and world, not merely a badge."
 *
 * A mark is a *construction*, never a colour and never a badge:
 *
 *   dialectic  a closed circuit through the three concepts — the holding, drawn
 *   canon      a light forever walking the carriers' path — recurrence, moving
 *   bridge     a ring turning about the span — the region, held at one joint
 */

export type MotifMarkKind = MotifKind;

export interface MotifMark {
  /** The completion this mark belongs to. Stable across replays. */
  readonly key: string;
  readonly kind: MotifMarkKind;
  /** The concepts the mark is drawn through, in the domain's own order. */
  readonly beads: readonly string[];
}

/**
 * Marks are permanent, but a long session can complete many and each one costs
 * a draw call and a frame of work. The most recent few are drawn.
 */
export const MAX_MOTIF_MARKS = 4;

/** A family the world knows how to mark, or nothing. Never a guess. */
export function asMotifKind(value: string): MotifKind | null {
  return (MOTIF_KINDS as readonly string[]).includes(value)
    ? (value as MotifKind)
    : null;
}

/**
 * The marks the world should be carrying, given the canonical session's
 * completed motifs. A completion whose family this build does not know, or
 * whose participants are fewer than a figure needs, earns nothing — silence
 * beats a mark that means something else.
 */
export function planMotifMarks(
  completed: readonly CompletedMotifV1[],
  max: number = MAX_MOTIF_MARKS
): readonly MotifMark[] {
  const marks: MotifMark[] = [];
  for (const motif of completed) {
    const kind = asMotifKind(String(motif.motifKindId));
    if (kind === null) continue;
    const beads = motif.conceptIds.map((id) => String(id));
    if (beads.length < 2) continue;
    marks.push(Object.freeze({ key: String(motif.completionId), kind, beads }));
  }
  return Object.freeze(marks.slice(-Math.max(0, max)));
}
