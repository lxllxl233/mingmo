import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { previewAllocationImpact } from '../src/ui/panels/allocationImpact';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING', 'normal');
const country = state.countries.MING!;
const configs = content.countryEstates.get('MING')!;
const shares = configs.map(config => (country.allocation[config.key] ?? 0) / 100);
const referenceIncome = 150_000;

describe('allocation impact preview', () => {
  it('matches the current state when nothing is dragged', () => {
    const impact = previewAllocationImpact(content, country, configs, shares, referenceIncome);
    configs.forEach((config, index) => {
      expect(impact.loyalties[index], config.key)
        .toBeCloseTo(country.estates[config.key]!.loyalty, 1);
    });
    configs.forEach((config, index) => {
      // 开局分配 = 惯例份额，影响力应基本不动。
      expect(impact.influences[index], config.key)
        .toBeCloseTo(country.estates[config.key]!.influence, 1);
      expect(impact.minimums[index], config.key)
        .toBeCloseTo(Math.min(20, 0.5 + country.estates[config.key]!.influence * 0.04), 1);
    });
    // 下月预览 = 当前值 + 一个月的漂移，而不是原地不动。
    expect(impact.stability).toBeCloseTo(country.stability + impact.stabilityDelta, 5);
    expect(impact.bottomPopShare).toBeGreaterThan(0.8);
    expect(impact.maintenanceCost).toBeGreaterThan(0);
  });

  it('trades stability against maintenance when wealth moves up the hierarchy', () => {
    const baseline = previewAllocationImpact(content, country, configs, shares, referenceIncome);
    const rulingIndex = configs.findIndex(config => config.key === 'ruling');
    const peasantIndex = configs.findIndex(config => config.key === 'peasants');
    const shifted = shares.map((share, index) => {
      if (index === rulingIndex) return share + 0.2;
      if (index === peasantIndex) return share - 0.2;
      return share;
    });
    const moved = previewAllocationImpact(content, country, configs, shifted, referenceIncome);
    expect(moved.loyalties[rulingIndex]!).toBeGreaterThan(baseline.loyalties[rulingIndex]!);
    expect(moved.loyalties[peasantIndex]!).toBeLessThan(baseline.loyalties[peasantIndex]!);
    // 精英更满意 → 稳定目标上升；底层更不满 → 维稳更贵。
    expect(moved.stabilityTarget).toBeGreaterThan(baseline.stabilityTarget);
    expect(moved.stabilityDelta).toBeGreaterThan(baseline.stabilityDelta);
    expect(moved.maintenanceCost).toBeGreaterThan(baseline.maintenanceCost);
    // 份额偏离惯例 → 下月影响力漂移 → 再下月最低份额随之抬升/下调。
    expect(moved.influences[rulingIndex]!).toBeGreaterThan(baseline.influences[rulingIndex]!);
    expect(moved.influences[peasantIndex]!).toBeLessThan(baseline.influences[peasantIndex]!);
    expect(moved.minimums[rulingIndex]!).toBeGreaterThan(baseline.minimums[rulingIndex]!);
    expect(moved.minimums[peasantIndex]!).toBeLessThan(baseline.minimums[peasantIndex]!);
  });

  it('scales maintenance with the reference tax base, not the dragged shares', () => {
    const low = previewAllocationImpact(content, country, configs, shares, 100_000);
    const high = previewAllocationImpact(content, country, configs, shares, 200_000);
    expect(high.maintenanceCost).toBeCloseTo(low.maintenanceCost * 2, 5);
    // 参考基数不变、把份额挪给精英：基层更不满，维稳应上升而不是下降。
    const rulingIndex = configs.findIndex(config => config.key === 'ruling');
    const peasantIndex = configs.findIndex(config => config.key === 'peasants');
    const squeezed = shares.map((share, index) => {
      if (index === rulingIndex) return share + 0.2;
      if (index === peasantIndex) return share - 0.2;
      return share;
    });
    const moved = previewAllocationImpact(content, country, configs, squeezed, 100_000);
    expect(moved.maintenanceCost).toBeGreaterThan(low.maintenanceCost);
  });
});
