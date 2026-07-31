import { describe, expect, it } from "vitest";
import { buildTopology } from "../graph/buildTopology";
import type { ConceptId } from "../ids";
import type { RelationIntention } from "../events";
import type { SessionStateV1 } from "../model/sessionState";
import type { RelationLookup } from "../outcomes/lookup";
import { countWord } from "../outcomes/prose";
import {
  buildSessionFixture,
  type ThreadFixtureSpec,
} from "../outcomes/testing/buildSessionFixture";
import { C, createFixtureLookup } from "../outcomes/testing/fixtureContent";
import { buildPortrait } from "../portrait/buildPortrait";
import { buildAnnotation } from "./buildAnnotation";

/**
 * A PROPERTY SWEEP OVER EVERYTHING THE GAME WRITES.
 *
 * The Portrait and the Annotation are the only places where the Game composes
 * sentences of its own, and both compose them out of counts that a real session
 * drives to zero, to one, and past twelve. Example-based tests only ever prove
 * the shapes someone thought to write down; this sweeps every web shape the
 * fixture vocabulary can express — empty, single, fragmented, joined, all-Echo,
 * all-Tension, motif-bearing, motif-free, with and without a content pack — and
 * holds every generated sentence to the same standard.
 *
 * The standard is deliberately mechanical. Each rule below is a defect that has
 * actually been shipped in this file's subjects, restated as something a machine
 * can check on any sentence at all:
 *
 *  - a sentence is non-empty and terminates;
 *  - a negated quantifier never carries a contrast that has nothing to attach to
 *    ("None of your seven threads closed back … rather than reaching outward");
 *  - a negated quantifier never governs a negated object ("none found nothing");
 *  - no list artefact survives composition (", and .", doubled article, a
 *    one-item list offered as a sample of itself, a plural quantifier over one);
 *  - no fraction has one as its denominator ("one of your one thread");
 *  - and no two sentences about the same session disagree about whether the web
 *    is one figure or several.
 *
 * A failure here is prose the player could be shown, not a hypothetical.
 */

const POOL: readonly ConceptId[] = Object.freeze([
  C.fibonacci,
  C.primes,
  C.symmetry,
  C.fourier,
  C.cantor,
  C.counterpoint,
  C.polyrhythm,
  C.just,
  C.equal,
  C.overtones,
  C.standingWave,
  C.energy,
  C.pendulums,
  C.perspective,
  C.divisionism,
  C.girih,
]);

const INTENTIONS: readonly RelationIntention[] = Object.freeze([
  "echo",
  "passage",
  "tension",
  "ground",
]);

const LOOKUPS: readonly (readonly [string, RelationLookup])[] = Object.freeze([
  ["full pack", createFixtureLookup()],
  ["no documented relations", createFixtureLookup({ withoutRelations: true })],
  ["no authored prompts", createFixtureLookup({ withoutOpenThreadPrompts: true })],
  [
    "empty pack",
    createFixtureLookup({ withoutRelations: true, withoutOpenThreadPrompts: true }),
  ],
]);

// ── Web generation ───────────────────────────────────────────────────────────

