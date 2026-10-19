/**
 * 场景一致性矩阵：同一剧本、不同玩家 tag，开局世界必须一致。
 *
 * 用法：
 *   pnpm dev:matrix            # 报告
 *   pnpm dev:matrix --strict   # 有不一致则 exit 1
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import type { GameState } from '../../src/engine/state/types';

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16);
}

interface Snapshot {
  provinces: string;
  wars: string;
  alive: string;
  owners: Record<string, number>;
  hash: string;
}

function snapshot(state: GameState): Snapshot {
  const provinces = Object.values(state.provinces)
    .map(province => `${province.id}:${province.owner}:${province.controller}`)
    .sort()
    .join('|');
  const wars = state.wars
    .map(war => `${war.attacker}>${war.defender}:${war.warGoal}`)
    .sort()
    .join('|');
  const alive = Object.values(state.countries)
    .filter(country => country.alive)
    .map(country => country.tag)
    .sort()
    .join(',');
  const owners: Record<string, number> = {};
  for (const province of Object.values(state.provinces)) {
    owners[province.owner] = (owners[province.owner] ?? 0) + 1;
  }
  return { provinces, wars, alive, owners, hash: hash(`${provinces}\n${wars}\n${alive}`) };
}

function diff(a: Snapshot, b: Snapshot, label: string): string[] {
  const lines: string[] = [];
  if (a.hash !== b.hash) lines.push(`${label}: hash ${a.hash} != ${b.hash}`);
  if (a.alive !== b.alive) lines.push(`${label}: alive [${a.alive}] != [${b.alive}]`);
  if (a.wars !== b.wars) lines.push(`${label}: wars [${a.wars}] != [${b.wars}]`);
  const provinceA = new Map<string, string>();
  const provinceB = new Map<string, string>();
  for (const entry of a.provinces.split('|')) {
    const [id, owner, controller] = entry.split(':');
    if (id) provinceA.set(id, `${owner ?? ''}/${controller ?? ''}`);
  }
  for (const entry of b.provinces.split('|')) {
    const [id, owner, controller] = entry.split(':');
    if (id) provinceB.set(id, `${owner ?? ''}/${controller ?? ''}`);
  }
  let shown = 0;
  for (const [id, value] of provinceA) {
    const other = provinceB.get(id);
    if (other && other !== value) {
      lines.push(`${label}: ${id} ${value} != ${other}`);
      shown += 1;
      if (shown >= 12) break;
    }
  }
  return lines;
}

const content = loadContentFromDirectory();
const strict = process.argv.includes('--strict');
const tags = [...content.countries.keys()];
let mismatches = 0;

for (const scenario of content.scenarios.values()) {
  const snapshots: Array<{ tag: string; snapshot: Snapshot }> = [];
  for (const tag of tags) {
    try {
      const state = createInitialState(content, scenario.id, 42, tag);
      snapshots.push({ tag, snapshot: snapshot(state) });
    } catch (error) {
      mismatches += 1;
      console.error(`${scenario.id}/${tag}: ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (snapshots.length === 0) continue;
  const baseline = snapshots[0]!;
  console.log(`\n=== ${scenario.id} (${scenario.name}) baseline=${baseline.tag} hash=${baseline.snapshot.hash} ===`);
  for (const { tag, snapshot: current } of snapshots) {
    const top = Object.entries(current.owners)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([owner, count]) => `${owner}:${count}`)
      .join(' ');
    console.log(`${tag.padEnd(8)} hash=${current.hash} alive=${current.alive} wars=${current.wars || 'none'}`);
    console.log(`         ${top}`);
    if (tag !== baseline.tag) {
      const lines = diff(baseline.snapshot, current, tag);
      if (lines.length > 0) {
        mismatches += 1;
        for (const line of lines) console.log(`  DIFF ${line}`);
      }
    }
  }
}

console.log(`\n=== 场景矩阵：${mismatches === 0 ? '一致' : `${mismatches} 处不一致`} ===`);
if (strict && mismatches > 0) {
  console.error('scenario-matrix 失败：同剧本不同玩家得到不同世界。');
  process.exitCode = 1;
}
