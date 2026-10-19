import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { favorCourtFaction, suppressCourtFaction, topCourtFaction } from '../src/engine/systems/court';

const content = loadContentFromDirectory();

describe('Ming court factions', () => {
  it('favors and suppresses factions with political power', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    ming.politicalPower = 100;
    ming.factions = { donglin: 10, eunuch: 20, imperial: 15, military: 12 };
    expect(topCourtFaction(state, 'MING')).toBe('eunuch');
    expect(favorCourtFaction(state, 'MING', 'donglin')).toBe(true);
    expect(ming.factions['donglin']).toBe(18);
    expect(ming.politicalPower).toBe(95);
    expect(suppressCourtFaction(state, 'MING', 'eunuch')).toBe(true);
    expect(ming.factions['eunuch']).toBe(10);
    expect(ming.politicalPower).toBe(85);
    expect(topCourtFaction(state, 'MING')).toBe('donglin');
  });

  it('does not apply to non-Ming countries', () => {
    const state = createInitialState(content, '1627', 42, 'QING');
    const qing = state.countries['QING'];
    if (!qing) throw new Error('missing QING');
    qing.politicalPower = 100;
    expect(topCourtFaction(state, 'QING')).toBeNull();
    expect(favorCourtFaction(state, 'QING', 'donglin')).toBe(false);
  });
});
