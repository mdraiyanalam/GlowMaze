import type { Ambience, GameEvent } from '../game/game';

/**
 * All sounds are synthesized with the Web Audio API; there are no audio files.
 * The browser only allows audio after a key press or tap, so call unlock() from one.
 */

const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** Pellets play a rising pentatonic run that restarts when the player stops eating. */
const PELLET_NOTES = [72, 74, 76, 79, 81, 84, 86, 88].map(midi);

interface Loop {
  name: Ambience;
  nodes: AudioScheduledSourceNode[];
  gain: GainNode;
  set?: (progress: number) => void;
}

export class Sound {
  muted = false;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private loop: Loop | null = null;
  private note = 0;
  private lastPellet = 0;
  private readonly volume = 0.55;

  unlock(): void {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = this.muted ? 0 : this.volume;
        this.out.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  handle(events: readonly GameEvent[]): void {
    if (!this.ctx || !this.out) return;
    for (const e of events) this.play(e, this.ctx.currentTime);
  }

  /** Keeps the right background loop running: a pulse, the fright warble, or the eyes whine. */
  setAmbience(name: Ambience | null, progress: number): void {
    if (!this.ctx || !this.out) return;
    if (this.loop?.name === name) {
      this.loop.set?.(progress);
      return;
    }
    this.stopLoop();
    if (name) this.loop = this.startLoop(name, progress);
  }

  // ---------------------------------------------------------------- one-shots

  private play(e: GameEvent, t: number): void {
    switch (e) {
      case 'dot': {
        if (t - this.lastPellet > 0.35) this.note = 0;
        this.lastPellet = t;
        const f = PELLET_NOTES[this.note % PELLET_NOTES.length];
        this.note++;
        this.tone('triangle', f, f * 1.25, 0.05, 0.15, t);
        break;
      }
      case 'power':
        this.tone('sine', 220, 880, 0.22, 0.22, t);
        this.tone('square', 440, 1760, 0.18, 0.04, t);
        break;
      case 'enemyEaten':
        this.tone('square', 160, 1600, 0.3, 0.07, t);
        this.tone('sine', 320, 2400, 0.3, 0.12, t);
        break;
      case 'bonusEaten':
        [84, 88, 91, 96].forEach((m, i) => this.tone('sine', midi(m), midi(m), 0.1, 0.15, t + i * 0.06));
        break;
      case 'extraLife':
        [79, 83, 86, 91, 86, 91].forEach((m, i) => this.tone('square', midi(m), midi(m), 0.08, 0.05, t + i * 0.09));
        break;
      case 'levelClear':
        [72, 76, 79, 84, 88].forEach((m, i) => this.tone('triangle', midi(m), midi(m), 0.14, 0.14, t + i * 0.08));
        break;
      case 'gameOver':
        [67, 64, 60, 55].forEach((m, i) => this.tone('triangle', midi(m), midi(m) * 0.98, 0.3, 0.18, t + i * 0.28));
        break;
      case 'death':
        this.shortCircuit(t);
        break;
      case 'start':
        this.jingle(t);
        break;
      case 'bonusSpawn':
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(this.out!);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  /** A falling, buzzing sweep for when VOLT shorts out. */
  private shortCircuit(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 1.3);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const depth = ctx.createGain();
    depth.gain.value = 40;
    lfo.connect(depth).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.setValueAtTime(0.08, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(filter).connect(g).connect(this.out!);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 1.45);
    lfo.stop(t + 1.45);
    this.tone('square', 196, 98, 0.12, 0.07, t + 1.45);
    this.tone('square', 196, 98, 0.12, 0.07, t + 1.62);
  }

  /** Glowmaze's own start tune: an E-minor arpeggio riff over a moving bass, about 4 seconds. */
  private jingle(t0: number): void {
    const step = 0.14;
    const lead = [76, 79, 83, 88, 86, 83, 79, 83, 84, 81, 76, 81, 83, 79, 74, 79, 76, 79, 83, 88, 90, 88, 86, 83];
    lead.forEach((m, i) => this.tone('square', midi(m), midi(m), step * 0.9, 0.05, t0 + i * step));
    this.tone('square', midi(88), midi(88), 0.55, 0.05, t0 + lead.length * step);
    const bass = [52, 52, 48, 50, 52, 47];
    bass.forEach((m, i) => this.tone('triangle', midi(m), midi(m), step * 3.8, 0.2, t0 + i * step * 4));
    this.tone('triangle', midi(40), midi(40), 0.6, 0.22, t0 + bass.length * step * 4);
  }

  // ---------------------------------------------------------------- loops

  private startLoop(name: Ambience, progress: number): Loop {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.out!);
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.connect(depth);

    if (name === 'siren') {
      // A soft bass pulse that quickens as the board empties.
      osc.type = 'triangle';
      const pulse = ctx.createGain();
      pulse.gain.value = 0.5;
      osc.connect(pulse).connect(gain);
      lfo.type = 'square';
      depth.gain.value = 0.5;
      depth.connect(pulse.gain);
      const set = (p: number) => {
        const now = ctx.currentTime;
        osc.frequency.setTargetAtTime(98 * (1 + p * 0.5), now, 0.1);
        lfo.frequency.setTargetAtTime(2 + p * 3, now, 0.1);
      };
      set(progress);
      gain.gain.setTargetAtTime(0.11, t, 0.05);
      osc.start();
      lfo.start();
      return { name, nodes: [osc, lfo], gain, set };
    }

    if (name === 'fright') {
      osc.type = 'sine';
      osc.frequency.value = 440;
      lfo.type = 'triangle';
      lfo.frequency.value = 7;
      depth.gain.value = 180;
      gain.gain.setTargetAtTime(0.06, t, 0.05);
    } else {
      osc.type = 'triangle';
      osc.frequency.value = 1250;
      lfo.type = 'sawtooth';
      lfo.frequency.value = 15;
      depth.gain.value = 420;
      gain.gain.setTargetAtTime(0.04, t, 0.05);
    }
    depth.connect(osc.frequency);
    osc.connect(gain);
    osc.start();
    lfo.start();
    return { name, nodes: [osc, lfo], gain };
  }

  private stopLoop(): void {
    const loop = this.loop;
    if (!loop || !this.ctx) return;
    const t = this.ctx.currentTime;
    loop.gain.gain.setTargetAtTime(0, t, 0.03);
    for (const n of loop.nodes) n.stop(t + 0.2);
    this.loop = null;
  }
}
