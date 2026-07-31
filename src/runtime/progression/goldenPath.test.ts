import { describe, expect, it } from "vitest";
import { createSessionEvent } from "../../domain/events";
import {
  eventIdFor,
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toThreadId,
  toWorldId,
  type ConceptId,
} from "../../domain/ids";
import { createDomainSessionStore } from "../../state/domainSession";
import { detectMotifs } from "../../domain/motifs";
import { compileConclusion } from "../../domain/performance";
import { buildPortrait } from "../../domain/portrait";
import { buildAnnotation } from "../../domain/annotation";
import { resolveThreadOutcome } from "../../domain/outcomes";
import {
  CASTALIA_PACK,
  CONTENT_PACK_VERSION,
} from "../../content/castalia";
import { drawCastaliaSession } from "../../domain/session";
import { castaliaDrawLookup, castaliaLookup } from "../content/castaliaLookup";
import { createCueBus, type PresentationCue } from "../cues";
import { describeCue } from "../captions";
import { isAttunementEligible } from "./attunementEligibility";
import { createSessionProgression } from "./createSessionProgression";

/**
 * THE GOLDEN PATH, END TO END, WITHOUT A BROWSER.
 *
 * VERTICAL-SLICE-SPEC §23 defines the canonical integration scenario. This runs
 * it entirely in the domain and runtime: draw, attend, commit, resolve, detect,
 * attune, conclude, and reload from the log — with no React, no Three.js, and
 * no Web Audio anywhere in the stack.
 *
 * That is the point. If this passes, the game's meaning is intact independently
 * of how it is drawn or sounded, which is the property ARCHITECTURE §2 exists
 * to establish and the property that makes the audiovisual work replaceable
 * without risking the composition.
 */

const SEED = "castalia-golden-001";
const FIBONACCI = toConceptId("measure.fibonacci-sequence");
const COUNTERPOINT = toConceptId("sound.counterpoint");
const PRIMES = toConceptId("measure.prime-numbers");
const POLYRHYTHM = toConceptId("sound.polyrhythm");

interface Harness {
  readonly store: ReturnType<typeof createDomainSessionStore>;
  readonly progression: ReturnType<typeof createSessionProgression>;
  readonly cues: PresentationCue[];
  readonly weave: (
    a: ConceptId,
    b: ConceptId,
    intention: "echo" | "passage" | "tension" | "ground"
  ) => string;
}

function harness(conceptIds: readonly ConceptId[]): Harness {
  const store = createDomainSessionStore();
  const sessionId = toSessionId(`session:${SEED}`);
  let clock = 0;
  const now = () => (clock += 10);

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
          seed: SEED,
          contentPackVersion: CONTENT_PACK_VERSION,
          worldId: toWorldId("castalia"),
          conceptIds,
        },
      }),
    ],
  });

  const cues: PresentationCue[] = [];
  const bus = createCueBus({ now: () => 0 });
  for (const channel of ["scene", "audio", "ui", "caption"] as const) {
    if (channel === "ui") bus.subscribe(channel, (cue) => cues.push(cue));
  }

  const progression = createSessionProgression({
    domainStore: store,
    cueBus: bus,
    lookup: castaliaLookup,
    now,
    resolveOutcome: resolveThreadOutcome,
    detectMotifs: (session, lookup) =>
      detectMotifs(session, lookup).map((motif) => ({
        completionId: motif.key,
        motifKindId: motif.kind,
        conceptIds: motif.conceptIds.map(String),
        threadIds: motif.threadIds.map(String),
        reason: motif.reason,
      })),
    compileConclusion,
    attunementEligible: isAttunementEligible,
  });

  const weave: Harness["weave"] = (a, b, intention) => {
    const session = store.getState().session!;
    const threadId = toThreadId(
      `thread:${String(session.sessionId).length}:${session.sessionId}:${
        session.threads.length + 1
      }`
    );
    const base = session.lastSequence;
    const pair = [a, b] as const;
    store.getState().appendEvents([
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 1,
        at: now(),
        type: "pair.selected",
        payload: { pair },
      }),
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 2,
        at: now(),
        type: "relation.hypothesized",
        payload: { pair, intention },
      }),
      createSessionEvent({
        sessionId: session.sessionId,
        sequence: base + 3,
        at: now(),
        type: "thread.committed",
        payload: {
          threadId,
          pair,
          intention,
          gesture: { inputModality: "mouse", durationMs: 620 },
        },
      }),
    ]);
    progression.afterCommit(threadId);
    // The outcome cue is staged after the weave has landed, so it sits in the
    // bus queue until time passes. Flush it, exactly as the render loop would.
    bus.tick(Number.MAX_SAFE_INTEGER);
    return String(threadId);
  };

  return { store, progression, cues, weave };
}

