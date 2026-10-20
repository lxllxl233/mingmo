/**
 * 内容重复审计：跑满 3 个剧本到 1683，统计事件重复触发与从未触发的事件。
 * 判定「重复到腻」的信号：同一事件对同一势力触发 ≥N 次、以及从未触发的死内容。
 *
 * 用法：
 *   pnpm exec tsx scripts/dev/audit-events.ts
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { LAST_DAY_INDEX } from '../../src/engine/core/clock';

const content = loadContentFromDirectory();
const scenarios = ['1627', '1644', '1650'];
const seeds = [42];

for (const scenario of scenarios) {
  const fireCounts = new Map<string, number>();
  for (const seed of seeds) {
    const state = createInitialState(content, scenario, seed, 'MING', 'normal', true);
    while (!state.ended && state.day < LAST_DAY_INDEX) advanceDay(state, content);
    // firedEvents 的 key 是 `eventId:country`，按 eventId 汇总所有势力的触发次数。
    for (const key of Object.keys(state.firedEvents)) {
      const eventId = key.slice(0, key.lastIndexOf(':'));
      fireCounts.set(eventId, (fireCounts.get(eventId) ?? 0) + 1);
    }
  }

  const totalEvents = content.events.size;
  const fired = [...fireCounts.entries()].filter(([, n]) => n > 0);
  const neverFired = [...content.events.keys()].filter(id => !fireCounts.has(id));
  const repeated = [...fireCounts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);

  console.log(`\n=== ${scenario} ===`);
  console.log(`events total=${totalEvents} fired(unique)=${fired.length} neverFired=${neverFired.length} repeat>=3=${repeated.length}`);
  console.log(`totalFires=${[...fireCounts.values()].reduce((s, n) => s + n, 0)}`);
  if (repeated.length > 0) {
    console.log('  most-repeated (id:fires):');
    for (const [id, n] of repeated.slice(0, 15)) {
      const def = content.events.get(id);
      console.log(`    ${id}: ${n}  (${def?.title ?? ''})`);
    }
  }
  if (neverFired.length > 0) {
    console.log(`  never-fired (first 25): ${neverFired.slice(0, 25).join(', ')}`);
  }
}
