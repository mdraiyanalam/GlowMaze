import { COLS, ROWS } from './constants';

/**
 * The Glowmaze board: 28 × 31 tiles, left-right symmetric.
 *
 *   #  wall            .  pellet (10)       o  power pellet (50)
 *   ' ' empty path     T  tunnel (enemies slow down, edges wrap)
 *   =  house door      _  house interior
 *
 * One tunnel runs through the middle row. 240 pellets + 4 power pellets.
 * Every path tile has at least two exits,
 * because enemies never reverse on their own (tests/maze.test.ts checks this).
 */
export const LAYOUT: readonly string[] = [
  '############################',
  '#..........................#',
  '#.###.###.########.###.###.#',
  '#.###.###.########.###.###.#',
  '#..........................#',
  '#.###.###.##.##.##.###.###.#',
  '#.###.###.##.##.##.###.###.#',
  '#o###.###.##.##.##.###.###o#',
  '#.....###....##....###.....#',
  '#####.### ######## ###.#####',
  '#####.### ######## ###.#####',
  '#####                  #####',
  '#####.### ###==### ###.#####',
  '#####.### #______# ###.#####',
  'TTTTT.### #______# ###.TTTTT',
  '#####.### #______# ###.#####',
  '#####.### ######## ###.#####',
  '#####                  #####',
  '#####.### ######## ###.#####',
  '#####.### ######## ###.#####',
  '#..........................#',
  '#.###.####.######.####.###.#',
  '#.###.####.######.####.###.#',
  '#..........######..........#',
  '#.########        ########.#',
  '#.######## ###### ########.#',
  '#o...##....######....##...o#',
  '#.##.##.##.######.##.##.##.#',
  '#.##.##.##.######.##.##.##.#',
  '#..........................#',
  '############################',
];

export type Pellet = 'dot' | 'power';

/** Rows whose edge tiles are open: the side tunnels. */
export const TUNNEL_ROWS: ReadonlySet<number> = new Set(
  LAYOUT.flatMap((row, i) => (row[0] !== '#' ? [i] : [])),
);

export class Maze {
  private readonly grid: string[][];
  readonly totalPellets: number;
  pelletsLeft: number;

  constructor(layout: readonly string[] = LAYOUT) {
    if (layout.length !== ROWS || layout.some((r) => r.length !== COLS)) {
      throw new Error(`Maze must be ${COLS}×${ROWS} tiles`);
    }
    this.grid = layout.map((r) => r.split(''));
    this.totalPellets = layout.join('').replace(/[^.o]/g, '').length;
    this.pelletsLeft = this.totalPellets;
  }

  /** Tile character. Off the left/right edge, tunnel rows continue as tunnel. */
  charAt(col: number, row: number): string {
    if (row < 0 || row >= ROWS) return '#';
    if (col < 0 || col >= COLS) return TUNNEL_ROWS.has(row) ? 'T' : '#';
    return this.grid[row][col];
  }

  /** Walkable for the player and for enemies roaming the maze. The door and house are not. */
  isOpen(col: number, row: number): boolean {
    const c = this.charAt(col, row);
    return c === '.' || c === 'o' || c === ' ' || c === 'T';
  }

  isTunnel(col: number, row: number): boolean {
    return this.charAt(col, row) === 'T';
  }

  pelletAt(col: number, row: number): Pellet | null {
    const c = this.charAt(col, row);
    return c === '.' ? 'dot' : c === 'o' ? 'power' : null;
  }

  /** Removes the pellet on a tile, if any, and says which kind it was. */
  eat(col: number, row: number): Pellet | null {
    const p = this.pelletAt(col, row);
    if (p) {
      this.grid[row][col] = ' ';
      this.pelletsLeft--;
    }
    return p;
  }
}
