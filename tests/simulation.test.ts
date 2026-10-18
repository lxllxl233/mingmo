import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceDay } from '../src/engine/tick';
import { hashState } from '../src/engine/state/hash';

describe('simulation smoke', () => {
  const content = loadContentFromDirectory();

  it('runs one year without NaN or negative resources', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    for (let day = 0; day < 365; day += 1) advanceDay(state, content);
    for (const country of Object.values(state.countries)) {
      expect(Number.isFinite(country.treasury), country.tag).toBe(true);
      expect(Number.isFinite(country.food), country.tag).toBe(true);
      expect(Number.isFinite(country.stability), country.tag).toBe(true);
      expect(country.treasury).toBeGreaterThanOrEqual(0);
      expect(country.food).toBeGreaterThanOrEqual(0);
      expect(country.stability).toBeGreaterThanOrEqual(0);
      expect(country.stability).toBeLessThanOrEqual(100);
      for (const estate of Object.values(country.estates)) {
        expect(Number.isFinite(estate.loyalty), `${country.tag}.${estate.key}`).toBe(true);
        expect(Number.isFinite(estate.influence), `${country.tag}.${estate.key}`).toBe(true);
      }
    }
    for (const province of Object.values(state.provinces)) {
      expect(Number.isFinite(province.unrest), province.id).toBe(true);
      expect(province.unrest).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic for the same seed and no commands', () => {
    const a = createInitialState(content, '1627', 7, 'MING');
    const b = createInitialState(content, '1627', 7, 'MING');
    for (let day = 0; day < 120; day += 1) {
      advanceDay(a, content);
      advanceDay(b, content);
    }
    expect(hashState(a)).toBe(hashState(b));
  });

  it('diverges for different seeds', () => {
    const a = createInitialState(content, '1627', 7, 'MING');
    const b = createInitialState(content, '1627', 8, 'MING');
    for (let day = 0; day < 120; day += 1) {
      advanceDay(a, content);
      advanceDay(b, content);
    }
    expect(hashState(a)).not.toBe(hashState(b));
  });
});
