import { describe, expect, it } from "vitest";
import { RELATION_INTENTIONS, type RelationIntention } from "../../domain/events";
import { toConceptId } from "../../domain/ids";
import {
  armDraftIntention,
  attendDraft,
  cancelDraft,
  createInterpretationDraft,
  INACTIVE_INTERPRETATION_DRAFT,
  INTERPRETATION_DRAFT_ERROR_CODES,
  INTERPRETATION_DRAFT_STAGES,
  InterpretationDraftError,
  selectDraftCandidate,
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

function armed(intention: RelationIntention = "echo") {
  return armDraftIntention(attending(), intention);
}

function selected(intention: RelationIntention = "echo") {
  return selectDraftCandidate(armed(intention), IDS.counterpoint, SESSION_CONCEPT_IDS);
}

function unsafeDraft(value: unknown): InterpretationDraft {
  return value as InterpretationDraft;
}

describe("interpretation draft", () => {
  it("exports closed frozen stage and error vocabularies", () => {
    expect(INTERPRETATION_DRAFT_STAGES).toEqual([
      "inactive",
      "attending",
      "armed",
      "candidate-selected",
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

  it("re-Attend replaces every active stage and discards intention and candidate", () => {
    const activeDrafts: readonly InterpretationDraft[] = [
      attending(),
      armed("passage"),
      selected("tension"),
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

  it.each(RELATION_INTENTIONS)("arms the accepted %s intention", (intention) => {
    const result = armDraftIntention(attending(), intention);

    expect(result).toEqual({
      stage: "armed",
      attendedConceptId: IDS.fibonacci,
      intention,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("replaces an armed intention without selecting a candidate", () => {
    const first = armed("echo");
    const result = armDraftIntention(first, "ground");

    expect(result).toEqual({
      stage: "armed",
      attendedConceptId: IDS.fibonacci,
      intention: "ground",
    });
    expect(first).toEqual({
      stage: "armed",
      attendedConceptId: IDS.fibonacci,
      intention: "echo",
    });
  });

  it("selects a distinct session candidate in attended-to-candidate order", () => {
    const draft = armed("passage");
    const result = selectDraftCandidate(
      draft,
      IDS.counterpoint,
      SESSION_CONCEPT_IDS
    );

    expect(result).toEqual({
      stage: "candidate-selected",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.counterpoint,
      intention: "passage",
      pair: [IDS.fibonacci, IDS.counterpoint],
    });
    expect(draft).toEqual({
      stage: "armed",
      attendedConceptId: IDS.fibonacci,
      intention: "passage",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.pair)).toBe(true);
  });

  it("cancels exactly one provisional stage at a time", () => {
    const candidateSelected = selected("tension");
    const backToArmed = cancelDraft(candidateSelected);
    const backToAttending = cancelDraft(backToArmed);
    const backToInactive = cancelDraft(backToAttending);

    expect(backToArmed).toEqual({
      stage: "armed",
      attendedConceptId: IDS.fibonacci,
      intention: "tension",
    });
    expect(backToAttending).toEqual({
      stage: "attending",
      attendedConceptId: IDS.fibonacci,
    });
    expect(backToInactive).toBe(INACTIVE_INTERPRETATION_DRAFT);
    expect(Object.isFrozen(backToArmed)).toBe(true);
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
      () => selectDraftCandidate(armed(), IDS.unknown, SESSION_CONCEPT_IDS),
      "unknown-concept"
    );
  });

  it("rejects an attended concept missing from the candidate session context", () => {
    expectErrorCode(
      () =>
        selectDraftCandidate(armed(), IDS.perspective, [
          IDS.counterpoint,
          IDS.perspective,
        ]),
      "unknown-concept"
    );
  });

  it("rejects selecting the attended concept as its own candidate", () => {
    expectErrorCode(
      () => selectDraftCandidate(armed(), IDS.fibonacci, SESSION_CONCEPT_IDS),
      "identical-concepts"
    );
  });

  it("rejects unsupported intentions without coercion or defaults", () => {
    expectErrorCode(
      () => armDraftIntention(attending(), "analogy" as RelationIntention),
      "unsupported-intention"
    );
  });

  it("rejects arm and candidate selection out of order", () => {
    expectErrorCode(
      () => armDraftIntention(createInterpretationDraft(), "echo"),
      "invalid-transition-order"
    );
    expectErrorCode(
      () => armDraftIntention(selected(), "ground"),
      "invalid-transition-order"
    );
    expectErrorCode(
      () =>
        selectDraftCandidate(
          createInterpretationDraft(),
          IDS.counterpoint,
          SESSION_CONCEPT_IDS
        ),
      "invalid-transition-order"
    );
    expectErrorCode(
      () => selectDraftCandidate(attending(), IDS.counterpoint, SESSION_CONCEPT_IDS),
      "invalid-transition-order"
    );
  });

  it("fails closed for an unrecognized runtime draft stage", () => {
    const invalid = unsafeDraft({ stage: "weaving" });
    expectErrorCode(
      () => attendDraft(invalid, IDS.fibonacci, SESSION_CONCEPT_IDS),
      "invalid-transition-order"
    );
    expectErrorCode(() => cancelDraft(invalid), "invalid-transition-order");
  });

  it("is byte deterministic, deeply immutable, and does not mutate inputs", () => {
    const sessionConceptIds = [...SESSION_CONCEPT_IDS];
    const run = () => {
      const inactive = createInterpretationDraft();
      const attention = attendDraft(inactive, IDS.fibonacci, sessionConceptIds);
      const intention = armDraftIntention(attention, "ground");
      return selectDraftCandidate(intention, IDS.perspective, sessionConceptIds);
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
    const drafts = [
      createInterpretationDraft(),
      attending(),
      armed(),
      selected(),
    ];
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
