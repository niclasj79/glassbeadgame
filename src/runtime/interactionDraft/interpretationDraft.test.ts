import { describe, expect, it } from "vitest";
import { RELATION_INTENTIONS, type RelationIntention } from "../../domain/events";
import { toConceptId } from "../../domain/ids";
import {
  attendDraft,
  cancelDraft,
  chooseDraftReading,
  createInterpretationDraft,
  INACTIVE_INTERPRETATION_DRAFT,
  INTERPRETATION_DRAFT_ERROR_CODES,
  INTERPRETATION_DRAFT_STAGES,
  InterpretationDraftError,
  lockDraftCandidate,
  type InterpretationDraft,
  type InterpretationDraftErrorCode,
} from ".";

const IDS = Object.freeze({
  fibonacci: toConceptId("math.fibonacci-sequence"),
  counterpoint: toConceptId("music.counterpoint"),
  perspective: toConceptId("image.perspective"),
  unknown: toConceptId("unknown.concept"),
});

const SESSION_CONCEPT_IDS = Object.freeze([
  IDS.fibonacci,
  IDS.counterpoint,
  IDS.perspective,
]);

function expectErrorCode(
  action: () => unknown,
  code: InterpretationDraftErrorCode
): InterpretationDraftError {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(InterpretationDraftError);
  expect((thrown as InterpretationDraftError).code).toBe(code);
  return thrown as InterpretationDraftError;
}

function attending() {
  return attendDraft(createInterpretationDraft(), IDS.fibonacci, SESSION_CONCEPT_IDS);
}

function locked(candidate = IDS.counterpoint) {
  return lockDraftCandidate(attending(), candidate, SESSION_CONCEPT_IDS);
}

function reading(intention: RelationIntention = "echo") {
  return chooseDraftReading(locked(), intention);
}

function unsafeDraft(value: unknown): InterpretationDraft {
  return value as InterpretationDraft;
}

