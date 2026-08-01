import { describe, expect, it, vi } from "vitest";
import { createSessionEvent } from "../../domain/events";
import {
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toWorldId,
  type ConceptId,
} from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import { createDomainSessionStore } from "../../state/domainSession";
import { createCueBus } from "../cues";
import { createSessionProgression } from "./createSessionProgression";

/**
 * GAP-B1 — ATTUNEMENT WAS UNREACHABLE.
 *
 * `grep -rn "enterAttunement" src` returned the interface declaration, the
 * definition, and a unit test: nothing in the running application could reach
 * it. A live DOM audit after session start enumerated eighteen buttons and
 * found no Attunement affordance; the project's own capture harness probes for
 * one and gives up, which is why `artifacts/capture/` holds frames 01–10 and 12
 * and no 11. A reducer state, two event types, a cue, a written caption and 346
 * tested lines of `audio/attunement.ts` were dead to every player.
 *
 * `attunementAvailable()` already answered the eligibility question correctly.
 * What was missing was any way for a surface to *learn* the answer had changed,
 * so the invitation could appear in the world at the moment the composition
 * earned it rather than sitting in the HUD from the first second (spec §13:
 * explicitly invited, never forced).
 */

const A = toConceptId("measure.fibonacci-sequence");
const B = toConceptId("sound.counterpoint");
const C = toConceptId("measure.prime-numbers");

function harness(options?: { eligible?: (session: SessionStateV1) => boolean }) {
  const store = createDomainSessionStore();
  const sessionId = toSessionId("session:attunement-invitation");
  let clock = 0;
  const conceptIds: readonly ConceptId[] = [A, B, C];

  store.getState().loadEventLog({
    format: "glass-bead-game.session-event-log",
    schemaVersion: 1,
    events: [
      createSessionEvent({
        sessionId,
        sequence: 0,
        at: 0,
        type: "session.started",
        payload: {
          seed: "attunement-invitation",
          contentPackVersion: toContentPackVersion("castalia.test.v1"),
          worldId: toWorldId("castalia"),
          conceptIds,
        },
      }),
    ],
  });

  let eligible = false;
  const progression = createSessionProgression({
    domainStore: store,
    cueBus: createCueBus({ now: () => 0 }),
    lookup: {} as never,
    now: () => (clock += 10),
    resolveOutcome: (thread) => ({
      kind: "unresolved",
      threadId: thread.id,
      pair: thread.pair,
      intention: thread.intention,
      sequence: 0,
      statement: "Nothing is grounded here yet.",
    }),
    detectMotifs: () => [],
    compileConclusion: () => ({}),
    attunementEligible: options?.eligible ?? (() => eligible),
  });

  return {
    store,
    progression,
    sessionId,
    become: (value: boolean) => {
      eligible = value;
    },
    /** Appends a real event, which is the only thing that can move eligibility. */
    commitNothing: () => {
      const session = store.getState().session!;
      store.getState().appendEvent(
        createSessionEvent({
          sessionId,
          sequence: session.lastSequence + 1,
          at: (clock += 10),
          type: "bead.attended",
          payload: { conceptId: A },
        })
      );
      progression.afterCommit(session.threads[0]?.id ?? ("none" as never));
    },
  };
}

describe("the Attunement invitation", () => {
  it("is reachable: entering it appends to the durable log", () => {
    const h = harness({ eligible: () => true });
    expect(h.progression.attunementAvailable()).toBe(true);

    h.progression.enterAttunement();
    expect(h.store.getState().session!.attunementActive).toBe(true);
    h.progression.exitAttunement();
    expect(h.store.getState().session!.attunementActive).toBe(false);
  });

  it("tells a surface the current answer the moment it subscribes", () => {
    const h = harness({ eligible: () => true });
    const listener = vi.fn();
    h.progression.onInvitationChanged(listener);
    // A world mark that mounts after the composition already qualified must not
    // wait for the next commit to appear.
    expect(listener).toHaveBeenCalledWith(true);
  });

  it("announces the edge, once, when the composition earns it", () => {
    const h = harness();
    const seen: boolean[] = [];
    h.progression.onInvitationChanged((available) => seen.push(available));
    expect(seen).toEqual([false]);

    h.commitNothing();
    expect(seen).toEqual([false]);

    h.become(true);
    h.commitNothing();
    expect(seen).toEqual([false, true]);

    // Still eligible on the next commit: the invitation does not ask twice.
    h.commitNothing();
    expect(seen).toEqual([false, true]);
  });

  it("withdraws the invitation while Attunement is held, and offers it again", () => {
    const h = harness({ eligible: () => true });
    const seen: boolean[] = [];
    h.progression.onInvitationChanged((available) => seen.push(available));
    expect(seen).toEqual([true]);

    h.progression.enterAttunement();
    expect(seen).toEqual([true, false]);
    expect(h.progression.attunementAvailable()).toBe(false);

    h.progression.exitAttunement();
    expect(seen).toEqual([true, false, true]);
  });

  it("withdraws it for good once the session is concluded", () => {
    const h = harness({ eligible: () => true });
    const seen: boolean[] = [];
    h.progression.onInvitationChanged((available) => seen.push(available));

    h.progression.conclude();
    expect(seen).toEqual([true, false]);
    expect(h.progression.attunementAvailable()).toBe(false);
  });

  it("does not carry one Game's invitation into the next", () => {
    const h = harness({ eligible: () => true });
    const seen: boolean[] = [];
    h.progression.onInvitationChanged((available) => seen.push(available));
    expect(seen).toEqual([true]);

    // A fresh draw replaces the log wholesale, exactly as `startSession` does.
    h.store.getState().clearSession();
    expect(seen).toEqual([true, false]);
    expect(h.progression.attunementAvailable()).toBe(false);
  });

  it("stops notifying once a surface unsubscribes", () => {
    const h = harness({ eligible: () => true });
    const listener = vi.fn();
    const off = h.progression.onInvitationChanged(listener);
    listener.mockClear();
    off();
    h.progression.enterAttunement();
    expect(listener).not.toHaveBeenCalled();
  });
});
