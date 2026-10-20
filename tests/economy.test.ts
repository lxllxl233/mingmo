import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { runMonthlyEconomy } from '../src/engine/systems/economy';

const content = loadContentFromDirectory();

function mingState() {
  const state = createInitialState(content, '1627', 42, 'MING');
  const ming = state.countries['MING'];
  if (!ming) throw new Error('missing MING');
  ming.inflation = 0;
  ming.foodPurchasePct = 0;
  return { state, ming };
}

describe('monthly economy', () => {
  it('splits each estate tax between silver and grain by silverShare', () => {
    const { state, ming } = mingState();
    const peasants = ming.estates['peasants'];
    if (!peasants) throw new Error('missing peasants');
    peasants.taxLaw = 'tax_peasants_head_tax';
    runMonthlyEconomy(state, content);
    const report = ming.lastReport;
    if (!report) throw new Error('missing report');
    const tax = report.taxByEstate?.['peasants'] ?? 0;
    expect(tax).toBeGreaterThan(0);
    expect(report.silverByEstate['peasants'] ?? 0).toBeCloseTo(tax * 0.4, 6);
    const grainPrice = Math.max(0.1, content.balance.economy.grainPrice * (1 + ming.inflation / 200));
    expect((report.foodByEstate['peasants'] ?? 0) * grainPrice).toBeCloseTo(tax * 0.6, 6);
  });

  it('pays down arrears with a real treasury outflow', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.inflation = 0;
    zheng.foodPurchasePct = 0;
    zheng.arrears = 1000;
    // 国库保持在囤银上限以下，只验证「偿债是真实流出」，不触发火耗。
    zheng.treasury = 200000;
    const before = zheng.treasury;
    runMonthlyEconomy(state, content);
    const report = zheng.lastReport;
    if (!report) throw new Error('missing report');
    expect(report.net).toBeGreaterThan(0);
    expect(zheng.arrears).toBeLessThan(1000);
    expect(report.expense).toBeGreaterThan(0);
    expect(zheng.treasury - before).toBeCloseTo(report.net, 6);
  });

  it('drains treasury above the hoard cap (囤银 sink)', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.inflation = 0;
    zheng.foodPurchasePct = 0;
    // 远超上限（350000 + 省数×3000）的囤银必须被火耗/库藏积压按月烧掉。
    zheng.treasury = 10000000;
    runMonthlyEconomy(state, content);
    const report = zheng.lastReport;
    if (!report) throw new Error('missing report');
    expect(report.expenseHoard).toBeGreaterThan(0);
    expect(report.net).toBeLessThan(0);
  });
});
