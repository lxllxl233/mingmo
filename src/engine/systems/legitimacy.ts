import type { GameState } from '../state/types';
import { addAlliance, areAllied, improveRelation } from '../rules/diplomacy';

const COOLDOWN_KEY = 'sming_legitimacy';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shiftFaction(state: GameState, tag: string, faction: string, delta: number): void {
  const nation = state.countries[tag];
  if (nation) nation.factions[faction] = clamp((nation.factions[faction] ?? 0) + delta, 0, 100);
}

export function legitimacyCooldown(state: GameState, tag: string): number {
  return Math.max(0, (state.countries[tag]?.cooldowns[COOLDOWN_KEY] ?? 0) - state.day);
}

export function proclaimEmperor(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'SMING' || !nation?.alive) return false;
  if (legitimacyCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 20 || nation.treasury < 60000) return false;
  nation.politicalPower -= 20;
  nation.treasury -= 60000;
  nation.mandate = clamp(nation.mandate + 8, 0, 100);
  nation.stability = clamp(nation.stability + 4, 0, 100);
  nation.authority = clamp(nation.authority + 3, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 365;
  shiftFaction(state, tag, 'royal_clan', 8);
  shiftFaction(state, tag, 'donglin', -4);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '拥立新帝：正统 +8、稳定 +4、皇权 +3；宗室 +8、东林 -4',
    severity: 'info',
  });
  return true;
}

export function compromiseCourt(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'SMING' || !nation?.alive) return false;
  if (legitimacyCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 5) return false;
  nation.politicalPower -= 5;
  nation.mandate = clamp(nation.mandate + 2, 0, 100);
  nation.stability = clamp(nation.stability + 2, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  shiftFaction(state, tag, 'donglin', 5);
  shiftFaction(state, tag, 'gentry', 3);
  shiftFaction(state, tag, 'royal_clan', -3);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '廷议妥协：正统 +2、稳定 +2；东林 +5、士绅 +3、宗室 -3',
    severity: 'info',
  });
  return true;
}

export function mobilizeLoyalists(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'SMING' || !nation?.alive) return false;
  if (legitimacyCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 10) return false;
  nation.politicalPower -= 10;
  nation.manpower += 10000;
  nation.armyLoyalty = clamp(nation.armyLoyalty + 5, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  shiftFaction(state, tag, 'military', 8);
  shiftFaction(state, tag, 'donglin', -5);
  state.log.push({
    day: state.day,
    category: 'military',
    country: tag,
    text: '号召勤王：兵源 +1 万、军心 +5；武将 +8、东林 -5',
    severity: 'info',
  });
  return true;
}

export function uniteLoyalists(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'SMING' || !nation?.alive) return false;
  if (legitimacyCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 20 || nation.treasury < 50000) return false;
  const partners = ['ZHENG', 'XI'].filter(partner =>
    state.countries[partner]?.alive && !areAllied(state, tag, partner));
  if (partners.length === 0) return false;
  nation.politicalPower -= 20;
  nation.treasury -= 50000;
  nation.mandate = clamp(nation.mandate + 3, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 365;
  for (const partner of partners) {
    addAlliance(state, tag, partner);
    improveRelation(state, tag, partner, 25);
  }
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    country: tag,
    text: `联合抗清：与 ${partners.join('、')} 结盟，正统 +3`,
    severity: 'info',
  });
  return true;
}
