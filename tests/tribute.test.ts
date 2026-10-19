import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import {
  isJoseonNorth,
  northernExpedition,
  sendTribute,
  submitToQing,
  tributeCooldown,
} from '../src/engine/systems/tribute';
import { relationKey } from '../src/engine/state/types';

const content = loadContentFromDirectory();

describe('Joseon tribute policy', () => {
  it('submits, goes north and sends tribute', () => {
    const state = createInitialState(content, '1627', 42, 'JOSEON');
    const joseon = state.countries['JOSEON'];
    if (!joseon) throw new Error('missing JOSEON');
    joseon.politicalPower = 100;
    joseon.treasury = 200000;
    joseon.food = 200000;
    expect(submitToQing(state, 'JOSEON')).toBe(true);
    expect(isJoseonNorth(state)).toBe(false);
    expect(tributeCooldown(state, 'JOSEON')).toBeGreaterThan(0);

    joseon.cooldowns['joseon_tribute'] = 0;
    const manpower = joseon.manpower;
    expect(northernExpedition(state, 'JOSEON')).toBe(true);
    expect(isJoseonNorth(state)).toBe(true);
    expect(joseon.manpower).toBe(manpower + 5000);

    joseon.cooldowns['joseon_tribute'] = 0;
    const treasury = joseon.treasury;
    expect(sendTribute(state, 'JOSEON')).toBe(true);
    expect(joseon.treasury).toBe(treasury - 20000);
    expect(state.relations[relationKey('JOSEON', 'QING')]).toBeDefined();
  });

  it('rejects other countries', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(submitToQing(state, 'MING')).toBe(false);
  });
});
