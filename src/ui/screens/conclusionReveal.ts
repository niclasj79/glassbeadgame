/**
 * THE READING, ON THE PERFORMANCE'S CLOCK (VERTICAL-SLICE-SPEC §14).
 *
 * The domain compiles the concluded event log into a performance: what enters,
 * when, transformed how, how loud, and where the weight of the web falls. Until
 * this module existed nothing outside the domain read the timing at all. The
 * audio director rendered the voices; the page was stamped complete at t = 0
 * with a stagger built from five hard-coded constants — 0.3, 0.09, 0.18, 0.6,
 * 0.7 — that knew nothing about the session. A player therefore heard a
 * forty-second reconstruction of a Game they had just played while looking at a
 * document that had finished arriving before the first voice entered.
 *
 * §14 says threads enter in creation order. So they do, here, at the exact
 * seconds the compiler put them at, and the page assembles around them:
 *
 *   the annotation           steps on the performance's own beat, which is
 *                            derived from the web's density and tension load —
 *                            a dense web reads faster because it *is* faster;
 *   each thread              at `entries[i].atSeconds`, in creation order, one
 *                            for one with the voice that is sounding;
 *   the six readings         only once the last voice has finished, because a
 *                            reading of the whole web is a claim about a web
 *                            that has finished sounding;
 *   the close                at `totalSeconds`, when the performance ends.
 *
 * WHAT THIS IS NOT.
 *
 * It is not a progress bar and it cannot become one. There is no percentage
 * here, no elapsed-of-total, nothing that says how far through anything the
 * player is, and nothing on the schedule distinguishes one thread from another
 * — a documented relation, an Open Thread and an unresolved thread enter at the
 * time the compiler gave them and are set identically when they arrive
 * (CAV-006). `climax` is deliberately not read: the heaviest moment of a web is
 * a structural fact and marking it on the page would print a best thread, which
 * is the number ADR-010 removed wearing a different hat.
 *
 * It is also not a cutscene. The whole reading is one control away at every
 * moment (`ConclusionScreen`), and the schedule is a list of times rather than
 * a state machine, so completing it early is `steps.length` and nothing else.
 *
 * Pure, and independent of React. The narrow input contract below is a
 * structural subset of `ConclusionPerformance` in `domain/performance/types.ts`
 * — declared rather than imported, following `audio/conclusion.ts`, so the two
 * packages stay independently editable while the compiler's field names are
 * still checked structurally at the one call site that passes a real one.
 */

export interface PerformedEntryTiming {
  /** Creation order. The performance follows it exactly. */
  readonly order: number;
  readonly atSeconds: number;
  readonly durationSeconds: number;
}

export interface PerformanceTiming {
  readonly secondsPerBeat: number;
  readonly totalSeconds: number;
  readonly entries: readonly PerformedEntryTiming[];
}

/** What the page is asked to add. Never a score, never a fraction. */
export type RevealKind = "sentence" | "thread" | "reading" | "close";

export interface RevealStep {
  readonly atSeconds: number;
  readonly kind: RevealKind;
}

/** How much of the reading has arrived. */
export interface RevealState {
  readonly sentences: number;
  readonly threads: number;
  readonly readings: number;
  /** The performance has ended; the invitation stands. */
  readonly closed: boolean;
}

export interface ReadingParts {
  readonly sentences: number;
  readonly threads: number;
  readonly readings: number;
}

const NOTHING_REVEALED: RevealState = Object.freeze({
  sentences: 0,
  threads: 0,
  readings: 0,
  closed: false,
});

/**
 * A floor under the beat so a pathological tempo cannot produce a schedule of
 * zero-length steps. `compileConclusion` puts the tempo between 50 and 70 bpm,
 * so this never binds in practice; it exists so the function is total.
 */
const MIN_BEAT_SECONDS = 0.2;

/**
 * The schedule for one performance, in ascending time.
 *
 * Ties keep the order the parts are built in, which is the order they are read
 * in: a sentence that lands on the same beat as an entry is written before the
 * thread it is describing appears beneath it.
 */
export function revealSchedule(
  performance: PerformanceTiming,
  parts: ReadingParts
): readonly RevealStep[] {
  const beat = Math.max(MIN_BEAT_SECONDS, performance.secondsPerBeat);
  const entries = [...performance.entries].sort((a, b) => a.order - b.order);

  const steps: RevealStep[] = [];

  for (let i = 0; i < parts.sentences; i++) {
    steps.push({ atSeconds: i * beat, kind: "sentence" });
  }

  /*
   * One page entry per compiled entry, in creation order. A thread the compiler
   * has no entry for — it drops an outcome it cannot resolve — still has a line
   * in the register, so it is carried on the beat after the last voice rather
   * than silently withheld: the register is the record of what the player said
   * and nothing may remove a line from it.
   */
  let voicesEnd = 0;
  for (let i = 0; i < parts.threads; i++) {
    const entry = entries[i];
    const at = entry ? entry.atSeconds : voicesEnd + beat;
    steps.push({ atSeconds: at, kind: "thread" });
    const ends = entry ? entry.atSeconds + entry.durationSeconds : at;
    if (ends > voicesEnd) voicesEnd = ends;
  }

  // The web has finished sounding: now it can be characterised.
  const readingsFrom = Math.max(voicesEnd, parts.sentences * beat);
  for (let j = 0; j < parts.readings; j++) {
    steps.push({ atSeconds: readingsFrom + j * beat, kind: "reading" });
  }

  const lastMark = steps.reduce((at, step) => Math.max(at, step.atSeconds), 0);
  steps.push({
    atSeconds: Math.max(performance.totalSeconds, lastMark + beat),
    kind: "close",
  });

  // Stable by construction: `sort` is stable, so equal times keep build order.
  return Object.freeze(
    [...steps].sort((a, b) => a.atSeconds - b.atSeconds)
  );
}

/** What is on the page once `taken` steps have been played. */
export function revealAfter(
  steps: readonly RevealStep[],
  taken: number
): RevealState {
  if (taken <= 0) return NOTHING_REVEALED;
  let sentences = 0;
  let threads = 0;
  let readings = 0;
  let closed = false;
  const upTo = Math.min(taken, steps.length);
  for (let i = 0; i < upTo; i++) {
    switch (steps[i].kind) {
      case "sentence":
        sentences += 1;
        break;
      case "thread":
        threads += 1;
        break;
      case "reading":
        readings += 1;
        break;
      case "close":
        closed = true;
        break;
    }
  }
  return Object.freeze({ sentences, threads, readings, closed });
}

/**
 * How long to wait before playing step `taken`, given how long the page has
 * been open. Never negative: a tab that was backgrounded returns to a schedule
 * it has already passed, and the remaining steps are played at once rather
 * than being replayed against a clock that moved without it.
 */
export function delayMsFor(
  steps: readonly RevealStep[],
  taken: number,
  elapsedMs: number
): number {
  const step = steps[taken];
  if (step === undefined) return 0;
  return Math.max(0, step.atSeconds * 1000 - elapsedMs);
}
