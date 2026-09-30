import { describe, expect, it, vi } from "vitest";

/**
 * "No draw" is proved rather than inferred: the draw is replaced by one that
 * refuses to run, so a Study start that reached for it would fail here.
 */
vi.mock("../../domain/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../domain/session")>()),
  drawCastaliaSession: () => {
    throw new Error("a Study session must not draw");
  },
}));

import { CONTENT_PACK_VERSION } from "../../content/castalia";
import { castaliaStudies, castaliaStudyById } from "../../content/castalia/studies";
import { createSessionEvent } from "../../domain/events";
import { toThreadId, type ConceptId } from "../../domain/ids";
import {
  parseSessionEventLogV1,
  replaySessionEventLogV1,
  serializeSessionEventLogV1,
} from "../../domain/replay";
import { evaluateStudy, type StudyDefinition } from "../../domain/studies";
import { createDomainSessionStore, type DomainSessionStore } from "../../state/domainSession";
import { createCastaliaSessionStart } from "../session/createCastaliaSessionStart";
import { createStudySessionStart, studySeedOf } from "./createStudySessionStart";
import { castaliaStudyLookup } from "./lookup";

const studyNamed = (id: string): StudyDefinition => {
  const study = castaliaStudyById(id);
  if (study === undefined) throw new RangeError(`no Study ${id}`);
  return study;
};

const harness = (at = 1_000) => {
  const domainStore = createDomainSessionStore();
  let clock = at;
  const start = createStudySessionStart({ domainStore, now: () => (clock += 7) });
  return { domainStore, start };
};

/** Weave a line the way the loop commits it: pair, reading, commit. */
function weave(
  store: DomainSessionStore,
  pairs: readonly (readonly [ConceptId, ConceptId])[]
): void {
  pairs.forEach(([a, b], index) => {
    const session = store.getState().session!;
    const base = session.lastSequence;
    const pair = [a, b] as const;
    store.getState().appendEvents([
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 1,
        at: 2_000 + index,
        type: "pair.selected",
        payload: { pair },
      }),
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 2,
        at: 2_000 + index,
        type: "relation.hypothesized",
        payload: { pair, intention: "echo" },
      }),
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 3,
        at: 2_000 + index,
        type: "thread.committed",
        payload: {
          threadId: toThreadId(`thread:study:${index}`),
          pair,
          intention: "echo",
          gesture: { inputModality: "keyboard" },
        },
      }),
    ]);
  });
}

describe("a Study session start (STUDIES-SPEC §8)", () => {
  it("starts from the seed study:<studyId>, with the Free Game's session-id formula", () => {
    const { start } = harness();
    const { session } = start(studyNamed("study.eschholz-1"));
    expect(studySeedOf("study.eschholz-1")).toBe("study:study.eschholz-1");
    expect(session.seed).toBe("study:study.eschholz-1");
    expect(String(session.sessionId)).toBe(
      `session:${String(CONTENT_PACK_VERSION)}:study:study.eschholz-1`
    );
  });

  it("holds the Study's eight beads in authored order, in the Castalia world and the pinned pack", () => {
    // The draw is out of reach in this file: a Free Game start fails here…
    expect(() =>
      createCastaliaSessionStart({
        domainStore: createDomainSessionStore(),
        now: () => 0,
      })({ seed: "free" })
    ).toThrow(/must not draw/);
    // …and every Study still starts, because none of them draws.
    for (const study of castaliaStudies()) {
      const { session } = harness().start(study);
      expect(session.conceptIds, study.id).toEqual(study.conceptIds);
      expect(session.conceptIds, study.id).toHaveLength(8);
      expect(String(session.worldId)).toBe("castalia");
      expect(session.contentPackVersion).toBe(CONTENT_PACK_VERSION);
    }
  });

  it("is one ordinary session.started event, stamped by the injected clock, and nothing else", () => {
    const { start, domainStore } = harness(40);
    const { eventLog, session } = start(studyNamed("study.waldzell-2"));
    expect(eventLog.events).toHaveLength(1);
    const [event] = eventLog.events;
    expect(event.type).toBe("session.started");
    expect(event.at).toBe(47);
    expect(event.payload).toEqual({
      seed: "study:study.waldzell-2",
      contentPackVersion: CONTENT_PACK_VERSION,
      worldId: "castalia",
      conceptIds: studyNamed("study.waldzell-2").conceptIds,
    });
    // Published to the canonical store, as the Free Game's start publishes.
    expect(domainStore.getState().eventLog).toBe(eventLog);
    expect(domainStore.getState().session).toBe(session);
    expect(session.threads).toHaveLength(0);
    expect(session.concluded).toBe(false);
  });

  it("starts again from the same seed as the same session, whenever it is started", () => {
    const study = studyNamed("study.vicus-lusorum-1");
    const first = harness(0).start(study);
    const again = harness(90_000).start(study);
    expect(again.session.sessionId).toBe(first.session.sessionId);
    expect(again.session.seed).toBe(first.session.seed);
    expect(again.session.conceptIds).toEqual(first.session.conceptIds);
  });

  it("replays its log to the same status: the status is a function of the log (§8)", () => {
    const study = studyNamed("study.eschholz-1");
    const { start, domainStore } = harness();
    start(study);
    if (study.answer.kind !== "threads") throw new Error("eschholz-1 is solved by threads");
    weave(domainStore, study.answer.pairs);

    const live = domainStore.getState();
    const status = evaluateStudy(live.session!, study, castaliaStudyLookup, false);
    expect(status.kind).toBe("solved");

    const stored = serializeSessionEventLogV1(live.eventLog!);
    const replayed = replaySessionEventLogV1(parseSessionEventLogV1(stored));
    expect(JSON.stringify(evaluateStudy(replayed, study, castaliaStudyLookup, false))).toBe(
      JSON.stringify(status)
    );

    // And a fresh store loading the stored log says the same.
    const reloaded = createDomainSessionStore();
    reloaded.getState().loadEventLog(parseSessionEventLogV1(stored));
    expect(
      JSON.stringify(evaluateStudy(reloaded.getState().session!, study, castaliaStudyLookup, false))
    ).toBe(JSON.stringify(status));
  });
});
