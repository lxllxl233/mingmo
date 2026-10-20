import type { ContentIndex, CountryDef, Tech } from '../../content/types';
import type { ArmyState, GameState } from '../state/types';
import { armyStrength } from '../state/types';
import { armyStrengthOf } from './economy';
import { availableFocuses, startFocus } from './focus';
import { availableTechs, startResearch } from './research';
import { startTaxReform } from './tax';
import { enqueueTraining } from './training';
import { startCoreIntegration } from './core';
import { startBuilding } from './buildings';
import { confiscationCooldown, extortGentry, pacifyGentry } from './confiscation';
import { compromiseCourt, legitimacyCooldown, mobilizeLoyalists, proclaimEmperor, uniteLoyalists } from './legitimacy';
import { dividendCooldown, openTradePost, recruitMerchants, takeDividend } from './trade';
import { holdKurultai, leagueCooldown, marriagePact, organizeBanners, raidBorder } from './league';
import { isJapanOpen, nagasakiTrade, persecuteChristians, sakokuCooldown, toggleSakoku } from './sakoku';
import { isJoseonNorth, northernExpedition, sendTribute, submitToQing, tributeCooldown } from './tribute';
import { setArmyPath, splitArmy } from './military';
import { areAtWar, declareWar, makePeace, truceDays, warsOf } from '../rules/war';
import { addAlliance, alliesOf, areAllied, improveRelation } from '../rules/diplomacy';
import { relationKey } from '../state/types';
import { canMarchThrough } from '../rules/access';
import { evaluateTrigger } from '../rules/triggers';
import { isHistoricalFocus } from '../../content/historical';
import { fromDayIndex } from '../core/clock';

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
      + historicalFocusBonus(state, tag, focus.id)
      + (isHistoricalFocus(focus.id) ? 30 : 0);
    if (!best || score > best.score) best = { id: focus.id, score };
  }
  if (best) startFocus(state, content, tag, best.id);
}

function manageResearch(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation || nation.treasury < 30000) return;
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
  if ((nation.cooldowns['ai-tax'] ?? 0) > state.day) return;
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
    nation.cooldowns['ai-tax'] = state.day + 180;
  }
}

function manageEconomy(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  const army = armyStrengthOf(state, tag);
  const monthlyFood = army * content.balance.economy.armyFoodPerManMonth;
  if (monthlyFood <= 0) {
    nation.foodPurchasePct = 10;
    return;
  }
  if (nation.food < monthlyFood * 3 && nation.foodPurchasePct < 80) {
    nation.foodPurchasePct = Math.min(100, nation.foodPurchasePct + 15);
  } else if (nation.food > monthlyFood * 12 && nation.foodPurchasePct > 10) {
    nation.foodPurchasePct = Math.max(10, nation.foodPurchasePct - 5);
  }
}
function manageDiplomacy(state: GameState, content: ContentIndex, tag: string): void {
  // 锁国日本不主动结盟，避免被大陆同盟拖入扩张战争。
  if (tag === 'JAPAN') return;
  const nation = state.countries[tag];
  if (!nation?.alive) return;
  const neighbors = neighborsOf(state, content, tag)
    .filter(target => target !== tag && state.countries[target]?.alive);
  if (neighbors.length === 0) return;

  if (alliesOf(state, tag).length < 2) {
    const friend = neighbors
      .map(target => ({ target, relation: state.relations[relationKey(tag, target)] ?? 0 }))
      .filter(entry => entry.target !== 'JAPAN' && entry.relation >= 50 && !areAtWar(state, tag, entry.target) && !areAllied(state, tag, entry.target))
      .sort((a, b) => b.relation - a.relation)[0];
    if (friend && addAlliance(state, tag, friend.target)) {
      state.log.push({
        day: state.day,
        category: 'diplomacy',
        country: tag,
        text: `与 ${content.countries.get(friend.target)?.name ?? friend.target} 缔结同盟`,
        severity: 'info',
      });
    }
  }

  if (nation.treasury > 300000) {
    const target = neighbors
      .map(id => ({ id, relation: state.relations[relationKey(tag, id)] ?? 0 }))
      .filter(entry => entry.relation < 20 && !areAtWar(state, tag, entry.id))
      .sort((a, b) => a.relation - b.relation)[0];
    if (target) {
      nation.treasury -= 10000;
      improveRelation(state, tag, target.id, 10);
    }
  }
}

