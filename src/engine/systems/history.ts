import type { ContentIndex } from '../../content/types';
import { fromDayIndex } from '../core/clock';
import type { GameState } from '../state/types';

interface RegionAssignment {
  target: string;
  regions: string[];
}

interface Milestone {
  key: string;
  year: number;
  assignments: RegionAssignment[];
  purge?: string[];
}

const MILESTONES: Record<string, Milestone[]> = {
  '1627': [
    {
      key: 'history_1644',
      purge: ['MING'],
      year: 1644,
      assignments: [
        { target: 'QING', regions: ['reg_beizhili', 'reg_shandong', 'reg_liaodong', 'reg_xuanda', 'reg_hexi'] },
        { target: 'SHUN', regions: ['reg_shaanxi', 'reg_henan', 'reg_shanxi'] },
        { target: 'XI', regions: ['reg_sichuan'] },
        { target: 'ZHENG', regions: ['reg_taiwan'] },
        { target: 'SMING', regions: ['reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_fujian', 'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou'] },
      ],
    },
    {
      key: 'history_1650',
      purge: ['SHUN'],
      year: 1650,
      assignments: [
        { target: 'QING', regions: ['reg_shaanxi', 'reg_henan', 'reg_shanxi', 'reg_beizhili', 'reg_shandong', 'reg_liaodong', 'reg_xuanda', 'reg_hexi', 'reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_fujian', 'reg_guangdong'] },
      ],
    },
    {
      key: 'history_1662',
      purge: ['SMING', 'XI'],
      year: 1662,
      assignments: [
        { target: 'QING', regions: ['reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_sichuan', 'reg_fujian', 'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou'] },
      ],
    },
    {
      key: 'history_1683',
      purge: ['ZHENG'],
      year: 1683,
      assignments: [
        { target: 'QING', regions: ['reg_fujian'] },
      ],
    },
  ],
  '1644': [
    {
      key: 'history_1644',
      purge: ['MING'],
      year: 1644,
      assignments: [
        { target: 'QING', regions: ['reg_beizhili', 'reg_shandong', 'reg_liaodong', 'reg_xuanda', 'reg_hexi'] },
        { target: 'SHUN', regions: ['reg_shaanxi', 'reg_henan', 'reg_shanxi'] },
        { target: 'XI', regions: ['reg_sichuan'] },
        { target: 'ZHENG', regions: ['reg_taiwan'] },
        { target: 'SMING', regions: ['reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_fujian', 'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou'] },
      ],
    },
    {
      key: 'history_1650',
      purge: ['SHUN'],
      year: 1650,
      assignments: [
        { target: 'QING', regions: ['reg_shaanxi', 'reg_henan', 'reg_shanxi', 'reg_beizhili', 'reg_shandong', 'reg_liaodong', 'reg_xuanda', 'reg_hexi', 'reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_fujian', 'reg_guangdong'] },
      ],
    },
    {
      key: 'history_1662',
      purge: ['SMING', 'XI'],
      year: 1662,
      assignments: [
        { target: 'QING', regions: ['reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_sichuan', 'reg_fujian', 'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou'] },
      ],
    },
    {
      key: 'history_1683',
      purge: ['ZHENG'],
      year: 1683,
      assignments: [
        { target: 'QING', regions: ['reg_fujian'] },
      ],
    },
  ],
  '1650': [
    {
      key: 'history_1650',
      purge: ['SHUN'],
      year: 1650,
      assignments: [
        { target: 'QING', regions: ['reg_shaanxi', 'reg_henan', 'reg_shanxi', 'reg_beizhili', 'reg_shandong', 'reg_liaodong', 'reg_xuanda', 'reg_hexi', 'reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_fujian', 'reg_guangdong'] },
      ],
    },
    {
      key: 'history_1662',
      purge: ['SMING', 'XI'],
      year: 1662,
      assignments: [
        { target: 'QING', regions: ['reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_sichuan', 'reg_fujian', 'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou'] },
      ],
    },
    {
      key: 'history_1683',
      purge: ['ZHENG'],
      year: 1683,
      assignments: [
        { target: 'QING', regions: ['reg_fujian'] },
      ],
    },
  ],
};

