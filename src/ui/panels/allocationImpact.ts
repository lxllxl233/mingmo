import type { ContentIndex, CountryEstateConfig } from '../../content/types';
import type { CountryState } from '../../engine/state/types';
import {
  bottomMaintenanceCost,
  estatePopulationShare,
  governmentProfile,
  minimumAllocationShare,
} from '../../engine/systems/economy';
import { driftedInfluence } from '../../engine/systems/politics';

export interface AllocationImpact {
  /** 下月各阶级忠诚（与月结同一公平度公式）。 */
  loyalties: number[];
  /** 下月各阶级影响力（份额偏离惯例 → 缓慢漂移）；再下月起用于最低分配。 */
  influences: number[];
  /** 按漂移后影响力计算的最低分配份额（%）。 */
  minimums: number[];
  stabilityTarget: number;
  stabilityDelta: number;
  stability: number;
  /** 下月基层维稳支出（农民 / 匠户的人口加权忠诚）。 */
  maintenanceCost: number;
  bottomPopShare: number;
  bottomLoyalty: number;
}

function clampValue(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * 拖动分配时的下月预览。公式与 `runMonthlyEconomy` 对齐：
 * 份额 → 各阶级公平度忠诚 → 影响力加权稳定目标；基层人数与忠诚 → 基层维稳成本。
 * `referenceIncome` 是按惯例份额推算的参考税收，改分配不会直接抬高维稳基数。
 * 只做一步预测，不模拟连锁反应。
 */
export function previewAllocationImpact(
  content: ContentIndex,
  country: CountryState,
  configs: CountryEstateConfig[],
  shares: number[],
  referenceIncome: number,
): AllocationImpact {
  const loyalties = configs.map((config, index) => {
    const estate = country.estates[config.key];
    if (!estate) return 0;
    const fairness = ((shares[index] ?? 0) - config.incomeShare) * 3;
    return clampValue(estate.loyalty + fairness);
  });
  // 月结顺序：本月经济 → 本月政治（影响力漂移）→ 下月经济（按新影响力计算最低份额）。
  const influences = configs.map((config, index) =>
    driftedInfluence(
      country.estates[config.key]?.influence ?? 0,
      shares[index] ?? 0,
      config.incomeShare,
    ));
  const minimums = influences.map(minimumAllocationShare);
  // 下月稳定由下月经济结算产生，此时影响力已经过本月漂移。
  const weightOf = (index: number) => Math.max(1, influences[index] ?? 0);
  const loyaltyWeight = configs.reduce((sum, _config, index) => sum + weightOf(index), 0);
  const weightedLoyalty = configs.reduce(
    (sum, _config, index) => sum + (loyalties[index] ?? 0) * weightOf(index),
    0,
  ) / Math.max(1, loyaltyWeight);
  const government = governmentProfile(content.countries.get(country.tag)?.government ?? 'monarchy');
  const stabilityTarget = clampValue(weightedLoyalty * government.stability);
  const stabilityDelta = (stabilityTarget - country.stability) * 0.12
    + content.balance.economy.stabilityDrift * 0.4
    + (country.treasury > 0 ? 0.02 : -0.08)
    + (country.flags['food_shortage'] ? -0.25 : 0.01)
    - country.warExhaustion / 1000;

  let bottomPopShare = 0;
  let bottomLoyaltyWeighted = 0;
  configs.forEach((config, index) => {
    if (config.key !== 'peasants' && config.key !== 'artisans') return;
    const popShare = estatePopulationShare(content, country.tag, config.key);
    bottomPopShare += popShare;
    bottomLoyaltyWeighted += (loyalties[index] ?? 0) * popShare;
  });
  const bottomLoyalty = bottomPopShare > 0 ? bottomLoyaltyWeighted / bottomPopShare : 50;
  const maintenanceCost = bottomMaintenanceCost(referenceIncome, bottomPopShare, bottomLoyalty);

  return {
    loyalties,
    influences,
    minimums,
    stabilityTarget,
    stabilityDelta,
    stability: clampValue(country.stability + stabilityDelta),
    maintenanceCost,
    bottomPopShare,
    bottomLoyalty,
  };
}
