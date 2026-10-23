/**
 * Procedural sound effects with the Web Audio API — no audio files needed.
 * Sounds are panned in stereo according to where they happen on the court.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      const compressor = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(compressor).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** @param pan -1 (left) .. 1 (right) */
  paddle(speedRatio: number, pan: number): void {
    this.tone({ type: 'square', freq: 320 + speedRatio * 380, freqEnd: 180, duration: 0.09, gain: 0.35, pan });
    this.tone({ type: 'sine', freq: 90, freqEnd: 50, duration: 0.12, gain: 0.5, pan });
  }

  wall(pan: number): void {
    this.tone({ type: 'triangle', freq: 520, freqEnd: 380, duration: 0.06, gain: 0.25, pan });
  }

  score(pan: number): void {
    this.tone({ type: 'sawtooth', freq: 440, freqEnd: 110, duration: 0.45, gain: 0.25, pan });
    this.noise(0.25, 0.25, pan);
  }

  tick(): void {
    this.tone({ type: 'sine', freq: 880, duration: 0.05, gain: 0.2 });
  }

  serve(): void {
    this.tone({ type: 'sine', freq: 660, freqEnd: 1320, duration: 0.12, gain: 0.25 });
  }

  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ type: 'square', freq: f, duration: 0.18, gain: 0.2, delay: i * 0.11 }),
    );
  }

  lose(): void {
    [392, 329.63, 261.63, 196].forEach((f, i) =>
      this.tone({ type: 'triangle', freq: f, duration: 0.22, gain: 0.25, delay: i * 0.14 }),
    );
  }

  click(): void {
    this.tone({ type: 'square', freq: 1200, duration: 0.03, gain: 0.12 });
  }

  private tone(o: {
    type: OscillatorType;
    freq: number;
    freqEnd?: number;
    duration: number;
    gain: number;
    pan?: number;
    delay?: number;
  }): void {
    const out = this.output(o.pan ?? 0);
    if (!out || !this.ctx) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + o.duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.duration);
    osc.connect(env).connect(out);
    osc.start(t0);
    osc.stop(t0 + o.duration + 0.02);
  }

  private noise(duration: number, gain: number, pan: number): void {
    const out = this.output(pan);
    if (!out || !this.ctx) return;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    const env = this.ctx.createGain();
    env.gain.value = gain;
    src.buffer = buffer;
    src.connect(env).connect(out);
    src.start();
  }

  private output(pan: number): AudioNode | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.master);
    return panner;
  }
}
