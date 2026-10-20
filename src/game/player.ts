import {
  DX,
  DY,
  LEFT,
  MAX_SPEED,
  PLAYER_START,
  centerOf,
  isHorizontal,
  opposite,
  tileOf,
  wrapX,
} from './constants';
import type { Dir, Tile } from './constants';
import type { Maze } from './maze';

/**
 * VOLT, the player. Moves one pixel at a time so tile centers are never skipped.
 *
 * Turning: a queued direction is taken as soon as the tile next to the player's
 * current tile is open in that direction, even a few pixels before or after the
 * tile center. While the player is off-center it also slides toward the center
 * on the other axis, so it cuts the corner diagonally. Enemies only turn exactly
 * at tile centers, which is why a skilled player can outrun them through turns.
 */
export class Player {
  x = PLAYER_START.x;
  y = PLAYER_START.y;
  dir: Dir = LEFT;
  /** Last direction the player asked for; kept until it can be taken. */
  want: Dir | null = null;
  /** Frames left to stand still after eating a pellet. */
  freeze = 0;
  blocked = false;
  /** Pixels travelled; drives the walk animation. */
  travel = 0;
  private acc = 0;

  reset(): void {
    this.x = PLAYER_START.x;
    this.y = PLAYER_START.y;
    this.dir = LEFT;
    this.want = null;
    this.freeze = 0;
    this.blocked = false;
    this.travel = 0;
    this.acc = 0;
  }

  get tile(): Tile {
    return { col: tileOf(this.x), row: tileOf(this.y) };
  }

  /** One frame of movement. `afterStep` runs after every pixel so the game can eat pellets. */
  update(maze: Maze, speed: number, afterStep: () => void): void {
    if (this.freeze > 0) {
      this.freeze--;
      return;
    }
    this.acc += speed * MAX_SPEED;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (!this.step(maze)) {
        this.acc = 0;
        this.blocked = true;
        return;
      }
      this.blocked = false;
      this.travel++;
      afterStep();
      if (this.freeze > 0) return;
    }
  }

  /** Moves one pixel. Returns false when a wall is in the way. */
  step(maze: Maze): boolean {
    const col = tileOf(this.x);
    const row = tileOf(this.y);
    const want = this.want;
    if (want !== null && want !== this.dir) {
      if (want === opposite(this.dir) || maze.isOpen(col + DX[want], row + DY[want])) this.dir = want;
    }

    const d = this.dir;
    const cx = centerOf(col);
    const cy = centerOf(row);
    const horizontal = isHorizontal(d);
    // How far past the tile center we are, measured in the direction of travel.
    const pastCenter = horizontal ? (this.x - cx) * DX[d] : (this.y - cy) * DY[d];
    if (pastCenter >= 0 && !maze.isOpen(col + DX[d], row + DY[d])) {
      if (horizontal) this.x = cx;
      else this.y = cy;
      return false;
    }

    this.x += DX[d];
    this.y += DY[d];
    if (horizontal) this.y += Math.sign(cy - this.y);
    else this.x += Math.sign(cx - this.x);
    this.x = wrapX(this.x);
    return true;
  }
}
