/**
 * 内容重复审计：读取 player-bot 输出的 8 局长局日志，统计事件重复度、
 * 1650 年后事件触发量、国策/决议剩余量，判定 10 小时档是否出现内容干旱。
 *
 * 用法：pnpm exec tsx scripts/dev/content-audit.ts [out/player-bot-*.json]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface BotRow {
  tag: string;
  startYear: number;
  endYear: number;
  alive: boolean;
  endReason: string | null;
  eventsHandled: number;
  repeats: Record<string, number>;
  lateEvents: number;
  eventsLeft: number;
  focusesLeft: number;
  decisionsLeft: number;
  errors: string[];
}

interface BotFile {
  generatedAt: string;
  rows: BotRow[];
}

function latestBotFile(): string {
  const dir = 'out';
  const candidates = readdirSync(dir)
    .filter(name => name.startsWith('player-bot-') && name.endsWith('.json'))
    .sort();
  const name = candidates[candidates.length - 1];
  if (!name) throw new Error('no player-bot json in out/');
  return join(dir, name);
}


const path = process.argv[2] ?? latestBotFile();
const data = JSON.parse(readFileSync(path, 'utf8')) as BotFile;
const survivors = data.rows.filter(row => row.alive && row.endYear >= 1683);
const lateTotal = survivors.reduce((sum, row) => sum + row.lateEvents, 0);
const latePerRun = survivors.length > 0 ? lateTotal / survivors.length : 0;
const pooled = new Map<string, number>();
for (const row of data.rows) {
  for (const [id, count] of Object.entries(row.repeats)) {
    pooled.set(id, Math.max(pooled.get(id) ?? 0, count));
  }
}
const repeated = [...pooled.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
const drought = survivors.length > 0 && latePerRun < 5;

const lines: string[] = [];
lines.push('# 内容重复审计（player-bot 8 局长局）', '');
lines.push(`数据：\`${path}\`，生成于 ${data.generatedAt}`, '');
lines.push('## 每局概况', '');
lines.push('| 势力 | 年份 | 存活 | 结局 | 事件总数 | 重复事件 | 1650+ 事件 | 末期可用事件 | 剩余国策 | 剩余决议 |');
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const row of data.rows) {
  const events = Object.values(row.repeats).reduce((sum, count) => sum + count, 0);
  const repeats = Object.values(row.repeats).filter(count => count > 1).length;
  lines.push(`| ${row.tag} | ${row.startYear}–${row.endYear} | ${row.alive ? '是' : '否'} | ${row.endReason ?? '—'} `
    + `| ${events} | ${repeats} | ${row.lateEvents} | ${row.eventsLeft} | ${row.focusesLeft} | ${row.decisionsLeft} |`);
}
lines.push('', '## 重复触发最多的事件（跨局取最大值）', '');
if (repeated.length === 0) {
  lines.push('无事件在单局内重复触发超过 1 次。');
} else {
  lines.push('| 事件 | 单局最多触发 |', '|---|---|');
  for (const [id, count] of repeated.slice(0, 12)) lines.push(`| ${id} | ${count} |`);
}
lines.push('', '## 判定', '');
lines.push(`- 存活到 1683 的局：${survivors.length}/${data.rows.length}。`);
lines.push(`- 1650 年后人均触发事件：${latePerRun.toFixed(1)} 次/局（${lateTotal} 次 / ${survivors.length} 局）。`);
lines.push(`- 末期可用事件池（代理值）：${survivors.map(row => `${row.tag} ${row.eventsLeft}`).join('，') || '—'}。`);
lines.push(`- 内容干旱：${drought ? '**是**（存活局 1650 后人均 < 5 次事件）' : '否（存活局 1650 后仍有持续事件供给）'}。`);
lines.push('', '## 方法学', '');
lines.push('- 「事件总数」来自 `state.firedEvents` 中归属于玩家 tag 的键，含事件链节点；');
lines.push('- 「末期可用事件」为终局时 trigger 仍为真、且国家范围匹配的事件数，仅作池量代理，不等于实际会触发数；');
lines.push('- 死亡局按死亡年份截断，不参与干旱判定。');

const out = join('out', `content-audit-${Date.now()}.md`);
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log(`\nreport=${out}`);