describe("interpretation draft — pair before reading (I-016)", () => {
  it("exports closed frozen stage and error vocabularies", () => {
    expect(INTERPRETATION_DRAFT_STAGES).toEqual([
      "inactive",
      "attending",
      "locked",
      "reading",
    ]);
    expect(INTERPRETATION_DRAFT_ERROR_CODES).toEqual([
      "invalid-session-concepts",
      "unknown-concept",
      "identical-concepts",
      "unsupported-intention",
      "invalid-transition-order",
    ]);
    expect(Object.isFrozen(INTERPRETATION_DRAFT_STAGES)).toBe(true);
    expect(Object.isFrozen(INTERPRETATION_DRAFT_ERROR_CODES)).toBe(true);
  });

  it("creates one frozen inactive reference and preserves it when cancelled", () => {
    const first = createInterpretationDraft();
    const second = createInterpretationDraft();

    expect(first).toBe(INACTIVE_INTERPRETATION_DRAFT);
    expect(second).toBe(first);
    expect(cancelDraft(first)).toBe(first);
    expect(first).toEqual({ stage: "inactive" });
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("attends a known concept without mutating the supplied session collection", () => {
    const sessionConceptIds = [...SESSION_CONCEPT_IDS];
    const snapshot = [...sessionConceptIds];
    const result = attendDraft(
      createInterpretationDraft(),
      IDS.fibonacci,
      sessionConceptIds
    );

    expect(result).toEqual({
      stage: "attending",
      attendedConceptId: IDS.fibonacci,
    });
    expect(sessionConceptIds).toEqual(snapshot);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("re-Attend replaces every active stage and discards candidate and reading", () => {
    const activeDrafts: readonly InterpretationDraft[] = [
      attending(),
      locked(),
      reading("tension"),
    ];

    for (const draft of activeDrafts) {
      const result = attendDraft(draft, IDS.perspective, SESSION_CONCEPT_IDS);
      expect(result).toEqual({
        stage: "attending",
        attendedConceptId: IDS.perspective,
      });
      expect(Object.keys(result)).toEqual(["stage", "attendedConceptId"]);
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it("locks a distinct session candidate in attended-to-candidate order, with no reading", () => {
    const draft = attending();
    const result = lockDraftCandidate(draft, IDS.counterpoint, SESSION_CONCEPT_IDS);

    expect(result).toEqual({
      stage: "locked",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.counterpoint,
      pair: [IDS.fibonacci, IDS.counterpoint],
    });
    expect(Object.keys(result)).not.toContain("intention");
    expect(draft).toEqual({ stage: "attending", attendedConceptId: IDS.fibonacci });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.pair)).toBe(true);
  });

  it("re-locks from locked and from reading, dropping the chosen reading (I-008)", () => {
    const fromLocked = lockDraftCandidate(locked(), IDS.perspective, SESSION_CONCEPT_IDS);
    const fromReading = lockDraftCandidate(
      reading("ground"),
      IDS.perspective,
      SESSION_CONCEPT_IDS
    );

    for (const result of [fromLocked, fromReading]) {
      expect(result).toEqual({
        stage: "locked",
        attendedConceptId: IDS.fibonacci,
        candidateConceptId: IDS.perspective,
        pair: [IDS.fibonacci, IDS.perspective],
      });
      expect(Object.keys(result)).not.toContain("intention");
    }
  });

  it.each(RELATION_INTENTIONS)("chooses the accepted %s reading for a locked pair", (intention) => {
    const result = chooseDraftReading(locked(), intention);

    expect(result).toEqual({
      stage: "reading",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.counterpoint,
      intention,
      pair: [IDS.fibonacci, IDS.counterpoint],
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("changes a chosen reading explicitly without touching the pair", () => {
    const first = reading("echo");
    const result = chooseDraftReading(first, "ground");

    expect(result.intention).toBe("ground");
    expect(result.pair).toBe(first.pair);
    expect(first.intention).toBe("echo");
  });

  it("cancels exactly one provisional stage at a time: Read → Lock → Attend → Roam", () => {
    const chosen = reading("tension");
    const backToLocked = cancelDraft(chosen);
    const backToAttending = cancelDraft(backToLocked);
    const backToInactive = cancelDraft(backToAttending);

    expect(backToLocked).toEqual({
      stage: "locked",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.counterpoint,
      pair: [IDS.fibonacci, IDS.counterpoint],
    });
    expect(backToAttending).toEqual({
      stage: "attending",
      attendedConceptId: IDS.fibonacci,
    });
    expect(backToInactive).toBe(INACTIVE_INTERPRETATION_DRAFT);
    expect(Object.isFrozen(backToLocked)).toBe(true);
    expect(Object.isFrozen(backToAttending)).toBe(true);
  });

  it.each([
    [[], "an empty collection"],
    [[IDS.fibonacci], "a one-concept collection"],
    [[IDS.fibonacci, IDS.fibonacci], "duplicate concepts"],
    [[IDS.fibonacci, ""], "an invalid concept"],
    [null, "a non-array collection"],
  ] as const)("rejects %s as invalid session concepts", (value, _label) => {
    expectErrorCode(
      () =>
        attendDraft(
          createInterpretationDraft(),
          IDS.fibonacci,
          value as unknown as readonly typeof IDS.fibonacci[]
        ),
      "invalid-session-concepts"
    );
  });

  it("rejects unknown attended and candidate concepts", () => {
    expectErrorCode(
      () =>
        attendDraft(createInterpretationDraft(), IDS.unknown, SESSION_CONCEPT_IDS),
      "unknown-concept"
    );
    expectErrorCode(
      () => lockDraftCandidate(attending(), IDS.unknown, SESSION_CONCEPT_IDS),
      "unknown-concept"
    );
  });

  it("rejects an attended concept missing from the candidate session context", () => {
    expectErrorCode(
      () =>
        lockDraftCandidate(attending(), IDS.perspective, [
          IDS.counterpoint,
          IDS.perspective,
        ]),
      "unknown-concept"
    );
  });

  it("rejects locking the attended concept as its own second bead", () => {
    expectErrorCode(
      () => lockDraftCandidate(attending(), IDS.fibonacci, SESSION_CONCEPT_IDS),
      "identical-concepts"
    );
  });

  it("rejects unsupported readings without coercion or defaults", () => {
    expectErrorCode(
      () => chooseDraftReading(locked(), "analogy" as RelationIntention),
      "unsupported-intention"
    );
  });

  it("rejects lock and reading out of order", () => {
    expectErrorCode(
      () =>
        lockDraftCandidate(
          createInterpretationDraft(),
          IDS.counterpoint,
          SESSION_CONCEPT_IDS
        ),
      "invalid-transition-order"
    );
    expectErrorCode(
      () => chooseDraftReading(createInterpretationDraft(), "echo"),
      "invalid-transition-order"
    );
    expectErrorCode(
      () => chooseDraftReading(attending(), "echo"),
      "invalid-transition-order"
    );
  });

  it("fails closed for an unrecognized runtime draft stage", () => {
    const invalid = unsafeDraft({ stage: "armed", attendedConceptId: IDS.fibonacci });
    expectErrorCode(
      () => attendDraft(invalid, IDS.fibonacci, SESSION_CONCEPT_IDS),
      "invalid-transition-order"
    );
    expectErrorCode(
      () => lockDraftCandidate(invalid, IDS.counterpoint, SESSION_CONCEPT_IDS),
      "invalid-transition-order"
    );
    expectErrorCode(() => chooseDraftReading(invalid, "echo"), "invalid-transition-order");
    expectErrorCode(() => cancelDraft(invalid), "invalid-transition-order");
  });

  it("is byte deterministic, deeply immutable, and does not mutate inputs", () => {
    const sessionConceptIds = [...SESSION_CONCEPT_IDS];
    const run = () => {
      const inactive = createInterpretationDraft();
      const attention = attendDraft(inactive, IDS.fibonacci, sessionConceptIds);
      const pair = lockDraftCandidate(attention, IDS.perspective, sessionConceptIds);
      return chooseDraftReading(pair, "ground");
    };
    const snapshot = [...sessionConceptIds];
    const first = run();
    const second = run();

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(sessionConceptIds).toEqual(snapshot);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.pair)).toBe(true);
  });

  it("exposes no durable, temporal, store, gesture, resonance, or presentation fields", () => {
    const drafts = [createInterpretationDraft(), attending(), locked(), reading()];
    const forbiddenKeys = new Set([
      "event",
      "events",
      "eventLog",
      "store",
      "session",
      "sequence",
      "at",
      "time",
      "gesture",
      "resonance",
      "sighted",
      "camera",
      "audio",
      "ui",
    ]);

    for (const draft of drafts) {
      for (const key of Object.keys(draft)) {
        expect(forbiddenKeys.has(key)).toBe(false);
      }
    }
  });
});
