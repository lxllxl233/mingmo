/**
 * 性能探针：内容加载、初始状态、1/5/20 年 tick。
 *
 * 用法：pnpm dev:perf --years 20
 */
import { performance } from 'node:perf_hooks';
import { constants, setPriority } from 'node:os';
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';

// Windows 会对持续占用 CPU 的后台进程启用 EcoQoS/省电节流（实测纯 JS 循环可慢 8 倍）。
// 探针需要真实数值，提到 HIGH；无权限时保持默认。
try {
  setPriority(process.pid, constants.priority.PRIORITY_HIGH);
} catch {
  // 忽略：默认优先级下测得的绝对值可能偏高，但不影响相对比较。
}

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

// 先跑一年热身，让 V8 完成 JIT 与内联；否则第一段 1 年会把冷启动开销算进 P99。
const warmup = createInitialState(content, '1627', 42, 'MING', 'normal', true);
for (let day = 0; day < 365 && !warmup.ended; day += 1) advanceDay(warmup, content);

function quantile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
}

for (const span of [1, 5, years]) {
  if (span <= 0) continue;
  const state = createInitialState(content, '1627', 42, 'MING', 'normal', true);
  const days = Math.min(365 * span, 365 * 200);
  const samples = new Float64Array(days);
  const start = performance.now();
  let count = 0;
  for (let day = 0; day < days && !state.ended; day += 1) {
    const dayStart = performance.now();
    advanceDay(state, content);
    samples[count] = performance.now() - dayStart;
    count += 1;
  }
  const elapsed = performance.now() - start;
  const sorted = samples.slice(0, count).sort();
  console.log(
    `${span}y: total=${elapsed.toFixed(0)}ms perDay=${(elapsed / count).toFixed(2)}ms ` +
    `p50=${quantile(sorted, 0.5).toFixed(2)} p95=${quantile(sorted, 0.95).toFixed(2)} ` +
    `p99=${quantile(sorted, 0.99).toFixed(2)} max=${(sorted[count - 1] ?? 0).toFixed(2)} ` +
    `armies=${Object.keys(state.armies).length} wars=${state.wars.length}`,
  );
}
