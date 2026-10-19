import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import {
  dividendCooldown,
  openTradePost,
  recruitMerchants,
  takeDividend,
  tradePostMonthlyIncome,
} from '../src/engine/systems/trade';

const content = loadContentFromDirectory();

describe('Zheng maritime network', () => {
  it('opens a trade post, earns monthly income and takes a dividend', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.treasury = 300000;
    zheng.politicalPower = 100;
    const port = Object.values(state.provinces).find(province =>
      province.controller === 'ZHENG' && content.provinces.get(province.id)?.isPort);
    if (!port) throw new Error('missing Zheng port');

    expect(openTradePost(state, content, 'ZHENG', port.id)).toBe(true);
    expect(zheng.tradePosts).toContain(port.id);
    expect(zheng.treasury).toBe(270000);
    expect(zheng.politicalPower).toBe(90);
    expect(tradePostMonthlyIncome(state, content, 'ZHENG')).toBeGreaterThan(0);

    const before = zheng.treasury;
    expect(takeDividend(state, content, 'ZHENG')).toBe(true);
    expect(zheng.treasury).toBeGreaterThan(before);
    expect(dividendCooldown(state, 'ZHENG')).toBeGreaterThan(0);
    expect(takeDividend(state, content, 'ZHENG')).toBe(false);
  });

  it('stops earning from a trade post once the port is occupied', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.treasury = 300000;
    zheng.politicalPower = 100;
    const port = Object.values(state.provinces).find(province =>
      province.controller === 'ZHENG' && content.provinces.get(province.id)?.isPort);
    if (!port) throw new Error('missing Zheng port');
    expect(openTradePost(state, content, 'ZHENG', port.id)).toBe(true);
    expect(tradePostMonthlyIncome(state, content, 'ZHENG')).toBeGreaterThan(0);
    port.controller = 'QING';
    expect(tradePostMonthlyIncome(state, content, 'ZHENG')).toBe(0);
  });

  it('can recruit merchants and rejects other countries', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.treasury = 100000;
    const manpower = zheng.manpower;
    expect(recruitMerchants(state, 'ZHENG')).toBe(true);
    expect(zheng.manpower).toBe(manpower + 2000);
    expect(openTradePost(state, content, 'MING', 'fuzhou')).toBe(false);
  });
});
