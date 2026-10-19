import type { ContentIndex } from '../../content/types';
import type { ArmyState, GameState } from '../state/types';
import { areAtWar } from './war';

export function isFleet(army: ArmyState): boolean {
  return army.composition.naval > 0;
}

/** 返回被敌方舰队封锁的港口（controller === tag、isPort、有敌国舰队在港）。 */
export function blockadedPorts(state: GameState, content: ContentIndex, tag: string): string[] {
  const ports: string[] = [];
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    const def = content.provinces.get(province.id);
    if (!def?.isPort) continue;
    const hostileFleet = Object.values(state.armies).some(army =>
      army.province === province.id
      // 航渡中的舰队不能封锁出发港。
      && !army.embarked
      && isFleet(army)
      && army.tag !== tag
      && areAtWar(state, army.tag, tag));
    if (hostileFleet) ports.push(province.id);
  }
  return ports;
}

export function blockadePenalty(state: GameState, content: ContentIndex, tag: string): number {
  return Math.min(0.35, blockadedPorts(state, content, tag).length * 0.04);
}
