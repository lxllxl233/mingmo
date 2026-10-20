import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { evaluateVictory, scoreCountry } from '../src/engine/victory';
import { LAST_DAY_INDEX } from '../src/engine/core/clock';

const MAJOR_CITIES = ['beijing', 'nanjing', 'xian', 'shenyang', 'guangzhou', 'chengdu'];
const PORTS = ['quanzhou', 'ningbo', 'guangzhou', 'nagasaki', 'anping', 'penghu', 'songjiang'];

const content = loadContentFromDirectory();

function giveAllTo(state: ReturnType<typeof createInitialState>, tag: string): void {
  for (const province of Object.values(state.provinces)) province.controller = tag;
}

function takeAllAway(state: ReturnType<typeof createInitialState>, keep: string[], tag = 'QING'): void {
  for (const province of Object.values(state.provinces)) province.controller = 'NEU';
  for (const id of keep) {
    const province = state.provinces[id];
    if (province) province.controller = tag;
  }
}

describe('victory scoring', () => {
  it('scores controlled provinces, population, treasury and progress', () => {
    const state = createInitialState(content, '1650', 42, 'QING');
    const qing = state.countries['QING'];
    if (!qing) throw new Error('missing QING');
    takeAllAway(state, ['beijing', 'shenyang']);
    qing.treasury = 1_000_000;
    qing.stability = 50;
    qing.completedTechs = [];
    qing.completedFocuses = [];
    const population = (state.provinces['beijing']?.population ?? 0) + (state.provinces['shenyang']?.population ?? 0);
    const score = scoreCountry(state, content, 'QING');
    expect(score.breakdown['疆域']).toBe(20);
    expect(score.breakdown['财政']).toBe(10);
    expect(score.breakdown['稳定']).toBe(50);
    expect(score.breakdown['人口']).toBe(Math.round(population / 1_000_000));
    expect(score.breakdown['科技']).toBe(0);
    expect(score.breakdown['国策']).toBe(0);
    expect(score.total).toBe(Object.values(score.breakdown).reduce((sum, value) => sum + value, 0));
    expect(scoreCountry(state, content, 'NOPE')).toEqual({ total: 0, breakdown: {} });
  });

  it('awards unification for 384 provinces and all major cities', () => {
    const state = createInitialState(content, '1650', 42, 'QING');
    giveAllTo(state, 'QING');
    const result = evaluateVictory(state, content);
    expect(result.reason).toBe('一统天下');
    expect(result.winner).toBe('QING');
    expect(result.breakdown['疆域']).toBe(Object.keys(state.provinces).length * 10);
    for (const id of MAJOR_CITIES) expect(state.provinces[id]?.controller).toBe('QING');
  });

  it('awards the mandate for high mandate and the two capitals', () => {
    const state = createInitialState(content, '1650', 42, 'QING');
    const qing = state.countries['QING'];
    if (!qing) throw new Error('missing QING');
    takeAllAway(state, ['beijing', 'nanjing']);
    qing.mandate = 95;
    expect(evaluateVictory(state, content).reason).toBe('承天受命');
  });

  it('reports the player’s destruction independently of the winner', () => {
    const state = createInitialState(content, '1650', 42, 'QING');
    const qing = state.countries['QING'];
    if (!qing) throw new Error('missing QING');
    qing.alive = false;
    const result = evaluateVictory(state, content);
    expect(result.reason).toBe('身死国灭');
    expect(result.winner).not.toBe('QING');
  });

  it('awards partition in 1683 with at least 15 provinces', () => {
    const state = createInitialState(content, '1644', 42, 'QING');
    // 避开港口，否则会先满足海上霸权的判定。
    const ids = Object.keys(state.provinces).filter(id => !PORTS.includes(id)).slice(0, 15);
    takeAllAway(state, ids);
    state.day = LAST_DAY_INDEX;
    expect(evaluateVictory(state, content).reason).toBe('割据一隅');
  });

  it('awards naval hegemony in 1683 for six controlled ports', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    takeAllAway(state, PORTS.slice(0, 6), 'ZHENG');
    state.day = LAST_DAY_INDEX;
    expect(evaluateVictory(state, content).reason).toBe('海上霸权');
  });

  it('keeps the player alive and unvictorious before 1683', () => {
    const state = createInitialState(content, '1644', 42, 'QING');
    takeAllAway(state, ['beijing']);
    expect(evaluateVictory(state, content).reason).toBe('存续');
  });
});
