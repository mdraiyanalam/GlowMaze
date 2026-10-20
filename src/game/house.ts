/**
 * Decides when enemies leave the house.
 *
 * Normally each enemy has its own pellet counter, and only the first enemy still
 * inside (LURK, then FLUX, then DRIFT) counts. After the player loses a life, a
 * shared counter takes over instead: LURK leaves at 7 pellets, FLUX at 17, DRIFT at 32.
 * Either way, if the player goes too long without eating, the next enemy is let out.
 */

/** Shared-counter release points by enemy id. */
export const SHARED_RELEASE: readonly number[] = [0, 7, 17, 32];

const HOUSE_ORDER = [1, 2, 3] as const;

export class HouseController {
  counters = [0, 0, 0, 0];
  sharedActive = false;
  sharedCount = 0;
  idleFrames = 0;
  private limits: readonly number[] = [0, 0, 0, 0];
  private idleLimit = 240;

  resetForLevel(limits: readonly number[], idleLimitFrames: number): void {
    this.limits = limits;
    this.idleLimit = idleLimitFrames;
    this.counters = [0, 0, 0, 0];
    this.sharedActive = false;
    this.sharedCount = 0;
    this.idleFrames = 0;
  }

  /** Personal counters keep their values; the shared counter starts from zero. */
  onLifeLost(): void {
    this.sharedActive = true;
    this.sharedCount = 0;
    this.idleFrames = 0;
  }

  private next(inHouse: readonly boolean[]): number | null {
    for (const id of HOUSE_ORDER) if (inHouse[id]) return id;
    return null;
  }

  /** Call when the player eats a pellet. Returns enemy ids to release. */
  onPellet(inHouse: readonly boolean[]): number[] {
    this.idleFrames = 0;
    if (this.sharedActive) {
      this.sharedCount++;
      for (const id of HOUSE_ORDER) {
        if (this.sharedCount === SHARED_RELEASE[id] && inHouse[id]) {
          // As in the arcade game, the shared counter only switches off if DRIFT is still inside at 32.
          if (id === 3) this.sharedActive = false;
          return [id];
        }
      }
      return [];
    }
    const id = this.next(inHouse);
    if (id !== null) this.counters[id]++;
    return [];
  }

  /** Call once per frame. Returns an enemy id to release, or null. */
  tick(inHouse: readonly boolean[]): number | null {
    const id = this.next(inHouse);
    if (id === null) {
      this.idleFrames = 0;
      return null;
    }
    if (!this.sharedActive && this.counters[id] >= this.limits[id]) return id;
    this.idleFrames++;
    if (this.idleFrames >= this.idleLimit) {
      this.idleFrames = 0;
      return id;
    }
    return null;
  }
}
