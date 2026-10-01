import { describe, expect, it } from "vitest";
import { ambient } from "./ambient";

/**
 * ONE SEAT PER THREAD. The room re-seats the whole canonical session whenever
 * a thread is added, and the choir used to take every thread again each time:
 * at four threads it held ten seats, spoke about twice as often as designed,
 * and told the director twice the voices it had. A thread is seated once.
 */
describe("the choir's seats", () => {
  it("seats a thread once however often the room re-seats it", () => {
    ambient.stop();
    const before = ambient.activeVoiceCount();
    ambient.addThreadVoice("thread:seat-1", "measure.fibonacci-sequence", "sound.counterpoint");
    ambient.addThreadVoice("thread:seat-1", "measure.fibonacci-sequence", "sound.counterpoint");
    ambient.addThreadVoice("thread:seat-1", "measure.fibonacci-sequence", "sound.counterpoint");
    expect(ambient.activeVoiceCount()).toBe(before + 1);
    ambient.addThreadVoice("thread:seat-2", "measure.prime-numbers", "sound.polyrhythm");
    expect(ambient.activeVoiceCount()).toBe(before + 2);
    ambient.stop();
  });
});