function manageArmy(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  const profile = aiProfile(state);
  const provinces = Object.values(state.provinces).filter(province => province.controller === tag).length;
  const atWar = warsOf(state, tag).length > 0;
  const target = Math.min(provinces, 120) * (atWar ? 250 : 140) * profile.armyTarget;
  const current = armyStrengthOf(state, tag);
  if (current >= target) {
    if (current > target * 1.5 && nation.treasury < 120000) {
      const weakest = Object.values(state.armies)
        .filter(army => army.tag === tag)
        .sort((a, b) => armyStrength(a) - armyStrength(b))[0];
      if (weakest) delete state.armies[weakest.id];
    }
    return;
  }
  if ((nation.lastReport?.net ?? 0) < 0 && nation.treasury < 180000) return;
  if (nation.treasury < Math.min(10000, profile.minTreasury * 0.8) || nation.manpower < 2000) return;
  const template = AI_TEMPLATES[tag] ?? 'ming_guard';
  const capital = state.provinces[nation.capital]?.controller === tag
    ? nation.capital
    : Object.values(state.provinces).find(province => province.controller === tag)?.id;
  if (!capital) return;
  enqueueTraining(state, content, tag, capital, template, 2);
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

function dominantTag(state: GameState): { tag: string; share: number } | null {
  const counts = new Map<string, number>();
  for (const province of Object.values(state.provinces)) {
    counts.set(province.controller, (counts.get(province.controller) ?? 0) + 1);
  }
  let bestTag: string | null = null;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (!state.countries[tag]?.alive) continue;
    if (count > bestCount) {
      bestTag = tag;
      bestCount = count;
    }
  }
  if (!bestTag) return null;
  return { tag: bestTag, share: bestCount / Math.max(1, Object.keys(state.provinces).length) };
}

function historicalWarTarget(state: GameState, tag: string): string | null {
  const alive = (target: string) => Boolean(state.countries[target]?.alive) && target !== tag;
  const year = fromDayIndex(state.day).year;
  const dominant = dominantTag(state);
  if (dominant && dominant.tag !== tag && dominant.share >= 0.38
    && tag !== 'JAPAN' && tag !== 'JOSEON'
    && !areAllied(state, tag, dominant.tag)) {
    return dominant.tag;
  }
  if (state.scenarioId === '1627') {
    if (tag === 'QING') {
      if (year >= 1644 && alive('SHUN')) return 'SHUN';
      if (alive('MING')) return 'MING';
      if (alive('SHUN')) return 'SHUN';
      if (alive('SMING')) return 'SMING';
      if (alive('ZHENG')) return 'ZHENG';
      return null;
    }
    if (tag === 'MING') {
      if (alive('QING')) return 'QING';
      if (alive('SHUN')) return 'SHUN';
      if (alive('XI')) return 'XI';
      return null;
    }
    if (tag === 'SHUN') {
      if (year < 1644 && alive('MING')) return 'MING';
      if (alive('QING')) return 'QING';
      if (alive('MING')) return 'MING';
      if (alive('XI')) return 'XI';
      return null;
    }
    if (tag === 'XI') {
      if (year >= 1644 && alive('QING')) return 'QING';
      if (alive('MING')) return 'MING';
      if (alive('QING')) return 'QING';
      return null;
    }
    if (tag === 'SMING') return alive('QING') ? 'QING' : alive('SHUN') ? 'SHUN' : null;
    if (tag === 'ZHENG') return year >= 1644 && alive('QING') ? 'QING' : alive('VOC') ? 'VOC' : null;
  }
  if (state.scenarioId === '1644') {
    if (tag === 'QING') {
      if (alive('MING')) return 'MING';
      if (alive('SHUN')) return 'SHUN';
      if (alive('XI')) return 'XI';
      if (alive('SMING')) return 'SMING';
      if (alive('ZHENG')) return 'ZHENG';
      return null;
    }
    if (tag === 'SHUN') {
      if (alive('MING')) return 'MING';
      if (alive('QING')) return 'QING';
      return null;
    }
    if (tag === 'XI') return alive('MING') ? 'MING' : alive('QING') ? 'QING' : null;
  }
  if (state.scenarioId === '1650') {
    if (tag === 'QING') {
      if (alive('SMING')) return 'SMING';
      if (alive('ZHENG')) return 'ZHENG';
      if (alive('XI')) return 'XI';
      return null;
    }
    if (tag === 'SMING' && alive('QING')) return 'QING';
    if (tag === 'ZHENG' && alive('QING')) return 'QING';
  }
  return null;
}
const HISTORICAL_TARGETS: Record<string, Record<string, string[]>> = {
  '1627': {
    MING: ['QING', 'SHUN', 'XI'], QING: ['MING', 'SHUN', 'MONGOL'], SHUN: ['MING', 'QING'], XI: ['MING', 'SHUN'],
    MONGOL: ['MING', 'QING'], TIBET: ['MONGOL'], ZHENG: ['VOC', 'QING'], VOC: ['ZHENG'],
    JAPAN: [], JOSEON: [], RUSSIA: ['MONGOL'],
  },
  '1644': {
    MING: ['QING', 'SHUN', 'XI'], QING: ['MING', 'SHUN', 'XI', 'SMING', 'ZHENG', 'MONGOL'], SHUN: ['MING', 'QING', 'SMING'],
    XI: ['MING', 'SHUN', 'QING'], MONGOL: ['QING', 'MING'], ZHENG: ['VOC', 'QING', 'SMING'], VOC: ['ZHENG'],
    SMING: ['QING', 'SHUN', 'XI'], JAPAN: [], JOSEON: [], TIBET: ['MONGOL'], RUSSIA: ['MONGOL'],
  },
  '1650': {
    QING: ['SMING', 'ZHENG', 'XI'], SMING: ['QING', 'XI'], ZHENG: ['QING', 'VOC'],
    MONGOL: ['QING'], TIBET: ['QING', 'MONGOL'], VOC: ['ZHENG'], RUSSIA: ['MONGOL'],
    JAPAN: [], JOSEON: [],
  },
};

