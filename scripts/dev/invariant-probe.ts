/**
 * 不变量探针：3 剧本 × 5 种子 × 5 年，逐日断言引擎状态不越界。
 *
 * 检查项：日期边界、NaN/Infinity、负资源、军队/省份/战争引用、事件队列、日志上限。
 * 用法：pnpm dev:invariant [--years 5] [--scenarios 1627,1644,1650] [--seeds 42,7,99,123,2024]
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { LAST_DAY_INDEX, formatDate } from '../../src/engine/core/clock';
import { armyStrength } from '../../src/engine/state/types';
import type { Difficulty, GameState } from '../../src/engine/state/types';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function list(value: string): string[] {
  return value.split(',').map(entry => entry.trim()).filter(Boolean);
}

interface Violation {
  scenario: string;
  seed: number;
  day: string;
  kind: string;
  detail: string;
}

const violations: Violation[] = [];
const MAX_DETAILS = 40;
let checks = 0;

function report(scenario: string, seed: number, state: GameState, kind: string, detail: string): void {
  violations.push({ scenario, seed, day: formatDate(state.day), kind, detail });
  if (violations.length > MAX_DETAILS) {
    console.error(`too many violations, stopping at ${MAX_DETAILS}`);
    printAndExit();
  }
}

function finite(value: number, label: string, scenario: string, seed: number, state: GameState): void {
  checks += 1;
  if (!Number.isFinite(value)) report(scenario, seed, state, label, `value=${value}`);
}

function nonNegative(value: number, label: string, scenario: string, seed: number, state: GameState): void {
  checks += 1;
  if (!Number.isFinite(value) || value < -1e-6) report(scenario, seed, state, label, `value=${value}`);
}

function checkState(state: GameState, scenario: string, seed: number): void {
  if (state.day > LAST_DAY_INDEX || state.day < 0) {
    report(scenario, seed, state, 'date', `day=${state.day}`);
  }

  for (const country of Object.values(state.countries)) {
    nonNegative(country.treasury, `country.${country.tag}.treasury`, scenario, seed, state);
    nonNegative(country.food, `country.${country.tag}.food`, scenario, seed, state);
    nonNegative(country.manpower, `country.${country.tag}.manpower`, scenario, seed, state);
    nonNegative(country.politicalPower, `country.${country.tag}.politicalPower`, scenario, seed, state);
    nonNegative(country.arrears, `country.${country.tag}.arrears`, scenario, seed, state);
    nonNegative(country.fiscalCrisisDays, `country.${country.tag}.fiscalCrisisDays`, scenario, seed, state);
    nonNegative(country.foodCrisisDays, `country.${country.tag}.foodCrisisDays`, scenario, seed, state);
    for (const key of ['stability', 'mandate', 'corruption', 'authority', 'armyLoyalty', 'inflation', 'warExhaustion', 'economicMomentum']) {
      finite(country[key as keyof typeof country] as number, `country.${country.tag}.${key}`, scenario, seed, state);
    }
    for (const [key, value] of Object.entries(country.allocation)) {
      nonNegative(value, `country.${country.tag}.allocation.${key}`, scenario, seed, state);
    }
    for (const [key, value] of Object.entries(country.modifiers)) {
      finite(value, `country.${country.tag}.modifier.${key}`, scenario, seed, state);
    }
  }

  for (const province of Object.values(state.provinces)) {
    const owner = state.countries[province.owner];
    const controller = state.countries[province.controller];
    checks += 2;
    if (!owner) report(scenario, seed, state, 'province.owner', `${province.id} owner=${province.owner}`);
    else if (!owner.alive) report(scenario, seed, state, 'province.owner.dead', `${province.id} owner=${province.owner}`);
    if (!controller) report(scenario, seed, state, 'province.controller', `${province.id} controller=${province.controller}`);
    else if (!controller.alive) report(scenario, seed, state, 'province.controller.dead', `${province.id} controller=${province.controller}`);
    nonNegative(province.population, `province.${province.id}.population`, scenario, seed, state);
    nonNegative(province.unrest, `province.${province.id}.unrest`, scenario, seed, state);
    nonNegative(province.devastation, `province.${province.id}.devastation`, scenario, seed, state);
    if (province.occupation && !state.countries[province.occupation.country]) {
      report(scenario, seed, state, 'province.occupation', `${province.id} by=${province.occupation.country}`);
    }
    if (province.building && !state.countries[province.building.by]) {
      report(scenario, seed, state, 'province.building', `${province.id} by=${province.building.by}`);
    }
    for (const modifier of province.modifiers) {
      checks += 1;
      if (modifier.daysLeft <= 0) report(scenario, seed, state, 'province.modifier.expired', `${province.id} ${modifier.id}=${modifier.daysLeft}`);
    }
  }

  for (const army of Object.values(state.armies)) {
    const country = state.countries[army.tag];
    checks += 1;
    if (!country) report(scenario, seed, state, 'army.tag', `${army.id} tag=${army.tag}`);
    else if (!country.alive) report(scenario, seed, state, 'army.tag.dead', `${army.id} tag=${army.tag}`);
    if (!state.provinces[army.province]) report(scenario, seed, state, 'army.province', `${army.id} province=${army.province}`);
    if (army.navalTarget && !state.provinces[army.navalTarget]) {
      report(scenario, seed, state, 'army.navalTarget', `${army.id} target=${army.navalTarget}`);
    }
    for (const [key, value] of Object.entries(army.composition)) {
      nonNegative(value, `army.${army.id}.composition.${key}`, scenario, seed, state);
    }
    nonNegative(armyStrength(army), `army.${army.id}.strength`, scenario, seed, state);
    nonNegative(army.maxStrength, `army.${army.id}.maxStrength`, scenario, seed, state);
    finite(army.organization, `army.${army.id}.organization`, scenario, seed, state);
    finite(army.supply, `army.${army.id}.supply`, scenario, seed, state);
    if (army.organization < -1e-6 || army.organization > 100.000001) {
      report(scenario, seed, state, 'army.organization.range', `${army.id} org=${army.organization}`);
    }
    if (army.supply < -1e-6 || army.supply > 100.000001) {
      report(scenario, seed, state, 'army.supply.range', `${army.id} supply=${army.supply}`);
    }
  }

  const warPairs = new Set<string>();
  for (const war of state.wars) {
    const attacker = state.countries[war.attacker];
    const defender = state.countries[war.defender];
    if (!attacker) report(scenario, seed, state, 'war.attacker', `${war.id} ${war.attacker}`);
    else if (!attacker.alive) report(scenario, seed, state, 'war.attacker.dead', `${war.id} ${war.attacker}`);
    if (!defender) report(scenario, seed, state, 'war.defender', `${war.id} ${war.defender}`);
    else if (!defender.alive) report(scenario, seed, state, 'war.defender.dead', `${war.id} ${war.defender}`);
    const pair = [war.attacker, war.defender].sort().join('|');
    if (warPairs.has(pair)) report(scenario, seed, state, 'war.duplicate', `${war.id} ${pair}`);
    warPairs.add(pair);
    for (const tag of [war.attacker, war.defender]) {
      finite(war.exhaustion[tag] ?? 0, `war.${war.id}.exhaustion.${tag}`, scenario, seed, state);
      finite(war.casualties[tag] ?? 0, `war.${war.id}.casualties.${tag}`, scenario, seed, state);
      nonNegative(war.casualties[tag] ?? 0, `war.${war.id}.casualties.${tag}`, scenario, seed, state);
    }
  }

  for (const battle of state.battles) {
    if (!state.countries[battle.attacker]?.alive) report(scenario, seed, state, 'battle.attacker', `${battle.id} ${battle.attacker}`);
    if (!state.countries[battle.defender]?.alive) report(scenario, seed, state, 'battle.defender', `${battle.id} ${battle.defender}`);
    if (!state.provinces[battle.provinceId]) report(scenario, seed, state, 'battle.province', `${battle.id} ${battle.provinceId}`);
  }

  for (const pending of state.pendingEvents) {
    if (!state.countries[pending.country]?.alive) report(scenario, seed, state, 'pending.deadCountry', `${pending.eventId} ${pending.country}`);
  }

  if (state.log.length > 800) report(scenario, seed, state, 'log.length', `${state.log.length}`);
}

function checkContent(content: ReturnType<typeof loadContentFromDirectory>): void {
  for (const event of content.events.values()) {
    checks += 1;
    if (event.options.length === 0) {
      violations.push({ scenario: 'content', seed: 0, day: '-', kind: 'event.options', detail: event.id });
    }
    for (const option of event.options) {
      checks += 1;
      if (!option.id || !option.name) {
        violations.push({ scenario: 'content', seed: 0, day: '-', kind: 'event.option.fields', detail: `${event.id}/${option.id}` });
      }
    }
  }
  for (const chain of content.eventChains.values()) {
    for (const stage of chain.stages) {
      checks += 1;
      if (!content.events.has(stage)) {
        violations.push({ scenario: 'content', seed: 0, day: '-', kind: 'chain.stage', detail: `${chain.id} -> ${stage}` });
      }
    }
  }
}

function printAndExit(): never {
  for (const violation of violations.slice(0, MAX_DETAILS)) {
    console.error(`[FAIL] ${violation.scenario}/seed${violation.seed} ${violation.day} ${violation.kind}: ${violation.detail}`);
  }
  if (violations.length > MAX_DETAILS) console.error(`... and ${violations.length - MAX_DETAILS} more`);
  console.error(`invariant probe: FAIL (${violations.length} violations, ${checks} checks)`);
  process.exit(1);
}

const content = loadContentFromDirectory();
const years = Number(arg('years', '5'));
const scenarios = list(arg('scenarios', '1627,1644,1650'));
const seeds = list(arg('seeds', '42,7,99,123,2024')).map(Number);
const difficulty = arg('difficulty', 'normal') as Difficulty;

checkContent(content);

const started = Date.now();
for (const scenario of scenarios) {
  for (const seed of seeds) {
    const state = createInitialState(content, scenario, seed, 'MING', difficulty, true);
    let days = 0;
    while (days < years * 365 && !state.ended && state.day < LAST_DAY_INDEX) {
      advanceDay(state, content);
      checkState(state, scenario, seed);
      days += 1;
    }
    const alive = Object.values(state.countries).filter(country => country.alive).length;
    const armies = Object.keys(state.armies).length;
    const wars = state.wars.length;
    console.log(`${scenario}/seed${seed}: days=${days} alive=${alive} armies=${armies} wars=${wars} ended=${state.ended}`);
  }
}

if (violations.length > 0) printAndExit();
console.log(`invariant probe: ok (${checks} checks, ${((Date.now() - started) / 1000).toFixed(1)}s)`);
