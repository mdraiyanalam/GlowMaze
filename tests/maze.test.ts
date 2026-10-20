import { describe, expect, it } from 'vitest';
import { COLS, DIR_ORDER, DX, DY, ROWS } from '../src/game/constants';
import { LAYOUT, Maze, TUNNEL_ROWS } from '../src/game/maze';

const count = (ch: string) => LAYOUT.join('').split(ch).length - 1;

describe('maze', () => {
  it('is 28 × 31 tiles', () => {
    expect(LAYOUT).toHaveLength(ROWS);
    for (const row of LAYOUT) expect(row).toHaveLength(COLS);
  });

  it('has 240 pellets and 4 power pellets', () => {
    expect(count('.')).toBe(240);
    expect(count('o')).toBe(4);
    expect(new Maze().pelletsLeft).toBe(244);
  });

  it('is left-right symmetric', () => {
    for (const row of LAYOUT) expect(row).toBe([...row].reverse().join(''));
  });

  it('has one tunnel through the middle that continues past the edge', () => {
    const m = new Maze();
    expect([...TUNNEL_ROWS]).toEqual([14]);
    expect(m.isOpen(-1, 14)).toBe(true);
    expect(m.isTunnel(28, 14)).toBe(true);
    expect(m.isOpen(-1, 13)).toBe(false);
  });

  it('has no dead ends, no open 2×2 blocks, and one connected path network', () => {
    const m = new Maze();
    const open: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!m.isOpen(c, r)) continue;
        open.push(`${c},${r}`);
        const exits = DIR_ORDER.filter((d) => m.isOpen(c + DX[d], r + DY[d])).length;
        expect(exits, `dead end at ${c},${r}`).toBeGreaterThanOrEqual(2);
        if (c + 1 < COLS && r + 1 < ROWS) {
          const block = m.isOpen(c + 1, r) && m.isOpen(c, r + 1) && m.isOpen(c + 1, r + 1);
          expect(block, `open 2×2 at ${c},${r}`).toBe(false);
        }
      }
    }
    const seen = new Set<string>(['13,24']);
    const stack = [[13, 24]];
    while (stack.length) {
      const [c, r] = stack.pop()!;
      for (const d of DIR_ORDER) {
        const nc = (c + DX[d] + COLS) % COLS;
        const nr = r + DY[d];
        const key = `${nc},${nr}`;
        if (m.isOpen(c + DX[d], nr) && m.isOpen(nc, nr) && !seen.has(key)) {
          seen.add(key);
          stack.push([nc, nr]);
        }
      }
    }
    expect(seen.size).toBe(open.length);
  });

  it('eats each pellet once', () => {
    const m = new Maze();
    expect(m.eat(1, 1)).toBe('dot');
    expect(m.eat(1, 1)).toBe(null);
    expect(m.eat(1, 7)).toBe('power');
    expect(m.pelletsLeft).toBe(242);
  });
});
