/**
 * Q6 QA 矩阵：按剧本 × 难度 × 种子跑无头旁观，汇总兴衰、僵尸、孤儿省、战争与结局。
 *
 * 用法：
 *   pnpm exec tsx scripts/dev/qa-matrix.ts --years 10 --seeds 42,7,99
 *   pnpm exec tsx scripts/dev/qa-matrix.ts --years 20 --seeds 42 --difficulties normal
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import type { Difficulty, GameState } from '../../src/engine/state/types';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function list(value: string): string[] {
  return value.split(',').map(entry => entry.trim()).filter(Boolean);
}

function summarize(state: GameState, scenario: string, difficulty: string, seed: number, years: number) {
  const counts: Record<string, number> = {};
  for (const province of Object.values(state.provinces)) {
    counts[province.controller] = (counts[province.controller] ?? 0) + 1;
  }
  const alive = Object.values(state.countries).filter(country => country.alive);
  const zombies = alive.filter(country => (counts[country.tag] ?? 0) === 0).map(country => country.tag);
  const orphans = Object.values(state.provinces).filter(province =>
    !state.countries[province.owner]?.alive || !state.countries[province.controller]?.alive);
  const top = alive
    .map(country => ({ tag: country.tag, provinces: counts[country.tag] ?? 0 }))
    .sort((a, b) => b.provinces - a.provinces)
    .slice(0, 6);
  const richest = alive
    .map(country => ({ tag: country.tag, treasury: Math.round(country.treasury) }))
    .sort((a, b) => b.treasury - a.treasury)
    .slice(0, 3);
  return {
    scenario,
    difficulty,
    seed,
    years,
    day: state.day,
    ended: state.ended,
    victory: state.victory?.reason ?? null,
    alive: alive.length,
    wars: state.wars.length,
    zombies,
    orphanProvinces: orphans.length,
    orphans: orphans.slice(0, 12).map(province => ({
      id: province.id,
      owner: province.owner,
      controller: province.controller,
    })),
    top,
    richest,
  };
}

const content = loadContentFromDirectory();
const years = Number(arg('years', '10'));
const scenarios = list(arg('scenarios', '1627,1644,1650'));
const difficulties = list(arg('difficulties', 'easy,normal,hard')) as Difficulty[];
const seeds = list(arg('seeds', '42,7,99')).map(Number);
const rows = [];
const started = Date.now();
for (const scenario of scenarios) {
  for (const difficulty of difficulties) {
    for (const seed of seeds) {
      const state = createInitialState(content, scenario, seed, 'MING', difficulty, true);
      for (let day = 0; day < years * 365 && !state.ended; day += 1) advanceDay(state, content);
      const row = summarize(state, scenario, difficulty, seed, years);
      rows.push(row);
      console.log(
        `${scenario}/${difficulty}/seed${seed}: alive=${row.alive} wars=${row.wars} `
        + `zombies=${row.zombies.length} orphans=${row.orphanProvinces} `
        + `top=${row.top.map(entry => `${entry.tag}:${entry.provinces}`).join(' ')}`,
      );
    }
  }
}
mkdirSync('out', { recursive: true });
const file = join('out', `qa-matrix-${years}y-${Date.now()}.json`);
writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
console.log(`runs=${rows.length} elapsed=${((Date.now() - started) / 1000).toFixed(1)}s json=${file}`);
