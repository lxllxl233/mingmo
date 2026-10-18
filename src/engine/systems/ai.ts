import type { ContentIndex, CountryDef, Tech } from '../../content/types';
import type { GameState } from '../state/types';
import { armyStrength } from '../state/types';
import { armyStrengthOf } from './economy';
import { availableFocuses, startFocus } from './focus';
import { availableTechs, startResearch } from './research';
import { startTaxReform } from './tax';
import { enqueueTraining } from './training';
import { setArmyPath } from './military';
import { areAtWar, declareWar, makePeace, warsOf } from '../rules/war';
import { evaluateTrigger } from '../rules/triggers';

const AI_TEMPLATES: Record<string, string> = {
  MING: 'ming_guard',
  QING: 'qing_green',
  SHUN: 'shun_rebel',
  XI: 'xi_army',
  SMING: 'sming_army',
  ZHENG: 'zheng_marines',
  MONGOL: 'mongol_cavalry',
  JOSEON: 'joseon_army',
  JAPAN: 'japan_samurai',
  TIBET: 'tibet_army',
  VOC: 'voc_company',
  RUSSIA: 'russia_cossack',
  NEU: 'neutrals_tribal',
};

function personalityFactor(personality: CountryDef['aiPersonality'], action: 'war' | 'economy' | 'defense'): number {
  switch (personality) {
    case 'aggressive': return action === 'war' ? 1.5 : action === 'defense' ? 0.7 : 0.9;
    case 'defensive': return action === 'war' ? 0.5 : action === 'defense' ? 1.3 : 1.0;
    case 'opportunistic': return action === 'war' ? 1.2 : action === 'defense' ? 0.9 : 1.0;
    case 'mercantile': return action === 'war' ? 0.6 : action === 'defense' ? 0.9 : 1.3;
    case 'bureaucratic': return action === 'war' ? 0.7 : action === 'defense' ? 1.1 : 1.2;
    default: return 1;
  }
}

function focusScore(state: GameState, content: ContentIndex, tag: string, focusId: string, base: number): number {
  const focus = content.focuses.get(focusId);
  if (!focus) return 0;
  let score = base;
  for (const modifier of focus.aiWillDo.modifier ?? []) {
    if (evaluateTrigger(modifier.if, { state, content, country: tag })) score *= modifier.factor;
  }
  return score;
}

function manageFocus(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation || nation.focus !== null) return;
  const focuses = availableFocuses(state, content, tag);
  let best: { id: string; score: number } | null = null;
  for (const focus of focuses) {
    const score = focusScore(state, content, tag, focus.id, focus.aiWillDo.base);
    if (!best || score > best.score) best = { id: focus.id, score };
  }
  if (best) startFocus(state, content, tag, best.id);
}

function manageResearch(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  while (nation.research.length < nation.researchSlots) {
    const techs = availableTechs(state, content, tag)
      .sort((a: Tech, b: Tech) => b.aiWeight - a.aiWeight);
    const next = techs[0];
    if (!next) break;
    if (!startResearch(state, content, tag, next.id)) break;
  }
}

