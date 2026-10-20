/**
 * Phase C 验收探针：把分配极端压向单一阶级，观察是否出现不同失败模式，
 * 以及是否存在「全压某一阶级」的长期最优解。
 *
 * 用法：npx tsx scripts/dev/probe-allocation-extremes.ts
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { formatDate } from '../../src/engine/core/clock';
import type { GameState } from '../../src/engine/state/types';

const content = loadContentFromDirectory();
const targets = ['peasants', 'merchants', 'ruling'] as const;

function pushAllocation(state: GameState, target: string): void {
  const nation = state.countries['MING'];
  if (!nation) return;
  for (const key of Object.keys(nation.estates)) {
    nation.allocation[key] = key === target ? 100 : 0;
  }
}

for (const target of targets) {
  const state = createInitialState(content, '1627', 42, 'MING', 'normal', true);
  const rows: string[] = [];
  for (let day = 0; day < 365 * 12 && !state.ended; day += 1) {
    pushAllocation(state, target);
    advanceDay(state, content);
    const nation = state.countries['MING'];
    if (!nation?.alive) break;
    if (state.day % 365 === 0) {
      const report = nation.lastReport;
      const provinces = Object.values(state.provinces).filter(province => province.controller === 'MING');
      const avgUnrest = provinces.length > 0
        ? provinces.reduce((sum, province) => sum + province.unrest, 0) / provinces.length
        : 0;
      rows.push(`${formatDate(state.day)} prov=${provinces.length} treasury=${Math.round(nation.treasury)} arrears=${Math.round(nation.arrears)} corruption=${nation.corruption.toFixed(0)} stability=${nation.stability.toFixed(0)} bottom=${(report?.bottomLoyalty ?? 0).toFixed(0)} loyaltyCost=${Math.round(report?.loyaltyCost ?? 0)} income=${Math.round(report?.income ?? 0)} net=${Math.round(report?.net ?? 0)} unrest=${avgUnrest.toFixed(0)} famine=${nation.flags['food_shortage'] === true ? 'Y' : 'N'}`);
    }
  }
  const ming = state.countries['MING'];
  console.log(`\n=== all-in ${target} ===`);
  console.log(rows.join('\n'));
  console.log(`alive=${ming?.alive ?? false} years=${(state.day / 365).toFixed(1)}`
    + ` corruption=${ming?.corruption.toFixed(1)} stability=${ming?.stability.toFixed(1)}`
    + ` treasury=${Math.round(ming?.treasury ?? 0)} arrears=${Math.round(ming?.arrears ?? 0)}`);
}
