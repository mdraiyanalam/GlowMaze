import { DOWN, DX, DY, LEFT, RIGHT, UP } from '../game/constants';
import type { Dir } from '../game/constants';
import type { BonusKind } from '../game/levels';
import { PALETTE as P } from './palette';

/**
 * Pixel-art sprites. Each grid is drawn once into a tiny canvas (1 pixel per
 * character) and then scaled up with smoothing off, so the pixels stay blocky.
 * Characters are 14 × 14, drawn centred on the actor's position.
 */

type Ctx = CanvasRenderingContext2D;
type Grid = readonly string[];
type ColorFn = (ch: string, x: number, y: number) => string | null;

const cache = new Map<string, HTMLCanvasElement>();

function bake(key: string, grid: Grid, color: ColorFn): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = grid[0].length;
  canvas.height = grid.length;
  const g = canvas.getContext('2d')!;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = color(grid[y][x], x, y);
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    }
  }
  cache.set(key, canvas);
  return canvas;
}

function blit(ctx: Ctx, img: HTMLCanvasElement, x: number, y: number, scale = 1): void {
  ctx.imageSmoothingEnabled = false;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}

// ------------------------------------------------------------------ VOLT

// W antenna tip · L light · Y body · S shade · D visor · M grille
const VOLT_OPEN: Grid = [
  '......WW......',
  '......LY......',
  '..LLLLLLLLLL..',
  '.LYYYYYYYYYYS.',
  'LYDDDDDDDDDDYS',
  'LYDDDDDDDDDDYS',
  'LYDDDDDDDDDDYS',
  'LYDDDDDDDDDDYS',
  'LYYYYYYYYYYYYS',
  'LYYYMMMMMMYYYS',
  'LYYYMMMMMMYYYS',
  'LYYYYYYYYYYYYS',
  '.SYYYYYYYYYYS.',
  '..SSSSSSSSSS..',
];
const VOLT_SHUT: Grid = VOLT_OPEN.map((row, y) => (y === 10 ? 'LYYYYYYYYYYYYS' : row));

const VOLT_COLORS: Record<string, string> = {
  W: P.ink,
  L: P.heroLight,
  Y: P.hero,
  S: P.heroShade,
  D: P.heroVisor,
  M: P.heroVisor,
};

/** Top-left of the left eye; the right eye sits 4 pixels further right. */
function voltEyes(dir: Dir): [number, number] {
  return [4 + DX[dir], 5 + DY[dir]];
}

function voltSprite(dir: Dir, frame: number): HTMLCanvasElement {
  const grid = frame === 0 ? VOLT_OPEN : VOLT_SHUT;
  const [ex, ey] = voltEyes(dir);
  return bake(`volt:${dir}:${frame}`, grid, (ch, x, y) => {
    const eyeRow = y === ey || y === ey + 1;
    const eyeCol = x === ex || x === ex + 1 || x === ex + 4 || x === ex + 5;
    if (ch === 'D' && eyeRow && eyeCol) return P.heroEye;
    return VOLT_COLORS[ch] ?? null;
  });
}

/** VOLT, the yellow robot. Its grille opens and shuts as it moves. */
export function drawHero(ctx: Ctx, x: number, y: number, dir: Dir, travel: number, scale = 1): void {
  blit(ctx, voltSprite(dir, Math.floor(travel / 4) % 2), x, y, scale);
}

/** VOLT shorts out: it flickers, shrinks and bursts into pixel sparks. t runs 0 → 1. */
export function drawHeroDeath(ctx: Ctx, x: number, y: number, t: number): void {
  const k = Math.min(1, Math.max(0, t));
  if (k < 0.5 && Math.floor(k * 40) % 2 === 0) {
    blit(ctx, voltSprite(DOWN, 1), x, y, Math.max(0.15, 1 - k * 1.6));
  }
  if (k > 0.3) {
    const s = (k - 0.3) / 0.7;
    const size = s < 0.6 ? 2 : 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      const d = 2 + s * 15 * (i % 2 === 0 ? 1 : 0.7);
      ctx.fillStyle = i % 2 === 0 ? P.hero : P.ink;
      ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), size, size);
    }
  }
}

// ------------------------------------------------------------------ the Glitches

// X body · t thruster flame
const VIPER: readonly [Grid, Grid] = [
  [
    '......XX......',
    '.X....XX....X.',
    '..X..XXXX..X..',
    '...XXXXXXXX...',
    '...XXXXXXXX...',
    '..XXXXXXXXXX..',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    '..XXXXXXXXXX..',
    '...XXXXXXXX...',
    '...XXXXXXXX...',
    '..X..XXXX..X..',
    '.X....XX....X.',
    '......XX......',
  ],
  [
    'X............X',
    '.X..........X.',
    '..X..XXXX..X..',
    '...XXXXXXXX...',
    '...XXXXXXXX...',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
    '...XXXXXXXX...',
    '...XXXXXXXX...',
    '..X..XXXX..X..',
    '.X..........X.',
    'X............X',
  ],
];

