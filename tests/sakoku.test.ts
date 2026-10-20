import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import {
  isJapanOpen,
  nagasakiTrade,
  persecuteChristians,
  sakokuCooldown,
  sakokuMonthlyIncome,
  toggleSakoku,
} from '../src/engine/systems/sakoku';

const content = loadContentFromDirectory();

describe('Japan sakoku', () => {
  it('toggles the country open and runs Nagasaki trade', () => {
    const state = createInitialState(content, '1627', 42, 'JAPAN');
    const japan = state.countries['JAPAN'];
    if (!japan) throw new Error('missing JAPAN');
    japan.politicalPower = 100;
    japan.stability = 65;
    expect(isJapanOpen(state)).toBe(false);
    expect(toggleSakoku(state, 'JAPAN')).toBe(true);
    expect(isJapanOpen(state)).toBe(true);
    expect(japan.politicalPower).toBe(90);
    expect(japan.stability).toBe(63);
    expect(sakokuCooldown(state, 'JAPAN')).toBeGreaterThan(0);

    japan.cooldowns['japan_sakoku'] = 0;
    const treasury = japan.treasury;
    expect(nagasakiTrade(state, content, 'JAPAN')).toBe(true);
    expect(japan.treasury).toBeGreaterThan(treasury);
  });

  it('persecutes Christians and rejects other countries', () => {
    const state = createInitialState(content, '1627', 42, 'JAPAN');
    const japan = state.countries['JAPAN'];
    if (!japan) throw new Error('missing JAPAN');
    japan.politicalPower = 100;
    const clergy = japan.factions['clergy'] ?? 0;
    expect(persecuteChristians(state, 'JAPAN')).toBe(true);
    expect(japan.factions['clergy']).toBe(clergy + 6);
    expect(toggleSakoku(state, 'MING')).toBe(false);
  });

  it('blocks every action during the sakoku cooldown', () => {
    const state = createInitialState(content, '1627', 42, 'JAPAN');
    const japan = state.countries['JAPAN'];
    if (!japan) throw new Error('missing JAPAN');
    japan.politicalPower = 100;
    expect(nagasakiTrade(state, content, 'JAPAN')).toBe(true);
    expect(sakokuCooldown(state, 'JAPAN')).toBe(180);
    expect(nagasakiTrade(state, content, 'JAPAN')).toBe(false);
    expect(persecuteChristians(state, 'JAPAN')).toBe(false);
    expect(toggleSakoku(state, 'JAPAN')).toBe(false);
  });

  it('halves Nagasaki trade while the country is closed', () => {
    const state = createInitialState(content, '1627', 42, 'JAPAN');
    const japan = state.countries['JAPAN'];
    if (!japan) throw new Error('missing JAPAN');
    japan.politicalPower = 100;
    japan.treasury = 0;
    expect(sakokuMonthlyIncome(state, content, 'JAPAN')).toBe(0);
    expect(nagasakiTrade(state, content, 'JAPAN')).toBe(true);
    const closed = japan.treasury;
    japan.treasury = 0;
    japan.cooldowns['japan_sakoku'] = 0;
    japan.flags['japan_open'] = true;
    expect(nagasakiTrade(state, content, 'JAPAN')).toBe(true);
    const open = japan.treasury;
    expect(open).toBeGreaterThan(closed);
    expect(sakokuMonthlyIncome(state, content, 'JAPAN')).toBeGreaterThan(0);
  });
});
