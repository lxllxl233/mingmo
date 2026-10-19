import type { GameState } from '../state/types';
import { areAtWar } from './war';
import { hasMilitaryAccess } from './diplomacy';

/** 军队可进入本国、交战方、同盟或已授予军通的国家领土。 */
export function canMarchThrough(state: GameState, tag: string, provinceId: string): boolean {
  const province = state.provinces[provinceId];
  if (!province) return false;
  if (province.controller === tag) return true;
  if (areAtWar(state, tag, province.controller) || areAtWar(state, tag, province.owner)) return true;
  return hasMilitaryAccess(state, province.controller, tag);
}

