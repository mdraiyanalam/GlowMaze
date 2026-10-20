import { BONUS_POS, BONUS_TILES, FPS, HOUSE_DOOR_TARGET, SCATTER_TARGETS } from './constants';
import type { Dir, Tile } from './constants';
import { Enemy } from './enemy';
import type { EnemyWorld } from './enemy';
import { HouseController } from './house';
import { levelSpec } from './levels';
import type { BonusKind, LevelSpec } from './levels';
import { Maze } from './maze';
import { ModeTimer } from './modes';
import { Player } from './player';
import { mulberry32 } from './rng';
import { chaseTarget } from './targeting';

export type Phase = 'title' | 'ready' | 'playing' | 'enemyEaten' | 'dying' | 'levelClear' | 'gameOver';

export type GameEvent =
  | 'start'
  | 'dot'
  | 'power'
  | 'enemyEaten'
  | 'death'
  | 'bonusSpawn'
  | 'bonusEaten'
  | 'extraLife'
  | 'levelClear'
  | 'gameOver';

export type Ambience = 'siren' | 'fright' | 'eyes';

export interface Popup {
  x: number;
  y: number;
  text: string;
  frames: number;
}

export interface Bonus {
  kind: BonusKind;
  points: number;
  frames: number;
}

export const SCORE = {
  dot: 10,
  power: 50,
  /** Each enemy eaten during one power-up is worth double the last. */
  enemyChain: [200, 400, 800, 1600] as const,
  extraLifeAt: 10_000,
};

export const START_LIVES = 3;
export const BONUS_AT_PELLETS: readonly number[] = [70, 170];

/** Phase lengths in frames (60 per second). */
export const TIMING = {
  readyFirst: 240,
  ready: 120,
  enemyEaten: 60,
  deathFreeze: 60,
  deathAnim: 100,
  deathEnd: 190,
  levelFreeze: 60,
  levelFlash: 96,
  gameOver: 180,
  /** Frightened enemies flash white/dark on this period near the end. */
  flashPeriod: 14,
  bonusMin: 9 * FPS,
  bonusExtra: FPS,
  popup: 2 * FPS,
};

/** Speed of returning eyes, and of enemies moving inside the house. */
export const EYES_SPEED = 1.5;
export const HOUSE_SPEED = 0.5;

export class Game implements EnemyWorld {
  phase: Phase = 'title';
  phaseFrames = 0;
  private phaseLength = 0;
  frame = 0;
  paused = false;

  level = 1;
  score = 0;
  hiScore = 0;
  lives = START_LIVES;
  extraLifeAwarded = false;

  spec: LevelSpec = levelSpec(1);
  maze = new Maze();
  readonly player = new Player();
  readonly enemies: readonly Enemy[] = [0, 1, 2, 3].map((id) => new Enemy(id));
  modes = new ModeTimer(this.spec.modeSeconds);
  readonly house = new HouseController();

  frightFrames = 0;
  flashFrames = 0;
  eatChain = 0;
  pelletsEaten = 0;
  /** After a lost life, enemy 1 can't speed up again until DRIFT leaves the house. */
  elroySuspended = false;
  bonus: Bonus | null = null;
  popups: Popup[] = [];
  eaten: { enemy: Enemy; points: number } | null = null;

  private events: GameEvent[] = [];
  private rng = mulberry32(1);
  private readonly bonusRng = mulberry32(0xb0b);

  readonly random = (): number => this.rng();

  // ---------------------------------------------------------------- controls

  start(): void {
    this.score = 0;
    this.lives = START_LIVES;
    this.extraLifeAwarded = false;
    this.level = 1;
    this.paused = false;
    this.setupLevel();
    this.resetActors();
    this.setPhase('ready', TIMING.readyFirst);
    this.emit('start');
  }

  pressStart(): void {
    if (this.phase === 'title') this.start();
    else if (this.phase === 'gameOver' && this.phaseFrames > 60) this.start();
  }

  setDirection(d: Dir): void {
    this.player.want = d;
  }

  get inGame(): boolean {
    return this.phase !== 'title' && this.phase !== 'gameOver';
  }

