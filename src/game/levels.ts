/**
 * Per-level difficulty tables. Values follow the arcade game's published
 * speed and timing tables; speeds are fractions of MAX_SPEED.
 */

export type BonusKind = 'chip' | 'gem' | 'bolt' | 'gear' | 'battery' | 'planet' | 'crown' | 'star';

export interface LevelSpec {
  level: number;
  bonus: BonusKind;
  bonusPoints: number;
  playerSpeed: number;
  playerFrightSpeed: number;
  enemySpeed: number;
  enemyTunnelSpeed: number;
  enemyFrightSpeed: number;
  /** Enemy 1 speeds up when this many pellets (or fewer) are left... */
  elroy1Dots: number;
  elroy1Speed: number;
  /** ...and again at this many. */
  elroy2Dots: number;
  elroy2Speed: number;
  frightSeconds: number;
  frightFlashes: number;
  /** Scatter, chase, scatter, chase, ... The last phase is chase forever (Infinity). */
  modeSeconds: readonly number[];
  /** Pellets each enemy waits for inside the house, by enemy id. Enemy 1 starts outside. */
  houseDotLimits: readonly number[];
  /** If the player eats nothing for this long, the next enemy in the house is let out. */
  houseIdleSeconds: number;
}

const BONUS: readonly (readonly [BonusKind, number])[] = [
  ['chip', 100],
  ['gem', 300],
  ['bolt', 500],
  ['bolt', 500],
  ['gear', 700],
  ['gear', 700],
  ['battery', 1000],
  ['battery', 1000],
  ['planet', 2000],
  ['planet', 2000],
  ['crown', 3000],
  ['crown', 3000],
]; // level 13+: star, 5000

/** [seconds, flashes] for levels 1-18. Level 19 and up: no fright at all. */
const FRIGHT: readonly (readonly [number, number])[] = [
  [6, 5], [5, 5], [4, 5], [3, 5], [2, 5], [5, 5], [2, 5], [2, 5], [1, 3],
  [5, 5], [2, 5], [1, 3], [1, 3], [3, 5], [1, 3], [1, 3], [0, 0], [1, 3],
];

/** Pellets left when enemy 1 first speeds up, levels 1-18. Level 19 and up: 120. */
const ELROY_DOTS: readonly number[] = [
  20, 30, 40, 40, 40, 50, 50, 50, 60, 60, 60, 80, 80, 80, 100, 100, 100, 100,
];

const INF = Number.POSITIVE_INFINITY;
const MODES_L1 = [7, 20, 7, 20, 5, 20, 5, INF];
const MODES_L2_4 = [7, 20, 7, 20, 5, 1033, 1 / 60, INF];
const MODES_L5 = [5, 20, 5, 20, 5, 1037, 1 / 60, INF];

function speeds(level: number) {
  if (level === 1) {
    return { player: 0.8, playerFright: 0.9, enemy: 0.75, tunnel: 0.4, fright: 0.5, elroy1: 0.8, elroy2: 0.85 };
  }
  if (level <= 4) {
    return { player: 0.9, playerFright: 0.95, enemy: 0.85, tunnel: 0.45, fright: 0.55, elroy1: 0.9, elroy2: 0.95 };
  }
  if (level <= 20) {
    return { player: 1, playerFright: 1, enemy: 0.95, tunnel: 0.5, fright: 0.6, elroy1: 1, elroy2: 1.05 };
  }
  return { player: 0.9, playerFright: 0.9, enemy: 0.95, tunnel: 0.5, fright: 0.6, elroy1: 1, elroy2: 1.05 };
}

export function levelSpec(level: number): LevelSpec {
  const n = Math.max(1, Math.floor(level));
  const i = n - 1;
  const [bonus, bonusPoints] = BONUS[i] ?? ['star', 5000];
  const [frightSeconds, frightFlashes] = FRIGHT[i] ?? [0, 0];
  const elroy1Dots = ELROY_DOTS[i] ?? 120;
  const s = speeds(n);
  return {
    level: n,
    bonus,
    bonusPoints,
    playerSpeed: s.player,
    playerFrightSpeed: s.playerFright,
    enemySpeed: s.enemy,
    enemyTunnelSpeed: s.tunnel,
    enemyFrightSpeed: s.fright,
    elroy1Dots,
    elroy1Speed: s.elroy1,
    elroy2Dots: elroy1Dots / 2,
    elroy2Speed: s.elroy2,
    frightSeconds,
    frightFlashes,
    modeSeconds: n === 1 ? MODES_L1 : n <= 4 ? MODES_L2_4 : MODES_L5,
    houseDotLimits: n === 1 ? [0, 0, 30, 60] : n === 2 ? [0, 0, 0, 50] : [0, 0, 0, 0],
    houseIdleSeconds: n <= 4 ? 4 : 3,
  };
}
