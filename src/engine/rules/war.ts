import type { ContentIndex } from '../../content/types';
import type { GameState, WarState } from '../state/types';
import { relationKey } from '../state/types';

export type PeaceTerms = 'white' | 'status' | 'demand';

export interface WarScore {
  attacker: number;
  defender: number;
  attackerOccupied: number;
  defenderOccupied: number;
}

export function areAtWar(state: GameState, a: string, b: string): boolean {
  return state.wars.some(war =>
    (war.attacker === a && war.defender === b)
    || (war.attacker === b && war.defender === a));
}

export function warScore(state: GameState, war: WarState): WarScore {
  let attacker = 0;
  let defender = 0;
  let attackerOccupied = 0;
  let defenderOccupied = 0;
  for (const province of Object.values(state.provinces)) {
    if (province.owner === war.defender && province.controller === war.attacker) {
      attacker += 1;
      attackerOccupied += 1;
    } else if (province.owner === war.attacker && province.controller === war.defender) {
      defender += 1;
      defenderOccupied += 1;
    }
  }
  return { attacker, defender, attackerOccupied, defenderOccupied };
}

export function truceDays(state: GameState, a: string, b: string): number {
  return Math.max(0, (state.truces[relationKey(a, b)] ?? 0) - state.day);
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
  if (state.vassals[defender] === attacker || state.vassals[attacker] === defender) return null;
  if (truceDays(state, attacker, defender) > 0) return null;
  const war: WarState = {
    id: `war_${state.nextWarId}`,
    attacker,
    defender,
    startDay: state.day,
    warGoal: goal,
    exhaustion: { [attacker]: 0, [defender]: 0 },
    casualties: { [attacker]: 0, [defender]: 0 },
    attrition: { [attacker]: 0, [defender]: 0 },
  };
  state.nextWarId += 1;
  state.wars.push(war);
  if (defender === state.playerTag && !state.spectator) {
    state.warAlerts.push({
      warId: war.id,
      attacker,
      defender,
      goal,
      day: state.day,
    });
  }
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

export function makePeace(
  state: GameState,
  warId: string,
  content: ContentIndex,
  terms: PeaceTerms = 'status',
  selectedProvinces?: readonly string[],
): boolean {
  const index = state.wars.findIndex(war => war.id === warId);
  if (index < 0) return false;
  const war = state.wars[index];
  if (!war) return false;
  const score = warScore(state, war);
  state.wars.splice(index, 1);
  state.relations[relationKey(war.attacker, war.defender)] = -25;
  state.truces[relationKey(war.attacker, war.defender)] = state.day + 365;
  state.warAlerts = state.warAlerts.filter(alert => alert.warId !== warId);
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
  let restored = 0;
  for (const province of Object.values(state.provinces)) {
    const atWarOccupation =
      (province.owner === war.attacker && province.controller === war.defender)
      || (province.owner === war.defender && province.controller === war.attacker);
    if (!atWarOccupation) continue;
    if (terms === 'white') {
      province.controller = province.owner;
      delete province.siege;
      restored += 1;
      continue;
    }
    if (selectedProvinces && !selectedProvinces.includes(province.id)) {
      province.controller = province.owner;
      delete province.siege;
      restored += 1;
      continue;
    }
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

  let reparations = 0;
  if (terms === 'demand' && score.attacker !== score.defender) {
    const winner = score.attacker > score.defender ? war.attacker : war.defender;
    const loser = winner === war.attacker ? war.defender : war.attacker;
    const winnerState = state.countries[winner];
    const loserState = state.countries[loser];
    if (winnerState && loserState && loserState.treasury > 0) {
      reparations = Math.round(Math.min(loserState.treasury * 0.2, 500000));
      loserState.treasury -= reparations;
      winnerState.treasury += reparations;
    }
  }

  for (const tag of [war.attacker, war.defender]) {
    const nation = state.countries[tag];
    if (!nation) continue;
    const hasProvince = Object.values(state.provinces).some(province => province.owner === tag);
    if (!hasProvince) {
      nation.alive = false;
      for (const army of Object.values(state.armies)) {
        if (army.tag === tag) delete state.armies[army.id];
      }
      continue;
    }
    const capital = state.provinces[nation.capital];
    const fallback = Object.values(state.provinces).find(province =>
      province.owner === tag || province.controller === tag);
    const home = capital && (capital.owner === tag || capital.controller === tag)
      ? capital.id
      : fallback?.id;
    if (!home) continue;
    for (const army of Object.values(state.armies)) {
      if (army.tag !== tag) continue;
      const province = state.provinces[army.province];
      if (province && (province.owner === tag || province.controller === tag)) continue;
      army.province = home;
      army.movePath = [];
      army.moveProgress = 0;
      army.stance = 'hold';
      army.entrenchment = 0;
      army.history = [home];
      state.log.push({
        day: state.day,
        category: 'military',
        country: tag,
        text: `${army.name} 和谈后撤回国都 ${content.provinces.get(home)?.name ?? home}`,
        severity: 'info',
      });
    }
  }

  const attackerName = content.countries.get(war.attacker)?.name ?? war.attacker;
  const defenderName = content.countries.get(war.defender)?.name ?? war.defender;
  const termLabel = terms === 'white' ? '白和' : terms === 'demand' ? '强制议和' : '按现状议和';
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    text: `${attackerName} 与 ${defenderName} ${termLabel}${transferred > 0 ? `，割让 ${transferred} 地区` : ''}${restored > 0 ? `，归还 ${restored} 地区` : ''}${reparations > 0 ? `，赔款 ${reparations} 两` : ''}`,
    severity: 'info',
  });
  return true;
}

export function warsOf(state: GameState, tag: string): WarState[] {
  return state.wars.filter(war => war.attacker === tag || war.defender === tag);
}

export function surrenderTendency(state: GameState, war: WarState, tag: string): number {
  const score = warScore(state, war);
  const mine = tag === war.attacker ? score.attacker : score.defender;
  const enemy = tag === war.attacker ? score.defender : score.attacker;
  const country = state.countries[tag];
  if (!country) return 50;
  const exhaustion = country.warExhaustion;
  const capital = state.provinces[country.capital];
  const capitalLost = capital ? capital.controller !== tag : false;
  const armies = Object.values(state.armies).filter(army => army.tag === tag).length;
  const raw = 42 - (mine - enemy) * 7 + exhaustion * 0.45 + (capitalLost ? 28 : 0) + (armies <= 1 ? 10 : 0);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

