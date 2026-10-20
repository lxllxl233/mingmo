import type { ContentIndex } from '../../content/types';
import type { GameState, WarState } from '../state/types';
import { relationKey, touchMap } from '../state/types';
import { alliesOf, areAllied, hasMilitaryAccess } from './diplomacy';

export type PeaceTerms = 'white' | 'status' | 'demand';

export interface WarScore {
  attacker: number;
  defender: number;
  attackerOccupied: number;
  defenderOccupied: number;
}

interface WarPairCache {
  state: GameState | null;
  day: number;
  length: number;
  nextWarId: number;
  pairs: Set<string>;
}

let warPairCache: WarPairCache | null = null;

function warPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function areAtWar(state: GameState, a: string, b: string): boolean {
  if (a === b) return false;
  if (warPairCache === null
    || warPairCache.state !== state
    || warPairCache.day !== state.day
    || warPairCache.length !== state.wars.length
    || warPairCache.nextWarId !== state.nextWarId) {
    const pairs = new Set<string>();
    for (const war of state.wars) pairs.add(warPairKey(war.attacker, war.defender));
    warPairCache = { state, day: state.day, length: state.wars.length, nextWarId: state.nextWarId, pairs };
  }
  return warPairCache.pairs.has(warPairKey(a, b));
}

let occupancyCache: { state: GameState; day: number; revision: number; counts: Map<string, number> } | null = null;

