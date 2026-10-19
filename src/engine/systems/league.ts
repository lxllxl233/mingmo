import type { ContentIndex } from '../../content/types';
import type { GameState } from '../state/types';
import { improveRelation } from '../rules/diplomacy';
import { relationKey } from '../state/types';

const COOLDOWN_KEY = 'mongol_league';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shift(state: GameState, tag: string, faction: string, delta: number): void {
  const nation = state.countries[tag];
  if (nation) nation.factions[faction] = clamp((nation.factions[faction] ?? 0) + delta, 0, 100);
}

export function leagueCooldown(state: GameState, tag: string): number {
  return Math.max(0, (state.countries[tag]?.cooldowns[COOLDOWN_KEY] ?? 0) - state.day);
}

export function holdKurultai(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'MONGOL' || !nation?.alive) return false;
  if (leagueCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 10) return false;
  nation.politicalPower -= 10;
  nation.mandate = clamp(nation.mandate + 6, 0, 100);
  nation.stability = clamp(nation.stability + 3, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  shift(state, tag, 'nobles', 6);
  shift(state, tag, 'clergy', 4);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '召开会盟：汗权 +6、稳定 +3；贵族 +6、喇嘛 +4',
    severity: 'info',
  });
  return true;
}

export function organizeBanners(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'MONGOL' || !nation?.alive) return false;
  if (leagueCooldown(state, tag) > 0) return false;
  if (nation.treasury < 30000) return false;
  nation.treasury -= 30000;
  nation.manpower += 8000;
  nation.armyLoyalty = clamp(nation.armyLoyalty + 4, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  shift(state, tag, 'military', 8);
  shift(state, tag, 'nobles', -3);
  state.log.push({
    day: state.day,
    category: 'military',
    country: tag,
    text: '编立盟旗：兵源 +8 千、军心 +4；武将 +8、贵族 -3',
    severity: 'info',
  });
  return true;
}

export function raidBorder(state: GameState, content: ContentIndex, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'MONGOL' || !nation?.alive) return false;
  if (leagueCooldown(state, tag) > 0) return false;
  let development = 0;
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    development += content.provinces.get(province.id)?.development ?? 0;
  }
  const gain = Math.min(120000, 30000 + development * 10);
  nation.treasury += gain;
  nation.food += gain * 2;
  nation.mandate = clamp(nation.mandate + 2, 0, 100);
  nation.stability = clamp(nation.stability - 3, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 120;
  shift(state, tag, 'military', 5);
  for (const target of ['MING', 'QING']) {
    if (state.countries[target]?.alive) improveRelation(state, tag, target, -15);
  }
  state.log.push({
    day: state.day,
    category: 'economy',
    country: tag,
    text: `掠边：得银 ${gain.toLocaleString()} 两、粮 ${(gain * 2).toLocaleString()} 石；稳定 -3，明/清关系 -15`,
    severity: 'warning',
  });
  return true;
}

export function marriagePact(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'MONGOL' || !nation?.alive) return false;
  if (leagueCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 10 || nation.treasury < 20000) return false;
  const target = state.countries['QING']?.alive ? 'QING' : state.countries['MING']?.alive ? 'MING' : null;
  if (!target) return false;
  nation.politicalPower -= 10;
  nation.treasury -= 20000;
  nation.cooldowns[COOLDOWN_KEY] = state.day + 365;
  improveRelation(state, tag, target, 20);
  state.truces[relationKey(tag, target)] = state.day + 365;
  shift(state, tag, 'nobles', 3);
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    country: tag,
    text: `与 ${target} 联姻：关系 +20、停战 365 日`,
    severity: 'info',
  });
  return true;
}
