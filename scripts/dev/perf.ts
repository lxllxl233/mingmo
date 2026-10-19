/**
 * 性能探针：内容加载、初始状态、1/5/20 年 tick。
 *
 * 用法：pnpm dev:perf --years 20
 */
import { performance } from 'node:perf_hooks';
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const years = Number(arg('years', '20'));
const contentStart = performance.now();
const content = loadContentFromDirectory();
const contentMs = performance.now() - contentStart;
console.log(`content load: ${contentMs.toFixed(1)}ms`);
console.log(`provinces=${content.provinces.size} events=${content.events.size} focuses=${content.focuses.size} techs=${content.techs.size} laws=${content.taxLaws.size}`);

const initStart = performance.now();
createInitialState(content, '1627', 42, 'MING');
console.log(`initial state: ${(performance.now() - initStart).toFixed(1)}ms`);

for (const span of [1, 5, years]) {
  if (span <= 0) continue;
  const state = createInitialState(content, '1627', 42, 'MING', 'normal', true);
  const start = performance.now();
  for (let day = 0; day < 365 * span && !state.ended; day += 1) advanceDay(state, content);
  const elapsed = performance.now() - start;
  console.log(`${span}y: total=${elapsed.toFixed(0)}ms perDay=${(elapsed / (365 * span)).toFixed(2)}ms armies=${Object.keys(state.armies).length} wars=${state.wars.length}`);
}
