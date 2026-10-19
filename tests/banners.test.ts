import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { expandBanners, raiseBanners, reformBanners, topBannerFaction } from '../src/engine/systems/banners';

const content = loadContentFromDirectory();

describe('Qing banners', () => {
  it('expands, raises and reforms the banners', () => {
    const state = createInitialState(content, '1627', 42, 'QING');
    const qing = state.countries['QING'];
    if (!qing) throw new Error('missing QING');
    qing.treasury = 200000;
    qing.manpower = 50000;
    qing.politicalPower = 100;
    qing.factions = { manchu: 20, han_official: 10, green_standard: 15, banners: 25, imperial: 10 };
    expect(topBannerFaction(state, 'QING')).toBe('banners');

    expect(expandBanners(state, 'QING')).toBe(true);
    expect(qing.factions['banners']).toBe(31);
    expect(qing.factions['manchu']).toBe(24);
    expect(qing.treasury).toBe(150000);
    expect(qing.manpower).toBe(40000);

    expect(raiseBanners(state, 'QING')).toBe(true);
    expect(qing.politicalPower).toBe(85);
    expect(qing.factions['manchu']).toBe(32);
    expect(qing.factions['green_standard']).toBe(10);

    expect(reformBanners(state, 'QING')).toBe(true);
    expect(qing.politicalPower).toBe(65);
    expect(qing.factions['banners']).toBe(25);
    expect(qing.factions['han_official']).toBe(15);
  });

  it('does not apply to non-Qing countries', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(topBannerFaction(state, 'MING')).toBeNull();
    expect(expandBanners(state, 'MING')).toBe(false);
  });
});