  togglePause(): void {
    if (this.inGame) this.paused = !this.paused;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- frame

  tick(): void {
    if (this.paused) return;
    this.frame++;
    this.phaseFrames++;
    if (this.popups.length) {
      for (const p of this.popups) p.frames--;
      this.popups = this.popups.filter((p) => p.frames > 0);
    }
    switch (this.phase) {
      case 'ready':
        if (this.phaseFrames >= this.phaseLength) this.setPhase('playing');
        break;
      case 'playing':
        this.tickPlaying();
        break;
      case 'enemyEaten':
        // Everything freezes except eyes that are already heading home.
        for (const e of this.enemies) {
          if (e !== this.eaten?.enemy && (e.state === 'eyes' || e.state === 'entering')) e.update(this, EYES_SPEED);
        }
        if (this.phaseFrames >= TIMING.enemyEaten) {
          this.eaten = null;
          this.setPhase('playing');
        }
        break;
      case 'dying':
        this.tickDying();
        break;
      case 'levelClear':
        if (this.phaseFrames >= TIMING.levelFreeze + TIMING.levelFlash) this.nextLevel();
        break;
      case 'gameOver':
        if (this.phaseFrames >= TIMING.gameOver) this.setPhase('title');
        break;
      case 'title':
        break;
    }
  }

  private tickPlaying(): void {
    // 1. Fright clock, or the scatter/chase clock (paused while frightened).
    if (this.frightFrames > 0) {
      this.frightFrames--;
      if (this.frightFrames === 0) for (const e of this.enemies) e.frightened = false;
    } else if (this.modes.tick()) {
      for (const e of this.enemies) e.reverse();
    }

    // 2. House releases on the idle timer / pellet counters.
    const id = this.house.tick(this.inHouse());
    if (id !== null) this.releaseEnemy(id);

    // 3. Player moves and eats.
    this.player.update(this.maze, this.playerSpeed(), () => this.onPlayerStep());
    if (this.maze.pelletsLeft === 0) {
      this.setPhase('levelClear');
      this.emit('levelClear');
      return;
    }
    // Collisions are checked after the player moves and again after the enemies
    // move, so the two can never pass through each other.
    if (this.checkCollisions()) return;

    // 4. Enemies move.
    for (const e of this.enemies) e.update(this, this.enemySpeed(e));
    if (this.checkCollisions()) return;

    // 5. Bonus item.
    this.updateBonus();
  }

  private tickDying(): void {
    if (this.phaseFrames === TIMING.deathFreeze) this.emit('death');
    if (this.phaseFrames < TIMING.deathEnd) return;
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.setPhase('gameOver');
      this.emit('gameOver');
      return;
    }
    this.resetActors();
    this.house.onLifeLost();
    this.elroySuspended = true;
    this.setPhase('ready', TIMING.ready);
  }

  // ---------------------------------------------------------------- rules

  private onPlayerStep(): void {
    const { col, row } = this.player.tile;
    this.eatPellet(col, row);
  }

  eatPellet(col: number, row: number): void {
    const pellet = this.maze.eat(col, row);
    if (!pellet) return;
    this.pelletsEaten++;
    if (pellet === 'dot') {
      this.addScore(SCORE.dot);
      this.player.freeze = 1;
      this.emit('dot');
    } else {
      this.addScore(SCORE.power);
      this.player.freeze = 3;
      this.emit('power');
      this.startFright();
    }
    for (const id of this.house.onPellet(this.inHouse())) this.releaseEnemy(id);
    if (BONUS_AT_PELLETS.includes(this.pelletsEaten)) this.spawnBonus();
  }

  startFright(): void {
    this.eatChain = 0;
    // Enemies always turn around on a power pellet, even on levels with no fright time.
    for (const e of this.enemies) e.reverse();
    const total = Math.round(this.spec.frightSeconds * FPS);
    this.frightFrames = total;
    this.flashFrames = Math.min(this.spec.frightFlashes * TIMING.flashPeriod * 2, total);
    if (total === 0) return;
    for (const e of this.enemies) {
      if (e.state !== 'eyes' && e.state !== 'entering') e.frightened = true;
    }
  }

  get flashing(): boolean {
    return (
      this.frightFrames > 0 &&
      this.frightFrames <= this.flashFrames &&
      Math.floor(this.frightFrames / TIMING.flashPeriod) % 2 === 0
    );
  }

  checkCollisions(): boolean {
    const p = this.player.tile;
    for (const e of this.enemies) {
      if (e.state !== 'active') continue;
      const t = e.tile;
      if (t.col !== p.col || t.row !== p.row) continue;
      if (e.frightened) this.eatEnemy(e);
      else this.setPhase('dying');
      return true;
    }
    return false;
  }

  private eatEnemy(e: Enemy): void {
    const chain = SCORE.enemyChain;
    const points = chain[Math.min(this.eatChain, chain.length - 1)];
    this.eatChain++;
    this.addScore(points);
    e.eaten();
    this.eaten = { enemy: e, points };
    this.setPhase('enemyEaten');
    this.emit('enemyEaten');
  }

  addScore(points: number): void {
    this.score += points;
    if (!this.extraLifeAwarded && this.score >= SCORE.extraLifeAt) {
      this.extraLifeAwarded = true;
      this.lives++;
      this.emit('extraLife');
    }
    if (this.score > this.hiScore) this.hiScore = this.score;
  }

