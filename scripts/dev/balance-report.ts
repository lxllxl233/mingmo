/**
 * 平衡报告：无头旁观模拟，输出年度版图/国库/军队/战争/僵尸国。
 *
 * 用法：
 *   pnpm dev:balance --scenario 1627 --seed 42 --years 20
 *   pnpm dev:balance --all --years 20
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { formatDate, fromDayIndex } from '../../src/engine/core/clock';
import type { GameState } from '../../src/engine/state/types';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

interface CountryRow {
  tag: string;
  provinces: number;
  treasury: number;
  arrears: number;
  stability: number;
  armyLoyalty: number;
  armies: number;
  atWar: boolean;
}

function rowsOf(state: GameState): CountryRow[] {
  const wars = new Set<string>();
  for (const war of state.wars) {
    wars.add(war.attacker);
    wars.add(war.defender);
  }
  const counts: Record<string, number> = {};
  for (const province of Object.values(state.provinces)) {
    counts[province.controller] = (counts[province.controller] ?? 0) + 1;
  }
  return Object.values(state.countries)
    .filter(country => country.alive)
    .map(country => ({
      tag: country.tag,
      provinces: counts[country.tag] ?? 0,
      treasury: Math.round(country.treasury),
      arrears: Math.round(country.arrears),
      stability: Number(country.stability.toFixed(1)),
      armyLoyalty: Number(country.armyLoyalty.toFixed(1)),
      armies: Object.values(state.armies).filter(army => army.tag === country.tag).length,
      atWar: wars.has(country.tag),
    }));
}

function reportYear(state: GameState): void {
  const rows = rowsOf(state);
  const alive = rows.length;
  const wars = state.wars.length;
  const zombies = rows.filter(row => row.treasury === 0 && row.arrears > 0 && row.armies > 0).length;
  const broken = rows.filter(row => row.armyLoyalty <= 5).length;
  const top = [...rows].sort((a, b) => b.provinces - a.provinces).slice(0, 6)
    .map(row => `${row.tag}:${row.provinces}`).join(' ');
  const richest = [...rows].sort((a, b) => b.treasury - a.treasury).slice(0, 3)
    .map(row => `${row.tag}:${row.treasury}`).join(' ');
  const year = fromDayIndex(state.day).year;
  console.log(`${formatDate(state.day)} y=${year} alive=${alive} wars=${wars} zombies=${zombies} broken=${broken}`);
  console.log(`  top ${top}`);
  console.log(`  rich ${richest}`);
}

function runScenario(content: ReturnType<typeof loadContentFromDirectory>, scenarioId: string, seed: number, years: number): void {
  const state = createInitialState(content, scenarioId, seed, 'MING', 'normal', true);
  const start = Date.now();
  console.log(`\n===== ${scenarioId} seed=${seed} years=${years} =====`);
  reportYear(state);
  let nextReport = 365;
  for (let day = 0; day < 365 * years && !state.ended; day += 1) {
    advanceDay(state, content);
    if (day + 1 >= nextReport) {
      reportYear(state);
      nextReport += 365;
    }
  }
  const elapsed = Date.now() - start;
  console.log(`elapsed=${(elapsed / 1000).toFixed(1)}s ended=${state.ended} reason=${state.victory?.reason ?? 'none'} date=${formatDate(state.day)}`);
  const rows = rowsOf(state).sort((a, b) => b.provinces - a.provinces);
  for (const row of rows) {
    console.log(`${row.tag.padEnd(8)} prov=${String(row.provinces).padStart(3)} treasury=${String(row.treasury).padStart(10)} arrears=${String(row.arrears).padStart(9)} stab=${String(row.stability).padStart(5)} loyalty=${String(row.armyLoyalty).padStart(5)} armies=${String(row.armies).padStart(2)} war=${row.atWar ? 'Y' : 'N'}`);
  }
  mkdirSync('out', { recursive: true });
  const payload = { scenarioId, seed, years, elapsedMs: elapsed, date: formatDate(state.day), ended: state.ended, rows };
  writeFileSync(join('out', `balance-${scenarioId}-${seed}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`json=out/balance-${scenarioId}-${seed}.json`);
}

const content = loadContentFromDirectory();
const years = Number(arg('years', '20'));
const seed = Number(arg('seed', '42'));
if (flag('all')) {
  for (const scenario of content.scenarios.values()) runScenario(content, scenario.id, seed, years);
} else {
  runScenario(content, arg('scenario', '1627'), seed, years);
}
