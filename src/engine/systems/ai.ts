import type { ContentIndex, CountryDef, Tech } from '../../content/types';
import type { GameState } from '../state/types';
import { armyStrength } from '../state/types';
import { armyStrengthOf } from './economy';
import { availableFocuses, startFocus } from './focus';
import { availableTechs, startResearch } from './research';
import { startTaxReform } from './tax';
import { enqueueTraining } from './training';
import { startCoreIntegration } from './core';
import { setArmyPath } from './military';
import { areAtWar, declareWar, makePeace, warsOf } from '../rules/war';
import { canMarchThrough } from '../rules/access';
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

type AiProfile = {
  warDelay: number;
  minTreasury: number;
  minStability: number;
  strengthRatio: number;
  armyTarget: number;
  peaceExhaustion: number;
  attackers: number;
};

function aiProfile(state: GameState): AiProfile {
  switch (state.difficulty) {
    case 'easy':
      return { warDelay: 540, minTreasury: 150000, minStability: 40, strengthRatio: 1.6, armyTarget: 0.8, peaceExhaustion: 30, attackers: 1 };
    case 'hard':
      return { warDelay: 240, minTreasury: 70000, minStability: 25, strengthRatio: 0.45, armyTarget: 1.25, peaceExhaustion: 65, attackers: 3 };
    default:
      return { warDelay: 365, minTreasury: 100000, minStability: 30, strengthRatio: 0.85, armyTarget: 1, peaceExhaustion: 55, attackers: 2 };
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

function historicalFocusBonus(state: GameState, tag: string, focusId: string): number {
  if (state.scenarioId === '1627') {
    if (tag === 'QING' && (focusId.startsWith('qing_entry') || focusId.startsWith('qing_banner'))) return 70;
    if (tag === 'MING' && focusId.startsWith('ming_liaodong')) return 55;
  }
  if (state.scenarioId === '1644') {
    if (tag === 'QING' && focusId.startsWith('qing_entry')) return 80;
    if (tag === 'SHUN' && focusId.startsWith('shun_east')) return 70;
    if (tag === 'XI' && focusId.startsWith('xi_sichuan')) return 55;
  }
  if (state.scenarioId === '1650') {
    if (tag === 'QING' && focusId.startsWith('qing_entry')) return 55;
    if (tag === 'SMING' && focusId.startsWith('sming_')) return 45;
  }
  return 0;
}

function manageFocus(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation || nation.focus !== null) return;
  const focuses = availableFocuses(state, content, tag);
  let best: { id: string; score: number } | null = null;
  for (const focus of focuses) {
    const score = focusScore(state, content, tag, focus.id, focus.aiWillDo.base)
      + historicalFocusBonus(state, tag, focus.id);
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
  const profile = aiProfile(state);
  const provinces = Object.values(state.provinces).filter(province => province.controller === tag).length;
  const atWar = warsOf(state, tag).length > 0;
  const target = provinces * (atWar ? 500 : 250) * profile.armyTarget;
  if (armyStrengthOf(state, tag) >= target) return;
  if ((nation.lastReport?.net ?? 0) < 0 && nation.treasury < 180000) return;
  if (nation.treasury < profile.minTreasury * 0.8 || nation.manpower < 2000) return;
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

function historicalWarTarget(state: GameState, tag: string): string | null {
  const alive = (target: string) => Boolean(state.countries[target]?.alive) && target !== tag;
  if (state.scenarioId === '1627') {
    if (tag === 'QING' && alive('MING')) return 'MING';
    if (tag === 'MING' && alive('QING')) return 'QING';
  }
  if (state.scenarioId === '1644') {
    if (tag === 'QING') return alive('SHUN') ? 'SHUN' : alive('MING') ? 'MING' : null;
    if (tag === 'SHUN' && alive('MING')) return 'MING';
    if (tag === 'MING' && alive('SHUN')) return 'SHUN';
    if (tag === 'XI' && alive('MING')) return 'MING';
  }
  if (state.scenarioId === '1650') {
    if (tag === 'QING') return alive('SMING') ? 'SMING' : alive('ZHENG') ? 'ZHENG' : null;
    if (tag === 'SMING' && alive('QING')) return 'QING';
    if (tag === 'ZHENG' && alive('QING')) return 'QING';
  }
  return null;
}

function manageWar(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  const def = content.countries.get(tag);
  if (!nation || !def) return;
  const wars = warsOf(state, tag);
  const profile = aiProfile(state);
  if (wars.length > 0) {
    const capitalLost = state.provinces[nation.capital]?.controller !== tag;
    for (const war of [...wars]) {
      if (nation.warExhaustion > profile.peaceExhaustion || capitalLost) makePeace(state, war.id, content);
    }
    return;
  }
  if (state.day - nation.ai.lastWarDay < profile.warDelay) return;
  if (nation.treasury < profile.minTreasury || nation.stability < profile.minStability) return;
  const scripted = historicalWarTarget(state, tag);
  if (scripted && !areAtWar(state, tag, scripted)) {
    const war = declareWar(state, tag, scripted, '历史疆界', content);
    if (war) {
      nation.ai.lastWarDay = state.day;
      nation.ai.target = scripted;
      return;
    }
  }
  const neighbors = neighborsOf(state, content, tag);
  const ownStrength = Math.max(1, armyStrengthOf(state, tag));
  const aggression = content.balance.ai.aggression * personalityFactor(def.aiPersonality, 'war');
  const requiredRatio = profile.strengthRatio / Math.max(0.35, aggression);
  const candidates = neighbors
    .filter(target => target !== 'NEU')
    .map(target => ({
      target,
      relation: state.relations[[tag, target].sort().join('|')] ?? 0,
      strength: Math.max(1, armyStrengthOf(state, target)),
      atWar: areAtWar(state, tag, target),
    }))
    .filter(entry => entry.relation <= -20 && !entry.atWar)
    .filter(entry => ownStrength / entry.strength >= requiredRatio);
  candidates.sort((a, b) => a.strength - b.strength);
  const target = candidates[0];
  if (!target) return;
  declareWar(state, tag, target.target, '边境争端', content);
  nation.ai.lastWarDay = state.day;
  nation.ai.target = target.target;
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
      if (!canMarchThrough(state, tag, neighborId)) continue;
      const nextPath = [...current.path, neighborId];
      if (province.controller !== tag && areAtWar(state, tag, province.controller)) return nextPath;
      if (nextPath.length < 24) queue.push({ id: neighborId, path: nextPath });
    }
  }
  return null;
}

function findPathToProvince(state: GameState, content: ContentIndex, tag: string, from: string, to: string): string[] | null {
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
      if (!canMarchThrough(state, tag, neighborId)) continue;
      seen.add(neighborId);
      const path = [...current.path, neighborId];
      if (neighborId === to) return path;
      if (path.length < 30) queue.push({ id: neighborId, path });
    }
  }
  return null;
}