const HISTORICAL_EXPANSION_CAP: Record<string, number> = {
  MING: 360, QING: 480, SHUN: 300, XI: 180, SMING: 200, ZHENG: 120,
  MONGOL: 40, JOSEON: 30, JAPAN: 60, TIBET: 50, VOC: 30, RUSSIA: 30,
};

function historicalTargets(state: GameState, tag: string): string[] | null {
  return HISTORICAL_TARGETS[state.scenarioId]?.[tag] ?? null;
}

function canUseHistoricalTarget(state: GameState, tag: string, target: string): boolean {
  if (areAllied(state, tag, target)) return false;
  const allowed = historicalTargets(state, tag);
  if (allowed && !allowed.includes(target)) return false;
  const overlord = state.vassals[target];
  if (overlord && overlord !== tag) return false;
  const cap = HISTORICAL_EXPANSION_CAP[tag] ?? 480;
  const owned = Object.values(state.provinces).filter(province => province.owner === tag).length;
  return owned < cap;
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
      if (nation.warExhaustion > profile.peaceExhaustion || capitalLost) {
        if (!state.spectator && (war.attacker === state.playerTag || war.defender === state.playerTag)) {
          if ((nation.cooldowns[`peace-${war.id}`] ?? 0) <= state.day
            && !state.peaceOffers.some(offer => offer.warId === war.id)) {
            state.peaceOffers.push({
              id: `peace_${war.id}_${state.day}`,
              warId: war.id,
              proposer: tag,
              terms: 'status',
              day: state.day,
            });
          }
        } else {
          makePeace(state, war.id, content);
        }
      }
    }
    return;
  }
  const scripted = historicalWarTarget(state, tag);
  if (scripted && !areAtWar(state, tag, scripted) && state.day - nation.ai.lastWarDay >= 90) {
    const war = declareWar(state, tag, scripted, '历史疆界', content);
    if (war) {
      nation.ai.lastWarDay = state.day;
      nation.ai.target = scripted;
      return;
    }
  }
  // 锁国日本不主动发动大陆扩张战争；被进攻时仍走上面的防御/议和逻辑。
  if (tag === 'JAPAN') return;
  if (state.day - nation.ai.lastWarDay < (state.spectator ? Math.min(240, profile.warDelay) : profile.warDelay)) return;
  if (nation.treasury < profile.minTreasury || nation.stability < profile.minStability) return;
  const neighbors = neighborsOf(state, content, tag);
  const ownStrength = Math.max(1, armyStrengthOf(state, tag));
  const aggression = content.balance.ai.aggression * personalityFactor(def.aiPersonality, 'war');
  const requiredRatio = state.spectator
    ? 0.45
    : profile.strengthRatio / Math.max(0.35, aggression);
  const relationLimit = state.spectator ? 60 : -20;
  const candidates = neighbors
    .filter(target => target !== 'NEU')
    .map(target => ({
      target,
      relation: state.relations[[tag, target].sort().join('|')] ?? 0,
      strength: Math.max(1, armyStrengthOf(state, target)),
      atWar: areAtWar(state, tag, target),
    }))
    .filter(entry => entry.relation <= relationLimit && !entry.atWar && truceDays(state, tag, entry.target) === 0)
    .filter(entry => canUseHistoricalTarget(state, tag, entry.target))
    .filter(entry => ownStrength / entry.strength >= requiredRatio);
  candidates.sort((a, b) => a.strength - b.strength);
  const target = candidates[0];
  if (!target) return;
  const war = declareWar(state, tag, target.target, '边境争端', content);
  if (!war) return;
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

