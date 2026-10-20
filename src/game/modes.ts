import { FPS } from './constants';

export type Mode = 'scatter' | 'chase';

/** The scatter/chase clock. The game stops ticking it while enemies are frightened. */
export class ModeTimer {
  private readonly phases: readonly number[];
  private index = 0;
  private frames = 0;

  constructor(seconds: readonly number[]) {
    this.phases = seconds.map((s) => (Number.isFinite(s) ? Math.max(1, Math.round(s * FPS)) : s));
  }

  get mode(): Mode {
    return this.index % 2 === 0 ? 'scatter' : 'chase';
  }

  get phaseIndex(): number {
    return this.index;
  }

  get framesInPhase(): number {
    return this.frames;
  }

  /** Advances one frame. Returns true on the frame the mode switches. */
  tick(): boolean {
    const length = this.phases[this.index];
    if (length === undefined || !Number.isFinite(length)) return false;
    this.frames++;
    if (this.frames < length) return false;
    this.index++;
    this.frames = 0;
    return true;
  }
}
