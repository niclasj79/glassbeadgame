import { describe, expect, expectTypeOf, it } from "vitest";
import type { RelationIntention } from "../../domain/events";
import { toConceptId } from "../../domain/ids";
import {
  INACTIVE_INTERPRETATION_DRAFT,
  InterpretationDraftError,
  type InterpretationDraft,
} from "../../runtime/interactionDraft";
import {
  createInterpretationDraftStore,
  type InterpretationDraftStore,
} from ".";

const IDS = Object.freeze({
  fibonacci: toConceptId("math.fibonacci-sequence"),
  counterpoint: toConceptId("music.counterpoint"),
  primeNumbers: toConceptId("math.prime-numbers"),
  unknown: toConceptId("unknown.concept"),
});

const SESSION_CONCEPT_IDS = Object.freeze([
  IDS.fibonacci,
  IDS.counterpoint,
  IDS.primeNumbers,
]);

type ActiveDraftStage = Exclude<InterpretationDraft["stage"], "inactive">;

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function advanceTo(
  store: InterpretationDraftStore,
  stage: ActiveDraftStage
): void {
  store.getState().attend(IDS.fibonacci, SESSION_CONCEPT_IDS);
  if (stage === "attending") return;

  store.getState().armIntention("echo");
  if (stage === "armed") return;

  store.getState().selectCandidate(IDS.counterpoint, SESSION_CONCEPT_IDS);
}

function expectStableActions(
  before: ReturnType<InterpretationDraftStore["getState"]>,
  after: ReturnType<InterpretationDraftStore["getState"]>
): void {
  expect(after.attend).toBe(before.attend);
  expect(after.armIntention).toBe(before.armIntention);
  expect(after.selectCandidate).toBe(before.selectCandidate);
  expect(after.cancel).toBe(before.cancel);
  expect(after.reset).toBe(before.reset);
}