/** 占领对索引：`controller|owner` → 省数。按 day + mapRevision 缓存，多处战争查询复用。 */
function occupancyCounts(state: GameState): Map<string, number> {
  if (occupancyCache === null
    || occupancyCache.state !== state
    || occupancyCache.day !== state.day
    || occupancyCache.revision !== state.mapRevision) {
    const counts = new Map<string, number>();
    for (const id in state.provinces) {
      const province = state.provinces[id];
      if (!province || province.controller === province.owner) continue;
      const key = `${province.controller}|${province.owner}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    occupancyCache = { state, day: state.day, revision: state.mapRevision, counts };
  }
  return occupancyCache.counts;
}

export function warScore(state: GameState, war: WarState): WarScore {
  const counts = occupancyCounts(state);
  const attackerOccupied = counts.get(`${war.attacker}|${war.defender}`) ?? 0;
  const defenderOccupied = counts.get(`${war.defender}|${war.attacker}`) ?? 0;
  return {
    attacker: attackerOccupied,
    defender: defenderOccupied,
    attackerOccupied,
    defenderOccupied,
  };
}

export function truceDays(state: GameState, a: string, b: string): number {
  return Math.max(0, (state.truces[relationKey(a, b)] ?? 0) - state.day);
}

function createWar(
  state: GameState,
  attacker: string,
  defender: string,
  goal: string,
  content: ContentIndex,
): WarState | null {
  if (!content.countries.has(attacker) || !content.countries.has(defender)) return null;
  if (!state.countries[attacker]?.alive || !state.countries[defender]?.alive) return null;
  if (attacker === defender || areAtWar(state, attacker, defender)) return null;
  if (areAllied(state, attacker, defender)) return null;
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
  // 记仇：被宣战方（及其被拖入的盟友）对侵略者累积怨气，供 AI 优先报复用。
  const grudged = state.countries[defender];
  if (grudged) {
    grudged.grudges[attacker] = Math.min(100, (grudged.grudges[attacker] ?? 0) + 60);
  }
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

export function declareWar(
  state: GameState,
  attacker: string,
  defender: string,
  goal: string,
  content: ContentIndex,
): WarState | null {
  const war = createWar(state, attacker, defender, goal, content);
  if (!war) return null;
  for (const ally of alliesOf(state, defender)) {
    if (ally === attacker || ally === 'JAPAN' || areAllied(state, ally, attacker)) continue;
    if (areAtWar(state, attacker, ally)) continue;
    createWar(state, attacker, ally, '同盟义务', content);
  }
  return war;
}

function relocateCapital(state: GameState, tag: string): void {
  const nation = state.countries[tag];
  if (!nation || !nation.alive) return;
  const capital = state.provinces[nation.capital];
  if (capital && capital.owner === tag && capital.controller === tag) return;
  const candidate = Object.values(state.provinces).find(province =>
    province.owner === tag && province.controller === tag);
  if (candidate) nation.capital = candidate.id;
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
  state.peaceOffers = state.peaceOffers.filter(offer => offer.warId !== warId);
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
  let mapChanged = false;
  const attackerAlive = state.countries[war.attacker]?.alive ?? false;
  const defenderAlive = state.countries[war.defender]?.alive ?? false;
  for (const province of Object.values(state.provinces)) {
    const attackerOccupies = province.owner === war.defender && province.controller === war.attacker;
    const defenderOccupies = province.owner === war.attacker && province.controller === war.defender;
    if (!attackerOccupies && !defenderOccupies) continue;
    mapChanged = true;
    const recipient = attackerOccupies ? war.attacker : war.defender;
    const recipientAlive = attackerOccupies ? attackerAlive : defenderAlive;
    const keep = terms !== 'white'
      && (selectedProvinces === undefined || selectedProvinces.includes(province.id));
    if (!keep || !recipientAlive) {
      province.controller = province.owner;
      province.occupation = null;
      delete province.siege;
      restored += 1;
      continue;
    }
    province.owner = recipient;
    province.controller = recipient;
    province.occupation = null;
    delete province.siege;
    transferred += 1;
  }
  if (mapChanged) touchMap(state);
  relocateCapital(state, war.attacker);
  relocateCapital(state, war.defender);
  // 清除本场双方在第三方省份留下的围城/占领进度（未攻下的要塞不再残留）。
  for (const province of Object.values(state.provinces)) {
    if (province.siege
      && (province.siege.attacker === war.attacker || province.siege.attacker === war.defender)
      && !areAtWar(state, province.siege.attacker, province.controller)) {
      delete province.siege;
    }
    if (province.occupation
      && (province.occupation.country === war.attacker || province.occupation.country === war.defender)
      && !areAtWar(state, province.occupation.country, province.controller)) {
      province.occupation = null;
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
    const fallback = Object.values(state.provinces).find(province => province.controller === tag);
    const home = capital && capital.controller === tag ? capital.id : fallback?.id;
    if (!home) {
      for (const [id, army] of Object.entries(state.armies)) {
        if (army.tag === tag) delete state.armies[id];
      }
      continue;
    }
    for (const army of Object.values(state.armies)) {
      if (army.tag !== tag) continue;
      const province = state.provinces[army.province];
      if (!province) continue;
      // 仍可合法驻扎（本国、交战方或已获军通）的军队保持原位；
      // 和谈后失去通行权的军队撤回，避免被困在敌境。
      if (province.controller === tag
        || areAtWar(state, tag, province.controller)
        || hasMilitaryAccess(state, province.controller, tag)) continue;
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
  // 基值为刚开战、双方尚未失地的健康国家的投降倾向：应当很低，而非 42%。
  // 失地差（每省 7%）、战争疲劳（0.45/点）、失首都（+28）、几乎无军（+10）再把它推高。
  const raw = 10 - (mine - enemy) * 7 + exhaustion * 0.45 + (capitalLost ? 28 : 0) + (armies <= 1 ? 10 : 0);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function countControllers(state: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const province of Object.values(state.provinces)) {
    counts.set(province.controller, (counts.get(province.controller) ?? 0) + 1);
  }
  return counts;
}

export function resolveFinishedWars(state: GameState, content: ContentIndex): void {
  if (state.wars.length === 0) return;
  let counts = countControllers(state);
  for (const war of [...state.wars]) {
    const attackerControlled = counts.get(war.attacker) ?? 0;
    const defenderControlled = counts.get(war.defender) ?? 0;
    if (attackerControlled > 0 && defenderControlled > 0) continue;
    if (attackerControlled === 0 && defenderControlled === 0) {
      makePeace(state, war.id, content, 'white');
    } else {
      makePeace(state, war.id, content, 'demand');
    }
    // 和约可能转移省份，后续战争必须基于最新控制情况判定。
    counts = countControllers(state);
  }
}

export function cleanupDefeatedNations(state: GameState, content: ContentIndex): void {
  // 一次扫描得到各势力控制省数；后续转移只会把省份转给已有控制区的势力，零控制判定仍然有效。
  let transferred = false;
  let neuOwnsProvince = false;
  const controlledCounts = new Map<string, number>();
  for (const id in state.provinces) {
    const province = state.provinces[id];
    if (!province) continue;
    controlledCounts.set(province.controller, (controlledCounts.get(province.controller) ?? 0) + 1);
    if (province.owner === 'NEU') neuOwnsProvince = true;
  }
  for (const nation of Object.values(state.countries)) {
    if (nation.tag === 'NEU') continue;
    if (!nation.alive) {
      for (const [id, army] of Object.entries(state.armies)) {
        if (army.tag === nation.tag) delete state.armies[id];
      }
      state.training = state.training.filter(item => item.tag !== nation.tag);
      continue;
    }
    if ((controlledCounts.get(nation.tag) ?? 0) > 0) continue;
    // 无实际控制区时，把仍在名下的被占省转给占领者，避免“死国仍占地”。
    const owned = Object.values(state.provinces).filter(province => province.owner === nation.tag);
    for (const province of owned) {
      const occupier = province.controller;
      let target = occupier && state.countries[occupier]?.alive ? occupier : null;
      if (!target) {
        const def = content.provinces.get(province.id);
        for (const neighborId of def?.neighbors ?? []) {
          const controller = state.provinces[neighborId]?.controller;
          if (controller && controller !== 'NEU' && state.countries[controller]?.alive) {
            target = controller;
            break;
          }
        }
      }
      const previousController = province.controller;
      province.owner = target ?? 'NEU';
      province.controller = province.owner;
      if (province.controller !== previousController) {
        controlledCounts.set(previousController, Math.max(0, (controlledCounts.get(previousController) ?? 0) - 1));
        controlledCounts.set(province.controller, (controlledCounts.get(province.controller) ?? 0) + 1);
      }
      province.occupation = null;
      delete province.siege;
    }
    if (owned.length > 0) {
      touchMap(state);
      transferred = true;
    }
    nation.alive = false;
    for (const [id, army] of Object.entries(state.armies)) {
      if (army.tag === nation.tag) delete state.armies[id];
    }
    state.training = state.training.filter(item => item.tag !== nation.tag);
    state.log.push({
      day: state.day,
      category: 'politics',
      country: nation.tag,
      text: `${nation.tag} 已无实际控制区，残余军队解散`,
      severity: 'danger',
    });
  }

  // NEU 是地理兜底势力：只有实际持有省份时才存活，避免死国仍被计为存活。
  const neu = state.countries.NEU;
  if (neu) neu.alive = neuOwnsProvince || (controlledCounts.get('NEU') ?? 0) > 0;

  // 兜底：任何省份的 owner/controller 已死亡时，转给存活占领者/邻国/NEU。
  let repaired = false;
  for (const province of Object.values(state.provinces)) {
    const ownerAlive = Boolean(state.countries[province.owner]?.alive);
    const controllerAlive = Boolean(state.countries[province.controller]?.alive);
    if (ownerAlive && controllerAlive) continue;
    let target = controllerAlive ? province.controller : ownerAlive ? province.owner : null;
    if (!target) {
      const def = content.provinces.get(province.id);
      for (const neighborId of def?.neighbors ?? []) {
        const controller = state.provinces[neighborId]?.controller;
        if (controller && controller !== 'NEU' && state.countries[controller]?.alive) {
          target = controller;
          break;
        }
      }
    }
    province.owner = target ?? 'NEU';
    province.controller = province.owner;
    province.occupation = null;
    delete province.siege;
    repaired = true;
  }
  if (repaired) touchMap(state);
  // 本 tick 已在调用本函数前结算过一次战争；只有本次清理转移了省份，
  // 控制数才会变化，才需要再结算一次。
  if (transferred || repaired) resolveFinishedWars(state, content);
}


export function resolveCapitalCapitulation(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (nation.tag === 'NEU') continue;
    if (!nation.alive) continue;
    const capital = state.provinces[nation.capital];
    if (!capital || capital.controller === nation.tag) continue;
    // 只有首都仍属本国、且占领者确为交战国时才算投降，避免第三方或友军驻扎触发灭国。
    if (capital.owner !== nation.tag) continue;
    if (Object.values(state.armies).some(army => army.tag === nation.tag)) continue;
    const occupier = capital.controller;
    if (!occupier || occupier === 'NEU' || occupier === nation.tag) continue;
    if (!state.countries[occupier]?.alive || !areAtWar(state, nation.tag, occupier)) continue;
    const owned = Object.values(state.provinces).filter(province => province.owner === nation.tag);
    if (owned.length === 0) continue;
    // 大国不会因首都失守而整体投降：只割让被占领土，余部继续抵抗。
    // 否则一次首都陷落会把两百多个省整体转给占领者，直接造成滚雪球。
    if (owned.length > 40) {
      const war = state.wars.find(entry =>
        (entry.attacker === nation.tag && entry.defender === occupier)
        || (entry.defender === nation.tag && entry.attacker === occupier));
      if (war) makePeace(state, war.id, content, 'demand');
      continue;
    }
    for (const province of owned) {
      province.owner = occupier;
      province.controller = occupier;
      province.occupation = null;
      delete province.siege;
    }
    if (owned.length > 0) touchMap(state);
    nation.alive = false;
    for (const [id, army] of Object.entries(state.armies)) {
      if (army.tag === nation.tag) delete state.armies[id];
    }
    state.training = state.training.filter(item => item.tag !== nation.tag);
    const related = state.wars.filter(war => war.attacker === nation.tag || war.defender === nation.tag);
    for (const war of related) makePeace(state, war.id, content, 'demand');
    state.log.push({
      day: state.day,
      country: occupier,
      category: 'diplomacy',
      text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 首都失陷且已无军队，残存领地全部投降`,
      severity: 'danger',
    });
  }
}

