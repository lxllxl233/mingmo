import type { ContentIndex, Modifier } from '../../content/types';
import type { GameState } from '../state/types';

let cachedState: GameState | null = null;
let cachedDay = -1;
let cachedRevision = -1;
const cachedModifiers = new Map<string, Modifier>();

export function invalidateBuildingCache(): void {
  cachedState = null;
  cachedDay = -1;
  cachedRevision = -1;
  cachedModifiers.clear();
}

export function buildingModifiers(state: GameState, content: ContentIndex, tag: string): Modifier {
  // 同日易手（mapRevision 变化）也会影响建筑归属，必须让缓存失效。
  if (cachedState !== state || cachedDay !== state.day || cachedRevision !== state.mapRevision) {
    cachedState = state;
    cachedDay = state.day;
    cachedRevision = state.mapRevision;
    cachedModifiers.clear();
  }
  const cached = cachedModifiers.get(tag);
  if (cached) return cached;
  const total: Modifier = {};
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    for (const id of province.buildings) {
      const def = content.buildings.get(id);
      if (!def) continue;
      for (const [key, value] of Object.entries(def.modifiers)) {
        total[key] = (total[key] ?? 0) + value;
      }
    }
  }
  cachedModifiers.set(tag, total);
  return total;
}

export function startBuilding(
  state: GameState,
  content: ContentIndex,
  tag: string,
  provinceId: string,
  buildingId: string,
): boolean {
  const nation = state.countries[tag];
  const province = state.provinces[provinceId];
  const def = content.buildings.get(buildingId);
  const provinceDef = content.provinces.get(provinceId);
  if (!nation || !province || !def || !provinceDef) return false;
  if (province.controller !== tag) return false;
  if (province.building !== null) return false;
  if (province.buildings.includes(buildingId)) return false;
  if (def.terrain.length > 0 && !def.terrain.includes(provinceDef.terrain)) return false;
  if (nation.treasury < def.costSilver || nation.food < def.costFood) return false;
  nation.treasury -= def.costSilver;
  nation.food -= def.costFood;
  province.building = {
    id: buildingId,
    by: tag,
    daysLeft: def.days,
    totalDays: def.days,
  };
  state.log.push({
    day: state.day,
    category: 'economy',
    country: tag,
    text: `${provinceDef.name} 开始修建${def.name}（${def.days} 日，银 ${def.costSilver} / 粮 ${def.costFood}）`,
    severity: 'info',
  });
  return true;
}

export function advanceBuildings(state: GameState, content: ContentIndex): void {
  for (const province of Object.values(state.provinces)) {
    const building = province.building;
    if (!building) continue;
    if (province.controller !== building.by) {
      province.building = null;
      state.log.push({
        day: state.day,
        category: 'economy',
        country: building.by,
        text: `${content.provinces.get(province.id)?.name ?? province.id} 易手，${content.buildings.get(building.id)?.name ?? building.id} 停工`,
        severity: 'warning',
      });
      continue;
    }
    building.daysLeft -= 1;
    if (building.daysLeft > 0) continue;
    if (!province.buildings.includes(building.id)) province.buildings.push(building.id);
    province.building = null;
    invalidateBuildingCache();
    const def = content.buildings.get(building.id);
    state.log.push({
      day: state.day,
      category: 'economy',
      country: building.by,
      text: `${content.provinces.get(province.id)?.name ?? province.id} 建成${def?.name ?? building.id}`,
      severity: 'info',
    });
  }
}
