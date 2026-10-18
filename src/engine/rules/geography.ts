import type { ContentIndex } from '../../content/types';
import type { GameState } from '../state/types';

export function controlledAreaCount(state: GameState, tag: string): number {
  return Object.values(state.provinces).filter(province => province.controller === tag).length;
}

export function controlledProvinceCount(state: GameState, content: ContentIndex, tag: string): number {
  const groups = new Set<string>();
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    const def = content.provinces.get(province.id);
    if (def) groups.add(def.prefectureId);
  }
  return groups.size;
}

export function ownedProvinceCount(state: GameState, content: ContentIndex, tag: string): number {
  const groups = new Set<string>();
  for (const province of Object.values(state.provinces)) {
    if (province.owner !== tag) continue;
    const def = content.provinces.get(province.id);
    if (def) groups.add(def.prefectureId);
  }
  return groups.size;
}
