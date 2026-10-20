/**
 * Phase 3/5 验证：战争时长分布与“≥50% 省份持续 24 个月”检查。
 *
 * 用法：
 *   pnpm exec tsx scripts/dev/war-duration.ts --years 20 --seeds 42,7
 *   pnpm exec tsx scripts/dev/war-duration.ts --scenarios 1650 --seeds 42
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { constants, setPriority } from 'node:os';
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

function controllerCounts(state: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const province of Object.values(state.provinces)) {
    counts.set(province.controller, (counts.get(province.controller) ?? 0) + 1);
  }
  return counts;
}

interface RunResult {
  scenario: string;
  difficulty: string;
  seed: number;
  years: number;
  wars: Array<{ id: string; attacker: string; defender: string; days: number; ongoing: boolean }>;
  maxShare: { tag: string; provinces: number; share: number; day: number };
  longestOver50Months: number;
  over50Tags: string[];
}

try {
  setPriority(process.pid, constants.priority.PRIORITY_HIGH);
} catch {
  // 无权限时保持默认优先级。
}

const content = loadContentFromDirectory();
const years = Number(arg('years', '20'));
const scenarios = list(arg('scenarios', '1627,1644,1650'));
const difficulties = list(arg('difficulties', 'easy,normal,hard')) as Difficulty[];
const seeds = list(arg('seeds', '42,7')).map(Number);
const totalProvinces = 480;
const rows: RunResult[] = [];
const started = Date.now();

for (const scenario of scenarios) {
  for (const difficulty of difficulties) {
    for (const seed of seeds) {
      const state = createInitialState(content, scenario, seed, 'MING', difficulty, true);
      const warStart = new Map<string, { startDay: number; attacker: string; defender: string }>();
      const finished: RunResult['wars'] = [];
      let maxShare = { tag: '', provinces: 0, share: 0, day: 0 };
      let over50Months = 0;
      let longestOver50Months = 0;
      let lastMonth = -1;
      const over50Tags = new Set<string>();

      const lastDay = years * 365;
      for (let elapsed = 0; elapsed < lastDay && !state.ended; elapsed += 1) {
        for (const war of state.wars) {
          if (!warStart.has(war.id)) {
            warStart.set(war.id, { startDay: war.startDay, attacker: war.attacker, defender: war.defender });
          }
        }
        advanceDay(state, content);
        const alive = new Set(state.wars.map(war => war.id));
        for (const [id, war] of [...warStart]) {
          if (alive.has(id)) continue;
          finished.push({
            id,
            attacker: war.attacker,
            defender: war.defender,
            days: state.day - war.startDay,
            ongoing: false,
          });
          warStart.delete(id);
        }
        const month = Math.floor(elapsed / 30);
        if (month !== lastMonth) {
          lastMonth = month;
          const counts = controllerCounts(state);
          let topTag = '';
          let topCount = 0;
          for (const [tag, count] of counts) {
            if (count > topCount) {
              topTag = tag;
              topCount = count;
            }
          }
          const share = topCount / totalProvinces;
          if (share > maxShare.share) maxShare = { tag: topTag, provinces: topCount, share, day: state.day };
          if (share >= 0.5) {
            over50Months += 1;
            over50Tags.add(topTag);
            longestOver50Months = Math.max(longestOver50Months, over50Months);
          } else {
            over50Months = 0;
          }
        }
      }
      for (const [id, war] of warStart) {
        finished.push({
          id,
          attacker: war.attacker,
          defender: war.defender,
          days: state.day - war.startDay,
          ongoing: true,
        });
      }
      rows.push({
        scenario,
        difficulty,
        seed,
        years,
        wars: finished,
        maxShare,
        longestOver50Months,
        over50Tags: [...over50Tags],
      });
      const durations = finished.filter(war => !war.ongoing).map(war => war.days);
      const ongoing = finished.length - durations.length;
      console.log(
        `${scenario}/${difficulty}/seed${seed}: endedWars=${durations.length} ongoing=${ongoing} `
        + `medianDays=${durations.length > 0 ? median(durations) : 0} maxDays=${durations.length > 0 ? Math.max(...durations) : 0} `
        + `maxShare=${maxShare.tag}:${maxShare.provinces}(${(maxShare.share * 100).toFixed(1)}%) `
        + `over50=${longestOver50Months}mo`,
      );
    }
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted[middle] ?? 0;
}

mkdirSync('out', { recursive: true });
const file = join('out', `war-duration-${years}y-${Date.now()}.json`);
const ended = rows.flatMap(row => row.wars.filter(war => !war.ongoing).map(war => war.days));
writeFileSync(file, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalProvinces,
  summary: {
    runs: rows.length,
    endedWars: ended.length,
    medianDays: median(ended),
    p90Days: [...ended].sort((a, b) => a - b)[Math.floor(ended.length * 0.9)] ?? 0,
    maxDays: ended.length > 0 ? Math.max(...ended) : 0,
    over5Years: ended.filter(days => days > 365 * 5).length,
    maxOver50Months: Math.max(0, ...rows.map(row => row.longestOver50Months)),
  },
  rows,
}, null, 2));
console.log(`runs=${rows.length} elapsed=${((Date.now() - started) / 1000).toFixed(1)}s json=${file}`);
