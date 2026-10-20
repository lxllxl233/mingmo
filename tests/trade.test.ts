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

  it('enforces port, duplicate, capacity and resource limits', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.treasury = 300000;
    zheng.politicalPower = 100;
    const port = Object.values(state.provinces).find(province =>
      province.controller === 'ZHENG' && content.provinces.get(province.id)?.isPort);
    if (!port) throw new Error('missing Zheng port');
    expect(openTradePost(state, content, 'ZHENG', 'beijing')).toBe(false);
    expect(openTradePost(state, content, 'ZHENG', port.id)).toBe(true);
    expect(openTradePost(state, content, 'ZHENG', port.id)).toBe(false);
    zheng.tradePosts = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(openTradePost(state, content, 'ZHENG', port.id)).toBe(false);
    zheng.tradePosts = [];
    zheng.treasury = 0;
    expect(openTradePost(state, content, 'ZHENG', port.id)).toBe(false);
    zheng.treasury = 300000;
    zheng.politicalPower = 5;
    expect(openTradePost(state, content, 'ZHENG', port.id)).toBe(false);
  });

  it('shares the merchant cooldown between dividends and recruitment', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.treasury = 100000;
    expect(recruitMerchants(state, 'ZHENG')).toBe(true);
    expect(dividendCooldown(state, 'ZHENG')).toBe(90);
    zheng.tradePosts = ['anping'];
    expect(takeDividend(state, content, 'ZHENG')).toBe(false);
    expect(recruitMerchants(state, 'ZHENG')).toBe(false);
  });

  it('accumulates monthly income across posts', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    const ports = Object.keys(state.provinces)
      .filter(id => content.provinces.get(id)?.isPort)
      .slice(0, 2);
    if (ports.length < 2) throw new Error('missing ports');
    for (const id of ports) {
      const province = state.provinces[id];
      if (province) province.controller = 'ZHENG';
    }
    zheng.tradePosts = [ports[0]!];
    const single = tradePostMonthlyIncome(state, content, 'ZHENG');
    zheng.tradePosts = ports;
    const double = tradePostMonthlyIncome(state, content, 'ZHENG');
    expect(single).toBeGreaterThan(0);
    expect(double).toBeGreaterThan(single);
    expect(tradePostMonthlyIncome(state, content, 'MING')).toBe(0);
  });
});
