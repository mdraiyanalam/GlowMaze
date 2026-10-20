import { DIR_ORDER, DX, DY, UP, opposite } from './constants';
import type { Dir, Tile } from './constants';

/**
 * The arcade game miscalculates "tiles ahead" when the player faces up:
 * the target also shifts the same number of tiles to the left.
 * Kept on by default to match the original behaviour.
 */
export const ARCADE_UP_QUIRK = true;

export interface PlayerView {
  tile: Tile;
  dir: Dir;
}

export function aheadOf(tile: Tile, dir: Dir, n: number, upQuirk = ARCADE_UP_QUIRK): Tile {
  const t = { col: tile.col + DX[dir] * n, row: tile.row + DY[dir] * n };
  if (upQuirk && dir === UP) t.col -= n;
  return t;
}

export const dist2 = (a: Tile, b: Tile): number => (a.col - b.col) ** 2 + (a.row - b.row) ** 2;

/**
 * Chase-mode target for each enemy.
 *  0 VIPER: the player's tile.
 *  1 LURK:  4 tiles ahead of the player (ambush).
 *  2 FLUX:  take the point 2 tiles ahead of the player, draw a line from VIPER to it, double it (flank).
 *  3 DRIFT: the player's tile while more than 8 tiles away, otherwise its scatter corner.
 */
export function chaseTarget(id: number, player: PlayerView, viper: Tile, self: Tile, scatter: Tile): Tile {
  switch (id) {
    case 0:
      return player.tile;
    case 1:
      return aheadOf(player.tile, player.dir, 4);
    case 2: {
      const pivot = aheadOf(player.tile, player.dir, 2);
      return { col: 2 * pivot.col - viper.col, row: 2 * pivot.row - viper.row };
    }
    default:
      return dist2(self, player.tile) > 64 ? player.tile : scatter;
  }
}

type OpenFn = (col: number, row: number) => boolean;

/**
 * At a junction, take the exit whose next tile is closest (straight-line) to the target.
 * Never reverses unless it is the only way out. Ties go up, left, down, right.
 */
export function chooseDirection(tile: Tile, dir: Dir, target: Tile, isOpen: OpenFn): Dir {
  let best: Dir | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const d of DIR_ORDER) {
    if (d === opposite(dir)) continue;
    const next = { col: tile.col + DX[d], row: tile.row + DY[d] };
    if (!isOpen(next.col, next.row)) continue;
    const dd = dist2(next, target);
    if (dd < bestDist) {
      bestDist = dd;
      best = d;
    }
  }
  return best ?? opposite(dir);
}

/**
 * Frightened enemies pick a random exit. If that exit is a wall or a reversal,
 * they try up, left, down, right in that order.
 */
export function chooseRandomDirection(tile: Tile, dir: Dir, random: () => number, isOpen: OpenFn): Dir {
  const ok = (d: Dir) => d !== opposite(dir) && isOpen(tile.col + DX[d], tile.row + DY[d]);
  const pick = DIR_ORDER[Math.floor(random() * 4) % 4];
  if (ok(pick)) return pick;
  for (const d of DIR_ORDER) if (ok(d)) return d;
  return opposite(dir);
}
