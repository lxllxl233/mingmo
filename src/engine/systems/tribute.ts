import type { GameState } from '../state/types';
import { improveRelation } from '../rules/diplomacy';

const COOLDOWN_KEY = 'joseon_tribute';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shift(state: GameState, tag: string, faction: string, delta: number): void {
  const nation = state.countries[tag];
  if (nation) nation.factions[faction] = clamp((nation.factions[faction] ?? 0) + delta, 0, 100);
}

export function isJoseonNorth(state: GameState): boolean {
  return state.countries['JOSEON']?.flags['joseon_north'] === true;
}

export function tributeCooldown(state: GameState, tag: string): number {
  return Math.max(0, (state.countries[tag]?.cooldowns[COOLDOWN_KEY] ?? 0) - state.day);
}

export function submitToQing(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'JOSEON' || !nation?.alive) return false;
  if (!state.countries['QING']?.alive) return false;
  if (tributeCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 5) return false;
  nation.politicalPower -= 5;
  nation.flags['joseon_north'] = false;
  nation.stability = clamp(nation.stability + 2, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 365;
  improveRelation(state, tag, 'QING', 15);
  shift(state, tag, 'nobles', 5);
  shift(state, tag, 'military', -5);
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    country: tag,
    text: '事大：对清称臣，关系 +15、稳定 +2；两班 +5、武臣 -5',
    severity: 'info',
  });
  return true;
}

export function northernExpedition(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'JOSEON' || !nation?.alive) return false;
  if (tributeCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 10) return false;
  nation.politicalPower -= 10;
  nation.flags['joseon_north'] = true;
  nation.stability = clamp(nation.stability - 2, 0, 100);
  nation.manpower += 5000;
  nation.cooldowns[COOLDOWN_KEY] = state.day + 365;
  improveRelation(state, tag, 'QING', -20);
  shift(state, tag, 'military', 8);
  shift(state, tag, 'nobles', -5);
  state.log.push({
    day: state.day,
    category: 'military',
    country: tag,
    text: '北伐：兵源 +5 千、武臣 +8、两班 -5；对清关系 -20、稳定 -2',
    severity: 'warning',
  });
  return true;
}

export function sendTribute(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'JOSEON' || !nation?.alive) return false;
  if (!state.countries['QING']?.alive) return false;
  if (tributeCooldown(state, tag) > 0) return false;
  if (nation.treasury < 20000 || nation.food < 20000) return false;
  nation.treasury -= 20000;
  nation.food -= 20000;
  nation.mandate = clamp(nation.mandate + 3, 0, 100);
  nation.stability = clamp(nation.stability + 1, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  improveRelation(state, tag, 'QING', 15);
  shift(state, tag, 'officials', 3);
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    country: tag,
    text: '朝贡：银 2 万、粮 2 万石；对清关系 +15、正统 +3、稳定 +1、文臣 +3',
    severity: 'info',
  });
  return true;
}
