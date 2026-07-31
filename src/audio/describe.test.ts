import { describe, expect, it } from "vitest";

import { CASTALIA_LOOKUP } from "@/content/castalia";
import { castaliaConceptById } from "@/content/castalia/concepts";
import { RELATION_INTENTIONS, type RelationIntention } from "@/domain/events";
import { planAttentionSpace } from "./attention";
import { planAttunement } from "./attunement";
import { planConclusionPerformance } from "./conclusion";
import {
  GRAMMAR_PHRASE,
  describeAttentionSpace,
  describeAttunement,
  describeConclusion,
  describeVoicePlan,
  intervalPhrase,
} from "./describe";
import { planRelationVoices } from "./grammar";
import { CASTALIA_MODE } from "./mode";
import { NEUTRAL_PHRASING, type MotifSource } from "./motif";
import { SCORE } from "./score";

const source = (id: string): MotifSource => {
  const concept = castaliaConceptById.get(id);
  if (!concept) throw new Error(`missing fixture concept ${id}`);
  return { conceptId: concept.id, motif: concept.motif };
};

const names = { conceptName: (id: string) => CASTALIA_LOOKUP.conceptName(id) };
const FIBONACCI = source("measure.fibonacci-sequence");
const COUNTERPOINT = source("sound.counterpoint");
const JUST = source("sound.just-intonation");
const EQUAL = source("sound.equal-temperament");
const SYMMETRY = source("measure.continuous-symmetry");
const ENERGY = source("matter.conservation-of-energy");
const PERSPECTIVE = source("image.linear-perspective");
const CAMERA = source("image.camera-obscura");

const relation = (
  intention: RelationIntention,
  a: MotifSource,
  b: MotifSource,
  resolves = true
) =>
  planRelationVoices({
    planId: `p:${intention}`,
    mode: CASTALIA_MODE,
    intention,
    a,
    b,
    unitSeconds: 0.125,
    ambientGain: SCORE.grammar.bedGain,
    bedGain: SCORE.grammar.bedGain,
    resolves,
    phrasing: { ...NEUTRAL_PHRASING, rubato: 0 },
  });

/** Words that would mean the caption had started praising or asserting. */
const FORBIDDEN = [
  "well done",
  "correct",
  "brilliant",
  "great",
  "influenced",
  "inspired by",
  "proves",
  "everything is connected",
];

describe("captions for the music", () => {
  it("describes every relation grammar, naming both concepts", () => {
    const pairs: readonly (readonly [RelationIntention, MotifSource, MotifSource])[] = [
      ["echo", FIBONACCI, COUNTERPOINT],
      ["passage", PERSPECTIVE, CAMERA],
      ["tension", JUST, EQUAL],
      ["ground", SYMMETRY, ENERGY],
    ];
    for (const [intention, a, b] of pairs) {
      const text = describeVoicePlan(relation(intention, a, b), names);
      expect(text).not.toBeNull();
      expect(text!).toContain(CASTALIA_LOOKUP.conceptName(a.conceptId));
      expect(text!).toContain(CASTALIA_LOOKUP.conceptName(b.conceptId));
    }
  });

  it("names the grammar, so the four are distinguishable in text alone", () => {
    const texts = [
      describeVoicePlan(relation("echo", FIBONACCI, COUNTERPOINT), names)!,
      describeVoicePlan(relation("passage", PERSPECTIVE, CAMERA), names)!,
      describeVoicePlan(relation("tension", JUST, EQUAL), names)!,
      describeVoicePlan(relation("ground", SYMMETRY, ENERGY), names)!,
    ];
    expect(texts[0].startsWith("Echo.")).toBe(true);
    expect(texts[1].startsWith("Passage.")).toBe(true);
    expect(texts[2].startsWith("Tension.")).toBe(true);
    expect(texts[3].startsWith("Ground.")).toBe(true);
    expect(new Set(texts).size).toBe(4);
  });

  it("carries the musical facts a hearing player receives", () => {
    const echo = describeVoicePlan(relation("echo", FIBONACCI, COUNTERPOINT), names)!;
    // Which body answers, at what interval, and that the rhythm is shared.
    expect(echo).toContain("gut string");
    expect(echo).toMatch(/fifth|fourth|third|sixth|seventh|tone|semitone|octave/);
    expect(echo).toContain("rhythm");

    const tension = describeVoicePlan(relation("tension", JUST, EQUAL), names)!;
    expect(tension).toMatch(/beating \d/);
    expect(tension).toContain("does not resolve");

    const ground = describeVoicePlan(relation("ground", SYMMETRY, ENERGY), names)!;
    expect(ground).toContain("unchanging pitch");
    expect(ground).toContain("continues above");
  });

  it("always says whether the phrase closes", () => {
    for (const intention of RELATION_INTENTIONS) {
      const closed = describeVoicePlan(
        relation(intention, FIBONACCI, COUNTERPOINT, true),
        names
      )!;
      const open = describeVoicePlan(
        relation(intention, FIBONACCI, COUNTERPOINT, false),
        names
      )!;
      if (intention === "tension") {
        // Tension never closes, so both readings say the same true thing.
        expect(closed).toBe(open);
        expect(closed).toContain("does not resolve");
      } else {
        expect(closed).not.toBe(open);
      }
    }
  });

  it("never praises the player and never asserts influence", () => {
    const all = [
      ...RELATION_INTENTIONS.map(
        (intention) => describeVoicePlan(relation(intention, FIBONACCI, COUNTERPOINT), names)!
      ),
      describeAttentionSpace(
        planAttentionSpace({
          planId: "a",
          mode: CASTALIA_MODE,
          attended: FIBONACCI,
          unitSeconds: 0.125,
          ambientGain: SCORE.grammar.bedGain,
          activeThreadCount: 0,
        }),
        names
      ),
    ];
    for (const text of all) {
      for (const word of FORBIDDEN) {
        expect(text.toLowerCase()).not.toContain(word);
      }
    }
  });

  it("names intervals as a listener hears them", () => {
    expect(intervalPhrase(7)).toBe("a fifth");
    expect(intervalPhrase(12)).toBe("an octave");
    expect(intervalPhrase(13)).toBe("a compound semitone");
    expect(intervalPhrase(0)).toBe("the same pitch");
  });
});

