import { describe, expect, it } from 'vitest';
import { DOWN, LEFT, RIGHT, UP, centerOf } from '../src/game/constants';
import { Enemy } from '../src/game/enemy';
import { HouseController } from '../src/game/house';
import { levelSpec } from '../src/game/levels';
import { Maze } from '../src/game/maze';
import { ModeTimer } from '../src/game/modes';
import { aheadOf, chaseTarget, chooseDirection, chooseRandomDirection } from '../src/game/targeting';

const allOpen = () => true;
const corner = { col: 0, row: 32 };

describe('enemy targets', () => {
  const player = { tile: { col: 10, row: 20 }, dir: RIGHT };
  const viper = { col: 14, row: 24 };

  it('VIPER targets the player tile', () => {
    expect(chaseTarget(0, player, viper, viper, corner)).toEqual({ col: 10, row: 20 });
  });

  it('LURK targets 4 tiles ahead of the player', () => {
    expect(chaseTarget(1, player, viper, viper, corner)).toEqual({ col: 14, row: 20 });
    expect(chaseTarget(1, { ...player, dir: DOWN }, viper, viper, corner)).toEqual({ col: 10, row: 24 });
  });

  it('keeps the arcade quirk: facing up also shifts the target left', () => {
    expect(aheadOf({ col: 10, row: 20 }, UP, 4)).toEqual({ col: 6, row: 16 });
    expect(aheadOf({ col: 10, row: 20 }, UP, 4, false)).toEqual({ col: 10, row: 16 });
  });

  it('FLUX doubles the line from VIPER to 2 tiles ahead of the player', () => {
    // pivot = (12, 20); target = pivot + (pivot - viper) = (10, 16)
    expect(chaseTarget(2, player, viper, viper, corner)).toEqual({ col: 10, row: 16 });
  });

  it('DRIFT chases from more than 8 tiles away and retreats when closer', () => {
    expect(chaseTarget(3, player, viper, { col: 10, row: 29 }, corner)).toEqual(player.tile);
    expect(chaseTarget(3, player, viper, { col: 10, row: 28 }, corner)).toEqual(corner);
  });
});

describe('junction choice', () => {
  const here = { col: 5, row: 5 };

  it('never reverses and breaks ties up, left, down, right', () => {
    expect(chooseDirection(here, LEFT, here, allOpen)).toBe(UP);
    expect(chooseDirection(here, DOWN, here, allOpen)).toBe(LEFT);
    expect(chooseDirection(here, UP, here, allOpen)).toBe(UP);
  });

  it('takes the exit closest to the target', () => {
    expect(chooseDirection(here, RIGHT, { col: 5, row: 20 }, allOpen)).toBe(DOWN);
  });

  it('reverses only from a dead end', () => {
    const onlyBack = (c: number) => c === 4;
    expect(chooseDirection(here, RIGHT, { col: 30, row: 5 }, onlyBack)).toBe(LEFT);
  });

  it('frightened choice falls back to up, left, down, right', () => {
    const noRight = (c: number, r: number) => !(c === 6 && r === 5);
    // random 0.99 picks RIGHT, which is blocked, so it falls back to UP
    expect(chooseRandomDirection(here, LEFT, () => 0.99, noRight)).toBe(UP);
    // random 0 picks UP, which is the reverse of DOWN, so it falls back to LEFT
    expect(chooseRandomDirection(here, DOWN, () => 0, allOpen)).toBe(LEFT);
  });
});

describe('scatter / chase clock', () => {
  it('runs 7, 20, 7, 20, 5, 20, 5 seconds, then chases forever on level 1', () => {
    const timer = new ModeTimer(levelSpec(1).modeSeconds);
    const switches: number[] = [];
    for (let f = 1; f <= 60 * 300; f++) if (timer.tick()) switches.push(f);
    expect(switches).toEqual([420, 1620, 2040, 3240, 3540, 4740, 5040]);
    expect(timer.mode).toBe('chase');
  });

  it('uses the later-level schedules', () => {
    expect(levelSpec(2).modeSeconds.slice(0, 7)).toEqual([7, 20, 7, 20, 5, 1033, 1 / 60]);
    expect(levelSpec(5).modeSeconds.slice(0, 7)).toEqual([5, 20, 5, 20, 5, 1037, 1 / 60]);
  });
});

describe('house releases', () => {
  it('lets LURK out at once, FLUX after 30 pellets and DRIFT after 60 more on level 1', () => {
    const h = new HouseController();
    h.resetForLevel(levelSpec(1).houseDotLimits, 240);
    const inHouse = [false, true, true, true];
    expect(h.tick(inHouse)).toBe(1);
    inHouse[1] = false;
    for (let i = 0; i < 29; i++) h.onPellet(inHouse);
    expect(h.tick(inHouse)).toBe(null);
    h.onPellet(inHouse);
    expect(h.tick(inHouse)).toBe(2);
    inHouse[2] = false;
    for (let i = 0; i < 59; i++) h.onPellet(inHouse);
    expect(h.tick(inHouse)).toBe(null);
    h.onPellet(inHouse);
    expect(h.tick(inHouse)).toBe(3);
  });

  it('releases the next enemy if the player stops eating', () => {
    const h = new HouseController();
    h.resetForLevel(levelSpec(1).houseDotLimits, 240);
    const inHouse = [false, false, true, true];
    let released: number | null = null;
    let frames = 0;
    while (released === null && frames < 1000) {
      released = h.tick(inHouse);
      frames++;
    }
    expect(released).toBe(2);
    expect(frames).toBe(240);
  });

  it('uses the shared counter after a lost life: 7, 17, 32', () => {
    const h = new HouseController();
    h.resetForLevel(levelSpec(1).houseDotLimits, 10_000);
    h.onLifeLost();
    const inHouse = [false, true, true, true];
    const out: [number, number][] = [];
    for (let n = 1; n <= 40; n++) {
      for (const id of h.onPellet(inHouse)) {
        out.push([n, id]);
        inHouse[id] = false;
      }
    }
    expect(out).toEqual([
      [7, 1],
      [17, 2],
      [32, 3],
    ]);
    expect(h.sharedActive).toBe(false);
  });
});

describe('enemy movement', () => {
  const world = (maze = new Maze()) => ({ maze, target: () => ({ col: 0, row: 0 }), random: () => 0.5 });

  it('turns around when told to', () => {
    const e = new Enemy(0);
    e.x = centerOf(3) + 1; // on row 1, moving right, just past a center
    e.y = centerOf(1);
    e.dir = RIGHT;
    e.reverse();
    e.update(world(), 1);
    expect(e.dir).toBe(LEFT);
  });

  it('leaves the house through the door', () => {
    const e = new Enemy(2);
    e.release();
    for (let i = 0; i < 200 && e.state !== 'active'; i++) e.update(world(), 0.8);
    expect(e.state).toBe('active');
    expect(e.tile).toEqual({ col: 14, row: 11 });
  });

  it('returns home as eyes, revives, and comes back out', () => {
    const e = new Enemy(1);
    e.state = 'active';
    e.x = centerOf(9);
    e.y = centerOf(20);
    e.dir = UP;
    e.eaten();
    const w = { ...world(), target: () => ({ col: 13, row: 11 }) };
    const seen = new Set<string>();
    for (let i = 0; i < 3000 && !(seen.has('leaving') && e.state === 'active'); i++) {
      e.update(w, 1.5);
      seen.add(e.state);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['eyes', 'entering', 'leaving', 'active']));
    expect(e.state).toBe('active');
    expect(e.frightened).toBe(false);
  });
});
