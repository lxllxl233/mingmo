import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import {
  holdKurultai,
  leagueCooldown,
  marriagePact,
  organizeBanners,
  raidBorder,
} from '../src/engine/systems/league';
import { relationKey } from '../src/engine/state/types';

const content = loadContentFromDirectory();

describe('Mongol banner league', () => {
  it('holds a kurultai, organizes banners and raids', () => {
    const state = createInitialState(content, '1627', 42, 'MONGOL');
    const mongol = state.countries['MONGOL'];
    if (!mongol) throw new Error('missing MONGOL');
    mongol.politicalPower = 100;
    mongol.treasury = 200000;
    const mandate = mongol.mandate;
    expect(holdKurultai(state, 'MONGOL')).toBe(true);
    expect(mongol.mandate).toBe(mandate + 6);
    expect(leagueCooldown(state, 'MONGOL')).toBeGreaterThan(0);

    mongol.cooldowns['mongol_league'] = 0;
    const manpower = mongol.manpower;
    expect(organizeBanners(state, 'MONGOL')).toBe(true);
    expect(mongol.manpower).toBe(manpower + 8000);
    expect(mongol.treasury).toBe(170000);

    mongol.cooldowns['mongol_league'] = 0;
    const treasury = mongol.treasury;
    expect(raidBorder(state, content, 'MONGOL')).toBe(true);
    expect(mongol.treasury).toBeGreaterThan(treasury);
    expect(state.relations[relationKey('MONGOL', 'MING')]).toBeLessThanOrEqual(-15);
  });

  it('can marry into a truce and rejects other countries', () => {
    const state = createInitialState(content, '1627', 42, 'MONGOL');
    const mongol = state.countries['MONGOL'];
    if (!mongol) throw new Error('missing MONGOL');
    mongol.politicalPower = 100;
    mongol.treasury = 100000;
    expect(marriagePact(state, 'MONGOL')).toBe(true);
    expect(state.truces[relationKey('MONGOL', 'QING')]).toBeGreaterThan(state.day);
    expect(holdKurultai(state, 'MING')).toBe(false);
  });
});
