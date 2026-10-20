/**
 * 五阶级迁移验收探针：3 剧本 × 12 个月。
 * 检查阶级键、阶级数量、分配总额、报告键与数值健康。
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { chooseEventOption } from '../../src/engine/systems/events';
import type { GameState } from '../../src/engine/state/types';

const content = loadContentFromDirectory();
const FIXED = new Set(['ruling', 'merchants', 'landlords', 'artisans', 'peasants']);
const problems: string[] = [];

function resolvePlayerEvents(state: GameState): void {
  for (let guard = 0; guard < 8; guard += 1) {
    const pending = state.pendingEvents.find(event => event.country === state.playerTag);
    if (!pending) return;
    const event = content.events.get(pending.eventId);
    if (!event) {
      state.pendingEvents = state.pendingEvents.filter(entry => entry !== pending);
      continue;
    }
    const option = event.options.find(entry => entry.id === event.aiChoice) ?? event.options[0];
    if (!option) return;
    chooseEventOption(state, content, event.id, option.id);
  }
}

for (const scenario of ['1627', '1644', '1650']) {
  const state = createInitialState(content, scenario, 42, 'MING');
  for (let day = 0; day < 360; day += 1) {
    advanceDay(state, content);
    resolvePlayerEvents(state);
  }
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const keys = Object.keys(nation.estates);
    if (keys.length < 3 || keys.length > 5) {
      problems.push(`${scenario} ${nation.tag}: ${keys.length} estates (${keys.join(',')})`);
    }
    for (const key of keys) {
      if (!FIXED.has(key) && !key.startsWith('custom:')) {
        problems.push(`${scenario} ${nation.tag}: unknown estate ${key}`);
      }
    }
    const allocTotal = Object.values(nation.allocation).reduce((sum, value) => sum + value, 0);
    if (Math.abs(allocTotal - 100) > 0.51) {
      problems.push(`${scenario} ${nation.tag}: allocation sums ${allocTotal.toFixed(2)}`);
    }
    for (const key of Object.keys(nation.allocation)) {
      if (!nation.estates[key]) problems.push(`${scenario} ${nation.tag}: allocation key ${key} has no estate`);
    }
    const report = nation.lastReport;
    if (report) {
      for (const key of Object.keys(report.taxByEstate ?? {})) {
        if (!nation.estates[key]) problems.push(`${scenario} ${nation.tag}: report key ${key} has no estate`);
      }
      if (!Number.isFinite(report.net) || !Number.isFinite(report.income)) {
        problems.push(`${scenario} ${nation.tag}: non-finite report`);
      }
    }
  }
  const ming = state.countries['MING'];
  const report = ming?.lastReport;
  if (ming && report) {
    console.log(`${scenario} MING: treasury=${Math.round(ming.treasury)} arrears=${Math.round(ming.arrears)}`
      + ` corruption=${ming.corruption.toFixed(1)} stability=${ming.stability.toFixed(1)}`
      + ` income=${Math.round(report.income)} net=${Math.round(report.net)}`
      + ` estates=${Object.keys(ming.estates).join('/')}`);
  }
}

if (problems.length > 0) {
  console.error(`five-estate probe FAILED (${problems.length})`);
  for (const problem of problems.slice(0, 40)) console.error(` - ${problem}`);
  process.exit(1);
}
console.log('five-estate probe: ok');
