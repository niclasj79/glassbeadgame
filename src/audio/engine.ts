/**
 * The audio engine singleton — context lifecycle and gain staging.
 * Everything audible flows: (voice) → ambientBus | sfxBus → master →
 * compressor → destination. No React in here.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  ambientBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  private muted = false;

  private static MASTER_LEVEL = 0.8;

  /** Create (or resume) the context. Must first be called from a user gesture. */
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.01;
      this.compressor.release.value = 0.25;
      this.compressor.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : AudioEngine.MASTER_LEVEL;
      this.master.connect(this.compressor);

      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = 0.9;
      this.ambientBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void this.ctx?.resume();
      });
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Context if it already exists and is running-ish; never creates one. */
  get(): AudioContext | null {
    return this.ctx;
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(muted ? 0 : AudioEngine.MASTER_LEVEL, t, 0.05);
  }

  /** Gentle ambient swell as the web grows; capped, never dominant. */
  setAmbientIntensity(score: number): void {
    if (!this.ctx || !this.ambientBus) return;
    const target = 0.9 + Math.min(0.35, score / 400);
    this.ambientBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
  }
}

export const audio = new AudioEngine();