function manageCore(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation || nation.treasury < 250000 || nation.food < 80000) return;
  const candidates = Object.values(state.provinces)
    .filter(province => province.controller === tag && !province.cores.includes(tag) && !province.coreWork)
    .map(province => ({ province, development: content.provinces.get(province.id)?.development ?? 0 }))
    .sort((a, b) => b.development - a.development);
  const best = candidates[0];
  if (best) startCoreIntegration(state, tag, best.province.id);
}

function manageMovement(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  const capital = state.provinces[nation.capital];
  const armies = Object.values(state.armies).filter(army => army.tag === tag);
  if (armies.length === 0) return;

  if (capital && capital.controller !== tag) {
    for (const army of armies) {
      const path = findPathToProvince(state, content, tag, army.province, nation.capital);
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
      const path = findPathToProvince(state, content, tag, strongest.province, nation.capital);
      if (path) setArmyPath(state, content, strongest.id, path);
    }
  }
  for (const army of attackers.slice(0, aiProfile(state).attackers)) {
    if (army.movePath.length > 0) continue;
    const path = findPathToEnemy(state, content, tag, army.province);
    if (path) setArmyPath(state, content, army.id, path);
  }
}

export function runMonthlyAi(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive || (!state.spectator && nation.tag === state.playerTag)) continue;
    manageFocus(state, content, nation.tag);
    manageResearch(state, content, nation.tag);
    manageTax(state, content, nation.tag);
    manageArmy(state, content, nation.tag);
    manageCore(state, content, nation.tag);
    manageWar(state, content, nation.tag);
    manageMovement(state, content, nation.tag);
  }
}