  private spawnBonus(): void {
    this.bonus = {
      kind: this.spec.bonus,
      points: this.spec.bonusPoints,
      frames: TIMING.bonusMin + Math.floor(this.bonusRng() * TIMING.bonusExtra),
    };
    this.emit('bonusSpawn');
  }

  private updateBonus(): void {
    if (!this.bonus) return;
    this.bonus.frames--;
    if (this.bonus.frames <= 0) {
      this.bonus = null;
      return;
    }
    const p = this.player.tile;
    if (BONUS_TILES.some((t) => t.col === p.col && t.row === p.row)) {
      this.addScore(this.bonus.points);
      this.popups.push({ x: BONUS_POS.x, y: BONUS_POS.y, text: String(this.bonus.points), frames: TIMING.popup });
      this.bonus = null;
      this.emit('bonusEaten');
    }
  }

  private inHouse(): boolean[] {
    return this.enemies.map((e) => e.state === 'house');
  }

  private releaseEnemy(id: number): void {
    const e = this.enemies[id];
    if (e.state !== 'house') return;
    e.release();
    if (id === 3) this.elroySuspended = false;
  }

  // ---------------------------------------------------------------- AI hooks

  target(e: Enemy): Tile {
    if (e.state === 'eyes') return HOUSE_DOOR_TARGET;
    const scatter = SCATTER_TARGETS[e.id];
    const elroyChases = e.id === 0 && this.elroyLevel() > 0;
    if (this.modes.mode === 'scatter' && !elroyChases) return scatter;
    return chaseTarget(e.id, { tile: this.player.tile, dir: this.player.dir }, this.enemies[0].tile, e.tile, scatter);
  }

  elroyLevel(): 0 | 1 | 2 {
    if (this.elroySuspended) return 0;
    const left = this.maze.pelletsLeft;
    if (left <= this.spec.elroy2Dots) return 2;
    if (left <= this.spec.elroy1Dots) return 1;
    return 0;
  }

  playerSpeed(): number {
    return this.frightFrames > 0 ? this.spec.playerFrightSpeed : this.spec.playerSpeed;
  }

  enemySpeed(e: Enemy): number {
    if (e.state === 'eyes' || e.state === 'entering') return EYES_SPEED;
    if (e.state === 'house' || e.state === 'leaving') return HOUSE_SPEED;
    const t = e.tile;
    if (this.maze.isTunnel(t.col, t.row)) return this.spec.enemyTunnelSpeed;
    if (e.frightened) return this.spec.enemyFrightSpeed;
    if (e.id === 0) {
      const elroy = this.elroyLevel();
      if (elroy === 2) return this.spec.elroy2Speed;
      if (elroy === 1) return this.spec.elroy1Speed;
    }
    return this.spec.enemySpeed;
  }

  // ---------------------------------------------------------------- audio hints

  get ambience(): Ambience | null {
    if (this.paused || this.phase !== 'playing') return null;
    if (this.enemies.some((e) => e.state === 'eyes' || e.state === 'entering')) return 'eyes';
    if (this.frightFrames > 0) return 'fright';
    return 'siren';
  }

  /** 0 at the start of a level, 1 when the board is empty. */
  get progress(): number {
    return 1 - this.maze.pelletsLeft / this.maze.totalPellets;
  }

  // ---------------------------------------------------------------- setup

  private setupLevel(): void {
    this.spec = levelSpec(this.level);
    this.maze = new Maze();
    this.house.resetForLevel(this.spec.houseDotLimits, Math.round(this.spec.houseIdleSeconds * FPS));
    this.pelletsEaten = 0;
    this.elroySuspended = false;
    this.popups = [];
  }

  private resetActors(): void {
    this.player.reset();
    for (const e of this.enemies) e.reset();
    this.modes = new ModeTimer(this.spec.modeSeconds);
    this.frightFrames = 0;
    this.flashFrames = 0;
    this.eatChain = 0;
    this.bonus = null;
    this.eaten = null;
    this.house.idleFrames = 0;
    // Same seed each life and level, so frightened movement repeats like the arcade.
    this.rng = mulberry32(0x9e3779b9 ^ this.level);
  }

  private nextLevel(): void {
    this.level++;
    this.setupLevel();
    this.resetActors();
    this.setPhase('ready', TIMING.ready);
  }

  private setPhase(phase: Phase, length = 0): void {
    this.phase = phase;
    this.phaseFrames = 0;
    this.phaseLength = length;
  }

  private emit(e: GameEvent): void {
    this.events.push(e);
  }
}
