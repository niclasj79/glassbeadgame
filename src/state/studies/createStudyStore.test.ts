import { describe, expect, it } from "vitest";
import { createStudyStore } from "./createStudyStore";

describe("the Study store", () => {
  it("begins a Study clean and forgets everything on reset", () => {
    const store = createStudyStore();
    store.getState().begin("study.eschholz-1");
    store.getState().answerNotYet("can-be-done");
    store.getState().openPlate();
    store.getState().begin("study.eschholz-2");
    expect(store.getState()).toMatchObject({
      studyId: "study.eschholz-2",
      status: null,
      notYet: null,
      plateOpen: false,
    });
    store.getState().reset();
    expect(store.getState().studyId).toBeNull();
  });

  it("gives every not-yet its own serial, so the same words said twice still arrive", () => {
    const store = createStudyStore();
    store.getState().begin("study.eschholz-1");
    store.getState().answerNotYet("can-be-done");
    const first = store.getState().notYet;
    store.getState().answerNotYet("can-be-done");
    expect(store.getState().notYet?.serial).toBe((first?.serial ?? 0) + 1);
  });

  it("opens and closes the plate idempotently", () => {
    const store = createStudyStore();
    let changes = 0;
    store.subscribe(() => {
      changes += 1;
    });
    store.getState().openPlate();
    store.getState().openPlate();
    store.getState().closePlate();
    store.getState().closePlate();
    expect(changes).toBe(2);
  });
});
