import { BONUS_POS, COLS, HUD_TOP_ROWS, RIGHT, ROWS, SCREEN_H, SCREEN_W, TILE } from '../game/constants';
import { ENEMY_NAMES } from '../game/enemy';
import { TIMING } from '../game/game';
import type { Game } from '../game/game';
import { levelSpec } from '../game/levels';
import { LAYOUT, TUNNEL_ROWS } from '../game/maze';
import { FONT, PALETTE as P } from './palette';
import { drawBonus, drawEnemy, drawEnemyEyes, drawHero, drawHeroDeath, drawPower } from './sprites';

type Ctx = CanvasRenderingContext2D;
type Align = 'left' | 'center' | 'right';

const MAZE_Y = HUD_TOP_ROWS * TILE;
const MESSAGE_Y = 17 * TILE + 0.5;

const CAST = ['HUNTS YOU DOWN', 'CUTS YOU OFF', 'FLANKS WITH VIPER', 'CHASES, THEN DRIFTS'];

// ------------------------------------------------------------------ wall outlines

/** Wall tiles for outlining. Off-board counts as wall, except where the tunnel opens. */
function isWall(col: number, row: number): boolean {
  if (row < 0 || row >= ROWS) return true;
  if (col < 0 || col >= COLS) return !TUNNEL_ROWS.has(row);
  return LAYOUT[row][col] === '#';
}

/** Wall tiles joined to the outer frame. They get a second line, like a cabinet bezel. */
const FRAME: boolean[][] = (() => {
  const seen = LAYOUT.map((row) => [...row].map(() => false));
  const stack: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const onEdge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
      if (onEdge && LAYOUT[r][c] === '#') {
        seen[r][c] = true;
        stack.push([c, r]);
      }
    }
  }
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen[nr][nc] || LAYOUT[nr][nc] !== '#') continue;
      seen[nr][nc] = true;
      stack.push([nc, nr]);
    }
  }
  return seen;
})();

/** Quarter circle from point A to point B around (cx, cy). */
function quarter(ctx: Ctx, cx: number, cy: number, ax: number, ay: number, bx: number, by: number): void {
  const r = Math.hypot(ax - cx, ay - cy);
  ctx.moveTo(ax, ay);
  if (r < 0.01) {
    ctx.lineTo(bx, by);
    return;
  }
  const cross = (ax - cx) * (by - cy) - (ay - cy) * (bx - cx);
  ctx.arc(cx, cy, r, Math.atan2(ay - cy, ax - cx), Math.atan2(by - cy, bx - cx), cross < 0);
}

/**
 * Adds one outline to the path: a line `k` px from each wall tile's centre,
 * toward the open side. Each tile is drawn as four quarters; a quarter is a
 * straight piece, an outer corner (arc around the tile centre) or an inner
 * corner (arc around the tile corner). The pieces meet up across tiles, which
 * gives continuous outlines with rounded corners.
 */
function outline(ctx: Ctx, k: number, include: (c: number, r: number) => boolean): void {
  const half = TILE / 2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isWall(c, r) || !include(c, r)) continue;
      const cx = c * TILE + half;
      const cy = r * TILE + half;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const h = isWall(c + sx, r);
        const v = isWall(c, r + sy);
        const d = isWall(c + sx, r + sy);
        const X = (u: number) => cx + sx * u;
        const Y = (u: number) => cy + sy * u;
        if (!h && !v) quarter(ctx, cx, cy, X(k), cy, cx, Y(k));
        else if (!h) {
          ctx.moveTo(X(k), cy);
          ctx.lineTo(X(k), Y(half));
        } else if (!v) {
          ctx.moveTo(cx, Y(k));
          ctx.lineTo(X(half), Y(k));
        } else if (!d) quarter(ctx, X(half), Y(half), X(half), Y(k), X(k), Y(half));
      }
    }
  }
}

// ------------------------------------------------------------------ renderer

