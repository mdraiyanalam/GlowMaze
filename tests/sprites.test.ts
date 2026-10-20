import { describe, expect, it } from 'vitest';
import { ALL_GRIDS } from '../src/render/sprites';

describe('pixel-art sprites', () => {
  it('has rectangular grids, with every character 14 × 14', () => {
    for (const [name, grid] of Object.entries(ALL_GRIDS)) {
      const width = grid[0].length;
      for (const row of grid) expect(row.length, `${name} row width`).toBe(width);
      if (name.startsWith('VOLT') || name.startsWith('enemy')) {
        expect([width, grid.length], name).toEqual([14, 14]);
      }
      if (name.startsWith('bonus')) expect([width, grid.length], name).toEqual([12, 12]);
    }
  });

  it('draws each character left-right symmetric (except its eye)', () => {
    for (const [name, grid] of Object.entries(ALL_GRIDS)) {
      if (!name.startsWith('enemy') && !name.startsWith('VOLT')) continue;
      for (const row of grid) {
        const shape = row.replace(/[^.]/g, '#');
        expect(shape, name).toBe([...shape].reverse().join(''));
      }
    }
  });
});
