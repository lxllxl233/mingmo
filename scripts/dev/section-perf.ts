/**
 * 分段计时：复刻 advanceDay 的调用顺序，定位多个模拟之间变慢的系统。
 * 仅用于性能诊断，不参与游戏逻辑。
 */
import { performance } from 'node:perf_hooks';
import { constants, setPriority } from 'node:os';
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { LAST_DAY_INDEX, isMonthStart } from '../../src/engine/core/clock';
import { advanceArmies, cleanupEmptyArmies, replenishArmies } from '../../src/engine/systems/military';
import { advanceCoreIntegration } from '../../src/engine/systems/core';
import { advanceCrisis } from '../../src/engine/systems/crisis';
import { maybeFoundSouthernMing } from '../../src/engine/systems/southernMing';
import { advanceTraining } from '../../src/engine/systems/training';
import { advanceBuildings } from '../../src/engine/systems/buildings';
import { advanceFocus } from '../../src/engine/systems/focus';
import { advanceResearch } from '../../src/engine/systems/research';
import { advanceTaxReforms } from '../../src/engine/systems/tax';
import { processEvents } from '../../src/engine/systems/events';
import { runMonthlyEconomy } from '../../src/engine/systems/economy';
import { runMonthlyPolitics } from '../../src/engine/systems/politics';
import { runMonthlyAi } from '../../src/engine/systems/ai';
import { evaluateVictory } from '../../src/engine/victory';
import { cleanupDefeatedNations, resolveCapitalCapitulation, resolveFinishedWars } from '../../src/engine/rules/war';
import type { ContentIndex } from '../../src/content/types';
import type { GameState, TimedModifier } from '../../src/engine/state/types';

try {
  setPriority(process.pid, constants.priority.PRIORITY_HIGH);
} catch {
  // 无权限时保持默认优先级。
}

const content: ContentIndex = loadContentFromDirectory();
const labels = [
  'tax', 'focus', 'research', 'armies', 'cleanupArmies', 'replenish', 'core', 'buildings',
  'crisis', 'training', 'events', 'monthlySouthern', 'monthlyEconomy', 'monthlyPolitics',
  'warExhaustion', 'monthlyAi', 'timedModifiers', 'alive', 'capital', 'finishedWars', 'defeated',
] as const;
type Label = typeof labels[number];

function ageModifiers(modifiers: TimedModifier[], day: number): void {
  let write = 0;
  for (let read = 0; read < modifiers.length; read += 1) {
    const modifier = modifiers[read];
    if (!modifier) continue;
    if (modifier.addedDay !== day) {
      modifier.daysLeft -= 1;
      if (modifier.daysLeft <= 0) continue;
    }
    modifiers[write] = modifier;
    write += 1;
  }
  modifiers.length = write;
}

function updateTimedModifiers(state: GameState): void {
  for (const nation of Object.values(state.countries)) ageModifiers(nation.timedModifiers, state.day);
  for (const province of Object.values(state.provinces)) {
    if (province.modifiers.length === 0) continue;
    ageModifiers(province.modifiers, state.day);
  }
}

function updateWarExhaustion(state: GameState): void {
  for (const war of state.wars) {
    for (const tag of [war.attacker, war.defender]) {
      const casualtyPressure = Math.min(1.5, (war.casualties[tag] ?? 0) / 20000);
      war.exhaustion[tag] = Math.min(100, (war.exhaustion[tag] ?? 0) + 1.5 + casualtyPressure);
    }
  }
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const atWar = state.wars.filter(war => war.attacker === nation.tag || war.defender === nation.tag);
    const target = atWar.length === 0
      ? Math.max(0, nation.warExhaustion - 2)
      : Math.max(...atWar.map(war => war.exhaustion[nation.tag] ?? 0));
    nation.warExhaustion = Math.min(100, target);
  }
}

function updateAlive(state: GameState): void {
  const owners = new Set<string>();
  for (const province of Object.values(state.provinces)) owners.add(province.owner);
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    if (!owners.has(nation.tag)) nation.alive = false;
  }
}

const timings = new Map<Label, number>();
function time<T>(label: Label, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  timings.set(label, (timings.get(label) ?? 0) + (performance.now() - start));
  return result;
}

for (let run = 0; run < 3; run += 1) {
  const state = createInitialState(content, '1627', 42, 'MING', 'normal', true);
  timings.clear();
  const start = performance.now();
  for (let day = 0; day < 365 * 5 && !state.ended; day += 1) {
    if (state.day >= LAST_DAY_INDEX) break;
    state.day += 1;
    time('tax', () => advanceTaxReforms(state, content));
    time('focus', () => advanceFocus(state, content));
    time('research', () => advanceResearch(state, content));
    time('armies', () => advanceArmies(state, content));
    time('cleanupArmies', () => cleanupEmptyArmies(state));
    time('replenish', () => replenishArmies(state, content));
    time('core', () => advanceCoreIntegration(state, content));
    time('buildings', () => advanceBuildings(state, content));
    time('crisis', () => advanceCrisis(state, content));
    time('training', () => advanceTraining(state, content));
    time('events', () => processEvents(state, content));
    if (isMonthStart(state.day)) {
      time('monthlySouthern', () => maybeFoundSouthernMing(state, content));
      time('monthlyEconomy', () => runMonthlyEconomy(state, content));
      time('monthlyPolitics', () => runMonthlyPolitics(state, content));
      time('warExhaustion', () => updateWarExhaustion(state));
      time('monthlyAi', () => runMonthlyAi(state, content));
    }
    time('timedModifiers', () => updateTimedModifiers(state));
    time('alive', () => updateAlive(state));
    time('capital', () => resolveCapitalCapitulation(state, content));
    time('finishedWars', () => resolveFinishedWars(state, content));
    time('defeated', () => cleanupDefeatedNations(state, content));
    if (state.day >= LAST_DAY_INDEX) evaluateVictory(state, content);
    if (state.log.length > 800) state.log.splice(0, state.log.length - 800);
  }
  const elapsed = performance.now() - start;
  const parts = labels.map(label => `${label}=${((timings.get(label) ?? 0) / 1825).toFixed(3)}`);
  console.log(`run${run} perDay=${(elapsed / 1825).toFixed(2)} | ${parts.join(' ')}`);
}
