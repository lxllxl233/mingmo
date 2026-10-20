import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { cleanupDefeatedNations, declareWar, makePeace, resolveCapitalCapitulation, resolveFinishedWars, surrenderTendency } from '../src/engine/rules/war';

describe('war resolution', () => {
  it('ends a war when one side has no controlled province left', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    declareWar(state, 'ZHENG', 'VOC', 'test', content);
    for (const province of Object.values(state.provinces)) {
      if (province.owner === 'VOC') province.controller = 'ZHENG';
    }
    resolveFinishedWars(state, content);
    cleanupDefeatedNations(state, content);
    expect(state.wars.some(war =>
      (war.attacker === 'ZHENG' && war.defender === 'VOC')
      || (war.attacker === 'VOC' && war.defender === 'ZHENG'))).toBe(false);
    expect(state.countries['VOC']?.alive).toBe(false);
    expect(Object.values(state.provinces).filter(province => province.owner === 'VOC')).toHaveLength(0);
    expect(Object.values(state.armies).filter(army => army.tag === 'VOC')).toHaveLength(0);
  });

  it('refuses to declare war on a dead country', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    const voc = state.countries['VOC'];
    expect(voc).toBeDefined();
    if (!voc) return;
    voc.alive = false;
    expect(declareWar(state, 'ZHENG', 'VOC', 'test', content)).toBeNull();
  });

  it('restores occupied provinces and clears siege state on white peace', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    const war = declareWar(state, 'ZHENG', 'VOC', 'test', content);
    expect(war).not.toBeNull();
    if (!war) return;
    const province = state.provinces['anping'];
    expect(province).toBeDefined();
    if (!province) return;
    expect(province.owner).toBe('VOC');
    province.controller = 'ZHENG';
    province.occupation = { country: 'ZHENG', progress: 100, days: 10 };
    province.siege = { attacker: 'ZHENG', progress: 100, days: 10 };
    expect(makePeace(state, war.id, content, 'white')).toBe(true);
    expect(province.owner).toBe('VOC');
    expect(province.controller).toBe('VOC');
    expect(province.occupation).toBeNull();
    expect(province.siege).toBeUndefined();
  });

  it('cedes occupied provinces and relocates the capital on status peace', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    const war = declareWar(state, 'ZHENG', 'VOC', 'test', content);
    expect(war).not.toBeNull();
    if (!war) return;
    const oldCapitalId = state.countries['VOC']?.capital;
    expect(oldCapitalId).toBeDefined();
    if (!oldCapitalId) return;
    const capital = state.provinces[oldCapitalId];
    expect(capital).toBeDefined();
    if (!capital) return;
    expect(capital.owner).toBe('VOC');
    capital.controller = 'ZHENG';
    expect(makePeace(state, war.id, content, 'status')).toBe(true);
    expect(capital.owner).toBe('ZHENG');
    const newCapitalId = state.countries['VOC']?.capital;
    expect(newCapitalId).toBeDefined();
    expect(newCapitalId).not.toBe(oldCapitalId);
    const newCapital = newCapitalId ? state.provinces[newCapitalId] : undefined;
    expect(newCapital?.owner).toBe('VOC');
    expect(newCapital?.controller).toBe('VOC');
  });

  it('does not capitulate when the capital is held by a non-belligerent', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    declareWar(state, 'ZHENG', 'VOC', 'test', content);
    const capital = state.provinces['anping'];
    expect(capital).toBeDefined();
    if (!capital) return;
    capital.controller = 'MING';
    for (const [id, army] of Object.entries(state.armies)) {
      if (army.tag === 'VOC') delete state.armies[id];
    }
    resolveCapitalCapitulation(state, content);
    expect(state.countries['VOC']?.alive).toBe(true);
  });

  it('keeps the neutral tag alive while it still owns provinces', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    const neutralOwns = Object.values(state.provinces).some(province => province.owner === 'NEU');
    expect(neutralOwns).toBe(true);
    cleanupDefeatedNations(state, content);
    expect(state.countries['NEU']?.alive).toBe(true);
  });

  it('repatriates armies stranded in third-party territory after peace', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    const war = declareWar(state, 'ZHENG', 'VOC', 'test', content);
    expect(war).not.toBeNull();
    if (!war) return;
    const army = Object.values(state.armies).find(entry => entry.tag === 'VOC');
    const beijing = state.provinces['beijing'];
    expect(army).toBeDefined();
    expect(beijing).toBeDefined();
    if (!army || !beijing) return;
    army.province = 'beijing';
    expect(makePeace(state, war.id, content, 'white')).toBe(true);
    expect(state.provinces[army.province]?.controller).toBe('VOC');
  });

  it('gives a low surrender tendency for a fresh healthy war', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'MING');
    const war = state.wars.find(entry => entry.attacker === 'QING' && entry.defender === 'MING');
    expect(war).toBeDefined();
    if (!war) return;
    // 刚开战、未失一地、满员军队：投降倾向应很低，而非接近一半。
    expect(surrenderTendency(state, war, 'MING')).toBeLessThan(20);
    expect(surrenderTendency(state, war, 'QING')).toBeLessThan(20);
  });

  it('raises surrender tendency when the capital falls', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'MING');
    const war = state.wars.find(entry => entry.attacker === 'QING' && entry.defender === 'MING');
    expect(war).toBeDefined();
    if (!war) return;
    const base = surrenderTendency(state, war, 'MING');
    const capital = state.provinces[state.countries['MING']?.capital ?? ''];
    expect(capital).toBeDefined();
    if (!capital) return;
    capital.controller = 'QING';
    expect(surrenderTendency(state, war, 'MING')).toBeGreaterThan(base);
  });

  it('capitulates a country whose capital fell and has no armies', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    declareWar(state, 'ZHENG', 'VOC', 'test', content);
    const capital = state.provinces['anping'];
    expect(capital).toBeDefined();
    if (!capital) return;
    capital.controller = 'ZHENG';
    for (const [id, army] of Object.entries(state.armies)) {
      if (army.tag === 'VOC') delete state.armies[id];
    }
    resolveCapitalCapitulation(state, content);
    expect(state.countries['VOC']?.alive).toBe(false);
    expect(Object.values(state.provinces).filter(province => province.owner === 'VOC')).toHaveLength(0);
    expect(Object.values(state.armies).filter(army => army.tag === 'VOC')).toHaveLength(0);
  });

  it('records a grudge against the aggressor when declared upon', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    declareWar(state, 'ZHENG', 'VOC', 'test', content);
    expect(state.countries['VOC']?.grudges['ZHENG']).toBeGreaterThan(0);
    // 侵略者本人不应对自己记仇。
    expect(state.countries['ZHENG']?.grudges['VOC'] ?? 0).toBe(0);
  });
});
