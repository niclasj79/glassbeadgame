import { describe, expect, it } from "vitest";
import { CASTALIA_LOOKUP } from "@/content/castalia";
import type { RelationIntention } from "@/domain/events";
import { toConceptId, toThreadId } from "@/domain/ids";
import type { CuePayloadMap, CueType, PresentationCue } from "@/runtime/cues";
import {
  createAudioDirector,
  type AudioSink,
  type ThreadVoiceLight,
} from "./director";

/**
 * WHICH THREAD IS SOUNDING, AND WHEN.
 *
 * `frameState.pulses` — "this thread's motif will sound at this audio-clock
 * moment" — was written by the ambient engine and read by *nothing*, anywhere.
 * The scene had no way to know which relation the music was speaking, which is
 * why Attunement's first clause ("threads become individually audible") had no
 * visible half at all: entering the held state thinned time and changed nothing
 * a screenshot could show.
 *
 * This is the channel that closes that loop. It reports; it never asserts.
 */

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const PRIMES = "measure.prime-numbers";

const cue = <Type extends CueType>(
  type: Type,
  payload: CuePayloadMap[Type]
): PresentationCue =>
  ({
    id: `cue:${type}`,
    type,
    sourceEventId: null,
    startAt: 0,
    duration: 1,
    channels: ["audio"],
    payload,
  }) as PresentationCue;

const QUANTIZED = 100.25;

function harness() {
  const lights: ThreadVoiceLight[] = [];
  const sink: AudioSink = {
    now: () => 100,
    quantize: () => QUANTIZED,
    play: () => {},
    setSpace: () => {},
    activeVoiceCount: () => 0,
    concludeAt: () => {},
  };
  const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
  director.onThreadVoice((light) => lights.push(light));
  return { director, lights };
}

const woven = (
  threadId: string,
  a: string,
  b: string,
  intention: RelationIntention
): CuePayloadMap["thread.woven"] => ({
  threadId: toThreadId(threadId),
  pair: [toConceptId(a), toConceptId(b)],
  intention,
  gesture: { inputModality: "mouse", durationMs: 900 },
});

const unresolved = (
  threadId: string,
  a: string,
  b: string,
  intention: RelationIntention
): CuePayloadMap["outcome.unresolved"] => ({
  threadId: toThreadId(threadId),
  pair: [toConceptId(a), toConceptId(b)],
  intention,
  statement: "Nothing is grounded here yet.",
});

describe("the thread-voice channel", () => {
  it("says which thread sounded, and on the clock the notes were scheduled on", () => {
    const { director, lights } = harness();
    director.handleCue(cue("thread.woven", woven("t1", FIBONACCI, COUNTERPOINT, "echo")));
    expect(lights).toHaveLength(1);
    expect(lights[0].threadId).toBe("t1");
    expect(lights[0].atSeconds).toBe(QUANTIZED);
    expect(lights[0].durationSeconds).toBeGreaterThan(0);
  });

  /**
   * CAV-006. An Unresolved thread is quieter, never dimmer: it lights for its
   * own span exactly as a documented relation does, because the player did
   * nothing wrong.
   */
  it("lights an unresolved thread as readily as a resolved one", () => {
    const { director, lights } = harness();
    director.handleCue(
      cue("outcome.unresolved", unresolved("t9", FIBONACCI, PRIMES, "ground"))
    );
    expect(lights.map((light) => light.threadId)).toEqual(["t9"]);
    expect(lights[0].durationSeconds).toBeGreaterThan(0);
  });

  /**
   * Spec §13, first clause. Attunement gives each thread its own window, and
   * the world must be able to show which one it is.
   */
  it("gives every Attunement channel its own window, in order", () => {
    const { director, lights } = harness();
    // The director learns a thread from its *outcome*, which is the cue that
    // says what the relation turned out to be.
    director.handleCue(
      cue("outcome.unresolved", unresolved("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    director.handleCue(
      cue("outcome.unresolved", unresolved("t2", PRIMES, COUNTERPOINT, "tension"))
    );
    lights.length = 0;

    director.handleCue(cue("attunement.changed", { active: true }));

    expect(lights.map((light) => light.threadId)).toEqual(["t1", "t2"]);
    // Individually audible means genuinely separate windows, not a texture.
    expect(lights[1].atSeconds).toBeGreaterThan(
      lights[0].atSeconds + lights[0].durationSeconds
    );
    for (const light of lights) expect(light.durationSeconds).toBeGreaterThan(0);
  });

  it("says nothing when Attunement is released", () => {
    const { director, lights } = harness();
    director.handleCue(
      cue("outcome.unresolved", unresolved("t1", FIBONACCI, COUNTERPOINT, "echo"))
    );
    lights.length = 0;
    director.handleCue(cue("attunement.changed", { active: false }));
    expect(lights).toEqual([]);
  });

  it("stops reporting once the listener detaches", () => {
    const lights: ThreadVoiceLight[] = [];
    const sink: AudioSink = {
      now: () => 100,
      quantize: () => QUANTIZED,
      play: () => {},
      setSpace: () => {},
      activeVoiceCount: () => 0,
      concludeAt: () => {},
    };
    const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
    const detach = director.onThreadVoice((light) => lights.push(light));
    director.handleCue(cue("thread.woven", woven("t1", FIBONACCI, COUNTERPOINT, "echo")));
    detach();
    director.handleCue(cue("thread.woven", woven("t2", PRIMES, COUNTERPOINT, "echo")));
    expect(lights.map((light) => light.threadId)).toEqual(["t1"]);
  });
});