function manageTax(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  if ((nation.cooldowns['ai-tax'] ?? 0) > 0) return;
  const report = nation.lastReport;
  if (report && report.net >= 0 && nation.treasury > 100000) return;
  const candidates: Array<{ estate: string; law: string; score: number }> = [];
  for (const estate of Object.values(nation.estates)) {
    const current = content.taxLaws.get(estate.taxLaw);
    if (estate.reform || estate.cooldownDays > 0) continue;
    for (const law of content.taxLawsByEstate.get(estate.key) ?? []) {
      if (law.country !== undefined && law.country !== tag) continue;
      if (law.rate <= (current?.rate ?? 0)) continue;
      if (law.require && !evaluateTrigger(law.require, { state, content, country: tag })) continue;
      const score = law.rate * 500 + law.aiWeight - estate.influence * 0.6;
      candidates.push({ estate: estate.key, law: law.id, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best && startTaxReform(state, content, tag, best.estate, best.law, 50)) {
    nation.cooldowns['ai-tax'] = 180;
  }
}

function manageArmy(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  const provinces = Object.values(state.provinces).filter(province => province.controller === tag).length;
  const atWar = warsOf(state, tag).length > 0;
  const target = provinces * (atWar ? 500 : 250);
  if (armyStrengthOf(state, tag) >= target) return;
  if (nation.treasury < 120000 || nation.manpower < 2000) return;
  const template = AI_TEMPLATES[tag] ?? 'ming_guard';
  enqueueTraining(state, content, tag, nation.capital, template, 2);
}

function neighborsOf(state: GameState, content: ContentIndex, tag: string): string[] {
  const result = new Set<string>();
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    const def = content.provinces.get(province.id);
    if (!def) continue;
    for (const neighborId of def.neighbors) {
      const neighbor = state.provinces[neighborId];
      if (neighbor && neighbor.controller !== tag) result.add(neighbor.controller);
    }
  }
  return [...result];
}

function manageWar(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  const def = content.countries.get(tag);
  if (!nation || !def) return;
  const wars = warsOf(state, tag);
  if (wars.length > 0) {
    const capitalLost = state.provinces[nation.capital]?.controller !== tag;
    for (const war of [...wars]) {
      if (nation.warExhaustion > 55 || capitalLost) makePeace(state, war.id, content);
    }
    return;
  }
  if (state.day - nation.ai.lastWarDay < 365) return;
  if (nation.treasury < 100000 || nation.stability < 30) return;
  const neighbors = neighborsOf(state, content, tag);
  const ownStrength = Math.max(1, armyStrengthOf(state, tag));
  const aggression = content.balance.ai.aggression * personalityFactor(def.aiPersonality, 'war');
  for (const target of neighbors) {
    if (target === 'NEU') continue;
    const relation = state.relations[[tag, target].sort().join('|')] ?? 0;
    if (relation > -20) continue;
    const enemyStrength = Math.max(1, armyStrengthOf(state, target));
    if (ownStrength / enemyStrength < 1.2 * aggression) continue;
    if (areAtWar(state, tag, target)) continue;
    declareWar(state, tag, target, '边境争端', content);
    nation.ai.lastWarDay = state.day;
    nation.ai.target = target;
    return;
  }
}

function findPathToEnemy(state: GameState, content: ContentIndex, tag: string, start: string): string[] | null {
  const queue: Array<{ id: string; path: string[] }> = [{ id: start, path: [] }];
  const visited = new Set<string>([start]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const def = content.provinces.get(current.id);
    if (!def) continue;
    for (const neighborId of def.neighbors) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      const province = state.provinces[neighborId];
      if (!province) continue;
      const nextPath = [...current.path, neighborId];
      if (province.controller !== tag && areAtWar(state, tag, province.controller)) return nextPath;
      if (nextPath.length < 24) queue.push({ id: neighborId, path: nextPath });
    }
  }
  return null;
}

function findPathToProvince(content: ContentIndex, from: string, to: string): string[] | null {
  if (from === to) return [];
  const queue: Array<{ id: string; path: string[] }> = [{ id: from, path: [] }];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const def = content.provinces.get(current.id);
    if (!def) continue;
    for (const neighborId of def.neighbors) {
      if (seen.has(neighborId)) continue;
      seen.add(neighborId);
      const path = [...current.path, neighborId];
      if (neighborId === to) return path;
      if (path.length < 30) queue.push({ id: neighborId, path });
    }
  }
  return null;
}

function manageMovement(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  const capital = state.provinces[nation.capital];
  const armies = Object.values(state.armies).filter(army => army.tag === tag);
  if (armies.length === 0) return;

  if (capital && capital.controller !== tag) {
    for (const army of armies) {
      const path = findPathToProvince(content, army.province, nation.capital);
      if (path) setArmyPath(state, content, army.id, path);
    }
    return;
  }
  if (warsOf(state, tag).length === 0) return;

  const atCapital = armies.find(army => army.province === nation.capital);
  const attackers = armies.filter(army => army.id !== atCapital?.id);
  if (!atCapital && attackers.length > 1) {
    const strongest = [...attackers].sort((a, b) => armyStrength(b) - armyStrength(a))[0];
    if (strongest) {
      const path = findPathToProvince(content, strongest.province, nation.capital);
      if (path) setArmyPath(state, content, strongest.id, path);
    }
  }
  for (const army of attackers) {
    if (army.movePath.length > 0) continue;
    const path = findPathToEnemy(state, content, tag, army.province);
    if (path) setArmyPath(state, content, army.id, path);
  }
}

export function runMonthlyAi(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive || nation.tag === state.playerTag) continue;
    manageFocus(state, content, nation.tag);
    manageResearch(state, content, nation.tag);
    manageTax(state, content, nation.tag);
    manageArmy(state, content, nation.tag);
    manageWar(state, content, nation.tag);
    manageMovement(state, content, nation.tag);
  }
}
