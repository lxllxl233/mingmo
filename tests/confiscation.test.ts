import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import {
  confiscationCooldown,
  extortGentry,
  landReform,
  pacifyGentry,
} from '../src/engine/systems/confiscation';

const content = loadContentFromDirectory();

describe('Shun confiscation', () => {
  it('extorts the gentry and then goes on cooldown', () => {
    const state = createInitialState(content, '1627', 42, 'SHUN');
    const shun = state.countries['SHUN'];
    if (!shun) throw new Error('missing SHUN');
    const before = shun.treasury;
    const gentryBefore = shun.estates['gentry']?.loyalty ?? 0;
    expect(extortGentry(state, content, 'SHUN')).toBe(true);
    expect(shun.treasury).toBeGreaterThan(before);
    expect(shun.estates['gentry']?.loyalty).toBe(gentryBefore - 8);
    expect(confiscationCooldown(state, 'SHUN')).toBeGreaterThan(0);
    expect(extortGentry(state, content, 'SHUN')).toBe(false);
  });

  it('can reform land or pacify the gentry after cooldown', () => {
    const state = createInitialState(content, '1627', 42, 'SHUN');
    const shun = state.countries['SHUN'];
    if (!shun) throw new Error('missing SHUN');
    shun.politicalPower = 100;
    shun.treasury = 200000;
    shun.cooldowns['shun_confiscation'] = 0;
    const food = shun.food;
    expect(landReform(state, 'SHUN')).toBe(true);
    expect(shun.food).toBe(food + 80000);
    expect(confiscationCooldown(state, 'SHUN')).toBeGreaterThan(0);

    shun.cooldowns['shun_confiscation'] = 0;
    expect(pacifyGentry(state, 'SHUN')).toBe(true);
    expect(shun.treasury).toBe(150000);
  });

  it('does not apply to other countries', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(extortGentry(state, content, 'MING')).toBe(false);
  });
});