export class Renderer {
  private readonly ctx: Ctx;
  private scale = 1;
  private walls: { normal: HTMLCanvasElement; flash: HTMLCanvasElement } | null = null;
  reducedMotion = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser does not support canvas drawing.');
    this.ctx = ctx;
  }

  /** Sizes the canvas to a CSS width and renders at device resolution. */
  resize(cssWidth: number, dpr: number): void {
    const cssHeight = Math.round((cssWidth * SCREEN_H) / SCREEN_W);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.scale = this.canvas.width / SCREEN_W;
    this.walls = null;
  }

  draw(g: Game): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    if (g.phase === 'title') {
      this.drawTitle(g);
      return;
    }
    this.drawHud(g);
    ctx.save();
    ctx.translate(0, MAZE_Y);
    this.drawWalls(g);
    this.drawPellets(g);
    this.drawBonusItem(g);
    this.drawActors(g);
    this.drawPopups(g);
    this.drawMessages(g);
    ctx.restore();
    this.drawFooter(g);
    if (g.paused) this.drawPaused();
  }

  // ---------------------------------------------------------------- maze

  private buildWalls(color: string): HTMLCanvasElement {
    const s = this.scale;
    const out = document.createElement('canvas');
    out.width = Math.ceil(SCREEN_W * s);
    out.height = Math.ceil(ROWS * TILE * s);
    const c = out.getContext('2d')!;
    c.scale(s, s);
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.lineCap = 'round';
    c.shadowColor = color;
    c.shadowBlur = 2.5 * s;
    c.beginPath();
    outline(c, 2.5, () => true); // every wall: one thin line
    outline(c, 0.5, (col, row) => FRAME[row][col]); // the outer frame: a second line
    c.stroke();
    return out;
  }

  private drawWalls(g: Game): void {
    if (!this.walls) this.walls = { normal: this.buildWalls(P.wall), flash: this.buildWalls(P.wallFlash) };
    let layer = this.walls.normal;
    if (g.phase === 'levelClear' && g.phaseFrames >= TIMING.levelFreeze) {
      if (Math.floor((g.phaseFrames - TIMING.levelFreeze) / 12) % 2 === 0) layer = this.walls.flash;
    }
    this.ctx.drawImage(layer, 0, 0, layer.width / this.scale, layer.height / this.scale);
    this.ctx.fillStyle = P.door;
    this.ctx.fillRect(13 * TILE, 12 * TILE + 3, 2 * TILE, 2);
  }

  private drawPellets(g: Game): void {
    const ctx = this.ctx;
    const m = g.maze;
    ctx.fillStyle = P.dot;
    ctx.beginPath();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (m.pelletAt(c, r) === 'dot') ctx.rect(c * TILE + 3, r * TILE + 3, 2, 2);
      }
    }
    ctx.fill();
    // Power pellets blink while the game is running.
    if (g.phase === 'playing' && Math.floor(g.frame / 10) % 2 === 1) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (m.pelletAt(c, r) === 'power') drawPower(ctx, c * TILE + 4, r * TILE + 4);
      }
    }
  }

  private drawBonusItem(g: Game): void {
    if (g.bonus && (g.phase === 'playing' || g.phase === 'enemyEaten')) {
      drawBonus(this.ctx, g.bonus.kind, BONUS_POS.x, BONUS_POS.y);
    }
  }

  private drawActors(g: Game): void {
    const ctx = this.ctx;
    const dyingLate = g.phase === 'dying' && g.phaseFrames >= TIMING.deathFreeze;
    const clearing = g.phase === 'levelClear' && g.phaseFrames >= TIMING.levelFreeze;
    const showEnemies = !dyingLate && !clearing && g.phase !== 'gameOver';
    const frame = this.reducedMotion ? 0 : g.frame;

    if (showEnemies) {
      for (const e of g.enemies) {
        if (g.phase === 'enemyEaten' && g.eaten?.enemy === e) {
          this.text(String(g.eaten.points), e.x, e.y - 3, P.accent, 6, 'center');
          continue;
        }
        if (e.state === 'eyes' || e.state === 'entering') {
          drawEnemyEyes(ctx, e.id, e.x, e.y, e.dir);
          continue;
        }
        drawEnemy(ctx, e.id, e.x, e.y, e.dir, frame, { frightened: e.frightened, flashing: e.frightened && g.flashing });
      }
    }

    if (g.phase === 'enemyEaten' || g.phase === 'gameOver') return;
    const p = g.player;
    if (dyingLate) drawHeroDeath(ctx, p.x, p.y, (g.phaseFrames - TIMING.deathFreeze) / TIMING.deathAnim);
    else drawHero(ctx, p.x, p.y, p.dir, p.travel);
  }

  private drawPopups(g: Game): void {
    for (const p of g.popups) this.text(p.text, p.x, p.y - 3, P.accent, 6, 'center');
  }

  private drawMessages(g: Game): void {
    if (g.phase === 'ready') this.text('READY!', SCREEN_W / 2, MESSAGE_Y, P.hero, 8, 'center');
    if (g.phase === 'gameOver') this.text('GAME OVER', SCREEN_W / 2, MESSAGE_Y, P.warn, 8, 'center');
  }

  // ---------------------------------------------------------------- score bar

  private drawHud(g: Game): void {
    // "1UP" blinks while a game is running, as on an arcade cabinet.
    if (!g.inGame || g.paused || Math.floor(g.frame / 16) % 2 === 0) this.text('1UP', 24, 1, P.ink, 8);
    this.text(String(g.score).padStart(2, '0'), 64, 10, P.ink, 8, 'right');
    this.text('HIGH SCORE', SCREEN_W / 2, 1, P.ink, 8, 'center');
    this.text(String(g.hiScore).padStart(2, '0'), 144, 10, P.ink, 8, 'right');
    this.text('LV', SCREEN_W - 8, 1, P.muted, 8, 'right');
    this.text(String(g.level), SCREEN_W - 8, 10, P.ink, 8, 'right');
  }

  private drawFooter(g: Game): void {
    const y = SCREEN_H - 8;
    const spare = Math.max(0, g.lives - (g.inGame ? 1 : 0));
    for (let i = 0; i < Math.min(spare, 5); i++) drawHero(this.ctx, 18 + i * 16, y, RIGHT, 0);
    const first = Math.max(1, g.level - 6);
    for (let l = g.level, i = 0; l >= first; l--, i++) {
      drawBonus(this.ctx, levelSpec(l).bonus, SCREEN_W - 16 - i * 15, y);
    }
  }

  private drawPaused(): void {
    const ctx = this.ctx;
    ctx.fillStyle = P.shade;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.text('PAUSED', SCREEN_W / 2, 128, P.ink, 8, 'center');
    this.text('PRESS P TO RESUME', SCREEN_W / 2, 144, P.muted, 6, 'center');
  }

  // ---------------------------------------------------------------- title

  private drawTitle(g: Game): void {
    const ctx = this.ctx;
    const f = this.reducedMotion ? 0 : g.frame;
    const cx = SCREEN_W / 2;

    this.text('1UP', 24, 1, P.ink, 8);
    this.text('HIGH SCORE', cx, 1, P.ink, 8, 'center');
    this.text(String(g.hiScore).padStart(2, '0'), 144, 10, P.ink, 8, 'right');

    ctx.save();
    ctx.shadowColor = P.wall;
    ctx.shadowBlur = (6 + 3 * Math.sin(f * 0.05)) * this.scale;
    this.text('GLOWMAZE', cx, 36, P.wall, 16, 'center');
    ctx.restore();
    this.text('A MAZE CHASE', cx, 58, P.accent, 6, 'center');

    drawHero(ctx, 34, 90, RIGHT, Math.floor(f / 2));
    this.text('VOLT', 50, 83, P.hero, 8);
    this.text('THAT IS YOU', 50, 93, P.muted, 6);

    ENEMY_NAMES.forEach((name, id) => {
      const y = 118 + id * 24;
      drawEnemy(ctx, id, 34, y, RIGHT, f, { frightened: false, flashing: false });
      this.text(name, 50, y - 7, P.enemies[id], 8);
      this.text(CAST[id], 50, y + 3, P.muted, 6);
    });

    const y = 216;
    ctx.fillStyle = P.dot;
    ctx.fillRect(59, y + 2, 2, 2);
    this.text('10 PTS', 68, y, P.ink, 6);
    drawPower(ctx, 128, y + 3);
    this.text('50 PTS', 138, y, P.ink, 6);

    if (this.reducedMotion || Math.floor(g.frame / 30) % 2 === 0) {
      this.text('PRESS ENTER OR TAP', cx, 240, P.hero, 8, 'center');
    }
    this.text('ARROWS, WASD OR SWIPE', cx, 260, P.muted, 6, 'center');
    this.text('P PAUSE  -  M SOUND', cx, 270, P.muted, 6, 'center');
  }

  private text(str: string, x: number, y: number, color: string, size: number, align: Align = 'left'): void {
    const ctx = this.ctx;
    ctx.font = `${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(str, x, y);
  }
}
