/**
 * 行为回归探针：逐个剧本 × 种子跑 5 年，每年输出状态哈希。
 * 性能优化前后必须完全一致（零行为变更）。
 *
 * 用法：pnpm exec tsx scripts/dev/hash-probe.ts > out/hash.txt
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { hashState } from '../../src/engine/state/hash';
import { advanceDay } from '../../src/engine/tick';

const content = loadContentFromDirectory();

for (const scenario of ['1627', '1644', '1650']) {
  for (const seed of [42, 7]) {
    const state = createInitialState(content, scenario, seed, 'MING', 'normal', true);
    const rows: string[] = [];
    for (let year = 1; year <= 5; year += 1) {
      for (let day = 0; day < 365 && !state.ended; day += 1) advanceDay(state, content);
      rows.push(`${year}:${hashState(state)}`);
      if (state.ended) break;
    }
    console.log(`${scenario}/seed${seed} ${rows.join(' ')}`);
  }
}
