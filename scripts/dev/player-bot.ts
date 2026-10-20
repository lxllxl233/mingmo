/**
 * 脚本化玩家：用规则驱动的“拟人玩家”替代 30 小时人工通关，验证核心循环无死锁。
 *
 * 行为：选国策/科研、按预算调税与购粮、招兵、向前线行军、按战分宣战/议和、
 * 处理事件、定期存档并校验存档。每个势力一局，1627→1683 或死亡为止。
 *
 * 用法：pnpm exec tsx scripts/dev/player-bot.ts [--seeds 42] [--tags MING,QING]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { CommandError, dispatch, type Command } from '../../src/engine/commands';
import { LAST_DAY_INDEX, fromDayIndex } from '../../src/engine/core/clock';
import { canMarchThrough } from '../../src/engine/rules/access';
import { areAtWar, truceDays, warScore } from '../../src/engine/rules/war';
import { availableFocuses } from '../../src/engine/systems/focus';
import { availableTechs } from '../../src/engine/systems/research';
import { evaluateTrigger } from '../../src/engine/rules/triggers';
import { armyStrengthOf } from '../../src/engine/systems/economy';
import { encodeSave, decodeSave } from '../../src/app/save/save';
import type { ContentIndex } from '../../src/content/types';
import type { GameState } from '../../src/engine/state/types';

const DEFAULT_TAGS = ['MING', 'QING', 'SHUN', 'XI', 'ZHENG', 'MONGOL', 'JOSEON', 'JAPAN'];
const TAG_PREFIX: Record<string, string> = {
  MING: 'ming', QING: 'qing', SHUN: 'shun', XI: 'xi', SMING: 'sming', ZHENG: 'zheng',
  MONGOL: 'mongol', JOSEON: 'joseon', JAPAN: 'japan', TIBET: 'tibet', VOC: 'voc', RUSSIA: 'russia',
};

interface RunStats {
  tag: string;
  startYear: number;
  endYear: number;
  ended: boolean;
  endReason: string | null;
  alive: boolean;
  victories: number;
  peaces: number;
  warsDeclared: number;
  recruits: number;
  eventsHandled: number;
  saves: number;
  repeats: Record<string, number>;
  lateEvents: number;
  eventsLeft: number;
  focusesLeft: number;
  decisionsLeft: number;
  errors: string[];
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function tryCommand(state: GameState, content: ContentIndex, command: Command): boolean {
  try {
    dispatch(state, command, content);
    return true;
  } catch (error) {
    if (error instanceof CommandError) return false;
    throw error;
  }
}

function handleEvents(state: GameState, content: ContentIndex): number {
  let handled = 0;
  while (state.pendingEvents.length > 0 && handled < 8) {
    const pending = state.pendingEvents[0]!;
    const event = content.events.get(pending.eventId);
    if (!event) {
      state.pendingEvents.shift();
      continue;
    }
    const options = [...event.options].sort((a, b) => (b.aiChance ?? 0) - (a.aiChance ?? 0));
    let chosen = false;
    for (const option of options) {
      if (tryCommand(state, content, { type: 'event.choose', eventId: event.id, optionId: option.id })) {
        chosen = true;
        break;
      }
    }
    if (!chosen) break;
    handled += 1;
  }
  return handled;
}

function pickFocus(state: GameState, content: ContentIndex, tag: string): void {
  const nation = state.countries[tag];
  if (!nation) return;
  if (!nation.focus) {
    const focus = availableFocuses(state, content, tag)
      .sort((a, b) => b.aiWillDo.base - a.aiWillDo.base)[0];
    if (focus) tryCommand(state, content, { type: 'focus.start', focusId: focus.id });
  }
  while (nation.research.length < nation.researchSlots) {
    const tech = availableTechs(state, content, tag).sort((a, b) => b.aiWeight - a.aiWeight)[0];
    if (!tech || !tryCommand(state, content, { type: 'research.start', techId: tech.id })) break;
  }
}

function manageBudget(state: GameState, content: ContentIndex, tag: string, day: number, lastTax: number): number {
  const nation = state.countries[tag];
  if (!nation) return lastTax;
  const expense = nation.lastReport?.expense ?? 0;
  const armyFood = armyStrengthOf(state, tag) * 0.002;
  tryCommand(state, content, {
    type: 'economy.setFoodPurchasePct',
    value: nation.food < armyFood * 30 ? 25 : 5,
  });
  if (day - lastTax < 365) return lastTax;
  const poor = expense > 0 && nation.treasury / expense < 3;
  const estateKey = 'peasants';
  const estate = nation.estates[estateKey];
  if (!estate || estate.reform) return lastTax;
  const laws = [...content.taxLaws.values()]
    .filter(law => law.estate === estateKey && (law.country === undefined || law.country === tag))
    .sort((a, b) => (poor ? b.rate - a.rate : a.rate - b.rate));
  const target = laws.find(law => law.id !== estate.taxLaw);
  if (target && tryCommand(state, content, { type: 'tax.setLaw', estate: estateKey, lawId: target.id })) {
    return day;
  }
  return lastTax;
}

function recruit(state: GameState, content: ContentIndex, tag: string): boolean {
  const nation = state.countries[tag];
  if (!nation || nation.treasury < 120000 || nation.manpower < 15000) return false;
  const own = Object.values(state.armies).filter(army => army.tag === tag);
  if (own.length >= 4) return false;
  const provinceId = state.provinces[nation.capital]?.controller === tag
    ? nation.capital
    : Object.values(state.provinces).find(province => province.controller === tag)?.id;
  if (!provinceId) return false;
  const prefix = TAG_PREFIX[tag] ?? '';
  const templateId = own[0]?.templateId
    ?? [...content.armyTemplates.values()].find(template => template.id.startsWith(prefix))?.id;
  if (!templateId) return false;
  return tryCommand(state, content, { type: 'army.recruit', province: provinceId, template: templateId, size: 2 });
}

function pathToEnemy(state: GameState, content: ContentIndex, tag: string, from: string): string[] | null {
  const queue: string[][] = [[from]];
  const seen = new Set<string>([from]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1]!;
    const def = content.provinces.get(current);
    for (const next of def?.neighbors ?? []) {
      if (seen.has(next) || !canMarchThrough(state, tag, next)) continue;
      const controller = state.provinces[next]?.controller;
      if (controller && areAtWar(state, tag, controller)) return path.slice(1).concat(next);
      seen.add(next);
      if (path.length < 15) queue.push([...path, next]);
    }
  }
  return null;
}

function moveArmies(state: GameState, content: ContentIndex, tag: string): void {
  for (const army of Object.values(state.armies)) {
    if (army.tag !== tag || army.embarked || army.stance === 'battle' || army.encircled) continue;
    if (army.movePath.length > 0) continue;
    const path = pathToEnemy(state, content, tag, army.province);
    if (path && path.length > 0) tryCommand(state, content, { type: 'army.move', armyId: army.id, path });
  }
}

function manageWars(state: GameState, content: ContentIndex, stats: RunStats): void {
  const tag = state.playerTag;
  for (const war of [...state.wars]) {
    if (war.attacker !== tag && war.defender !== tag) continue;
    const score = warScore(state, war);
    const ours = war.attacker === tag ? score.attackerOccupied : score.defenderOccupied;
    const theirs = war.attacker === tag ? score.defenderOccupied : score.attackerOccupied;
    const nation = state.countries[tag];
    const exhausted = (nation?.warExhaustion ?? 0) > 55;
    const terms = ours - theirs >= 3 ? 'demand'
      : theirs - ours >= 3 || exhausted ? 'white'
        : state.day - war.startDay > 3 * 365 ? 'status' : null;
    if (terms && tryCommand(state, content, { type: 'diplomacy.makePeace', warId: war.id, terms })) {
      stats.peaces += 1;
    }
  }
}

function borderTargets(state: GameState, content: ContentIndex, tag: string): string[] {
  const result = new Set<string>();
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    const def = content.provinces.get(province.id);
    for (const neighborId of def?.neighbors ?? []) {
      const controller = state.provinces[neighborId]?.controller;
      if (controller && controller !== tag && controller !== 'NEU' && state.countries[controller]?.alive) {
        result.add(controller);
      }
    }
  }
  return [...result];
}

function maybeDeclareWar(state: GameState, content: ContentIndex, tag: string, stats: RunStats): void {
  const nation = state.countries[tag];
  if (!nation || state.wars.some(war => war.attacker === tag || war.defender === tag)) return;
  if (state.wars.length >= 4 || nation.treasury < 150000) return;
  const ours = armyStrengthOf(state, tag);
  const target = borderTargets(state, content, tag)
    .filter(other => truceDays(state, tag, other) === 0 && !areAtWar(state, tag, other))
    .map(other => ({ other, strength: armyStrengthOf(state, other) }))
    .filter(entry => ours >= Math.max(8000, entry.strength * 1.3))
    .sort((a, b) => a.strength - b.strength)[0];
  if (target && tryCommand(state, content, { type: 'diplomacy.declareWar', target: target.other, cb: '边境争端' })) {
    stats.warsDeclared += 1;
  }
}

function finiteErrors(state: GameState): string[] {
  const errors: string[] = [];
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const fields: Array<[string, number]> = [
      ['treasury', nation.treasury], ['food', nation.food], ['manpower', nation.manpower],
      ['stability', nation.stability], ['mandate', nation.mandate], ['corruption', nation.corruption],
      ['armyLoyalty', nation.armyLoyalty], ['inflation', nation.inflation], ['arrears', nation.arrears],
    ];
    for (const [name, value] of fields) {
      if (!Number.isFinite(value)) errors.push(`${nation.tag}.${name}=${String(value)}`);
    }
  }
  for (const army of Object.values(state.armies)) {
    for (const [name, value] of Object.entries(army.composition)) {
      if (!Number.isFinite(value)) errors.push(`${army.id}.${name}=${String(value)}`);
    }
    if (!Number.isFinite(army.organization)) errors.push(`${army.id}.organization`);
  }
  for (const province of Object.values(state.provinces)) {
    if (!Number.isFinite(province.population) || !Number.isFinite(province.devastation)) {
      errors.push(`province.${province.id}`);
    }
  }
  return errors.slice(0, 5);
}

function runOne(content: ContentIndex, tag: string, seed: number, saveDir: string): RunStats {
  const state = createInitialState(content, '1627', seed, tag, 'normal', false);
  const stats: RunStats = {
    tag, startYear: fromDayIndex(state.day).year, endYear: 0, ended: false, endReason: null, alive: true,
    victories: 0, peaces: 0, warsDeclared: 0, recruits: 0, eventsHandled: 0, saves: 0,
    repeats: {}, lateEvents: 0, eventsLeft: 0, focusesLeft: 0, decisionsLeft: 0, errors: [],
  };
  let lastTax = 0;
  let lastRecruit = 0;
  let lastWar = 0;
  let lastCheckYear = 0;
  while (!state.ended && state.day < LAST_DAY_INDEX && state.countries[tag]?.alive) {
    advanceDay(state, content);
    const { year } = fromDayIndex(state.day);
    stats.eventsHandled += handleEvents(state, content);
    if (state.day % 30 === 0) {
      pickFocus(state, content, tag);
      lastTax = manageBudget(state, content, tag, state.day, lastTax);
      manageWars(state, content, stats);
      if (state.day - lastRecruit > 180 && recruit(state, content, tag)) {
        lastRecruit = state.day;
        stats.recruits += 1;
      }
      if (state.day - lastWar > 180) {
        maybeDeclareWar(state, content, tag, stats);
        lastWar = state.day;
      }
      moveArmies(state, content, tag);
    }
    if (year !== lastCheckYear) {
      lastCheckYear = year;
      const errors = finiteErrors(state);
      stats.errors.push(...errors);
      if (year % 10 === 0) {
        const file = join(saveDir, `${tag}-${year}-${seed}.json`);
        const text = encodeSave(state);
        writeFileSync(file, text, 'utf8');
        decodeSave(text);
        stats.saves += 1;
      }
    }
    if (stats.errors.length > 20) break;
  }
  const suffix = `:${tag}`;
  for (const [key, firedDay] of Object.entries(state.firedEvents)) {
    if (!key.endsWith(suffix)) continue;
    const eventId = key.slice(0, -suffix.length);
    stats.repeats[eventId] = (stats.repeats[eventId] ?? 0) + 1;
    if (fromDayIndex(firedDay).year >= 1650) stats.lateEvents += 1;
  }
  stats.eventsLeft = [...content.events.values()].filter(event =>
    (event.country === undefined || event.country === 'any' || event.country === tag)
    && evaluateTrigger(event.trigger, { state, content, country: tag })).length;
  stats.focusesLeft = availableFocuses(state, content, tag).length;
  stats.decisionsLeft = [...content.decisions.values()].filter(decision =>
    decision.country === tag
    && (decision.visible === undefined
      || evaluateTrigger(decision.visible, { state, content, country: tag }))).length;
  stats.endYear = fromDayIndex(state.day).year;
  stats.ended = state.ended;
  stats.endReason = state.victory?.reason ?? null;
  stats.alive = state.countries[tag]?.alive ?? false;
  stats.victories = state.stats.battles;
  return stats;
}

const content = loadContentFromDirectory();
const seeds = arg('seeds', '42').split(',').map(Number);
const tags = arg('tags', DEFAULT_TAGS.join(',')).split(',').map(tag => tag.trim()).filter(Boolean);
const saveDir = join('out', 'bot-saves');
mkdirSync(saveDir, { recursive: true });
const rows: RunStats[] = [];
for (const tag of tags) {
  for (const seed of seeds) {
    const stats = runOne(content, tag, seed, saveDir);
    rows.push(stats);
    const status = stats.errors.length === 0 && (stats.ended || stats.endYear >= 1683 || !stats.alive)
      ? 'ok' : 'FAIL';
    console.log(`${tag}/seed${seed} ${status} ${stats.startYear}->${stats.endYear} `
      + `alive=${stats.alive} ended=${stats.ended}${stats.endReason ? `(${stats.endReason})` : ''} wars=${stats.warsDeclared} peaces=${stats.peaces} `
      + `recruits=${stats.recruits} events=${stats.eventsHandled} saves=${stats.saves} `
      + `errors=${stats.errors.length}${stats.errors.length ? ` (${stats.errors.join(';')})` : ''}`);
  }
}
const failed = rows.filter(row => row.errors.length > 0 || (!row.ended && row.endYear < 1683 && row.alive));
const file = join('out', `player-bot-${Date.now()}.json`);
writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
console.log(`runs=${rows.length} failed=${failed.length} json=${file}`);
if (failed.length > 0) process.exitCode = 1;
