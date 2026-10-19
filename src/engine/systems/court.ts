import type { GameState } from '../state/types';

export const COURT_FACTIONS = ['donglin', 'eunuch', 'imperial', 'military'] as const;
export type CourtFaction = (typeof COURT_FACTIONS)[number];

export const COURT_FACTION_NAMES: Record<CourtFaction, string> = {
  donglin: '东林',
  eunuch: '阉党',
  imperial: '帝党',
  military: '边将',
};

export const COURT_FACTION_EFFECTS: Record<CourtFaction, string> = {
  donglin: '稳定 +0.02/月，腐败 -0.02/月；边将不满。',
  eunuch: '腐败 +0.05/月，稳定 -0.02/月；税收略增。',
  imperial: '皇权 +0.05/月，稳定 +0.01/月。',
  military: '军心 +0.05/月，军费略降；士绅不满。',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function courtFactionInfluence(state: GameState, tag: string, faction: CourtFaction): number {
  return state.countries[tag]?.factions[faction] ?? 0;
}

export function topCourtFaction(state: GameState, tag: string): CourtFaction | null {
  if (tag !== 'MING') return null;
  const nation = state.countries[tag];
  if (!nation) return null;
  let best: CourtFaction | null = null;
  let bestValue = -1;
  for (const faction of COURT_FACTIONS) {
    const value = nation.factions[faction] ?? 0;
    if (value > bestValue) {
      best = faction;
      bestValue = value;
    }
  }
  return best;
}

export function favorCourtFaction(state: GameState, tag: string, faction: CourtFaction): boolean {
  const nation = state.countries[tag];
  if (tag !== 'MING' || !nation?.alive) return false;
  if (!COURT_FACTIONS.includes(faction)) return false;
  if (nation.politicalPower < 5) return false;
  nation.politicalPower -= 5;
  nation.factions[faction] = clamp((nation.factions[faction] ?? 0) + 8, 0, 100);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: `朝议：扶植${COURT_FACTION_NAMES[faction]}（影响 +8）`,
    severity: 'info',
  });
  return true;
}

export function suppressCourtFaction(state: GameState, tag: string, faction: CourtFaction): boolean {
  const nation = state.countries[tag];
  if (tag !== 'MING' || !nation?.alive) return false;
  if (!COURT_FACTIONS.includes(faction)) return false;
  if (nation.politicalPower < 10) return false;
  nation.politicalPower -= 10;
  nation.factions[faction] = clamp((nation.factions[faction] ?? 0) - 10, 0, 100);
  nation.stability = clamp(nation.stability - 2, 0, 100);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: `朝议：打压${COURT_FACTION_NAMES[faction]}（影响 -10，稳定 -2）`,
    severity: 'warning',
  });
  return true;
}