const LURK: readonly [Grid, Grid] = [
  [
    '......XX......',
    '.....XXXX.....',
    '....XXXXXX....',
    '...XXXXXXXX...',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
    '...XXXXXXXX...',
    '....XXXXXX....',
    '.....XXXX.....',
    '......XX......',
  ],
  [
    '..............',
    '......XX......',
    '.....XXXX.....',
    '....XXXXXX....',
    '...XXXXXXXX...',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
    '...XXXXXXXX...',
    '....XXXXXX....',
    '.....XXXX.....',
    '......XX......',
    '..............',
  ],
];

const FLUX: readonly [Grid, Grid] = [
  [
    '...XXXXXXXX...',
    '...XXXXXXXX...',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '...XXXXXXXX...',
    '...XXXXXXXX...',
  ],
  [
    '......XX......',
    '....XXXXXX....',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
    '....XXXXXX....',
    '......XX......',
  ],
];

const DRIFT_BODY: Grid = [
  '......XX......',
  '......XX......',
  '.....XXXX.....',
  '.....XXXX.....',
  '....XXXXXX....',
  '....XXXXXX....',
  '...XXXXXXXX...',
  '...XXXXXXXX...',
  '..XXXXXXXXXX..',
  '..XXXXXXXXXX..',
  '.XXXXXXXXXXXX.',
  '.XXXXXXXXXXXX.',
  'XXXXXXXXXXXXXX',
];
const DRIFT: readonly [Grid, Grid] = [
  [...DRIFT_BODY, '..t...tt...t..'],
  [...DRIFT_BODY, '.t...t..t...t.'],
];

const BODIES = [VIPER, LURK, FLUX, DRIFT];
/** Top row of each enemy's 4 × 4 eye; the eye always starts at column 5. */
const EYE_TOP = [5, 5, 5, 7];
const EYE_LEFT = 5;

export interface EnemyLook {
  frightened: boolean;
  flashing: boolean;
}

const inEye = (ex: number, ey: number) =>
  ex >= 0 && ex < 4 && ey >= 0 && ey < 4 && !((ex === 0 || ex === 3) && (ey === 0 || ey === 3));
const inPupil = (ex: number, ey: number, dir: Dir) => {
  const px = 1 + DX[dir];
  const py = 1 + DY[dir];
  return ex >= px && ex <= px + 1 && ey >= py && ey <= py + 1;
};

function enemySprite(id: number, frame: number, dir: Dir, look: 'normal' | 'fright' | 'flash'): HTMLCanvasElement {
  const grid = BODIES[id][frame];
  const body = (x: number, y: number) => grid[y]?.[x] === 'X';
  return bake(`enemy:${id}:${frame}:${dir}:${look}`, grid, (ch, x, y) => {
    if (ch === 't') return look === 'normal' ? P.thruster : null;
    if (ch !== 'X') return null;
    const ex = x - EYE_LEFT;
    const ey = y - EYE_TOP[id];
    if (look === 'normal' && inEye(ex, ey)) return inPupil(ex, ey, dir) ? P.pupil : P.ink;
    if (look !== 'normal') {
      // A small, nervous eye that hops between frames.
      const jx = 1 + frame;
      if ((ex === jx || ex === jx + 1) && (ey === 1 || ey === 2)) return look === 'flash' ? P.frightFill : P.fright;
    }
    const edge = !body(x - 1, y) || !body(x + 1, y) || !body(x, y - 1) || !body(x, y + 1);
    if (look === 'fright') return edge ? P.fright : P.frightFill;
    if (look === 'flash') return P.flash;
    if (!body(x, y + 1) || !body(x + 1, y)) return P.enemyShade[id];
    if (!body(x, y - 1) || !body(x - 1, y)) return P.enemyLight[id];
    return P.enemies[id];
  });
}

export function drawEnemy(ctx: Ctx, id: number, x: number, y: number, dir: Dir, frame: number, look: EnemyLook): void {
  const f = Math.floor(frame / 12) % 2;
  const mode = look.flashing ? 'flash' : look.frightened ? 'fright' : 'normal';
  blit(ctx, enemySprite(id, f, dir, mode), x, y);
}

const EYE_GRID: Grid = ['.XX.', 'XXXX', 'XXXX', '.XX.'];

/** An eaten enemy: just its eye, racing home. The pupil takes the enemy's colour. */
export function drawEnemyEyes(ctx: Ctx, id: number, x: number, y: number, dir: Dir): void {
  const img = bake(`eyes:${id}:${dir}`, EYE_GRID, (ch, ex, ey) =>
    ch === 'X' ? (inPupil(ex, ey, dir) ? P.enemies[id] : P.ink) : null,
  );
  blit(ctx, img, x, y);
}

// ------------------------------------------------------------------ pellets

const POWER: Grid = ['...ee...', '..ePPe..', '.ePPPPe.', 'ePPPPPPe', 'ePPPPPPe', '.ePPPPe.', '..ePPe..', '...ee...'];

