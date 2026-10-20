import {
  DOWN,
  DX,
  DY,
  HOUSE_CENTER_Y,
  HOUSE_DOOR_TARGET,
  HOUSE_EXIT,
  HOUSE_SLOTS_X,
  LEFT,
  MAX_SPEED,
  RIGHT,
  UP,
  offsetInTile,
  opposite,
  tileOf,
  wrapX,
} from './constants';
import type { Dir, Tile } from './constants';
import type { Maze } from './maze';
import { chooseDirection, chooseRandomDirection } from './targeting';

/**
 * house:    waiting inside, bobbing up and down
 * leaving:  sliding to the door and up out of the house
 * active:   roaming the maze (scatter, chase or frightened)
 * eyes:     eaten; racing back to the house
 * entering: dropping through the door to revive
 */
export type EnemyState = 'house' | 'leaving' | 'active' | 'eyes' | 'entering';

export const ENEMY_NAMES = ['VIPER', 'LURK', 'FLUX', 'DRIFT'] as const;

export interface EnemyWorld {
  maze: Maze;
  target(e: Enemy): Tile;
  random(): number;
}

const BOB = 4;

export class Enemy {
  x = 0;
  y = 0;
  dir: Dir = LEFT;
  state: EnemyState = 'house';
  frightened = false;
  private acc = 0;
  private decidedAt: number | null = null;
  private reversePending = false;

  constructor(readonly id: number) {
    this.reset();
  }

  reset(): void {
    this.acc = 0;
    this.frightened = false;
    this.reversePending = false;
    this.decidedAt = null;
    if (this.id === 0) {
      this.x = HOUSE_EXIT.x;
      this.y = HOUSE_EXIT.y;
      this.dir = LEFT;
      this.state = 'active';
    } else {
      this.x = HOUSE_SLOTS_X[this.id];
      this.y = HOUSE_CENTER_Y;
      this.dir = this.id === 1 ? DOWN : UP;
      this.state = 'house';
    }
  }

  get tile(): Tile {
    return { col: tileOf(this.x), row: tileOf(this.y) };
  }

  /** Turn around at the next step (mode switch or power pellet). */
  reverse(): void {
    if (this.state === 'active') this.reversePending = true;
  }

  release(): void {
    if (this.state === 'house') this.state = 'leaving';
  }

  eaten(): void {
    this.state = 'eyes';
    this.frightened = false;
    this.reversePending = false;
    this.decidedAt = null;
  }

  update(world: EnemyWorld, speed: number): void {
    this.acc += speed * MAX_SPEED;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.step(world);
    }
  }

  private step(world: EnemyWorld): void {
    switch (this.state) {
      case 'house':
        return this.bob();
      case 'leaving':
        return this.leave();
      case 'entering':
        return this.enter();
      default:
        return this.roam(world);
    }
  }

  private bob(): void {
    if (this.dir !== UP && this.dir !== DOWN) this.dir = UP;
    if (this.y <= HOUSE_CENTER_Y - BOB) this.dir = DOWN;
    else if (this.y >= HOUSE_CENTER_Y + BOB) this.dir = UP;
    this.y += DY[this.dir];
  }

  private leave(): void {
    if (this.x !== HOUSE_EXIT.x) {
      this.dir = this.x < HOUSE_EXIT.x ? RIGHT : LEFT;
      this.x += DX[this.dir];
      return;
    }
    if (this.y > HOUSE_EXIT.y) {
      this.dir = UP;
      this.y--;
      if (this.y > HOUSE_EXIT.y) return;
    }
    this.state = 'active';
    this.dir = LEFT;
    this.decidedAt = null;
  }

  private enter(): void {
    if (this.x !== HOUSE_EXIT.x) {
      this.dir = this.x < HOUSE_EXIT.x ? RIGHT : LEFT;
      this.x += DX[this.dir];
      return;
    }
    if (this.y < HOUSE_CENTER_Y) {
      this.dir = DOWN;
      this.y++;
      return;
    }
    this.state = 'leaving';
    this.frightened = false;
  }

  private roam(world: EnemyWorld): void {
    const col = tileOf(this.x);
    const row = tileOf(this.y);
    const centered = offsetInTile(this.x) === 4 && offsetInTile(this.y) === 4;
    const key = (row + 8) * 64 + (col + 8);

    if (this.reversePending) {
      this.reversePending = false;
      this.dir = opposite(this.dir);
      // Off-center, the enemy re-decides at the center it is heading back to.
      this.decidedAt = centered ? key : null;
    }

    if (centered) {
      if (this.state === 'eyes' && row === HOUSE_DOOR_TARGET.row && (col === 13 || col === 14)) {
        this.state = 'entering';
        this.enter();
        return;
      }
      const isOpen = (c: number, r: number) => world.maze.isOpen(c, r);
      const blocked = !isOpen(col + DX[this.dir], row + DY[this.dir]);
      if (this.decidedAt !== key || blocked) {
        this.decidedAt = key;
        const here = { col, row };
        this.dir = this.frightened
          ? chooseRandomDirection(here, this.dir, world.random, isOpen)
          : chooseDirection(here, this.dir, world.target(this), isOpen);
      }
    }

    this.x = wrapX(this.x + DX[this.dir]);
    this.y += DY[this.dir];
  }
}
