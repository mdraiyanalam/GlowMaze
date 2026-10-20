/** Board geometry, directions and fixed positions. All positions are maze pixels. */

export const TILE = 8;
export const COLS = 28;
export const ROWS = 31;
export const HUD_TOP_ROWS = 3;
export const HUD_BOTTOM_ROWS = 2;
export const SCREEN_W = COLS * TILE; // 224
export const SCREEN_H = (ROWS + HUD_TOP_ROWS + HUD_BOTTOM_ROWS) * TILE; // 288

/** The game logic always runs at 60 updates per second. */
export const FPS = 60;
/** "100% speed" from the arcade speed tables: about 75.76 px per second. */
export const MAX_SPEED = 75.75757625 / FPS;

export type Dir = 0 | 1 | 2 | 3;
export const UP: Dir = 0;
export const LEFT: Dir = 1;
export const DOWN: Dir = 2;
export const RIGHT: Dir = 3;
/** Order the enemy AI uses to break ties: up, left, down, right. */
export const DIR_ORDER: readonly Dir[] = [UP, LEFT, DOWN, RIGHT];
export const DX: readonly number[] = [0, -1, 0, 1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const isHorizontal = (d: Dir): boolean => d === LEFT || d === RIGHT;

export interface Tile {
  col: number;
  row: number;
}

export const tileOf = (px: number): number => Math.floor(px / TILE);
export const centerOf = (tile: number): number => tile * TILE + TILE / 2;
/** Pixel offset inside a tile, 0..7. The tile center is offset 4. */
export const offsetInTile = (px: number): number => ((px % TILE) + TILE) % TILE;

/** Horizontal wrap for the side tunnels. Actors may travel one tile past either edge. */
const WRAP_SPAN = (COLS + 2) * TILE;
export function wrapX(x: number): number {
  if (x < -TILE) return x + WRAP_SPAN;
  if (x >= COLS * TILE + TILE) return x - WRAP_SPAN;
  return x;
}

/** The player starts between columns 13 and 14 on row 24, facing left. */
export const PLAYER_START = { x: 14 * TILE, y: centerOf(24) };
/** The spot just above the house door. Enemy 1 starts here; enemies leave the house through it. */
export const HOUSE_EXIT = { x: 14 * TILE, y: centerOf(11) };
export const HOUSE_CENTER_Y = centerOf(14);
/** Where each enemy waits inside the house (enemy 1 never waits). */
export const HOUSE_SLOTS_X: readonly number[] = [14 * TILE, 14 * TILE, 12 * TILE, 16 * TILE];
/** Returning eyes aim for this tile, then drop through the door. */
export const HOUSE_DOOR_TARGET: Tile = { col: 13, row: 11 };

export const BONUS_POS = { x: 14 * TILE, y: centerOf(17) };
export const BONUS_TILES: readonly Tile[] = [
  { col: 13, row: 17 },
  { col: 14, row: 17 },
];

/** Scatter corners sit outside the maze so each enemy circles its own corner. */
export const SCATTER_TARGETS: readonly Tile[] = [
  { col: 25, row: -3 },
  { col: 2, row: -3 },
  { col: 27, row: 32 },
  { col: 0, row: 32 },
];