/** Deterministic 32-bit PRNG: the sweep is identical on every run and machine. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Web {
  readonly label: string;
  readonly conceptIds: readonly ConceptId[];
  readonly threads: readonly ThreadFixtureSpec[];
}

const pair = (
  a: ConceptId,
  b: ConceptId,
  intention: RelationIntention
): ThreadFixtureSpec => ({ a, b, intention });

/** The named shapes the brief calls out, so the sweep cannot miss them. */
function enumeratedWebs(): readonly Web[] {
  const webs: Web[] = [];

  webs.push({ label: "no concepts at all", conceptIds: [C.fibonacci], threads: [] });
  webs.push({ label: "no threads", conceptIds: POOL, threads: [] });
  webs.push({
    label: "one thread",
    conceptIds: POOL,
    threads: [pair(C.fibonacci, C.counterpoint, "echo")],
  });
  webs.push({
    label: "one thread, one faculty, whole arena",
    conceptIds: [C.just, C.equal, C.overtones],
    threads: [pair(C.just, C.equal, "tension")],
  });
  webs.push({
    label: "one thread, nothing left dark",
    conceptIds: [C.just, C.equal],
    threads: [pair(C.just, C.equal, "tension")],
  });

  for (const intention of INTENTIONS) {
    webs.push({
      label: `all-${intention} chain`,
      conceptIds: POOL,
      threads: [
        pair(C.fourier, C.overtones, intention),
        pair(C.overtones, C.standingWave, intention),
        pair(C.standingWave, C.energy, intention),
        pair(C.energy, C.perspective, intention),
      ],
    });
    webs.push({
      label: `all-${intention} disjoint pairs`,
      conceptIds: POOL,
      threads: [
        pair(C.fibonacci, C.girih, intention),
        pair(C.primes, C.polyrhythm, intention),
        pair(C.just, C.equal, intention),
        pair(C.standingWave, C.energy, intention),
      ],
    });
  }

  webs.push({
    label: "one component, one loop",
    conceptIds: POOL,
    threads: [
      pair(C.just, C.equal, "tension"),
      pair(C.overtones, C.just, "ground"),
      pair(C.overtones, C.equal, "ground"),
    ],
  });
  webs.push({
    label: "fragmented with an internal bridge",
    conceptIds: [C.fourier, C.overtones, C.energy, C.perspective, C.girih, C.cantor],
    threads: [
      pair(C.fourier, C.overtones, "echo"),
      pair(C.overtones, C.energy, "ground"),
      pair(C.perspective, C.girih, "echo"),
    ],
  });
  webs.push({
    label: "many components",
    conceptIds: POOL,
    threads: [
      pair(C.fibonacci, C.girih, "echo"),
      pair(C.primes, C.polyrhythm, "echo"),
      pair(C.just, C.equal, "tension"),
      pair(C.standingWave, C.energy, "ground"),
      pair(C.perspective, C.divisionism, "echo"),
      pair(C.cantor, C.symmetry, "passage"),
    ],
  });
  webs.push({
    label: "star: one concept carrying everything",
    conceptIds: POOL,
    threads: POOL.filter((id) => id !== C.overtones).map((id) =>
      pair(C.overtones, id, "ground")
    ),
  });
  // A thread against itself is deliberately absent: `relation.hypothesized`
  // rejects a pair of one concept at the event boundary, so no session can
  // reach the prose layer carrying one.
  webs.push({
    label: "the same pair drawn twice",
    conceptIds: POOL,
    threads: [
      pair(C.just, C.equal, "tension"),
      pair(C.just, C.equal, "ground"),
      pair(C.overtones, C.just, "echo"),
    ],
  });
  webs.push({
    label: "more than twelve threads",
    conceptIds: POOL,
    threads: [
      pair(C.fibonacci, C.counterpoint, "echo"),
      pair(C.fibonacci, C.girih, "echo"),
      pair(C.girih, C.perspective, "echo"),
      pair(C.primes, C.polyrhythm, "echo"),
      pair(C.polyrhythm, C.pendulums, "echo"),
      pair(C.just, C.equal, "tension"),
      pair(C.overtones, C.just, "ground"),
      pair(C.overtones, C.equal, "ground"),
      pair(C.fourier, C.overtones, "echo"),
      pair(C.fourier, C.standingWave, "echo"),
      pair(C.overtones, C.standingWave, "ground"),
      pair(C.symmetry, C.energy, "ground"),
      pair(C.cantor, C.fibonacci, "passage"),
      pair(C.divisionism, C.fourier, "echo"),
    ],
  });

  return Object.freeze(webs);
}

/** Randomised webs, to reach shapes nobody thought to enumerate. */
function randomWebs(count: number): readonly Web[] {
  const webs: Web[] = [];
  for (let seed = 1; seed <= count; seed += 1) {
    const random = seededRandom(seed * 2654435761);
    const conceptCount = 2 + Math.floor(random() * (POOL.length - 1));
    const conceptIds = POOL.slice(0, conceptCount);
    const threadCount = Math.floor(random() * 13);

    const threads: ThreadFixtureSpec[] = [];
    for (let index = 0; index < threadCount; index += 1) {
      const first = Math.floor(random() * conceptIds.length);
      // The event vocabulary rejects a pair of one concept, so the sweep only
      // generates sessions the game could actually have produced.
      const offset = 1 + Math.floor(random() * (conceptIds.length - 1));
      const a = conceptIds[first] as ConceptId;
      const b = conceptIds[(first + offset) % conceptIds.length] as ConceptId;
      const intention = INTENTIONS[
        Math.floor(random() * INTENTIONS.length)
      ] as RelationIntention;
      threads.push(pair(a, b, intention));
    }
    webs.push({ label: `random seed ${seed}`, conceptIds, threads });
  }
  return Object.freeze(webs);
}