describe("createInterpretationDraftStore", () => {
  it("creates isolated inactive stores with a narrow public API and stable actions", () => {
    const first = createInterpretationDraftStore();
    const second = createInterpretationDraftStore();
    const initial = first.getState();
    type HasSetState = "setState" extends keyof InterpretationDraftStore
      ? true
      : false;

    expectTypeOf<HasSetState>().toEqualTypeOf<false>();
    expect(first).not.toBe(second);
    expect(initial.draft).toBe(INACTIVE_INTERPRETATION_DRAFT);
    expect(second.getState().draft).toBe(INACTIVE_INTERPRETATION_DRAFT);
    expect(first.getInitialState()).toBe(initial);
    expect(Object.keys(initial).sort()).toEqual([
      "armIntention",
      "attend",
      "cancel",
      "draft",
      "reset",
      "selectCandidate",
    ]);

    initial.attend(IDS.fibonacci, SESSION_CONCEPT_IDS);

    expect(first.getState().draft.stage).toBe("attending");
    expect(second.getState().draft).toBe(INACTIVE_INTERPRETATION_DRAFT);
    expectStableActions(initial, first.getState());
  });

  it("publishes the complete Attend, arm, and candidate sequence once per transition", () => {
    const store = createInterpretationDraftStore();
    const initial = store.getState();
    const published: InterpretationDraft[] = [];
    store.subscribe((state) => published.push(state.draft));

    store.getState().attend(IDS.fibonacci, SESSION_CONCEPT_IDS);
    store.getState().armIntention("echo");
    store.getState().selectCandidate(IDS.counterpoint, SESSION_CONCEPT_IDS);

    expect(published.map((draft) => draft.stage)).toEqual([
      "attending",
      "armed",
      "candidate-selected",
    ]);
    expect(store.getState().draft).toEqual({
      stage: "candidate-selected",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.counterpoint,
      intention: "echo",
      pair: [IDS.fibonacci, IDS.counterpoint],
    });
    expectDeeplyFrozen(store.getState().draft);
    expectStableActions(initial, store.getState());
  });

  it.each(["attending", "armed", "candidate-selected"] as const)(
    "re-Attend replaces a %s draft with one new attending draft",
    (stage) => {
      const store = createInterpretationDraftStore();
      advanceTo(store, stage);
      const before = store.getState();
      const priorDraft = before.draft;
      let notifications = 0;
      store.subscribe(() => {
        notifications += 1;
      });

      store.getState().attend(IDS.primeNumbers, SESSION_CONCEPT_IDS);

      expect(notifications).toBe(1);
      expect(store.getState().draft).toEqual({
        stage: "attending",
        attendedConceptId: IDS.primeNumbers,
      });
      expectDeeplyFrozen(priorDraft);
      expectStableActions(before, store.getState());
    }
  );

  it("re-arms explicitly with one new immutable draft", () => {
    const store = createInterpretationDraftStore();
    advanceTo(store, "armed");
    const before = store.getState();
    const priorDraft = before.draft;
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.getState().armIntention("tension");

    expect(notifications).toBe(1);
    expect(store.getState().draft).toEqual({
      stage: "armed",
      attendedConceptId: IDS.fibonacci,
      intention: "tension",
    });
    expect(priorDraft).toEqual({
      stage: "armed",
      attendedConceptId: IDS.fibonacci,
      intention: "echo",
    });
    expectDeeplyFrozen(store.getState().draft);
    expectStableActions(before, store.getState());
  });

  it("follows the complete cancellation hierarchy and makes inactive cancel a no-op", () => {
    const store = createInterpretationDraftStore();
    advanceTo(store, "candidate-selected");
    const published: InterpretationDraft[] = [];
    store.subscribe((state) => published.push(state.draft));

    store.getState().cancel();
    store.getState().cancel();
    store.getState().cancel();

    expect(published.map((draft) => draft.stage)).toEqual([
      "armed",
      "attending",
      "inactive",
    ]);
    expect(store.getState().draft).toBe(INACTIVE_INTERPRETATION_DRAFT);

    const inactive = store.getState();
    store.getState().cancel();

    expect(published).toHaveLength(3);
    expect(store.getState()).toBe(inactive);
  });

  it.each(["attending", "armed", "candidate-selected"] as const)(
    "resets a %s draft once without changing prior values",
    (stage) => {
      const store = createInterpretationDraftStore();
      advanceTo(store, stage);
      const before = store.getState();
      const priorDraft = before.draft;
      let notifications = 0;
      store.subscribe(() => {
        notifications += 1;
      });

      store.getState().reset();

      expect(notifications).toBe(1);
      expect(store.getState().draft).toBe(INACTIVE_INTERPRETATION_DRAFT);
      expectDeeplyFrozen(priorDraft);
      expectStableActions(before, store.getState());
    }
  );

  it("makes reset an observable no-op when already inactive", () => {
    const store = createInterpretationDraftStore();
    const before = store.getState();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.getState().reset();

    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
    expect(store.getState().draft).toBe(INACTIVE_INTERPRETATION_DRAFT);
  });

  it.each([
    {
      label: "invalid session concepts",
      prepare: (_store: InterpretationDraftStore) => undefined,
      act: (store: InterpretationDraftStore) =>
        store.getState().attend(IDS.fibonacci, [IDS.fibonacci]),
      code: "invalid-session-concepts",
    },
    {
      label: "unknown attended concept",
      prepare: (_store: InterpretationDraftStore) => undefined,
      act: (store: InterpretationDraftStore) =>
        store.getState().attend(IDS.unknown, SESSION_CONCEPT_IDS),
      code: "unknown-concept",
    },
    {
      label: "unsupported intention",
      prepare: (store: InterpretationDraftStore) => advanceTo(store, "attending"),
      act: (store: InterpretationDraftStore) =>
        store.getState().armIntention("analogy" as RelationIntention),
      code: "unsupported-intention",
    },
    {
      label: "identical concepts",
      prepare: (store: InterpretationDraftStore) => advanceTo(store, "armed"),
      act: (store: InterpretationDraftStore) =>
        store.getState().selectCandidate(IDS.fibonacci, SESSION_CONCEPT_IDS),
      code: "identical-concepts",
    },
    {
      label: "unknown candidate",
      prepare: (store: InterpretationDraftStore) => advanceTo(store, "armed"),
      act: (store: InterpretationDraftStore) =>
        store.getState().selectCandidate(IDS.unknown, SESSION_CONCEPT_IDS),
      code: "unknown-concept",
    },
    {
      label: "invalid transition order",
      prepare: (_store: InterpretationDraftStore) => undefined,
      act: (store: InterpretationDraftStore) =>
        store.getState().armIntention("echo"),
      code: "invalid-transition-order",
    },
  ] as const)("propagates $label without publishing", ({ prepare, act, code }) => {
    const store = createInterpretationDraftStore();
    prepare(store);
    const before = store.getState();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });
    let thrown: unknown;

    try {
      act(store);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InterpretationDraftError);
    expect(thrown).toMatchObject({ name: "InterpretationDraftError", code });
    expect(notifications).toBe(0);
    expect(store.getState()).toBe(before);
    expect(store.getState().draft).toBe(before.draft);
    expectStableActions(before, store.getState());
  });

  it("does not mutate or retain caller-owned session concepts", () => {
    const store = createInterpretationDraftStore();
    const sessionConceptIds = [IDS.fibonacci, IDS.counterpoint];
    const snapshot = [...sessionConceptIds];

    store.getState().attend(IDS.fibonacci, sessionConceptIds);
    store.getState().armIntention("ground");
    store.getState().selectCandidate(IDS.counterpoint, sessionConceptIds);
    sessionConceptIds.push(IDS.primeNumbers);

    expect(sessionConceptIds.slice(0, 2)).toEqual(snapshot);
    expect(store.getState().draft).toEqual({
      stage: "candidate-selected",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.counterpoint,
      intention: "ground",
      pair: [IDS.fibonacci, IDS.counterpoint],
    });
    expect(Object.keys(store.getState())).toEqual(
      expect.not.arrayContaining(["sessionConceptIds"])
    );
  });

  it("is deterministic and byte-identical for equal transition sequences", () => {
    const run = (): InterpretationDraft => {
      const store = createInterpretationDraftStore();
      store.getState().attend(IDS.fibonacci, SESSION_CONCEPT_IDS);
      store.getState().armIntention("passage");
      store.getState().selectCandidate(IDS.counterpoint, SESSION_CONCEPT_IDS);
      return store.getState().draft;
    };

    const first = run();
    const second = run();

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expectDeeplyFrozen(first);
    expectDeeplyFrozen(second);
  });
});