interface FrontTarget {
  id: string;
  path: string[];
  score: number;
}

interface FrontCandidate {
  id: string;
  support: number;
  development: number;
}

/** 同一势力的所有军团面对的是同一批敌方目标，按势力扫描一次即可。 */
function frontCandidates(state: GameState, content: ContentIndex, tag: string): FrontCandidate[] {
  const candidates: FrontCandidate[] = [];
  for (const province of Object.values(state.provinces)) {
    if (province.controller === tag) continue;
    if (!areAtWar(state, tag, province.controller)) continue;
    const def = content.provinces.get(province.id);
    if (!def) continue;
    const support = def.neighbors.filter(neighborId => {
      const neighbor = state.provinces[neighborId];
      return neighbor !== undefined
        && neighbor.controller === tag;
    }).length;
    if (support === 0) continue;
    candidates.push({ id: province.id, support, development: def.development });
  }
  return candidates;
}

/**
 * 单次 BFS 求出源省到所有可达省的最短路径。
 * 与逐个目标跑 BFS 的结果完全一致（邻居顺序、深度上限 30 都相同），
 * 但 N 个目标只付一次队列与集合分配。
 */
function reachablePaths(
  state: GameState,
  content: ContentIndex,
  tag: string,
  from: string,
): Map<string, string[]> {
  const paths = new Map<string, string[]>([[from, []]]);
  const queue: string[] = [from];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    if (id === undefined) continue;
    const def = content.provinces.get(id);
    if (!def) continue;
    const base = paths.get(id) ?? [];
    for (const neighborId of def.neighbors) {
      if (paths.has(neighborId) || !canMarchThrough(state, tag, neighborId)) continue;
      const path = [...base, neighborId];
      paths.set(neighborId, path);
      if (path.length < 30) queue.push(neighborId);
    }
  }
  return paths;
}

function frontTargets(
  state: GameState,
  content: ContentIndex,
  tag: string,
  army: ArmyState,
  candidates: FrontCandidate[],
): FrontTarget[] {
  const paths = reachablePaths(state, content, tag, army.province);
  const targets: FrontTarget[] = [];
  for (const candidate of candidates) {
    const path = paths.get(candidate.id);
    if (!path || path.length === 0) continue;
    targets.push({
      id: candidate.id,
      path,
      score: candidate.support * 10 - path.length * 1.5 + candidate.development * 0.08,
    });
  }
  targets.sort((a, b) => b.score - a.score);
  return targets;
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
  const attackers = armies.length > 1
    ? armies.filter(army => army.id !== atCapital?.id)
    : armies;
  if (!atCapital && attackers.length > 1) {
    const strongest = [...attackers].sort((a, b) => armyStrength(b) - armyStrength(a))[0];
    if (strongest) {
      const path = findPathToProvince(state, content, tag, strongest.province, nation.capital);
      if (path) setArmyPath(state, content, strongest.id, path);
    }
  }
  const assigned = new Set<string>();
  const frontArmies = attackers
    .filter(army => army.movePath.length === 0)
    .sort((a, b) => armyStrength(b) - armyStrength(a))
    .slice(0, Math.max(2, aiProfile(state).attackers));
  const candidates = frontArmies.length > 0 ? frontCandidates(state, content, tag) : [];
  for (const army of frontArmies) {
    const targets = frontTargets(state, content, tag, army, candidates);
    const target = targets.find(entry => !assigned.has(entry.id)) ?? targets[0];
    if (target) {
      assigned.add(target.id);
      setArmyPath(state, content, army.id, target.path);
      continue;
    }
    const path = findPathToEnemy(state, content, tag, army.province);
    if (path) setArmyPath(state, content, army.id, path);
  }
}

