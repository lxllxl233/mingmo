import type { ContentIndex } from '../content/types';
import { LAST_DAY_INDEX, isMonthStart, isQuarterStart, isYearStart } from './core/clock';
import { advanceArmies, cleanupEmptyArmies, replenishArmies } from './systems/military';
import { advanceCoreIntegration } from './systems/core';
import { advanceCrisis } from './systems/crisis';
import { maybeFoundSouthernMing } from './systems/southernMing';
import { advanceTraining } from './systems/training';
import { advanceBuildings } from './systems/buildings';
import { advanceFocus } from './systems/focus';
import { advanceResearch } from './systems/research';
import { advanceTaxReforms } from './systems/tax';
import { processEvents } from './systems/events';
import { runMonthlyEconomy } from './systems/economy';
import { runMonthlyPolitics } from './systems/politics';
import { runMonthlyAi } from './systems/ai';
import { evaluateVictory } from './victory';
import { cleanupDefeatedNations, resolveCapitalCapitulation, resolveFinishedWars } from './rules/war';
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
  advanceBuildings(state, content);
  advanceCrisis(state, content);
  advanceTraining(state, content);
  processEvents(state, content);

  if (isMonthStart(state.day)) {
    maybeFoundSouthernMing(state, content);
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
  resolveCapitalCapitulation(state, content);
  resolveFinishedWars(state, content);
  cleanupDefeatedNations(state, content);
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