const WEBS: readonly Web[] = Object.freeze([...enumeratedWebs(), ...randomWebs(120)]);

// ── Sentence extraction ──────────────────────────────────────────────────────

/**
 * Portrait phrases are one or two sentences; the Annotation is already split.
 * Nothing in the fixture vocabulary uses a full stop inside a name, so a split
 * on terminal punctuation followed by whitespace is exact here.
 */
function sentencesOf(text: string): readonly string[] {
  return text
    .split(/(?<=[.?])\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

interface Reading {
  readonly label: string;
  readonly sentences: readonly string[];
  readonly text: string;
  readonly componentCount: number;
}

function read(web: Web, lookupLabel: string, lookup: RelationLookup): Reading {
  const fixture = buildSessionFixture({
    conceptIds: web.conceptIds,
    threads: web.threads,
  });
  const state: SessionStateV1 = fixture.state;

  const annotation = buildAnnotation(state, lookup);
  const portrait = buildPortrait(state, lookup);

  const sentences = [
    ...annotation.sentences.flatMap((entry) => sentencesOf(entry)),
    ...portrait.dimensions.flatMap((entry) => sentencesOf(entry.phrase)),
  ];

  return {
    label: `${web.label} [${lookupLabel}]`,
    sentences,
    text: sentences.join(" "),
    componentCount: buildTopology(state, lookup).componentCount,
  };
}

const READINGS: readonly Reading[] = Object.freeze(
  WEBS.flatMap((web) => LOOKUPS.map(([label, lookup]) => read(web, label, lookup)))
);

// ── Rules ────────────────────────────────────────────────────────────────────

interface SentenceRule {
  readonly name: string;
  /** Returns an explanation when the sentence breaks the rule. */
  readonly violation: (sentence: string) => string | null;
}

const forbid = (name: string, pattern: RegExp, why: string): SentenceRule => ({
  name,
  violation: (sentence) => {
    const found = pattern.exec(sentence);
    return found === null ? null : `${why} (matched "${found[0]}")`;
  },
});

const SENTENCE_RULES: readonly SentenceRule[] = Object.freeze([
  {
    name: "is not empty",
    violation: (sentence) =>
      sentence.trim().length === 0 ? "an empty sentence was composed" : null,
  },
  {
    name: "terminates",
    violation: (sentence) =>
      /[.?]$/.test(sentence.trim())
        ? null
        : "a sentence did not end in a full stop (a quoted Open Thread question may end in a question mark)",
  },
  forbid(
    "no negated quantifier over a negated object",
    /\bnone\b(?:\s+\w+){0,4}\s+nothing\b/i,
    "a double negative says the opposite of what the web did"
  ),
  forbid(
    "no contrast hanging off a negated quantifier",
    /\bnone\b[^.?]*\brather than\b/i,
    "under the negation the 'rather than' clause attaches to nothing"
  ),
  forbid(
    "no dangling list separator",
    /,\s*and\s*[.;?]|,\s*[.;?]|\band\s+and\b/i,
    "a list was composed with a separator and no item after it"
  ),
  forbid(
    "no doubled article",
    /\b(?:the|a|an)\s+(?:the|a|an)\b/i,
    "two articles were concatenated"
  ),
  forbid(
    "no fraction with one as its denominator",
    /\bof your one \w+\b/i,
    "a share was stated of a quantity that has no parts"
  ),
  {
    // "Sound all answered." A subject carrying neither a comma nor an "and" is
    // one item, and `all` presumes several.
    name: "no plural quantifier over a single item",
    violation: (sentence) => {
      const found = /^(.+?) all (?:answered|returned)\b/i.exec(sentence);
      const subject = found?.[1];
      if (subject === undefined) return null;
      if (subject.includes(",") || /\band\b/i.test(subject)) return null;
      return `'all' presumes several and the sentence supplies one ("${subject}")`;
    },
  },
  {
    name: "no one-item list offered as a sample of itself",
    violation: (sentence) =>
      /\bone \w+[^.?]*, including\b/i.test(sentence)
        ? "'including' offers an example drawn from a larger set, and there is no larger set"
        : null,
  },
  forbid(
    "no placeholder leaked into prose",
    /\bundefined\b|\bNaN\b|\[object |\{[a-z]+\}/i,
    "an unrendered value reached the player"
  ),
  forbid(
    "no doubled or dangling whitespace",
    /\s{2,}|\s+[.,;]/,
    "composition left a gap where a fragment was omitted"
  ),
]);

// ── Cross-sentence contradiction ─────────────────────────────────────────────

/** The web is in pieces. */
const CLAIMS_FRAGMENTED = /separate figures|nothing you wove crosses between them/i;
/** The web is one piece. */
const CLAIMS_JOINED = /hangs together as one figure|the point everything turned on/i;
/** A crossing exists between the regions the player opened. */
const CLAIMS_GLOBAL_CROSSING =
  /is all that holds those two regions together|the only doorway between the regions you opened/i;

const WORD_TO_NUMBER: ReadonlyMap<string, number> = new Map(
  Array.from({ length: 40 }, (_, value) => [countWord(value), value] as const)
);

function statedComponentCounts(text: string): readonly number[] {
  const counts: number[] = [];
  for (const found of text.matchAll(/(\S+) separate figures/gi)) {
    const word = (found[1] ?? "").toLowerCase();
    const value = WORD_TO_NUMBER.get(word);
    if (value !== undefined) counts.push(value);
  }
  return counts;
}

// ── The sweep ────────────────────────────────────────────────────────────────

describe("generated prose — every sentence the Game can write", () => {
  it("sweeps a wide range of real web shapes", () => {
    // Guards the sweep itself: if the generator collapses, the rules below stop
    // proving anything.
    expect(READINGS.length).toBeGreaterThan(400);
    expect(READINGS.every((reading) => reading.sentences.length > 0)).toBe(true);
    expect(READINGS.some((reading) => reading.componentCount > 1)).toBe(true);
    expect(READINGS.some((reading) => reading.componentCount === 1)).toBe(true);
    expect(
      READINGS.some((reading) => CLAIMS_GLOBAL_CROSSING.test(reading.text))
    ).toBe(true);
  });

  for (const rule of SENTENCE_RULES) {
    it(rule.name, () => {
      const failures: string[] = [];
      for (const reading of READINGS) {
        for (const sentence of reading.sentences) {
          const why = rule.violation(sentence);
          if (why !== null) {
            failures.push(`${reading.label}: ${why}\n  "${sentence}"`);
          }
        }
      }
      expect(failures.slice(0, 8).join("\n")).toBe("");
    });
  }

  it("never says the web is one figure and several figures at once", () => {
    const failures: string[] = [];
    for (const reading of READINGS) {
      if (CLAIMS_FRAGMENTED.test(reading.text) && CLAIMS_JOINED.test(reading.text)) {
        failures.push(`${reading.label}: ${reading.text}`);
      }
    }
    expect(failures.slice(0, 4).join("\n")).toBe("");
  });

  it("never states a crossing it has said does not exist", () => {
    const failures: string[] = [];
    for (const reading of READINGS) {
      if (
        /nothing you wove crosses between them/i.test(reading.text) &&
        CLAIMS_GLOBAL_CROSSING.test(reading.text)
      ) {
        failures.push(`${reading.label}: ${reading.text}`);
      }
    }
    expect(failures.slice(0, 4).join("\n")).toBe("");
  });

  it("states one component count per session, and it is the real one", () => {
    const failures: string[] = [];
    for (const reading of READINGS) {
      const stated = statedComponentCounts(reading.text);
      const distinct = new Set(stated);
      if (distinct.size > 1) {
        failures.push(`${reading.label}: stated ${[...distinct].join(" and ")}`);
      }
      for (const value of distinct) {
        if (value !== reading.componentCount) {
          failures.push(
            `${reading.label}: stated ${value} figures, the web has ${reading.componentCount}`
          );
        }
      }
    }
    expect(failures.slice(0, 4).join("\n")).toBe("");
  });

  it("is identical on a second sweep", () => {
    for (const [label, lookup] of LOOKUPS) {
      for (const web of WEBS.slice(0, 12)) {
        expect(read(web, label, lookup).text).toBe(
          READINGS.find((reading) => reading.label === `${web.label} [${label}]`)?.text
        );
      }
    }
  });
});