/** The draw the golden seed actually produces, with the opening pair pinned. */
function goldenDraw(): readonly ConceptId[] {
  return drawCastaliaSession({
    seed: SEED,
    lookup: castaliaDrawLookup,
    require: [FIBONACCI, COUNTERPOINT, PRIMES, POLYRHYTHM],
  }).conceptIds;
}

describe("the golden path, in the domain alone", () => {
  it("draws a session that can carry the canonical scenario", () => {
    const conceptIds = goldenDraw();
    expect(conceptIds).toContain(FIBONACCI);
    expect(conceptIds).toContain(COUNTERPOINT);
    expect(new Set(conceptIds.map((id) => String(id).split(".")[0])).size).toBe(4);
  });

  it("resolves the opening pair as a documented relation and records it", () => {
    const h = harness(goldenDraw());
    const threadId = h.weave(FIBONACCI, COUNTERPOINT, "echo");
    const session = h.store.getState().session!;

    const outcome = session.outcomes.find((o) => String(o.threadId) === threadId);
    expect(outcome?.type).toBe("documented-relation");
    // ADR-013 condition 1: the id must resolve in the pinned pack.
    const relationId = String(
      (outcome as { documentedRelationId: string }).documentedRelationId
    );
    expect(
      CASTALIA_PACK.relations.some((relation) => relation.id === relationId)
    ).toBe(true);
  });

  it("tells the player the Bartók attribution is disputed, not evidence", () => {
    // The campaign's most citation-sensitive claim. If this ever reads as
    // settled fact, the content model has failed at the one thing it is for.
    const h = harness(goldenDraw());
    h.weave(FIBONACCI, COUNTERPOINT, "echo");
    const cue = h.cues.find((c) => c.type === "outcome.documented");
    expect(cue).toBeDefined();
    const payload = (cue as Extract<PresentationCue, { type: "outcome.documented" }>)
      .payload;
    expect(payload.evidence).toBe("contested");
    expect(payload.relation.counterpoint).toBeTruthy();

    const caption = describeCue(cue!, {
      conceptName: castaliaLookup.conceptName as (id: string) => string,
      facetName: castaliaLookup.facetName as (id: string) => string,
    })!;
    expect(caption.text).toContain("specialists disagree");
  });

  it("answers an undocumented but structured pairing with a specific question", () => {
    const conceptIds = goldenDraw();
    const h = harness(conceptIds);
    // Find a pair the pack does not document but which shares a facet.
    let found: [ConceptId, ConceptId] | null = null;
    for (const a of conceptIds) {
      for (const b of conceptIds) {
        if (a >= b) continue;
        if (castaliaLookup.findRelation(a, b)) continue;
        const shared = castaliaLookup
          .conceptFacets(a)
          .filter((facet) => castaliaLookup.conceptFacets(b).includes(facet));
        if (shared.length > 0) {
          found = [a, b];
          break;
        }
      }
      if (found) break;
    }
    expect(found).not.toBeNull();
    h.weave(found![0], found![1], "echo");
    const cue = h.cues.find((c) => c.type === "outcome.open-thread");
    expect(cue).toBeDefined();
    const payload = (cue as Extract<PresentationCue, { type: "outcome.open-thread" }>)
      .payload;
    expect(payload.question.endsWith("?")).toBe(true);
    // The question must be about *these* ideas, not a generic template.
    expect(payload.question.length).toBeGreaterThan(30);
  });

  it("never fabricates significance for a pairing with nothing to say", () => {
    const conceptIds = goldenDraw();
    const h = harness(conceptIds);
    let bare: [ConceptId, ConceptId] | null = null;
    for (const a of conceptIds) {
      for (const b of conceptIds) {
        if (a >= b) continue;
        if (castaliaLookup.findRelation(a, b)) continue;
        const shared = castaliaLookup
          .conceptFacets(a)
          .filter((facet) => castaliaLookup.conceptFacets(b).includes(facet));
        if (shared.length === 0) {
          bare = [a, b];
          break;
        }
      }
      if (bare) break;
    }
    if (!bare) return; // A draw where every pair shares structure is legitimate.
    h.weave(bare[0], bare[1], "tension");
    const cue = h.cues.find((c) => c.type === "outcome.unresolved");
    expect(cue).toBeDefined();
    // Absence is the record: no durable outcome event was appended.
    const session = h.store.getState().session!;
    expect(session.outcomes.some((o) => o.threadId === session.threads.at(-1)!.id)).toBe(
      false
    );
  });

  it("carries a whole session through Attunement to a performed conclusion", () => {
    const conceptIds = goldenDraw();
    const h = harness(conceptIds);
    h.weave(FIBONACCI, COUNTERPOINT, "echo");
    h.weave(PRIMES, POLYRHYTHM, "echo");
    h.weave(FIBONACCI, PRIMES, "ground");
    h.weave(COUNTERPOINT, POLYRHYTHM, "passage");
    h.weave(FIBONACCI, POLYRHYTHM, "tension");
    h.weave(PRIMES, COUNTERPOINT, "echo");

    expect(h.progression.attunementAvailable()).toBe(true);
    h.progression.enterAttunement();
    expect(h.store.getState().session!.attunementActive).toBe(true);

    h.progression.conclude();
    const session = h.store.getState().session!;
    expect(session.concluded).toBe(true);
    // Concluding from inside Attunement must close it in the log, or replay
    // would reconstruct a session that ended mid-state.
    expect(session.attunementActive).toBe(false);

    const performance = compileConclusion(session, castaliaLookup);
    expect(performance).toBeTruthy();

    const portrait = buildPortrait(session, castaliaLookup);
    expect(portrait.dimensions).toHaveLength(6);
    expect(portrait).not.toHaveProperty("score");
    expect(portrait).not.toHaveProperty("total");

    const annotation = buildAnnotation(session, castaliaLookup);
    expect(annotation.sentences.length).toBeGreaterThanOrEqual(3);
    expect(annotation.text).not.toMatch(
      /\b(well done|congratulations|excellent|you scored)\b/i
    );
  });

  it("produces materially different portraits for materially different webs", () => {
    const conceptIds = goldenDraw();
    const echoing = harness(conceptIds);
    echoing.weave(FIBONACCI, COUNTERPOINT, "echo");
    echoing.weave(PRIMES, POLYRHYTHM, "echo");
    echoing.weave(FIBONACCI, PRIMES, "echo");

    const tense = harness(conceptIds);
    tense.weave(FIBONACCI, COUNTERPOINT, "tension");
    tense.weave(PRIMES, POLYRHYTHM, "tension");
    tense.weave(FIBONACCI, PRIMES, "tension");

    const a = buildPortrait(echoing.store.getState().session!, castaliaLookup);
    const b = buildPortrait(tense.store.getState().session!, castaliaLookup);
    expect(a.byId.tension.value).not.toBe(b.byId.tension.value);
    expect(
      buildAnnotation(echoing.store.getState().session!, castaliaLookup).text
    ).not.toBe(
      buildAnnotation(tense.store.getState().session!, castaliaLookup).text
    );
  });

  it("reconstructs the same result from the durable log alone", () => {
    const conceptIds = goldenDraw();
    const h = harness(conceptIds);
    h.weave(FIBONACCI, COUNTERPOINT, "echo");
    h.weave(PRIMES, POLYRHYTHM, "echo");
    h.weave(FIBONACCI, PRIMES, "ground");
    h.progression.conclude();

    const before = h.store.getState();
    const reloaded = createDomainSessionStore();
    reloaded.getState().loadEventLog(JSON.parse(JSON.stringify(before.eventLog)));

    expect(reloaded.getState().session).toEqual(before.session);
    expect(
      buildPortrait(reloaded.getState().session!, castaliaLookup)
    ).toEqual(buildPortrait(before.session!, castaliaLookup));
    expect(
      buildAnnotation(reloaded.getState().session!, castaliaLookup).text
    ).toBe(buildAnnotation(before.session!, castaliaLookup).text);
    expect(
      JSON.stringify(compileConclusion(reloaded.getState().session!, castaliaLookup))
    ).toBe(JSON.stringify(compileConclusion(before.session!, castaliaLookup)));
  });

  it("keeps event ids derivable, so the log cannot drift from its identity", () => {
    const h = harness(goldenDraw());
    h.weave(FIBONACCI, COUNTERPOINT, "echo");
    const log = h.store.getState().eventLog!;
    for (const event of log.events) {
      expect(event.id).toBe(eventIdFor(event.sessionId, event.sequence));
    }
    expect(String(log.events[0].payload.contentPackVersion ?? "")).toBe(
      String(toContentPackVersion("castalia.v1"))
    );
  });
});
