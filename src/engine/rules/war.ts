import type { ContentIndex } from '../../content/types';
import type { GameState, WarState } from '../state/types';
import { relationKey } from '../state/types';

export function areAtWar(state: GameState, a: string, b: string): boolean {
  return state.wars.some(war =>
    (war.attacker === a && war.defender === b)
    || (war.attacker === b && war.defender === a));
}

export function declareWar(
  state: GameState,
  attacker: string,
  defender: string,
  goal: string,
  content: ContentIndex,
): WarState | null {
  if (!content.countries.has(attacker) || !content.countries.has(defender)) return null;
  if (attacker === defender || areAtWar(state, attacker, defender)) return null;
  const war: WarState = {
    id: `war_${state.nextWarId}`,
    attacker,
    defender,
    startDay: state.day,
    warGoal: goal,
    exhaustion: { [attacker]: 0, [defender]: 0 },
  };
  state.nextWarId += 1;
  state.wars.push(war);
  state.relations[relationKey(attacker, defender)] = -80;
  const attackerName = content.countries.get(attacker)?.name ?? attacker;
  const defenderName = content.countries.get(defender)?.name ?? defender;
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    text: `${attackerName} 对 ${defenderName} 宣战（${goal || '无明确目标'}）`,
    severity: 'warning',
  });
  return war;
}

export function makePeace(state: GameState, warId: string, content: ContentIndex): boolean {
  const index = state.wars.findIndex(war => war.id === warId);
  if (index < 0) return false;
  const war = state.wars[index];
  if (!war) return false;
  state.wars.splice(index, 1);
  state.relations[relationKey(war.attacker, war.defender)] = -25;
  const attackerState = state.countries[war.attacker];
  const defenderState = state.countries[war.defender];
  if (attackerState) {
    attackerState.warExhaustion = 0;
    attackerState.ai.lastWarDay = state.day;
  }
  if (defenderState) {
    defenderState.warExhaustion = 0;
    defenderState.ai.lastWarDay = state.day;
  }
  let transferred = 0;
  for (const province of Object.values(state.provinces)) {
    if (province.owner === war.attacker && province.controller === war.defender) {
      province.owner = war.defender;
      province.controller = war.defender;
      if (!province.cores.includes(war.defender)) province.cores.push(war.defender);
      transferred += 1;
    } else if (province.owner === war.defender && province.controller === war.attacker) {
      province.owner = war.attacker;
      province.controller = war.attacker;
      if (!province.cores.includes(war.attacker)) province.cores.push(war.attacker);
      transferred += 1;
    }
  }
  const attackerName = content.countries.get(war.attacker)?.name ?? war.attacker;
  const defenderName = content.countries.get(war.defender)?.name ?? war.defender;
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    text: `${attackerName} 与 ${defenderName} 议和${transferred > 0 ? `，划界 ${transferred} 省` : ''}`,
    severity: 'info',
  });
  return true;
}

export function warsOf(state: GameState, tag: string): WarState[] {
  return state.wars.filter(war => war.attacker === tag || war.defender === tag);
}
