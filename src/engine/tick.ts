import type { ContentIndex } from '../content/types';
import { LAST_DAY_INDEX, isMonthStart, isQuarterStart, isYearStart } from './core/clock';
import { advanceArmies, cleanupEmptyArmies, replenishArmies } from './systems/military';
import { advanceCoreIntegration } from './systems/core';
import { advanceTraining } from './systems/training';
import { advanceFocus } from './systems/focus';
import { advanceResearch } from './systems/research';
import { advanceTaxReforms } from './systems/tax';
import { processEvents } from './systems/events';
import { runMonthlyEconomy } from './systems/economy';
import { runMonthlyPolitics } from './systems/politics';
import { runMonthlyAi } from './systems/ai';
import { evaluateVictory } from './victory';
import type { GameState } from './state/types';

function updateTimedModifiers(state: GameState): void {
  for (const nation of Object.values(state.countries)) {
    nation.timedModifiers = nation.timedModifiers.filter(modifier => {
      modifier.daysLeft -= 1;
      return modifier.daysLeft > 0;
    });
  }
  for (const province of Object.values(state.provinces)) {
    province.modifiers = province.modifiers.filter(modifier => {
      modifier.daysLeft -= 1;
      return modifier.daysLeft > 0;
    });
  }
}

function updateWarExhaustion(state: GameState): void {
  for (const war of state.wars) {
    war.exhaustion[war.attacker] = Math.min(100, (war.exhaustion[war.attacker] ?? 0) + 1.2);
    war.exhaustion[war.defender] = Math.min(100, (war.exhaustion[war.defender] ?? 0) + 1.2);
    const attacker = state.countries[war.attacker];
    const defender = state.countries[war.defender];
    if (attacker) attacker.warExhaustion = Math.min(100, attacker.warExhaustion + 1.2);
    if (defender) defender.warExhaustion = Math.min(100, defender.warExhaustion + 1.2);
  }
}

function updateAlive(state: GameState, content: ContentIndex): void {
  const owners = new Set<string>();
  for (const province of Object.values(state.provinces)) owners.add(province.owner);
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    if (!owners.has(nation.tag)) {
      nation.alive = false;
      state.log.push({
        day: state.day,
        category: 'politics',
        country: nation.tag,
        text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 灭亡`,
        severity: 'danger',
      });
    }
  }
}

export function advanceDay(state: GameState, content: ContentIndex): GameState {
  if (state.ended) return state;
  if (state.day >= LAST_DAY_INDEX) {
    state.ended = true;
    return state;
  }
  state.day += 1;

  advanceTaxReforms(state, content);
  advanceFocus(state, content);
  advanceResearch(state, content);
  advanceArmies(state, content);
  cleanupEmptyArmies(state);
  replenishArmies(state, content);
  advanceCoreIntegration(state, content);
  advanceTraining(state, content);
  processEvents(state, content);

  if (isMonthStart(state.day)) {
    runMonthlyEconomy(state, content);
    runMonthlyPolitics(state, content);
    updateWarExhaustion(state);
    runMonthlyAi(state, content);
  }
  if (isQuarterStart(state.day)) {
    // 季度系统预留给灾荒与外交重算。
  }
  if (isYearStart(state.day)) {
    // 年度计分与自动存档由 UI 处理。
  }

  updateTimedModifiers(state);
  updateAlive(state, content);
  const player = state.countries[state.playerTag];
  if (isYearStart(state.day) || state.day >= LAST_DAY_INDEX || !player?.alive) {
    const result = evaluateVictory(state, content);
    if (state.spectator) {
      if (state.day >= LAST_DAY_INDEX) {
        state.victory = result;
        state.ended = true;
      }
    } else if (state.day >= LAST_DAY_INDEX
      || !player?.alive
      || result.reason === '一统天下'
      || result.reason === '承天受命') {
      state.victory = result;
      state.ended = true;
    }
  }
  if (state.log.length > 800) state.log.splice(0, state.log.length - 800);
  if (state.day >= LAST_DAY_INDEX && !state.victory) {
    state.victory = evaluateVictory(state, content);
    state.ended = true;
  }
  return state;
}
