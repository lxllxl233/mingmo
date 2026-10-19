/**
 * 修正（modifier）注册表：内容、校验、UI、引擎共用的单一事实源。
 *
 * 规则：
 * - 每个 key 必须有 label / scope / kind / consumer / description。
 * - consumer 指向真正读取它的模块；新增 key 必须同时接线并有测试。
 * - 内容层只能使用这里注册的 key；`pnpm audit:content` 会检查消费者。
 */
export type ModifierScope = 'country' | 'province';
export type ModifierKind = 'pct' | 'flat' | 'monthly';

export interface ModifierDef {
  label: string;
  scope: ModifierScope;
  kind: ModifierKind;
  consumer: string;
  description: string;
}

export const MODIFIER_DEFS = {
  tax_efficiency_pct: {
    label: '税收效率',
    scope: 'country',
    kind: 'pct',
    consumer: 'economy',
    description: '按百分比提高税收实收。',
  },
  trade_efficiency_pct: {
    label: '贸易效率',
    scope: 'country',
    kind: 'pct',
    consumer: 'economy',
    description: '提高商税与贸易收入。',
  },
  food_output_pct: {
    label: '粮食产出',
    scope: 'country',
    kind: 'pct',
    consumer: 'economy',
    description: '提高购粮/粮食产出。',
  },
  famine_resistance: {
    label: '抗灾',
    scope: 'country',
    kind: 'flat',
    consumer: 'economy',
    description: '降低缺粮造成的稳定/忠诚/军队损失。',
  },
  army_upkeep_pct: {
    label: '军费',
    scope: 'country',
    kind: 'pct',
    consumer: 'economy',
    description: '按百分比改变军队月饷。',
  },
  army_attack_pct: {
    label: '陆军攻击',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高陆战攻击力。',
  },
  army_defense_pct: {
    label: '陆军防御',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高陆战防御力。',
  },
  cavalry_attack_pct: {
    label: '骑兵攻击',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高骑兵在攻击中的贡献。',
  },
  artillery_attack_pct: {
    label: '炮兵攻击',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高炮兵在攻击/围城中的贡献。',
  },
  naval_attack_pct: {
    label: '水师攻击',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高水师在海战/海运中的能力（海战 Q2 接入）。',
  },
  discipline_pct: {
    label: '纪律',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高攻防与组织恢复。',
  },
  morale_add: {
    label: '士气',
    scope: 'country',
    kind: 'flat',
    consumer: 'military',
    description: '提高组织度上限/恢复。',
  },
  movement_speed_pct: {
    label: '行军速度',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高行军速度。',
  },
  siege_speed_pct: {
    label: '围城速度',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '提高围城进度。',
  },
  fort_defense_pct: {
    label: '城防',
    scope: 'country',
    kind: 'pct',
    consumer: 'military',
    description: '守城时提高防御力。',
  },
  supply_limit_add: {
    label: '补给上限',
    scope: 'country',
    kind: 'flat',
    consumer: 'military',
    description: '提高补给恢复/降低断粮损耗。',
  },
  research_speed_pct: {
    label: '研究速度',
    scope: 'country',
    kind: 'pct',
    consumer: 'research',
    description: '提高科研进度。',
  },
  focus_speed_pct: {
    label: '国策速度',
    scope: 'country',
    kind: 'pct',
    consumer: 'focus',
    description: '提高国策进度。',
  },
  stability_monthly: {
    label: '稳定/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'economy',
    description: '每月稳定变化。',
  },
  mandate_monthly: {
    label: '天命/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'economy',
    description: '每月天命变化。',
  },
  corruption_monthly: {
    label: '腐败/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'economy',
    description: '每月腐败变化。',
  },
  authority_monthly: {
    label: '皇权/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'politics',
    description: '每月皇权变化。',
  },
  unrest_monthly: {
    label: '动乱/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'politics',
    description: '每月各省民怨变化。',
  },
  devastation_monthly: {
    label: '残破/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'politics',
    description: '每月各省残破度变化（负值恢复）。',
  },
  inflation_monthly: {
    label: '通胀/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'economy',
    description: '每月通胀变化。',
  },
  manpower_monthly: {
    label: '兵源/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'economy',
    description: '每月兵源变化。',
  },
  political_power_monthly: {
    label: '政治点/月',
    scope: 'country',
    kind: 'monthly',
    consumer: 'politics',
    description: '每月政治点变化。',
  },
  pop_growth_pct: {
    label: '人口增长',
    scope: 'country',
    kind: 'pct',
    consumer: 'politics',
    description: '按百分比改变人口增长。',
  },
} as const satisfies Record<string, ModifierDef>;

export type ModifierKey = keyof typeof MODIFIER_DEFS;

export const MODIFIER_KEYS: ReadonlySet<string> = new Set(Object.keys(MODIFIER_DEFS));

export function modifierLabel(key: string): string {
  return (MODIFIER_DEFS as Record<string, ModifierDef>)[key]?.label ?? key;
}

export function modifierDef(key: string): ModifierDef | undefined {
  return (MODIFIER_DEFS as Record<string, ModifierDef>)[key];
}
