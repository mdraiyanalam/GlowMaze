import { describe, expect, it, vi } from 'vitest';
import { DOWN, LEFT, RIGHT, UP, centerOf } from '../src/game/constants';
import { Game, TIMING } from '../src/game/game';
import { levelSpec } from '../src/game/levels';
import { Maze } from '../src/game/maze';

/** Ticks until `done()` is true; fails instead of hanging if it never happens. */
function until(g: Game, done: () => boolean, max = 60 * 120): void {
  for (let i = 0; i < max; i++) {
    if (done()) return;
    g.tick();
  }
  throw new Error('condition never became true');
}

function playing(): Game {
  const g = new Game();
  g.start();
  until(g, () => g.phase === 'playing');
  return g;
}

/** Puts an enemy on the player's tile, outside the house. */
function touch(g: Game, id: number) {
  const e = g.enemies[id];
  e.state = 'active';
  e.x = g.player.x;
  e.y = g.player.y;
  return e;
}

/** Moves the player to a tile center with an empty corridor around it. */
function park(g: Game, col = 9, row = 15) {
  g.player.x = centerOf(col);
  g.player.y = centerOf(row);
  g.player.dir = DOWN;
}

describe('scoring', () => {
  it('scores 10 for a pellet and freezes the player for one frame', () => {
    const g = playing();
    // The start corridor is empty; heading down leads to the first pellet.
    g.setDirection(DOWN);
    until(g, () => g.score > 0);
    expect(g.score).toBe(10);
    expect(g.player.freeze).toBe(1);
    const x = g.player.x;
    g.tick();
    expect(g.player.x).toBe(x);
  });

  it('scores 50 for a power pellet, freezes 3 frames, and frightens the enemies', () => {
    const g = playing();
    g.player.x = centerOf(1);
    g.player.y = centerOf(8);
    g.player.dir = UP;
    const spies = g.enemies.map((e) => vi.spyOn(e, 'reverse'));
    let before = g.score;
    for (let i = 0; i < 600 && g.maze.pelletAt(1, 7); i++) {
      before = g.score;
      g.tick();
    }
    expect(g.maze.pelletAt(1, 7)).toBe(null);
    expect(g.score - before).toBe(50);
    expect(g.player.freeze).toBe(3);
    expect(g.frightFrames).toBeGreaterThan(6 * 60 - 5);
    expect(g.enemies.every((e) => e.frightened)).toBe(true);
    for (const s of spies) expect(s).toHaveBeenCalled();
  });

  it('doubles the points for each enemy eaten in one power-up', () => {
    const g = playing();
    park(g);
    g.startFright();
    const got: number[] = [];
    for (const id of [0, 1, 2, 3]) {
      touch(g, id).frightened = true;
      const before = g.score;
      g.checkCollisions();
      got.push(g.score - before);
      expect(g.phase).toBe('enemyEaten');
      expect(g.enemies[id].state).toBe('eyes');
      for (let i = 0; i < TIMING.enemyEaten; i++) g.tick();
      park(g);
    }
    expect(got).toEqual([200, 400, 800, 1600]);
  });

  it('awards one extra life at 10,000 points', () => {
    const g = playing();
    expect(g.lives).toBe(3);
    g.addScore(9990);
    expect(g.lives).toBe(3);
    g.addScore(10);
    expect(g.lives).toBe(4);
    g.addScore(50_000);
    expect(g.lives).toBe(4);
  });

  it('shows a bonus item after 70 and 170 pellets', () => {
    const g = playing();
    const pellets: [number, number][] = [];
    for (let r = 0; r < 31; r++) for (let c = 0; c < 28; c++) if (g.maze.pelletAt(c, r) === 'dot') pellets.push([c, r]);
    for (let i = 0; i < 69; i++) g.eatPellet(...pellets[i]);
    expect(g.bonus).toBe(null);
    g.eatPellet(...pellets[69]);
    expect(g.bonus).toMatchObject({ kind: 'chip', points: 100 });
    expect(g.bonus!.frames).toBeGreaterThanOrEqual(9 * 60);
    expect(g.bonus!.frames).toBeLessThan(10 * 60);
    g.bonus = null;
    for (let i = 70; i < 169; i++) g.eatPellet(...pellets[i]);
    expect(g.bonus).toBe(null);
    g.eatPellet(...pellets[169]);
    expect(g.bonus).not.toBe(null);
  });
});

describe('lives and levels', () => {
  it('loses a life when an enemy touches the player', () => {
    const g = playing();
    park(g);
    touch(g, 0);
    g.checkCollisions();
    expect(g.phase).toBe('dying');
    until(g, () => g.phase !== 'dying');
    expect(g.lives).toBe(2);
    expect(g.phase).toBe('ready');
    expect(g.house.sharedActive).toBe(true);
  });

  it('ends the game when the last life is lost', () => {
    const g = playing();
    g.lives = 1;
    park(g);
    touch(g, 0);
    g.checkCollisions();
    until(g, () => g.phase !== 'dying');
    expect(g.phase).toBe('gameOver');
  });

  it('clears the level when every pellet is gone', () => {
    const g = playing();
    for (let r = 0; r < 31; r++) for (let c = 0; c < 28; c++) g.eatPellet(c, r);
    g.tick();
    expect(g.phase).toBe('levelClear');
    until(g, () => g.phase !== 'levelClear');
    expect(g.level).toBe(2);
    expect(g.maze.pelletsLeft).toBe(244);
  });
});

