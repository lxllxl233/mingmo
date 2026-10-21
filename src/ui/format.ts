import type { Effect } from '../content/types';
import { modifierLabel } from '../content/modifierRegistry';

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toFixed(digits);
}

const ESTATE_LABELS: Record<string, string> = {
  ruling: '统治阶级',
  merchants: '商人',
  landlords: '地主',
  artisans: '小生产者',
  peasants: '农民',
};

export function effectSummary(effect: Effect): string {
  if ('addAllEstateLoyalty' in effect) {
    return `各阶级忠诚 ${effect.addAllEstateLoyalty > 0 ? '+' : ''}${effect.addAllEstateLoyalty}`;
  }
  if ('addTreasury' in effect) return `银 ${formatNumber(effect.addTreasury)}`;
  if ('addFood' in effect) return `粮 ${formatNumber(effect.addFood)}`;
  if ('addManpower' in effect) return `兵源 ${formatNumber(effect.addManpower)}`;
  if ('addArmyLoyalty' in effect) return `军心 ${effect.addArmyLoyalty > 0 ? '+' : ''}${effect.addArmyLoyalty}`;
  if ('addEstateLoyalty' in effect) {
    return `${ESTATE_LABELS[effect.addEstateLoyalty.estate] ?? effect.addEstateLoyalty.estate} 忠诚 ${effect.addEstateLoyalty.value > 0 ? '+' : ''}${effect.addEstateLoyalty.value}`;
  }
  if ('addEstateInfluence' in effect) {
    return `${ESTATE_LABELS[effect.addEstateInfluence.estate] ?? effect.addEstateInfluence.estate} 影响 ${effect.addEstateInfluence.value > 0 ? '+' : ''}${effect.addEstateInfluence.value}`;
  }
  if ('addModifier' in effect) {
    return Object.entries(effect.addModifier)
      .slice(0, 4)
      .map(([key, value]) => {
        const suffix = key.endsWith('_pct') ? '%' : '';
        return `${modifierLabel(key)} ${value > 0 ? '+' : ''}${value}${suffix}`;
      }).join('，');
  }
  if ('setFlag' in effect) return '';
  if ('annexProvince' in effect) return '吞并目标省份（需已控制其地区）';
  if ('addCore' in effect) return '获得核心（完整人力与资源）';
  if ('addClaim' in effect) return '获得宣称';
  if ('setTaxLaw' in effect) return '变更税法';
  if ('unlockDecision' in effect) return '解锁决议';
  if ('unlockUnit' in effect) return '解锁单位';
  if ('triggerEvent' in effect) return '触发后续事件';
  if ('if' in effect) return '条件效果';
  if ('randomList' in effect) return '随机效果';
  return '';
}

export function effectsSummary(effects: Effect[]): string {
  return effects.map(effectSummary).filter(Boolean).slice(0, 4).join('；');
}

