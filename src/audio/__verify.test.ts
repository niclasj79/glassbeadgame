import { describe, it } from "vitest";
import { CASTALIA_CONCEPTS, castaliaConceptById } from "@/content/castalia/concepts";
import { CASTALIA_MODE } from "./mode";
import { suspensionInterval, type MotifSource } from "./grammar";
import {
  attunementBedGain,
  auditAttunement,
  flattenAttunement,
  planAttunement,
  type AttunementThread,
} from "./attunement";
import { peakConcurrentTenseNotes, peakTenseSummedGain } from "./plan";
import { SCORE } from "./score";
import { tensionCeiling } from "./comfort";

const src = (id: string): MotifSource => ({
  conceptId: id,
  motif: castaliaConceptById.get(id)!.motif,
});
const BED = SCORE.grammar.bedGain;

describe("verify", () => {
  it("prints", () => {
    const sources = CASTALIA_CONCEPTS.map((c) => ({
      conceptId: c.id,
      motif: c.motif,
    }));
    const counts = new Map<number, number>();
    let pairs = 0;
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const v = suspensionInterval(CASTALIA_MODE, sources[i], sources[j]);
        counts.set(v, (counts.get(v) ?? 0) + 1);
        pairs += 1;
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      "suspensions",
      [...counts.entries()].sort((a, b) => a[0] - b[0]),
      "pairs",
      pairs
    );

    const threads: AttunementThread[] = [
      {
        threadId: "t1",
        intention: "tension",
        a: src("sound.just-intonation"),
        b: src("sound.equal-temperament"),
        resolves: false,
      },
      {
        threadId: "t2",
        intention: "tension",
        a: src("measure.fibonacci-sequence"),
        b: src("sound.counterpoint"),
        resolves: false,
      },
    ];
    const plan = planAttunement({
      planId: "att",
      mode: CASTALIA_MODE,
      threads,
      unitSeconds: 0.125,
      ambientGain: BED,
    });
    const whole = flattenAttunement(plan);
    // eslint-disable-next-line no-console
    console.log(
      "attunement peak tense voices",
      peakConcurrentTenseNotes(whole),
      "summed",
      peakTenseSummedGain(whole).toFixed(5),
      "ceiling",
      tensionCeiling(attunementBedGain(BED)).toFixed(5),
      "ratio to bed",
      (peakTenseSummedGain(whole) / attunementBedGain(BED)).toFixed(3),
      "audit",
      auditAttunement(plan, BED)
    );
  });
});
