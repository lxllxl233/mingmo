import type { Effect } from '../content/types';

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toFixed(digits);
}

const MODIFIER_LABELS: Record<string, string> = {
  tax_efficiency_pct: '税收效率',
  stability_monthly: '稳定/月',
  political_power_monthly: '政治点/月',
  corruption_drift: '腐败/月',
  corruption_monthly: '腐败/月',
  mandate_monthly: '天命/月',
  army_attack_pct: '陆军攻击',
  army_defense_pct: '陆军防御',
  cavalry_attack_pct: '骑兵攻击',
  artillery_attack_pct: '炮兵攻击',
  naval_attack_pct: '水师攻击',
  siege_speed_pct: '围城速度',
  fort_defense_pct: '城防',
  morale_add: '士气',
  discipline_pct: '纪律',
  research_speed_pct: '研究速度',
  focus_speed_pct: '国策速度',
  supply_limit_add: '补给上限',
  manpower_add: '兵源',
  pop_growth_pct: '人口增长',
  food_output_pct: '粮食产出',
  famine_resistance: '抗灾',
  unrest_add: '动乱',
  unrest_monthly: '动乱/月',
  trade_efficiency_pct: '贸易效率',
  inflation_add: '通胀',
  movement_speed_pct: '行军速度',
  army_upkeep_pct: '军费',
};

const ESTATE_LABELS: Record<string, string> = {
  nobles: '宗室贵族',
  officials: '官僚',
  gentry: '士绅',
  merchants: '商人',
  peasants: '农民',
  soldiers: '军人',
  clergy: '僧道',
  scholars: '士人',
  natives: '土司',
  dynasty: '皇室',
};

export function effectSummary(effect: Effect): string {
  if ('addStability' in effect) return `稳定 ${effect.addStability > 0 ? '+' : ''}${effect.addStability}`;
  if ('addMandate' in effect) return `天命 ${effect.addMandate > 0 ? '+' : ''}${effect.addMandate}`;
  if ('addTreasury' in effect) return `银 ${formatNumber(effect.addTreasury)}`;
  if ('addFood' in effect) return `粮 ${formatNumber(effect.addFood)}`;
  if ('addManpower' in effect) return `兵源 ${formatNumber(effect.addManpower)}`;
  if ('addCorruption' in effect) return `腐败 ${effect.addCorruption > 0 ? '+' : ''}${effect.addCorruption}`;
  if ('addAuthority' in effect) return `皇权 ${effect.addAuthority > 0 ? '+' : ''}${effect.addAuthority}`;
  if ('addArmyLoyalty' in effect) return `军心 ${effect.addArmyLoyalty > 0 ? '+' : ''}${effect.addArmyLoyalty}`;
  if ('addEstateLoyalty' in effect) {
    return `${ESTATE_LABELS[effect.addEstateLoyalty.estate] ?? effect.addEstateLoyalty.estate} 忠诚 ${effect.addEstateLoyalty.value > 0 ? '+' : ''}${effect.addEstateLoyalty.value}`;
  }
  if ('addEstateInfluence' in effect) {
    return `${ESTATE_LABELS[effect.addEstateInfluence.estate] ?? effect.addEstateInfluence.estate} 影响 ${effect.addEstateInfluence.value > 0 ? '+' : ''}${effect.addEstateInfluence.value}`;
  }
  if ('addModifier' in effect) {
    return Object.entries(effect.addModifier)
      .filter(([key]) => MODIFIER_LABELS[key] !== undefined)
      .slice(0, 4)
      .map(([key, value]) => {
        const label = MODIFIER_LABELS[key];
        const suffix = key.endsWith('_pct') ? '%' : '';
        return `${label} ${value > 0 ? '+' : ''}${value}${suffix}`;
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
