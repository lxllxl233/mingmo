import type { ContentIndex } from '../../content/types';
import type { GameState } from '../state/types';

const COOLDOWN_KEY = 'japan_sakoku';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shift(state: GameState, tag: string, faction: string, delta: number): void {
  const nation = state.countries[tag];
  if (nation) nation.factions[faction] = clamp((nation.factions[faction] ?? 0) + delta, 0, 100);
}

export function isJapanOpen(state: GameState): boolean {
  return state.countries['JAPAN']?.flags['japan_open'] === true;
}

export function sakokuCooldown(state: GameState, tag: string): number {
  return Math.max(0, (state.countries[tag]?.cooldowns[COOLDOWN_KEY] ?? 0) - state.day);
}

export function toggleSakoku(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'JAPAN' || !nation?.alive) return false;
  if (sakokuCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 10) return false;
  nation.politicalPower -= 10;
  const opening = !isJapanOpen(state);
  nation.flags['japan_open'] = opening;
  nation.cooldowns[COOLDOWN_KEY] = state.day + 365;
  if (opening) {
    nation.stability = clamp(nation.stability - 2, 0, 100);
    shift(state, tag, 'merchants', 6);
    shift(state, tag, 'clergy', -4);
  } else {
    nation.stability = clamp(nation.stability + 2, 0, 100);
    shift(state, tag, 'merchants', -6);
    shift(state, tag, 'clergy', 4);
  }
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: opening ? '解除锁国：开放长崎以外的窗口，商人 +6、寺社 -4、稳定 -2' : '重申锁国：商人 -6、寺社 +4、稳定 +2',
    severity: 'warning',
  });
  return true;
}

export function nagasakiTrade(state: GameState, content: ContentIndex, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'JAPAN' || !nation?.alive) return false;
  if (sakokuCooldown(state, tag) > 0) return false;
  let development = 0;
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    const def = content.provinces.get(province.id);
    if (!def?.isPort) continue;
    development += def.development;
  }
  const multiplier = isJapanOpen(state) ? 1 : 0.5;
  const gain = Math.round((20000 + development * 40) * multiplier);
  nation.treasury += gain;
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  shift(state, tag, 'merchants', 3);
  shift(state, tag, 'clergy', -2);
  state.log.push({
    day: state.day,
    category: 'economy',
    country: tag,
    text: `长崎贸易：得银 ${gain.toLocaleString()} 两；商人 +3、寺社 -2`,
    severity: 'info',
  });
  return true;
}

export function persecuteChristians(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'JAPAN' || !nation?.alive) return false;
  if (sakokuCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 10) return false;
  nation.politicalPower -= 10;
  nation.stability = clamp(nation.stability + 2, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  shift(state, tag, 'clergy', 6);
  shift(state, tag, 'merchants', -5);
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    province.unrest = clamp(province.unrest + 2, 0, 100);
  }
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '禁教：寺社 +6、商人 -5、稳定 +2、各地民怨 +2',
    severity: 'warning',
  });
  return true;
}

export function sakokuMonthlyIncome(state: GameState, content: ContentIndex, tag: string): number {
  if (tag !== 'JAPAN' || !isJapanOpen(state)) return 0;
  let development = 0;
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    const def = content.provinces.get(province.id);
    if (def?.isPort) development += def.development;
  }
  return Math.round(development * 20);
}
