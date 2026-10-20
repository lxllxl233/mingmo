import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { relationKey } from '../src/engine/state/types';
import { areAtWar } from '../src/engine/rules/war';
import { demandTribute, overlordOf, tributeAmount, vassalsOf } from '../src/engine/rules/vassals';

const content = loadContentFromDirectory();

function setup() {
  const state = createInitialState(content, '1627', 42, 'MING');
  const ming = state.countries['MING'];
  const joseon = state.countries['JOSEON'];
  if (!ming || !joseon) throw new Error('missing MING or JOSEON');
  return { state, ming, joseon };
}

describe('vassal tribute', () => {
  it('reports vassal relationships and a 20% tribute cap', () => {
    const { state, joseon } = setup();
    expect(overlordOf(state, 'JOSEON')).toBe('MING');
    expect(overlordOf(state, 'MING')).toBeNull();
    expect(vassalsOf(state, 'MING').sort()).toEqual(['JOSEON', 'NEU']);
    joseon.treasury = 50000;
    expect(tributeAmount(state, 'JOSEON')).toBe(10000);
    joseon.treasury = -1;
    expect(tributeAmount(state, 'JOSEON')).toBe(0);
    expect(tributeAmount(state, 'MISSING')).toBe(0);
  });

  it('transfers tribute once per year and refuses a second demand', () => {
    const { state, ming, joseon } = setup();
    joseon.treasury = 100000;
    // 稳定度低于 40 时不会拒贡，便于测试确定性支付分支。
    joseon.stability = 20;
    ming.treasury = 50000;
    const paid = demandTribute(state, content, 'MING', 'JOSEON');
    expect(paid).toEqual({ ok: true, amount: 20000, refused: false, reason: 'paid' });
    expect(joseon.treasury).toBe(80000);
    expect(ming.treasury).toBe(70000);
    expect(state.lastTribute['JOSEON']).toBe(state.day);
    expect(demandTribute(state, content, 'MING', 'JOSEON')).toEqual({
      ok: false,
      amount: 0,
      refused: false,
      reason: 'already demanded this year',
    });
  });

  it('ends vassalage and declares war when a strong vassal refuses', () => {
    const { state, joseon } = setup();
    state.truces = {};
    joseon.treasury = 200000;
    joseon.stability = 70;
    state.relations[relationKey('MING', 'JOSEON')] = -50;
    const result = demandTribute(state, content, 'MING', 'JOSEON');
    expect(result.ok).toBe(true);
    expect(result.refused).toBe(true);
    expect(result.reason).toBe('refused');
    expect(state.vassals['JOSEON']).toBeUndefined();
    expect(areAtWar(state, 'MING', 'JOSEON')).toBe(true);
  });

  it('breaks vassalage without war when a truce blocks the declaration', () => {
    const { state, joseon } = setup();
    joseon.treasury = 200000;
    joseon.stability = 70;
    state.relations[relationKey('MING', 'JOSEON')] = -50;
    state.truces[relationKey('MING', 'JOSEON')] = state.day + 365;
    const result = demandTribute(state, content, 'MING', 'JOSEON');
    expect(result.refused).toBe(true);
    expect(result.reason).toBe('independence');
    expect(state.vassals['JOSEON']).toBeUndefined();
    expect(areAtWar(state, 'MING', 'JOSEON')).toBe(false);
  });

  it('rejects non-vassals, dead vassals and missing treasuries', () => {
    const { state, joseon } = setup();
    expect(demandTribute(state, content, 'MING', 'QING').reason).toBe('not a vassal');
    joseon.treasury = 100000;
    joseon.stability = 20;
    joseon.alive = false;
    expect(demandTribute(state, content, 'MING', 'JOSEON').reason).toBe('missing country');
    joseon.alive = true;
    // 空国库只能上供 0 两，仍视为一次成功索贡。
    joseon.treasury = 0;
    const result = demandTribute(state, content, 'MING', 'JOSEON');
    expect(result.ok).toBe(true);
    expect(result.amount).toBe(0);
  });
});
