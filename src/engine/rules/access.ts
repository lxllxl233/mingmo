import type { GameState } from '../state/types';
import { areAtWar } from './war';

/** 军队只能进入本国领土，或与自己交战的国家领土；中立国不自动给予通行权。 */
export function canMarchThrough(state: GameState, tag: string, provinceId: string): boolean {
  const province = state.provinces[provinceId];
  if (!province) return false;
  if (province.controller === tag) return true;
  return areAtWar(state, tag, province.controller) || areAtWar(state, tag, province.owner);
}

