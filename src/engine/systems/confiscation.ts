import type { ContentIndex } from '../../content/types';
import type { GameState } from '../state/types';

const COOLDOWN_KEY = 'shun_confiscation';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function setEstateLoyalty(state: GameState, tag: string, key: string, delta: number): void {
  const estate = state.countries[tag]?.estates[key];
  if (estate) estate.loyalty = clamp(estate.loyalty + delta, 0, 100);
}

export function confiscationCooldown(state: GameState, tag: string): number {
  return Math.max(0, (state.countries[tag]?.cooldowns[COOLDOWN_KEY] ?? 0) - state.day);
}

export function confiscationGain(state: GameState, content: ContentIndex, tag: string): number {
  let development = 0;
  let provinces = 0;
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    provinces += 1;
    development += content.provinces.get(province.id)?.development ?? 0;
  }
  const gentry = state.countries[tag]?.estates['gentry']?.loyalty ?? 50;
  return Math.min(300000, Math.round((50000 + provinces * 1500 + development * 30) * (0.6 + gentry / 150)));
}

export function extortGentry(state: GameState, content: ContentIndex, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'SHUN' || !nation?.alive) return false;
  if (confiscationCooldown(state, tag) > 0) return false;
  const gain = confiscationGain(state, content, tag);
  nation.treasury += gain;
  nation.stability = clamp(nation.stability - 4, 0, 100);
  nation.corruption = clamp(nation.corruption + 2, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  setEstateLoyalty(state, tag, 'gentry', -8);
  setEstateLoyalty(state, tag, 'farmers', 3);
  setEstateLoyalty(state, tag, 'military', 2);
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    province.unrest = clamp(province.unrest + 4, 0, 100);
  }
  state.log.push({
    day: state.day,
    category: 'economy',
    country: tag,
    text: `追赃助饷：拷掠士绅，得银 ${gain.toLocaleString()} 两；士绅忠诚 -8、稳定 -4、各地民怨 +4`,
    severity: 'warning',
  });
  return true;
}

export function landReform(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'SHUN' || !nation?.alive) return false;
  if (confiscationCooldown(state, tag) > 0) return false;
  if (nation.politicalPower < 20) return false;
  nation.politicalPower -= 20;
  nation.food += 80000;
  nation.manpower += 8000;
  nation.stability = clamp(nation.stability + 2, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 180;
  setEstateLoyalty(state, tag, 'farmers', 8);
  setEstateLoyalty(state, tag, 'gentry', -6);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '均田免赋：流民归田，得粮 8 万石、兵源 8 千；农民忠诚 +8、士绅 -6',
    severity: 'info',
  });
  return true;
}

export function pacifyGentry(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'SHUN' || !nation?.alive) return false;
  if (confiscationCooldown(state, tag) > 0) return false;
  if (nation.treasury < 50000) return false;
  nation.treasury -= 50000;
  nation.stability = clamp(nation.stability + 4, 0, 100);
  nation.cooldowns[COOLDOWN_KEY] = state.day + 120;
  setEstateLoyalty(state, tag, 'gentry', 8);
  setEstateLoyalty(state, tag, 'farmers', -3);
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    province.unrest = clamp(province.unrest - 3, 0, 100);
  }
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '安民：发银 5 万两赈济士绅，稳定 +4、士绅忠诚 +8、各地民怨 -3',
    severity: 'info',
  });
  return true;
}