function manageRebelGrowth(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  const def = content.countries.get(tag);
  if (!nation || !def || def.government !== 'rebel') return;
  if (warsOf(state, tag).length === 0) return;
  const provinces = Object.values(state.provinces).filter(province => province.controller === tag).length;
  const target = 2500 + provinces * 900;
  const current = armyStrengthOf(state, tag);
  if (current >= target) return;
  let armies = Object.values(state.armies).filter(army => army.tag === tag);
  const largest = armies.sort((a, b) => armyStrength(b) - armyStrength(a))[0];
  if (largest && armies.length < 4 && armyStrength(largest) > 3000) {
    splitArmy(state, content, largest.id, 2000);
    armies = Object.values(state.armies).filter(army => army.tag === tag);
  }
  const army = armies.sort((a, b) => armyStrength(a) - armyStrength(b))[0];
  if (!army || nation.manpower < 150 || nation.food < 10000) return;
  const recruits = Math.min(1000, Math.ceil(target - current), Math.floor(nation.manpower));
  if (recruits <= 0) return;
  army.composition.infantry += recruits;
  nation.manpower -= recruits;
  nation.food = Math.max(0, nation.food - recruits * 0.5);
  if (state.day % 90 === 0) {
    state.log.push({
      day: state.day,
      category: 'military',
      country: tag,
      text: `${def.name} 饥民来投，${army.name} 补充 ${recruits} 人`,
      severity: 'info',
    });
  }
}

function manageInvestments(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation?.alive) return;
  const report = nation.lastReport;
  const monthlyExpense = report?.expense ?? 0;
  const atWar = warsOf(state, tag).length > 0;
  const reserve = Math.max(200000, monthlyExpense * (atWar ? 12 : 8));
  if (nation.treasury <= reserve) return;

  const armies = Object.values(state.armies)
    .filter(army => army.tag === tag && (army.training < 80 || army.equipment < 80))
    .sort((a, b) => armyStrength(b) - armyStrength(a));
  for (const army of armies.slice(0, 2)) {
    const cost = Math.min(20000, Math.max(5000, (nation.treasury - reserve) * 0.2));
    if (nation.treasury - cost < reserve) break;
    nation.treasury -= cost;
    army.training = Math.min(100, army.training + 3);
    army.equipment = Math.min(100, army.equipment + 3);
  }

  if (nation.treasury > reserve + 60000) {
    const provinceCandidates = Object.values(state.provinces)
      .filter(province => province.controller === tag && !province.building)
      .sort((a, b) => (content.provinces.get(b.id)?.development ?? 0) - (content.provinces.get(a.id)?.development ?? 0));
    for (const province of provinceCandidates.slice(0, 3)) {
      const provinceDef = content.provinces.get(province.id);
      if (!provinceDef) continue;
      const options = [...content.buildings.values()]
        .filter(def => !province.buildings.includes(def.id)
          && (def.terrain.length === 0 || def.terrain.includes(provinceDef.terrain))
          && def.costSilver <= nation.treasury - reserve
          && def.costFood <= nation.food)
        .sort((a, b) => b.aiWeight - a.aiWeight);
      const choice = options[0];
      if (choice && startBuilding(state, content, tag, province.id, choice.id)) break;
    }
  }

  const unrest = Object.values(state.provinces)
    .filter(province => province.controller === tag && province.unrest > 35)
    .sort((a, b) => b.unrest - a.unrest)[0];
  if (unrest && nation.treasury - reserve > 15000) {
    nation.treasury -= 15000;
    unrest.unrest = Math.max(0, unrest.unrest - 8);
  }

  if (nation.corruption > 45 && nation.treasury - reserve > 25000) {
    nation.treasury -= 25000;
    nation.corruption = Math.max(0, nation.corruption - 1.5);
  }

  const excess = nation.treasury - reserve;
  if (excess > 100000) {
    const spend = excess * 0.2;
    nation.treasury -= spend;
    nation.stability = Math.min(100, nation.stability + 0.15);
    nation.corruption = Math.max(0, nation.corruption - 0.15);
  }

  if (state.day % 365 === 0 && nation.treasury > reserve * 3) {
    state.log.push({
      day: state.day,
      category: 'economy',
      country: tag,
      text: `${content.countries.get(tag)?.name ?? tag} 将库银投入军备、赈济与吏治`,
      severity: 'info',
    });
  }
}

