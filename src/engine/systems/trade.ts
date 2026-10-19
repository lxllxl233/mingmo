import type { ContentIndex } from '../../content/types';
import type { GameState } from '../state/types';

const COOLDOWN_KEY = 'zheng_trade';
const MAX_POSTS = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function tradePostMonthlyIncome(state: GameState, content: ContentIndex, tag: string): number {
  const nation = state.countries[tag];
  if (!nation) return 0;
  let income = 0;
  for (const portId of nation.tradePosts) {
    const def = content.provinces.get(portId);
    if (!def?.isPort) continue;
    income += def.development * 80 + (def.isCoastal ? 1500 : 0);
  }
  return Math.round(income);
}

export function dividendCooldown(state: GameState, tag: string): number {
  return Math.max(0, (state.countries[tag]?.cooldowns[COOLDOWN_KEY] ?? 0) - state.day);
}

export function openTradePost(state: GameState, content: ContentIndex, tag: string, portId: string): boolean {
  const nation = state.countries[tag];
  const province = state.provinces[portId];
  const def = content.provinces.get(portId);
  if (tag !== 'ZHENG' || !nation?.alive || !province || !def?.isPort) return false;
  if (province.controller !== tag) return false;
  if (nation.tradePosts.includes(portId) || nation.tradePosts.length >= MAX_POSTS) return false;
  if (nation.treasury < 30000 || nation.politicalPower < 10) return false;
  nation.treasury -= 30000;
  nation.politicalPower -= 10;
  nation.tradePosts.push(portId);
  nation.factions['merchants'] = clamp((nation.factions['merchants'] ?? 0) + 6, 0, 100);
  state.log.push({
    day: state.day,
    category: 'economy',
    country: tag,
    text: `在 ${def.name} 设埠通商：海贸网络 +1，商人 +6`,
    severity: 'info',
  });
  return true;
}

export function takeDividend(state: GameState, content: ContentIndex, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'ZHENG' || !nation?.alive) return false;
  if (dividendCooldown(state, tag) > 0) return false;
  if (nation.tradePosts.length === 0) return false;
  const income = tradePostMonthlyIncome(state, content, tag) * 4;
  nation.treasury += income;
  nation.factions['merchants'] = clamp((nation.factions['merchants'] ?? 0) + 3, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  state.log.push({
    day: state.day,
    category: 'economy',
    country: tag,
    text: `海商分红：得银 ${income.toLocaleString()} 两，商人 +3`,
    severity: 'info',
  });
  return true;
}

export function recruitMerchants(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'ZHENG' || !nation?.alive) return false;
  if (nation.treasury < 20000) return false;
  if (dividendCooldown(state, tag) > 0) return false;
  nation.treasury -= 20000;
  nation.manpower += 2000;
  nation.factions['merchants'] = clamp((nation.factions['merchants'] ?? 0) + 8, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 90;
  state.log.push({
    day: state.day,
    category: 'economy',
    country: tag,
    text: '招抚海商：商人 +8、兵源 +2 千',
    severity: 'info',
  });
  return true;
}