describe("captions for the states", () => {
  it("says what attention did to the score", () => {
    const thin = describeAttentionSpace(
      planAttentionSpace({
        planId: "a",
        mode: CASTALIA_MODE,
        attended: FIBONACCI,
        unitSeconds: 0.125,
        ambientGain: SCORE.grammar.bedGain,
        activeThreadCount: 0,
      }),
      names
    );
    const answering = describeAttentionSpace(
      planAttentionSpace({
        planId: "a",
        mode: CASTALIA_MODE,
        attended: FIBONACCI,
        unitSeconds: 0.125,
        ambientGain: SCORE.grammar.bedGain,
        activeThreadCount: 6,
      }),
      names
    );
    expect(thin).toContain("thins out");
    expect(answering).toContain("silence");
    expect(thin).toContain("Fibonacci Sequence");
  });

  it("lists the threads Attunement will sound, in order", () => {
    const text = describeAttunement(
      planAttunement({
        planId: "att",
        mode: CASTALIA_MODE,
        threads: [
          {
            threadId: "t1",
            intention: "echo",
            a: FIBONACCI,
            b: COUNTERPOINT,
            resolves: true,
          },
          {
            threadId: "t2",
            intention: "tension",
            a: JUST,
            b: EQUAL,
            resolves: false,
          },
        ],
        unitSeconds: 0.125,
        ambientGain: SCORE.grammar.bedGain,
      }),
      names
    );
    expect(text).toContain("Fibonacci Sequence and Counterpoint");
    expect(text).toContain("Just Intonation and Equal Temperament");
    expect(text.indexOf("Fibonacci")).toBeLessThan(text.indexOf("Just Intonation"));
  });

  it("says nothing was woven rather than inventing a performance", () => {
    const text = describeAttunement(
      planAttunement({
        planId: "att",
        mode: CASTALIA_MODE,
        threads: [],
        unitSeconds: 0.125,
        ambientGain: SCORE.grammar.bedGain,
      }),
      names
    );
    expect(text).toContain("nothing to sound");
  });

  it("names what stayed unresolved in the conclusion", () => {
    const text = describeConclusion(
      planConclusionPerformance(
        {
          sessionId: "s",
          secondsPerBeat: 0.75,
          entries: [],
          ensembles: [],
          unresolved: [
            {
              threadId: "u",
              conceptIds: [JUST.conceptId, EQUAL.conceptId],
              fromSeconds: 0,
              gain: 0.05,
              floorGain: 0.01,
              decayToFloorSeconds: 12,
            },
          ],
          totalSeconds: 10,
        },
        {
          mode: CASTALIA_MODE,
          ambientGain: SCORE.grammar.bedGain,
          bedGain: SCORE.grammar.bedGain,
          motifFor: (id) => castaliaConceptById.get(id)?.motif ?? null,
        }
      ),
      names
    );
    expect(text).toContain("Still unresolved, and left so");
    expect(text).toContain("Just Intonation and Equal Temperament");
  });

  it("keeps the accepted first-use vocabulary available", () => {
    expect(Object.keys(GRAMMAR_PHRASE).sort()).toEqual([...RELATION_INTENTIONS].sort());
  });
});
