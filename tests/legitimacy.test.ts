import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import {
  compromiseCourt,
  legitimacyCooldown,
  mobilizeLoyalists,
  proclaimEmperor,
  uniteLoyalists,
} from '../src/engine/systems/legitimacy';
import { areAllied } from '../src/engine/rules/diplomacy';

const content = loadContentFromDirectory();

describe('Southern Ming legitimacy', () => {
  it('proclaims, compromises and mobilizes', () => {
    const state = createInitialState(content, '1650', 42, 'SMING');
    const sming = state.countries['SMING'];
    if (!sming) throw new Error('missing SMING');
    sming.politicalPower = 100;
    sming.treasury = 500000;
    sming.factions = { donglin: 20, military: 15, royal_clan: 20, merchants: 10, gentry: 15 };
    const mandate = sming.mandate;
    expect(proclaimEmperor(state, 'SMING')).toBe(true);
    expect(sming.mandate).toBe(mandate + 8);
    expect(sming.politicalPower).toBe(80);
    expect(sming.treasury).toBe(440000);
    expect(legitimacyCooldown(state, 'SMING')).toBeGreaterThan(0);

    sming.cooldowns['sming_legitimacy'] = 0;
    expect(compromiseCourt(state, 'SMING')).toBe(true);
    expect(sming.factions['donglin']).toBe(21);
    expect(sming.factions['royal_clan']).toBe(25);

    sming.cooldowns['sming_legitimacy'] = 0;
    const manpower = sming.manpower;
    expect(mobilizeLoyalists(state, 'SMING')).toBe(true);
    expect(sming.manpower).toBe(manpower + 10000);
    expect(sming.factions['military']).toBe(23);
  });

  it('can ally with Zheng or Xi', () => {
    const state = createInitialState(content, '1650', 42, 'SMING');
    const sming = state.countries['SMING'];
    if (!sming) throw new Error('missing SMING');
    sming.politicalPower = 100;
    sming.treasury = 500000;
    expect(uniteLoyalists(state, 'SMING')).toBe(true);
    expect(areAllied(state, 'SMING', 'ZHENG') || areAllied(state, 'SMING', 'XI')).toBe(true);
  });

  it('does not apply to other countries', () => {
    const state = createInitialState(content, '1644', 42, 'QING');
    expect(proclaimEmperor(state, 'QING')).toBe(false);
  });
});
