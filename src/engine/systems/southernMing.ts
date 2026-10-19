import type { ContentIndex } from '../../content/types';
import { fromDayIndex } from '../core/clock';
import type { GameState } from '../state/types';
import { touchMap } from '../state/types';

/**
 * 南明建立：1644 年北京失守后，若玩家不是大明，AI 大明在南方的领土由南明继承。
 *
 * 这不是「传送玩家土地」：玩家选大明时不会触发；选清/顺等势力时，AI 大明的崩溃
 * 才会产生南明。这样既保留历史走向，也不破坏同剧本同世界的一致性。
 */
const SOUTHERN_REGIONS = new Set([
  'reg_nanzhili',
  'reg_zhejiang',
  'reg_jiangxi',
  'reg_huguang',
  'reg_fujian',
  'reg_guangdong',
  'reg_guangxi',
  'reg_yunnan',
  'reg_guizhou',
]);

export function maybeFoundSouthernMing(state: GameState, content: ContentIndex): void {
  if (state.scenarioId !== '1627' && state.scenarioId !== '1644') return;
  const sming = state.countries['SMING'];
  const ming = state.countries['MING'];
  if (!sming || !ming || sming.alive || !ming.alive) return;
  if (!state.spectator && state.playerTag === 'MING') return;
  if (fromDayIndex(state.day).year < 1644) return;
  const beijing = state.provinces['beijing'];
  if (beijing && beijing.controller === 'MING') return;

  // 只继承大明自有的南方省份；占领中的第三方领地不随南明建立而转移。
  const southern = Object.values(state.provinces).filter(province => {
    if (province.owner !== 'MING' || province.controller !== 'MING') return false;
    const def = content.provinces.get(province.id);
    return def !== undefined && SOUTHERN_REGIONS.has(def.regionId);
  });
  if (southern.length === 0) return;

  for (const province of southern) {
    province.owner = 'SMING';
    province.controller = 'SMING';
    province.occupation = null;
    delete province.siege;
    if (!province.cores.includes('SMING')) province.cores.push('SMING');
  }
  sming.alive = true;
  const nanjing = state.provinces['nanjing'];
  sming.capital = nanjing && nanjing.owner === 'SMING' && nanjing.controller === 'SMING'
    ? 'nanjing'
    : southern[0]!.id;
  touchMap(state);
  sming.treasury = Math.max(sming.treasury, 150000);
  sming.food = Math.max(sming.food, 200000);
  sming.manpower = Math.max(sming.manpower, 40000);
  sming.stability = Math.max(sming.stability, 35);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: 'SMING',
    text: `北京失守，南京诸臣拥立新君，南明继承南方 ${southern.length} 个地区`,
    severity: 'info',
  });
}
