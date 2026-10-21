import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { aggregateCountryModifiers } from '../src/engine/rules/modifiers';
import { governmentProfile, runMonthlyEconomy } from '../src/engine/systems/economy';
import { expectedTaxNet } from '../src/engine/systems/ai';
import { advanceTraining, enqueueTraining } from '../src/engine/systems/training';

const content = loadContentFromDirectory();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mingState() {
  const state = createInitialState(content, '1627', 42, 'MING');
  const ming = state.countries['MING'];
  if (!ming) throw new Error('missing MING');
  ming.inflation = 0;
  ming.foodPurchasePct = 0;
  return { state, ming };
}

describe('monthly economy', () => {
  it('does not inflate maintenance by reallocating wealth to the bottom', () => {
    const baseline = mingState();
    runMonthlyEconomy(baseline.state, content);
    const baseReport = baseline.ming.lastReport;
    if (!baseReport) throw new Error('missing baseline report');

    const shifted = mingState();
    // 这种幅度的再分配只有改革后才能做到；本用例只验证维稳基数不随份额放大。
    for (const estate of Object.values(shifted.ming.estates)) estate.allocationUnlocked = true;
    // 把绝大部分财富分给农民/匠户；他们税率高于士绅，实际税收会明显上升。
    shifted.ming.allocation = { ruling: 1.1, landlords: 0.9, merchants: 0.5, peasants: 48.7, artisans: 48.7 };
    runMonthlyEconomy(shifted.state, content);
    const shiftedReport = shifted.ming.lastReport;
    if (!shiftedReport) throw new Error('missing shifted report');

    expect(shiftedReport.income).toBeGreaterThan(baseReport.income * 1.5);
    // 维稳基数按惯例份额推算，不随这次重分配翻倍。
    expect((shiftedReport.loyaltyCost ?? 0) / (baseReport.loyaltyCost ?? 1)).toBeCloseTo(1, 2);
  });

  it('splits each estate tax between silver and grain; only silver is monetized', () => {
    const { state, ming } = mingState();
    const peasants = ming.estates['peasants'];
    if (!peasants) throw new Error('missing peasants');
    peasants.taxLaw = 'tax_peasants_head_tax';
    runMonthlyEconomy(state, content);
    const report = ming.lastReport;
    if (!report) throw new Error('missing report');
    const tax = report.taxByEstate?.['peasants'] ?? 0;
    expect(tax).toBeGreaterThan(0);
    const modifiers = aggregateCountryModifiers(state, content, 'MING');
    const government = governmentProfile(content.countries.get('MING')?.government ?? 'monarchy');
    const monetization = clamp(
      Math.max(1, government.trade) * (1 + (modifiers['trade_efficiency_pct'] ?? 0) / 100),
      0.5,
      1.8,
    );
    expect(report.silverByEstate['peasants'] ?? 0).toBeCloseTo(tax * 0.4 * monetization, 6);
    const grainPrice = Math.max(0.1, content.balance.economy.grainPrice * (1 + ming.inflation / 200));
    expect((report.foodByEstate['peasants'] ?? 0) * grainPrice).toBeCloseTo(tax * 0.6, 6);
  });

  it('pays down arrears in full from treasury surplus (足额补发欠饷)', () => {
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
    // 国库有盈余时优先足额补发：1000 两欠饷应被一次性清零，而非只还净收入的 15%。
    expect(zheng.arrears).toBe(0);
    expect(report.expense).toBeGreaterThan(0);
    expect(zheng.treasury - before).toBeCloseTo(report.net, 6);
  });

  it('does not burn silver above the hoard cap; pressure raises corruption and inflation', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.inflation = 0;
    zheng.foodPurchasePct = 0;
    zheng.arrears = 0;
    zheng.wageArrears = 0;
    const corruptionBefore = zheng.corruption;
    zheng.treasury = 10000000;
    runMonthlyEconomy(state, content);
    const report = zheng.lastReport;
    if (!report) throw new Error('missing report');
    expect(report.hoardPressure).toBeGreaterThan(0);
    // 软上限：银两不被直接烧掉，只是推高腐败与通胀。
    expect(report.expenseHoard).toBe(0);
    expect(zheng.corruption).toBeGreaterThan(corruptionBefore);
    expect(zheng.inflation).toBeGreaterThan(0);
    expect(zheng.treasury - 10000000).toBeCloseTo(report.net, 6);
  });

  it('pays the army before buying grain and never converts a food shortfall into wage arrears', () => {
    const { state, ming } = mingState();
    // 把现有军队规模放大 100 倍，确保军饷超过可用现金。
    for (const army of Object.values(state.armies)) {
      if (army.tag !== 'MING') continue;
      for (const key of ['infantry', 'firearm', 'cavalry', 'artillery', 'naval'] as const) {
        army.composition[key] *= 100;
      }
    }
    ming.treasury = 0;
    ming.arrears = 0;
    ming.wageArrears = 0;
    ming.foodPurchasePct = 100;
    // 隔离变量：腐败清零、基层忠诚较高，确保「可支配收入」为正，军饷才是唯一缺口。
    ming.corruption = 0;
    for (const estate of Object.values(ming.estates)) estate.loyalty = 80;
    runMonthlyEconomy(state, content);
    const report = ming.lastReport;
    if (!report) throw new Error('missing report');
    const available = Math.max(
      0,
      report.income - (report.corruptionLoss ?? 0) - (report.loyaltyCost ?? 0) - (report.expenseCourt ?? 0),
    );
    expect(report.wageShortfall).toBeGreaterThan(0);
    expect(report.expenseArmyPaid).toBeCloseTo(available, 6);
    // 军饷未付清时，购粮不得插队。
    expect(report.foodPurchaseSilver).toBe(0);
    expect(ming.wageArrears).toBeCloseTo(report.wageShortfall ?? 0, 6);
    expect(ming.arrears).toBeCloseTo(report.wageShortfall ?? 0, 6);
  });

  it('monetization raises silver tax without changing grain tax', () => {
    const open = mingState();
    const closed = mingState();
    open.ming.modifiers['trade_efficiency_pct'] = 200;
    closed.ming.modifiers['trade_efficiency_pct'] = -200;
    runMonthlyEconomy(open.state, content);
    runMonthlyEconomy(closed.state, content);
    const openReport = open.ming.lastReport;
    const closedReport = closed.ming.lastReport;
    if (!openReport || !closedReport) throw new Error('missing report');
    const openSilver = openReport.silverByEstate['peasants'] ?? 0;
    const closedSilver = closedReport.silverByEstate['peasants'] ?? 0;
    expect(closedSilver).toBeGreaterThan(0);
    // 修正被夹在 0.5–1.8：开海/海禁的银税比例应为 3.6 倍。
    expect(openSilver / closedSilver).toBeCloseTo(3.6, 4);
    expect(openReport.foodByEstate['peasants'] ?? 0).toBeCloseTo(closedReport.foodByEstate['peasants'] ?? 0, 6);
  });

  it('attributes corruption to estates so the parts sum to the whole', () => {
    const { state, ming } = mingState();
    runMonthlyEconomy(state, content);
    const report = ming.lastReport;
    if (!report) throw new Error('missing report');
    const parts = Object.values(report.corruptionByEstate ?? {});
    expect(parts.length).toBeGreaterThan(0);
    const sum = parts.reduce((total, value) => total + value, 0);
    expect(sum).toBeCloseTo(report.corruptionLoss ?? 0, 6);
  });

  it('charges upkeep on bottom-class loyalty and raises unrest when they are neglected', () => {
    const contentState = mingState();
    const neglected = mingState();
    const contentPeasants = contentState.ming.estates['peasants'];
    const contentArtisans = contentState.ming.estates['artisans'];
    const neglectedPeasants = neglected.ming.estates['peasants'];
    const neglectedArtisans = neglected.ming.estates['artisans'];
    if (!contentPeasants || !contentArtisans || !neglectedPeasants || !neglectedArtisans) {
      throw new Error('missing bottom estates');
    }
    contentPeasants.loyalty = 90;
    contentArtisans.loyalty = 90;
    neglectedPeasants.loyalty = 10;
    neglectedArtisans.loyalty = 10;
    const provinceId = Object.values(neglected.state.provinces)
      .find(province => province.controller === 'MING')?.id;
    if (!provinceId) throw new Error('missing province');
    const unrestBefore = neglected.state.provinces[provinceId]?.unrest ?? 0;

    runMonthlyEconomy(contentState.state, content);
    runMonthlyEconomy(neglected.state, content);
    const contentReport = contentState.ming.lastReport;
    const neglectedReport = neglected.ming.lastReport;
    if (!contentReport || !neglectedReport) throw new Error('missing report');
    expect(neglectedReport.loyaltyCost ?? 0).toBeGreaterThan(contentReport.loyaltyCost ?? 0);
    expect(neglectedReport.bottomLoyalty ?? 100).toBeLessThan(contentReport.bottomLoyalty ?? 0);
    const unrestAfter = neglected.state.provinces[provinceId]?.unrest ?? 0;
    expect(unrestAfter).toBeGreaterThan(unrestBefore);
  });

  it('reports training spend for the month without deducting it twice', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.treasury = 1000000;
    zheng.food = 1000000;
    zheng.manpower = 100000;
    zheng.wageArrears = 0;
    zheng.foodPurchasePct = 0;
    if (!enqueueTraining(state, content, 'ZHENG', zheng.capital, 'zheng_marines', 1)) {
      throw new Error('training did not start');
    }
    const item = state.training[0];
    if (!item) throw new Error('missing training item');
    for (let day = 0; day < 30; day += 1) advanceTraining(state, content);
    const expected = (item.costSilver / item.totalDays) * 30;
    runMonthlyEconomy(state, content);
    const report = zheng.lastReport;
    if (!report) throw new Error('missing report');
    expect(report.expenseTraining ?? 0).toBeCloseTo(expected, 6);
    // 月报只是对账，不重复扣款。
    expect(zheng.trainingSpentSilverMonth).toBe(0);
  });

  it('keeps the accounting identity and always allocates the full 100%', () => {
    const { state, ming } = mingState();
    ming.arrears = 0;
    ming.wageArrears = 0;
    runMonthlyEconomy(state, content);
    const report = ming.lastReport;
    if (!report) throw new Error('missing report');
    expect(report.unallocated).toBe(0);
    const allocated = Object.values(report.allocation ?? {}).reduce((sum, value) => sum + value, 0);
    expect(allocated).toBeCloseTo(1, 6);
    const identity = report.income
      - (report.corruptionLoss ?? 0)
      - (report.loyaltyCost ?? 0)
      - (report.expenseCourt ?? 0)
      - (report.expenseArmyPaid ?? 0)
      - (report.foodPurchaseSilver ?? 0)
      - (report.expenseTraining ?? 0);
    expect(identity).toBeCloseTo(report.net, 6);
  });

  it('scores tax laws by expected net revenue instead of nominal rate', () => {
    const { state, ming } = mingState();
    const peasants = ming.estates['peasants'];
    if (!peasants) throw new Error('missing peasants');
    peasants.income = 1200000;
    const template = content.taxLaws.get('tax_peasants_light');
    if (!template) throw new Error('missing template law');
    // 名义税率高 5 倍，但效率与逃税都更差。
    const highNominal = {
      ...template,
      id: 'test_high_nominal',
      rate: 0.2,
      efficiency: 0.1,
      evasionBase: 0.35,
      silverShare: 0.9,
      aiWeight: 0,
    };
    const efficient = {
      ...template,
      id: 'test_efficient',
      rate: 0.04,
      efficiency: 0.9,
      evasionBase: 0.05,
      silverShare: 0.9,
      aiWeight: 0,
    };
    const efficientNet = expectedTaxNet(state, content, 'MING', 'peasants', efficient);
    const highNominalNet = expectedTaxNet(state, content, 'MING', 'peasants', highNominal);
    expect(efficientNet).toBeGreaterThan(highNominalNet);
  });

  it('blocks training new armies while wage arrears are owed', () => {
    const state = createInitialState(content, '1650', 42, 'ZHENG');
    const zheng = state.countries['ZHENG'];
    if (!zheng) throw new Error('missing ZHENG');
    zheng.treasury = 1000000;
    zheng.food = 1000000;
    zheng.manpower = 100000;
    zheng.wageArrears = 1;
    expect(enqueueTraining(state, content, 'ZHENG', zheng.capital, 'zheng_marines', 1)).toBe(false);
  });
});
