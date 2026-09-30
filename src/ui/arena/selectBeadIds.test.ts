import { describe, expect, it } from "vitest";
import { selectBeadIds } from "./selectBeadIds";

describe("the mirror's bead list", () => {
  it("is the session's, and one and the same empty list once the session is gone", () => {
    const session = { beadIds: ["a", "b"] };
    expect(selectBeadIds({ session })).toBe(session.beadIds);
    // A store selector must answer the same reference for the same state, or
    // the subscription sees a new value on every render and never settles.
    expect(selectBeadIds({ session: null })).toBe(selectBeadIds({ session: null }));
    expect(selectBeadIds({ session: null })).toEqual([]);
  });
});