function transferProvince(state: GameState, content: ContentIndex, provinceId: string, target: string): boolean {
  const province = state.provinces[provinceId];
  const def = content.provinces.get(provinceId);
  const country = state.countries[target];
  if (!province || !def || !country) return false;
  if (!state.spectator && (province.owner === state.playerTag || province.controller === state.playerTag)) {
    return false;
  }
  if (province.owner === target && province.controller === target) return false;
  province.owner = target;
  province.controller = target;
  province.occupation = null;
  delete province.siege;
  country.alive = true;
  return true;
}

function cleanupNation(state: GameState, tag: string): void {
  const nation = state.countries[tag];
  if (!nation || !nation.alive) return;
  if (state.spectator || tag !== state.playerTag) {
    const owned = Object.values(state.provinces).some(province => province.owner === tag);
    if (!owned) {
      nation.alive = false;
      for (const [id, army] of Object.entries(state.armies)) {
        if (army.tag === tag) delete state.armies[id];
      }
      state.training = state.training.filter(item => item.tag !== tag);
    }
  }
}

function strengthenQing(state: GameState): void {
  const qing = state.countries['QING'];
  if (!qing) return;
  qing.treasury = Math.max(qing.treasury, 250000);
  qing.manpower = Math.max(qing.manpower, 120000);
  qing.food = Math.max(qing.food, 200000);
  qing.stability = Math.max(qing.stability, 60);
  qing.armyLoyalty = Math.max(qing.armyLoyalty, 70);
}
export function applyHistoricalTimeline(state: GameState, content: ContentIndex): void {
  const milestones = MILESTONES[state.scenarioId];
  if (!milestones || state.ended) return;
  const currentYear = fromDayIndex(state.day).year;
  for (const milestone of milestones) {
    if (currentYear < milestone.year || state.firedEvents[milestone.key] !== undefined) continue;
    let changed = false;
    for (const assignment of milestone.assignments) {
      for (const province of Object.values(state.provinces)) {
        const def = content.provinces.get(province.id);
        if (!def || !assignment.regions.includes(def.regionId)) continue;
        if (transferProvince(state, content, province.id, assignment.target)) changed = true;
      }
    }
    for (const tag of milestone.purge ?? []) {
      for (const province of Object.values(state.provinces)) {
        if (province.owner !== tag && province.controller !== tag) continue;
        if (transferProvince(state, content, province.id, 'QING')) changed = true;
      }
    }
    if (milestone.key === 'history_1644' || milestone.key === 'history_1650' || milestone.key === 'history_1662') {
      strengthenQing(state);
    }
    state.firedEvents[milestone.key] = state.day;
    if (changed) {
      for (const tag of ['MING', 'SHUN', 'XI', 'SMING', 'ZHENG']) cleanupNation(state, tag);
      state.wars = state.wars.filter(war =>
        Boolean(state.countries[war.attacker]?.alive) && Boolean(state.countries[war.defender]?.alive));
      state.log.push({
        day: state.day,
        category: 'politics',
        country: 'QING',
        text: `历史转折：${milestone.year} 年局势重划`,
        severity: 'info',
      });
    }
  }
  if ((state.scenarioId === '1627' || state.scenarioId === '1644') && currentYear >= 1644 && currentYear < 1650) {
    for (const province of Object.values(state.provinces)) {
      const def = content.provinces.get(province.id);
      if (!def || !['reg_beizhili', 'reg_shandong', 'reg_liaodong', 'reg_xuanda', 'reg_hexi'].includes(def.regionId)) continue;
      transferProvince(state, content, province.id, 'QING');
    }
  }
  if (state.scenarioId === '1650' && currentYear >= 1650 && currentYear < 1683) {
    const zheng = state.countries['ZHENG'];
    if (zheng && !zheng.alive) zheng.alive = true;
    for (const province of Object.values(state.provinces)) {
      const def = content.provinces.get(province.id);
      if (def?.regionId !== 'reg_taiwan') continue;
      transferProvince(state, content, province.id, 'ZHENG');
    }
  }
}






