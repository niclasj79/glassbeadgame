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

  store.getState().lockCandidate(IDS.counterpoint, SESSION_CONCEPT_IDS);
  if (stage === "locked") return;

  store.getState().chooseReading("echo");
}

function expectStableActions(
  before: ReturnType<InterpretationDraftStore["getState"]>,
  after: ReturnType<InterpretationDraftStore["getState"]>
): void {
  expect(after.attend).toBe(before.attend);
  expect(after.lockCandidate).toBe(before.lockCandidate);
  expect(after.chooseReading).toBe(before.chooseReading);
  expect(after.cancel).toBe(before.cancel);
  expect(after.reset).toBe(before.reset);
}

describe("createInterpretationDraftStore — pair before reading", () => {
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
      "attend",
      "cancel",
      "chooseReading",
      "draft",
      "lockCandidate",
      "reset",
    ]);

    initial.attend(IDS.fibonacci, SESSION_CONCEPT_IDS);

    expect(first.getState().draft.stage).toBe("attending");
    expect(second.getState().draft).toBe(INACTIVE_INTERPRETATION_DRAFT);
    expectStableActions(initial, first.getState());
  });

  it("publishes the complete Attend, lock, and reading sequence once per transition", () => {
    const store = createInterpretationDraftStore();
    const initial = store.getState();
    const published: InterpretationDraft[] = [];
    store.subscribe((state) => published.push(state.draft));

    store.getState().attend(IDS.fibonacci, SESSION_CONCEPT_IDS);
    store.getState().lockCandidate(IDS.counterpoint, SESSION_CONCEPT_IDS);
    store.getState().chooseReading("echo");

    expect(published.map((draft) => draft.stage)).toEqual([
      "attending",
      "locked",
      "reading",
    ]);
    expect(store.getState().draft).toEqual({
      stage: "reading",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.counterpoint,
      intention: "echo",
      pair: [IDS.fibonacci, IDS.counterpoint],
    });
    expectDeeplyFrozen(store.getState().draft);
    expectStableActions(initial, store.getState());
  });

  it.each(["attending", "locked", "reading"] as const)(
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

  it("changes the reading explicitly with one new immutable draft", () => {
    const store = createInterpretationDraftStore();
    advanceTo(store, "reading");
    const before = store.getState();
    const priorDraft = before.draft;
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.getState().chooseReading("tension");

    expect(notifications).toBe(1);
    expect(store.getState().draft).toMatchObject({
      stage: "reading",
      intention: "tension",
    });
    expect(priorDraft).toMatchObject({ stage: "reading", intention: "echo" });
    expectDeeplyFrozen(store.getState().draft);
    expectStableActions(before, store.getState());
  });

  it("replaces the second bead and drops the reading when re-locked", () => {
    const store = createInterpretationDraftStore();
    advanceTo(store, "reading");

    store.getState().lockCandidate(IDS.primeNumbers, SESSION_CONCEPT_IDS);

    expect(store.getState().draft).toEqual({
      stage: "locked",
      attendedConceptId: IDS.fibonacci,
      candidateConceptId: IDS.primeNumbers,
      pair: [IDS.fibonacci, IDS.primeNumbers],
    });
  });

  it("follows the complete cancellation hierarchy and makes inactive cancel a no-op", () => {
    const store = createInterpretationDraftStore();
    advanceTo(store, "reading");
    const published: InterpretationDraft[] = [];
    store.subscribe((state) => published.push(state.draft));

    store.getState().cancel();
    store.getState().cancel();
    store.getState().cancel();

    expect(published.map((draft) => draft.stage)).toEqual([
      "locked",
      "attending",
      "inactive",
    ]);
    expect(store.getState().draft).toBe(INACTIVE_INTERPRETATION_DRAFT);

    const inactive = store.getState();
    store.getState().cancel();

    expect(published).toHaveLength(3);
    expect(store.getState()).toBe(inactive);
  });

  it.each(["attending", "locked", "reading"] as const)(
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
      label: "unsupported reading",
      prepare: (store: InterpretationDraftStore) => advanceTo(store, "locked"),
      act: (store: InterpretationDraftStore) =>
        store.getState().chooseReading("analogy" as RelationIntention),
      code: "unsupported-intention",
    },
    {
      label: "identical concepts",
      prepare: (store: InterpretationDraftStore) => advanceTo(store, "attending"),
      act: (store: InterpretationDraftStore) =>
        store.getState().lockCandidate(IDS.fibonacci, SESSION_CONCEPT_IDS),
      code: "identical-concepts",
    },
    {
      label: "unknown candidate",
      prepare: (store: InterpretationDraftStore) => advanceTo(store, "attending"),
      act: (store: InterpretationDraftStore) =>
        store.getState().lockCandidate(IDS.unknown, SESSION_CONCEPT_IDS),
      code: "unknown-concept",
    },
    {
      label: "a reading before a lock",
      prepare: (store: InterpretationDraftStore) => advanceTo(store, "attending"),
      act: (store: InterpretationDraftStore) => store.getState().chooseReading("echo"),
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
    store.getState().lockCandidate(IDS.counterpoint, sessionConceptIds);
    store.getState().chooseReading("ground");
    sessionConceptIds.push(IDS.primeNumbers);

    expect(sessionConceptIds.slice(0, 2)).toEqual(snapshot);
    expect(store.getState().draft).toEqual({
      stage: "reading",
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
      store.getState().lockCandidate(IDS.counterpoint, SESSION_CONCEPT_IDS);
      store.getState().chooseReading("passage");
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
