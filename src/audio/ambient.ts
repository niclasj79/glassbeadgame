import { audio } from "./engine";
import { playVoice } from "./voices";
import { degreeToFreq, noteForConcept } from "./theory";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import { hashString, mulberry32 } from "@/lib/utils";
import type { TimbreId } from "@/content/types";

/**
 * The generative soundtrack that grows with the web.
 * A lookahead scheduler (the "Tale of Two Clocks" pattern — a JS interval
 * schedules Web-Audio-clock-accurate events ahead of time; never the legacy
 * setTimeout-as-metronome). Each woven thread registers a recurring two-note
 * motif; density is capped and probabilities rebalance so the piece thickens
 * without turning to mud.
 */

const TICK_MS = 25;
const LOOKAHEAD_S = 1.2;
const SLOT_S = 2.0; // one scheduling slot ≈ half a "bar" at largo
const MAX_ACTIVE_MOTIFS = 6;

interface Motif {
  threadId: string;
  freqA: number;
  freqB: number;
  timbreA: TimbreId;
  timbreB: TimbreId;
  rng: () => number;
  flip: boolean;
}

class AmbientEngine {
  private timer: number | null = null;
  private nextSlotTime = 0;
  private slot = 0;
  private motifs: Motif[] = [];
  private droneRefreshAt = 0;
  private running = false;

  start(): void {
    const ctx = audio.ensure();
    if (!ctx || this.running) return;
    this.running = true;
    this.motifs = [];
    this.slot = 0;
    this.nextSlotTime = ctx.currentTime + 0.15;
    this.droneRefreshAt = 0;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.motifs = [];
    // Long-tailed voices fade out on their own envelopes.
  }

  addThreadVoice(threadId: string, aId: string, bId: string): void {
    const a = conceptById.get(aId);
    const b = conceptById.get(bId);
    if (!a || !b) return;
    const da = disciplineById.get(a.discipline)!;
    const db = disciplineById.get(b.discipline)!;
    this.motifs.push({
      threadId,
      freqA: noteForConcept(a),
      freqB: noteForConcept(b),
      timbreA: da.timbre,
      timbreB: db.timbre,
      rng: mulberry32(hashString(threadId)),
      flip: false,
    });
    if (this.motifs.length > MAX_ACTIVE_MOTIFS * 2) {
      // The oldest voices retire entirely once the choir is very full.
      this.motifs.splice(0, this.motifs.length - MAX_ACTIVE_MOTIFS * 2);
    }
  }

  private tick(): void {
    const ctx = audio.get();
    if (!ctx || !audio.ambientBus) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;

    while (this.nextSlotTime < horizon) {
      this.scheduleSlot(ctx, this.nextSlotTime, this.slot);
      this.nextSlotTime += SLOT_S;
      this.slot += 1;
    }
  }

  private scheduleSlot(ctx: AudioContext, t: number, slot: number): void {
    const bus = audio.ambientBus!;

    // The ground: root drone + slow pad, refreshed every 8 slots (~16s)
    // with overlapping envelopes so the floor never drops out.
    if (slot >= this.droneRefreshAt) {
      this.droneRefreshAt = slot + 8;
      playVoice(ctx, bus, "drone", degreeToFreq(0, 2), {
        gain: 0.14,
        at: t,
        attack: 2.5,
        hold: 12,
        release: 6,
      });
      playVoice(ctx, bus, "pad", degreeToFreq(3, 2), {
        gain: 0.05,
        at: t + 1.2,
        attack: 3,
        hold: 10,
        release: 6,
      });
    }

    // The choir: each thread's motif speaks with probability scaled by density.
    const active = this.motifs.slice(-MAX_ACTIVE_MOTIFS * 2);
    const density = Math.min(active.length, MAX_ACTIVE_MOTIFS);
    if (density === 0) return;
    const perMotifProb = 0.4 / Math.sqrt(density);
    const gainScale = 1 / Math.sqrt(Math.max(1, density));

    for (const m of active) {
      if (m.rng() > perMotifProb) continue;
      const jitter = m.rng() * (SLOT_S * 0.5);
      const first = m.flip ? m.freqB : m.freqA;
      const second = m.flip ? m.freqA : m.freqB;
      const timbre1 = m.flip ? m.timbreB : m.timbreA;
      const timbre2 = m.flip ? m.timbreA : m.timbreB;
      m.flip = !m.flip;
      playVoice(ctx, bus, timbre1, first, {
        gain: 0.075 * gainScale,
        at: t + jitter,
        release: 1.6,
      });
      playVoice(ctx, bus, timbre2, second, {
        gain: 0.06 * gainScale,
        at: t + jitter + 0.55 + m.rng() * 0.3,
        release: 1.8,
      });
      // Occasionally the motif lifts an octave — a thought recurring, changed.
      if (m.rng() < 0.18) {
        playVoice(ctx, bus, "bell", first * 2, {
          gain: 0.03 * gainScale,
          at: t + jitter + 1.3,
          release: 1.4,
        });
      }
    }
  }
}

export const ambient = new AmbientEngine();
