import type { ContentIndex } from '../../content/types';
import type { GameState } from '../state/types';

export const CORE_INTEGRATION_DAYS = 360;
export const CORE_INTEGRATION_SILVER = 30000;
export const CORE_INTEGRATION_FOOD = 12000;

export function canStartCoreIntegration(state: GameState, tag: string, provinceId: string): boolean {
  const province = state.provinces[provinceId];
  if (!province || province.controller !== tag) return false;
  if (province.cores.includes(tag)) return false;
  if (province.coreWork) return false;
  const nation = state.countries[tag];
  return Boolean(nation?.alive);
}

export function startCoreIntegration(state: GameState, tag: string, provinceId: string): boolean {
  if (!canStartCoreIntegration(state, tag, provinceId)) return false;
  const nation = state.countries[tag];
  const province = state.provinces[provinceId];
  if (!nation || !province) return false;
  if (nation.treasury < CORE_INTEGRATION_SILVER || nation.food < CORE_INTEGRATION_FOOD) return false;
  nation.treasury -= CORE_INTEGRATION_SILVER;
  nation.food -= CORE_INTEGRATION_FOOD;
  province.coreWork = {
    country: tag,
    progress: 0,
    totalDays: CORE_INTEGRATION_DAYS,
  };
  return true;
}

export function advanceCoreIntegration(state: GameState, content: ContentIndex): void {
  for (const province of Object.values(state.provinces)) {
    const work = province.coreWork;
    if (!work) continue;
    if (province.controller !== work.country) {
      province.coreWork = null;
      continue;
    }
    work.progress += 1;
    if (work.progress < work.totalDays) continue;
    if (!province.cores.includes(work.country)) province.cores.push(work.country);
    province.coreWork = null;
    const name = content.provinces.get(province.id)?.name ?? province.id;
    state.log.push({
      day: state.day,
      category: 'politics',
      country: work.country,
      text: `${name} 完成核心化：当地开始提供完整人力与资源`,
      severity: 'info',
    });
  }
}
