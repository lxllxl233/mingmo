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

  it('blocks all tribute actions during the shared cooldown', () => {
    const state = createInitialState(content, '1627', 42, 'JOSEON');
    const joseon = state.countries['JOSEON'];
    if (!joseon) throw new Error('missing JOSEON');
    joseon.politicalPower = 100;
    joseon.treasury = 200000;
    joseon.food = 200000;
    expect(submitToQing(state, 'JOSEON')).toBe(true);
    expect(submitToQing(state, 'JOSEON')).toBe(false);
    expect(northernExpedition(state, 'JOSEON')).toBe(false);
    expect(sendTribute(state, 'JOSEON')).toBe(false);
    joseon.cooldowns['joseon_tribute'] = 0;
    expect(sendTribute(state, 'JOSEON')).toBe(true);
    expect(sendTribute(state, 'JOSEON')).toBe(false);
  });

  it('checks political power and treasury thresholds', () => {
    const state = createInitialState(content, '1627', 42, 'JOSEON');
    const joseon = state.countries['JOSEON'];
    if (!joseon) throw new Error('missing JOSEON');
    joseon.politicalPower = 4;
    expect(submitToQing(state, 'JOSEON')).toBe(false);
    joseon.politicalPower = 9;
    expect(northernExpedition(state, 'JOSEON')).toBe(false);
    joseon.politicalPower = 100;
    joseon.treasury = 10000;
    expect(sendTribute(state, 'JOSEON')).toBe(false);
    joseon.treasury = 200000;
    joseon.food = 10000;
    expect(sendTribute(state, 'JOSEON')).toBe(false);
  });
});