describe('enemy rules', () => {
  it('pauses the scatter/chase clock while enemies are frightened', () => {
    const g = playing();
    for (let i = 0; i < 100; i++) g.tick();
    const before = g.modes.framesInPhase;
    g.startFright();
    for (let i = 0; i < 200; i++) g.tick();
    expect(g.modes.framesInPhase).toBe(before);
  });

  it('turns every enemy around when the mode switches', () => {
    const g = playing();
    const spy = vi.spyOn(g.enemies[0], 'reverse');
    until(g, () => g.modes.phaseIndex > 0);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('has shorter fright time on later levels, and none from level 19', () => {
    expect([1, 2, 3, 4, 5].map((l) => levelSpec(l).frightSeconds)).toEqual([6, 5, 4, 3, 2]);
    expect(levelSpec(17).frightSeconds).toBe(0);
    expect(levelSpec(19).frightSeconds).toBe(0);
    const g = playing();
    g.spec = levelSpec(19);
    g.startFright();
    expect(g.frightFrames).toBe(0);
    expect(g.enemies.some((e) => e.frightened)).toBe(false);
  });

  it('speeds VIPER up when few pellets are left', () => {
    const g = playing();
    const viper = g.enemies[0];
    viper.x = centerOf(9);
    viper.y = centerOf(15);
    expect(g.enemySpeed(viper)).toBe(0.75);
    g.maze.pelletsLeft = 20;
    expect(g.enemySpeed(viper)).toBe(0.8);
    g.maze.pelletsLeft = 10;
    expect(g.enemySpeed(viper)).toBe(0.85);
    g.elroySuspended = true;
    expect(g.enemySpeed(viper)).toBe(0.75);
  });

  it('slows enemies in the tunnels', () => {
    const g = playing();
    const e = g.enemies[0];
    e.x = centerOf(2);
    e.y = centerOf(14);
    expect(g.enemySpeed(e)).toBe(levelSpec(1).enemyTunnelSpeed);
  });
});

describe('player movement', () => {
  it('cuts corners: a turn taken before the center moves diagonally', () => {
    const g = new Game();
    const p = g.player;
    // Row 1, heading right, 3 px before the junction with the column-5 corridor.
    p.x = centerOf(5) - 3;
    p.y = centerOf(1);
    p.dir = RIGHT;
    p.want = DOWN;
    p.step(g.maze);
    expect(p.dir).toBe(DOWN);
    expect([p.x, p.y]).toEqual([centerOf(5) - 2, centerOf(1) + 1]);
    p.step(g.maze);
    p.step(g.maze);
    expect([p.x, p.y]).toEqual([centerOf(5), centerOf(1) + 3]);
  });

  it('stops at walls and only turns where the path is open', () => {
    const m = new Maze();
    const g = new Game();
    const p = g.player;
    p.x = centerOf(1);
    p.y = centerOf(1);
    p.dir = LEFT;
    expect(p.step(m)).toBe(false);
    expect(p.x).toBe(centerOf(1));
    p.want = DOWN;
    expect(p.step(m)).toBe(true);
    expect(p.dir).toBe(DOWN);
  });

  it('wraps through the side tunnels', () => {
    const g = new Game();
    const p = g.player;
    p.x = centerOf(0);
    p.y = centerOf(14);
    p.dir = LEFT;
    for (let i = 0; i < 13; i++) p.step(g.maze);
    expect(p.x).toBeGreaterThan(220);
    for (let i = 0; i < 12; i++) p.step(g.maze);
    expect(p.tile).toEqual({ col: 27, row: 14 });
  });
});

describe('long random play', () => {
  it('never puts the player or a roaming enemy inside a wall', () => {
    for (const seed of [1, 2, 3]) {
      const g = new Game();
      g.start();
      let r = seed * 9973;
      const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      let best = 0;
      for (let f = 0; f < 60 * 60 * 4; f++) {
        if (f % 20 === 0) g.setDirection(Math.floor(rand() * 4) as 0 | 1 | 2 | 3);
        if (g.phase === 'title') g.start();
        g.tick();
        best = Math.max(best, g.score);
        const p = g.player.tile;
        expect(g.maze.isOpen(p.col, p.row), `player in wall at ${p.col},${p.row}`).toBe(true);
        for (const e of g.enemies) {
          if (e.state !== 'active' && e.state !== 'eyes') continue;
          const t = e.tile;
          expect(g.maze.isOpen(t.col, t.row), `enemy ${e.id} (${e.state}) in wall at ${t.col},${t.row}`).toBe(true);
        }
      }
      expect(best).toBeGreaterThan(0);
    }
  });
});
