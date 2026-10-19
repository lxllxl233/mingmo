import type { GameState } from '../state/types';

export const BANNER_FACTIONS = ['manchu', 'han_official', 'green_standard', 'banners', 'imperial'] as const;
export type BannerFaction = (typeof BANNER_FACTIONS)[number];

export const BANNER_FACTION_NAMES: Record<BannerFaction, string> = {
  manchu: '满洲旗分',
  han_official: '汉臣',
  green_standard: '绿营',
  banners: '八旗',
  imperial: '宗室',
};

export const BANNER_FACTION_EFFECTS: Record<BannerFaction, string> = {
  manchu: '军心 +0.03/月，稳定 +0.01/月。',
  han_official: '腐败 -0.02/月，稳定 +0.01/月。',
  green_standard: '兵源 +500/月，稳定 -0.01/月。',
  banners: '军心 +0.05/月，腐败 +0.01/月。',
  imperial: '皇权 +0.05/月。',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function topBannerFaction(state: GameState, tag: string): BannerFaction | null {
  if (tag !== 'QING') return null;
  const nation = state.countries[tag];
  if (!nation) return null;
  let best: BannerFaction | null = null;
  let bestValue = -1;
  for (const faction of BANNER_FACTIONS) {
    const value = nation.factions[faction] ?? 0;
    if (value > bestValue) {
      best = faction;
      bestValue = value;
    }
  }
  return best;
}

export function expandBanners(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'QING' || !nation?.alive) return false;
  if (nation.treasury < 50000 || nation.manpower < 10000) return false;
  nation.treasury -= 50000;
  nation.manpower -= 10000;
  nation.factions['banners'] = clamp((nation.factions['banners'] ?? 0) + 6, 0, 100);
  nation.factions['manchu'] = clamp((nation.factions['manchu'] ?? 0) + 4, 0, 100);
  nation.armyLoyalty = clamp(nation.armyLoyalty + 3, 0, 100);
  state.log.push({
    day: state.day,
    category: 'military',
    country: tag,
    text: '扩编八旗：新旗丁入册，八旗影响 +6、满洲旗分 +4、军心 +3',
    severity: 'info',
  });
  return true;
}

export function raiseBanners(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'QING' || !nation?.alive) return false;
  if (nation.politicalPower < 15) return false;
  nation.politicalPower -= 15;
  nation.factions['manchu'] = clamp((nation.factions['manchu'] ?? 0) + 8, 0, 100);
  nation.factions['banners'] = clamp((nation.factions['banners'] ?? 0) + 4, 0, 100);
  nation.factions['green_standard'] = clamp((nation.factions['green_standard'] ?? 0) - 5, 0, 100);
  nation.armyLoyalty = clamp(nation.armyLoyalty + 3, 0, 100);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '抬旗：汉军与绿营将弁编入旗籍，满洲旗分 +8、八旗 +4、绿营 -5',
    severity: 'info',
  });
  return true;
}

export function reformBanners(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (tag !== 'QING' || !nation?.alive) return false;
  if (nation.politicalPower < 20) return false;
  nation.politicalPower -= 20;
  nation.factions['banners'] = clamp((nation.factions['banners'] ?? 0) - 10, 0, 100);
  nation.factions['han_official'] = clamp((nation.factions['han_official'] ?? 0) + 5, 0, 100);
  nation.corruption = clamp(nation.corruption - 2, 0, 100);
  nation.stability = clamp(nation.stability + 2, 0, 100);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '整饬旗务：查办旗地隐匿，八旗 -10、汉臣 +5、腐败 -2、稳定 +2',
    severity: 'info',
  });
  return true;
}