export function runMonthlyAi(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (nation.tag === 'NEU') continue;
    if (!nation.alive || (!state.spectator && nation.tag === state.playerTag)) continue;
    manageFocus(state, content, nation.tag);
    manageResearch(state, content, nation.tag);
    manageTax(state, content, nation.tag);
    manageEconomy(state, content, nation.tag);
    manageArmy(state, content, nation.tag);
    manageInvestments(state, content, nation.tag);
    manageDiplomacy(state, content, nation.tag);
    if (nation.tag === 'SHUN' && confiscationCooldown(state, nation.tag) === 0) {
      if (nation.treasury < 80000) extortGentry(state, content, nation.tag);
      else if (nation.stability < 35 && nation.treasury > 150000) pacifyGentry(state, nation.tag);
    }
    if (nation.tag === 'SMING' && legitimacyCooldown(state, nation.tag) === 0) {
      const partnerAlive = ['ZHENG', 'XI'].some(partner =>
        state.countries[partner]?.alive && !areAllied(state, nation.tag, partner));
      if (nation.mandate < 45 && nation.politicalPower >= 20 && nation.treasury >= 60000) {
        proclaimEmperor(state, nation.tag);
      } else if (nation.stability < 40 && nation.politicalPower >= 5) {
        compromiseCourt(state, nation.tag);
      } else if (partnerAlive && nation.politicalPower >= 20 && nation.treasury >= 50000) {
        uniteLoyalists(state, nation.tag);
      } else if (nation.politicalPower >= 10 && nation.manpower < 60000) {
        mobilizeLoyalists(state, nation.tag);
      }
    }
    if (nation.tag === 'ZHENG') {
      if (nation.treasury > 200000 && nation.politicalPower >= 10 && nation.tradePosts.length < 6) {
        const port = Object.values(state.provinces)
          .filter(province => province.controller === 'ZHENG'
            && content.provinces.get(province.id)?.isPort
            && !nation.tradePosts.includes(province.id))
          .sort((a, b) => (content.provinces.get(b.id)?.development ?? 0) - (content.provinces.get(a.id)?.development ?? 0))[0];
        if (port) openTradePost(state, content, 'ZHENG', port.id);
      }
      if (dividendCooldown(state, 'ZHENG') === 0) {
        if (nation.tradePosts.length > 0) takeDividend(state, content, 'ZHENG');
        else if (nation.treasury > 120000 && (nation.factions['merchants'] ?? 0) < 45) {
          recruitMerchants(state, 'ZHENG');
        }
      }
    }
    if (nation.tag === 'MONGOL' && leagueCooldown(state, 'MONGOL') === 0) {
      if (nation.politicalPower >= 10 && nation.mandate < 45) holdKurultai(state, 'MONGOL');
      else if (nation.treasury >= 60000) organizeBanners(state, 'MONGOL');
      else if (nation.treasury < 80000) raidBorder(state, content, 'MONGOL');
      else if (nation.politicalPower >= 10 && nation.treasury >= 30000) marriagePact(state, 'MONGOL');
    }
    if (nation.tag === 'JAPAN' && sakokuCooldown(state, 'JAPAN') === 0) {
      if (!isJapanOpen(state) && nation.treasury < 150000 && nation.politicalPower >= 10) {
        toggleSakoku(state, 'JAPAN');
      } else if (isJapanOpen(state) && nation.stability < 45 && nation.politicalPower >= 10) {
        toggleSakoku(state, 'JAPAN');
      } else if (isJapanOpen(state)) {
        nagasakiTrade(state, content, 'JAPAN');
      } else if (nation.politicalPower >= 10) {
        persecuteChristians(state, 'JAPAN');
      }
    }
    if (nation.tag === 'JOSEON' && tributeCooldown(state, 'JOSEON') === 0) {
      const atWarWithQing = areAtWar(state, 'JOSEON', 'QING');
      if (atWarWithQing && !isJoseonNorth(state) && nation.stability > 35 && nation.politicalPower >= 10) {
        northernExpedition(state, 'JOSEON');
      } else if (!isJoseonNorth(state) && nation.treasury > 80000) {
        sendTribute(state, 'JOSEON');
      } else if (isJoseonNorth(state) && state.countries['QING']?.alive) {
        submitToQing(state, 'JOSEON');
      }
    }
    manageRebelGrowth(state, content, nation.tag);
    manageCore(state, content, nation.tag);
    manageWar(state, content, nation.tag);
    manageMovement(state, content, nation.tag);
  }
}













