import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceDay } from '../src/engine/tick';
import { setArmyPath } from '../src/engine/systems/military';

describe('encirclement', () => {
  it('locks an isolated army and starts attrition after seven days', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'MING', undefined, true);
    const army = Object.values(state.armies).find(entry => entry.tag === 'MING');
    expect(army).toBeDefined();
    if (!army) return;
    const provinceId = 'shenyang_a';
    const province = state.provinces[provinceId];
    expect(province).toBeDefined();
    if (!province) return;
    province.owner = 'QING';
    province.controller = 'QING';
    army.province = provinceId;
    army.movePath = [];
    advanceDay(state, content);
    expect(army.encircled).toBe(true);
    expect(army.encircledDays).toBe(1);
    expect(setArmyPath(state, content, army.id, ['shenyang_b'])).toBe(false);
    const before = army.composition.infantry;
    for (let day = 0; day < 8; day += 1) advanceDay(state, content);
    expect(army.encircledDays).toBeGreaterThan(7);
    expect(army.composition.infantry).toBeLessThan(before);
    expect(army.organization).toBeLessThan(100);
  });
});
