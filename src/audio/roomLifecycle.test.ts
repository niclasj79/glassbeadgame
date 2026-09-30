import { describe, expect, it } from "vitest";
import { choirMustReset, roomIsEmpty } from "./roomLifecycle";

describe("the room's lifecycle", () => {
  it("is empty on the title, the threshold and the Studies list, and nowhere else", () => {
    expect(roomIsEmpty("title")).toBe(true);
    expect(roomIsEmpty("threshold")).toBe(true);
    expect(roomIsEmpty("studies")).toBe(true);
    expect(roomIsEmpty("arena")).toBe(false);
    // The conclusion keeps the bed under the performance; the director ends it.
    expect(roomIsEmpty("conclusion")).toBe(false);
  });

  it("empties the choir for a new session or the same one begun again, and never for a replay", () => {
    const seated = { sessionId: "session:a", threadIds: ["t1", "t2"] };
    // Next Study: another session.
    expect(choirMustReset(seated, { sessionId: "session:b", threadIds: [] })).toBe(true);
    // Again: the same seed, so the same id, and the woven threads are gone.
    expect(choirMustReset(seated, { sessionId: "session:a", threadIds: [] })).toBe(true);
    // A thread woven, or the log replayed whole: every seated thread remains.
    expect(choirMustReset(seated, { sessionId: "session:a", threadIds: ["t1", "t2", "t3"] })).toBe(false);
    expect(choirMustReset(seated, { sessionId: "session:a", threadIds: ["t2", "t1"] })).toBe(false);
    // Nothing seated yet: nothing to empty.
    expect(
      choirMustReset({ sessionId: null, threadIds: [] }, { sessionId: "session:a", threadIds: [] })
    ).toBe(false);
  });
});
