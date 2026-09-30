import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  toContentPackVersion,
  toEventId,
  toSessionId,
  toThreadId,
  toWorldId,
  type ThreadId,
} from "@/domain/ids";
import type { CommittedThreadV1, SessionStateV1 } from "@/domain/model";
import { domainSessionStore } from "@/state/domainSession";
import { installMotionDomStubs } from "../testing/domStubs";
import { InterpretationControls, WovenThreadList } from "./InterpretationControls";
import { byTestId, press } from "./testing/elementTree";
import { COUNTERPOINT, FIBONACCI, GOLDEN_PAIR } from "./testing/focusFixtures";

/**
 * THE MIRROR'S WAY BACK TO A THREAD (I-019).
 *
 * A committed thread can be clicked in the world; the mirror lists the same
 * threads as buttons so a keyboard or a screen reader can reopen one with no
 * pointer at all. Every other control of the mirror keeps its test id, because
 * the browser suite drives the keyboard path through them.
 */

const thread = (id: string, pair: CommittedThreadV1["pair"], sequence: number): CommittedThreadV1 =>
  Object.freeze({
    id: toThreadId(id),
    pair,
    intention: sequence === 3 ? "echo" : "tension",
    gesture: Object.freeze({ inputModality: "keyboard" as const, durationMs: 420 }),
    eventId: toEventId(`event:${sequence}`),
    sequence,
    committedAt: sequence * 1000,
  });

const GOLDEN = thread("thread:1:s:1", GOLDEN_PAIR, 3);
const RETURN = thread("thread:2:s:1", [COUNTERPOINT, FIBONACCI], 6);

const session = (threads: readonly CommittedThreadV1[]): SessionStateV1 =>
  Object.freeze({
    sessionId: toSessionId("session:mirror"),
    seed: "castalia-golden-001",
    contentPackVersion: toContentPackVersion("castalia.v1"),
    worldId: toWorldId("castalia"),
    conceptIds: Object.freeze([FIBONACCI, COUNTERPOINT]),
    lastSequence: 6,
    at: 6000,
    attendedConceptId: null,
    selectedPair: null,
    hypothesis: null,
    threads,
    outcomes: Object.freeze([]),
    completedMotifs: Object.freeze([]),
    attunementActive: false,
    concluded: false,
  });

describe("the mirror's list of woven threads", () => {
  beforeAll(installMotionDomStubs);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists every woven thread as a button named by its reading", () => {
    const html = renderToStaticMarkup(
      createElement(WovenThreadList, {
        threads: [GOLDEN, RETURN],
        reopenedThreadId: null,
        disabled: false,
        onReopen: () => undefined,
      })
    );
    expect(html).toContain('data-testid="woven-thread-thread:1:s:1"');
    expect(html).toContain('data-testid="woven-thread-thread:2:s:1"');
    expect(html).toContain("Fibonacci Sequence · Echo · Counterpoint");
    expect(html).toContain("Counterpoint · Tension · Fibonacci Sequence");
    // In the order they were woven.
    expect(html.indexOf("thread:1:s:1")).toBeLessThan(html.indexOf("thread:2:s:1"));
    // A way back to a thread, never a tally of how it fared.
    expect(html).not.toMatch(/documented|open thread|unlit|\bscore|\brank/i);
  });

  it("reopens the thread a button names", () => {
    const reopened: ThreadId[] = [];
    const tree = WovenThreadList({
      threads: [GOLDEN, RETURN],
      reopenedThreadId: null,
      disabled: false,
      onReopen: (threadId) => reopened.push(threadId),
    });
    press(byTestId(tree, "woven-thread-thread:2:s:1")[0]);
    press(byTestId(tree, "woven-thread-thread:1:s:1")[0]);
    expect(reopened.map(String)).toEqual(["thread:2:s:1", "thread:1:s:1"]);
  });

  it("marks the thread being read, and waits while a pair is being composed", () => {
    const html = renderToStaticMarkup(
      createElement(WovenThreadList, {
        threads: [GOLDEN, RETURN],
        reopenedThreadId: GOLDEN.id,
        disabled: true,
        onReopen: () => undefined,
      })
    );
    expect(html).toMatch(/data-testid="woven-thread-thread:1:s:1"[^>]*aria-current="true"/);
    expect(html).not.toMatch(/data-testid="woven-thread-thread:2:s:1"[^>]*aria-current/);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("says nothing before the first thread is woven", () => {
    expect(
      renderToStaticMarkup(
        createElement(WovenThreadList, {
          threads: [],
          reopenedThreadId: null,
          disabled: false,
          onReopen: () => undefined,
        })
      )
    ).toBe("");
  });

  it("reads the threads from the canonical session, beside the mirror's other controls", () => {
    // A static render reads a store's server snapshot, which zustand takes
    // from its initial state; the canonical session is put there for this one
    // render rather than faked anywhere the mirror could see it.
    const initial = domainSessionStore.getInitialState();
    vi.spyOn(domainSessionStore, "getInitialState").mockReturnValue({
      ...initial,
      session: session([GOLDEN, RETURN]),
    });
    const html = renderToStaticMarkup(createElement(InterpretationControls));
    expect(html).toContain('data-testid="woven-thread-thread:1:s:1"');
    expect(html).toContain('data-testid="woven-thread-thread:2:s:1"');
    expect(html).toContain('aria-label="Woven threads"');
    for (const control of [
      "keyboard-weave-confirm",
      "inspect-focused-bead",
      "cancel-interpretation",
    ]) {
      expect(html).toContain(`data-testid="${control}"`);
    }
    expect(html).toContain('role="status"');
    // Roaming: nothing to weave yet, and nothing to step back from.
    expect(html).toMatch(/data-testid="keyboard-weave-confirm"[^>]*disabled/);
    expect(html).toMatch(/data-testid="cancel-interpretation"[^>]*disabled/);
    // The mirror stays non-dominant: it is never drawn.
    expect(html).toContain('class="sr-only"');
  });
});