export function drawPower(ctx: Ctx, x: number, y: number): void {
  blit(ctx, bake('power', POWER, (ch) => (ch === 'P' ? P.power : ch === 'e' ? P.powerEdge : null)), x, y);
}

// ------------------------------------------------------------------ bonus items

const BONUS: Record<BonusKind, { grid: Grid; colors: Record<string, string> }> = {
  chip: {
    grid: [
      '............',
      '..p.p..p.p..',
      '.GGGGGGGGGG.',
      'pGggggggggGp',
      '.GgLLLLLLgG.',
      'pGgLccccLgGp',
      'pGgLccccLgGp',
      '.GgLLLLLLgG.',
      'pGggggggggGp',
      '.GGGGGGGGGG.',
      '..p.p..p.p..',
      '............',
    ],
    colors: { G: '#145c35', g: '#1f8a4c', L: '#5fd68f', c: '#c8ffe0', p: '#ffd166' },
  },
  gem: {
    grid: [
      '............',
      '...CCCCCC...',
      '..CWCCCCWC..',
      '.CCWCCCCWCC.',
      'CCCCCCCCCCCC',
      '.cCCCCCCCCc.',
      '..cCCCCCCc..',
      '...cCCCCc...',
      '....cCCc....',
      '.....cc.....',
      '............',
      '............',
    ],
    colors: { C: '#4de3ff', c: '#1b8fb0', W: '#ffffff' },
  },
  bolt: {
    grid: [
      '......OOO...',
      '.....OOO....',
      '....OOO.....',
      '...OOO......',
      '..OOOOOOOO..',
      '......OOO...',
      '.....OOO....',
      '....OOO.....',
      '...OOO......',
      '..OO........',
      '.O..........',
      '............',
    ],
    colors: { O: '#ffb703' },
  },
  gear: {
    grid: [
      '.....gg.....',
      '..g..gg..g..',
      '...gggggg...',
      '..gggggggg..',
      '.gggg..gggg.',
      'gggg....gggg',
      'gggg....gggg',
      '.gggg..gggg.',
      '..gggggggg..',
      '...gggggg...',
      '..g..gg..g..',
      '.....gg.....',
    ],
    colors: { g: '#b9c4d9' },
  },
  battery: {
    grid: [
      '....BBBB....',
      '..BBBBBBBB..',
      '..B......B..',
      '..B.gggg.B..',
      '..B......B..',
      '..B.gggg.B..',
      '..B......B..',
      '..B.gggg.B..',
      '..B......B..',
      '..BBBBBBBB..',
      '............',
      '............',
    ],
    colors: { B: '#7dff9a', g: '#2fd36a' },
  },
  planet: {
    grid: [
      '............',
      '............',
      '....OOOO....',
      '..OOOOOOOO..',
      '.OOOOOOOOOO.',
      'RRRRRRRRRRRR',
      '.oooooooooo.',
      '..oooooooo..',
      '....oooo....',
      '............',
      '............',
      '............',
    ],
    colors: { O: '#ffb36b', o: '#e06d1f', R: '#ffe9c7' },
  },
  crown: {
    grid: [
      '............',
      '............',
      '.Y...YY...Y.',
      '.YY..YY..YY.',
      '.YYY.YY.YYY.',
      '.YYYYYYYYYY.',
      '.YYYYrrYYYY.',
      '.YYYYrrYYYY.',
      '.YYYYYYYYYY.',
      '.yyyyyyyyyy.',
      '............',
      '............',
    ],
    colors: { Y: '#ffcf3a', y: '#c99212', r: '#ff2e88' },
  },
  star: {
    grid: [
      '............',
      '.....SS.....',
      '.....SS.....',
      '....SSSS....',
      'SSSSSSSSSSSS',
      '.SSSSSSSSSS.',
      '..SSSSSSSS..',
      '...SSSSSS...',
      '..SSSSSSSS..',
      '..SSS..SSS..',
      '.SS......SS.',
      '............',
    ],
    colors: { S: '#fff3a0' },
  },
};

export function drawBonus(ctx: Ctx, kind: BonusKind, x: number, y: number): void {
  const b = BONUS[kind];
  blit(ctx, bake(`bonus:${kind}`, b.grid, (ch) => b.colors[ch] ?? null), x, y);
}

/** Every sprite grid, for tests: all rows in a grid must be the same width. */
export const ALL_GRIDS: Record<string, Grid> = {
  VOLT_OPEN,
  VOLT_SHUT,
  POWER,
  EYE_GRID,
  ...Object.fromEntries(BODIES.flatMap((frames, id) => frames.map((g, f) => [`enemy${id}_${f}`, g]))),
  ...Object.fromEntries(Object.entries(BONUS).map(([k, v]) => [`bonus_${k}`, v.grid])),
};

export const DIRS_FOR_TESTS: readonly Dir[] = [UP, LEFT, DOWN, RIGHT];
