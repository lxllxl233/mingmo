import type { Effect } from '../content/types';

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toFixed(digits);
}

export function effectSummary(effect: Effect): string {
  if ('addStability' in effect) return `稳定 ${effect.addStability > 0 ? '+' : ''}${effect.addStability}`;
  if ('addMandate' in effect) return `天命 ${effect.addMandate > 0 ? '+' : ''}${effect.addMandate}`;
  if ('addTreasury' in effect) return `银 ${formatNumber(effect.addTreasury)}`;
  if ('addFood' in effect) return `粮 ${formatNumber(effect.addFood)}`;
  if ('addManpower' in effect) return `兵源 ${formatNumber(effect.addManpower)}`;
  if ('addCorruption' in effect) return `腐败 ${effect.addCorruption > 0 ? '+' : ''}${effect.addCorruption}`;
  if ('addAuthority' in effect) return `皇权 ${effect.addAuthority > 0 ? '+' : ''}${effect.addAuthority}`;
  if ('addArmyLoyalty' in effect) return `军心 ${effect.addArmyLoyalty > 0 ? '+' : ''}${effect.addArmyLoyalty}`;
  if ('addEstateLoyalty' in effect) return `${effect.addEstateLoyalty.estate} 忠诚 ${effect.addEstateLoyalty.value}`;
  if ('addEstateInfluence' in effect) return `${effect.addEstateInfluence.estate} 影响 ${effect.addEstateInfluence.value}`;
  if ('addModifier' in effect) {
    return Object.entries(effect.addModifier).slice(0, 3).map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`).join('，');
  }
  if ('setFlag' in effect) return `flag: ${effect.setFlag}`;
  if ('setTaxLaw' in effect) return `税制: ${effect.setTaxLaw.law}`;
  if ('unlockDecision' in effect) return '解锁决议';
  if ('unlockUnit' in effect) return '解锁单位';
  if ('triggerEvent' in effect) return '触发后续事件';
  if ('if' in effect) return '条件效果';
  if ('randomList' in effect) return '随机效果';
  return Object.keys(effect)[0] ?? '效果';
}

export function effectsSummary(effects: Effect[]): string {
  return effects.slice(0, 4).map(effectSummary).join('；');
}
