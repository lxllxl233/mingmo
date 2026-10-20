/**
 * 囤银诊断：跑一个势力若干年，打印国库/月收入/月支出/净收入/海贸收入，定位囤银根因。
 *
 * 用法：
 *   pnpm exec tsx scripts/dev/probe-hoard.ts --scenario 1650 --tag ZHENG --years 20
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const content = loadContentFromDirectory();
const scenario = arg('scenario', '1650');
const tag = arg('tag', 'ZHENG');
const years = Number(arg('years', '20'));

const state = createInitialState(content, scenario, 42, tag, 'normal', true);
for (let day = 0; day < years * 365 && !state.ended; day += 1) advanceDay(state, content);

const nation = state.countries[tag];
if (!nation) {
  console.log('no nation', tag);
  process.exit(1);
}
const report = nation.lastReport;
const history = nation.monthlyHistory;
const recent = history.slice(-12);
const avgIncome = recent.reduce((sum, r) => sum + (r.income ?? 0), 0) / Math.max(1, recent.length);
const avgExpense = recent.reduce((sum, r) => sum + (r.expense ?? 0), 0) / Math.max(1, recent.length);
const avgNet = recent.reduce((sum, r) => sum + (r.net ?? 0), 0) / Math.max(1, recent.length);
const provinces = Object.values(state.provinces).filter(province => province.controller === tag).length;

console.log(JSON.stringify({
  tag,
  scenario,
  years,
  alive: nation.alive,
  provinces,
  treasury: Math.round(nation.treasury),
  tradePosts: nation.tradePosts.length,
  avgIncome: Math.round(avgIncome),
  avgExpense: Math.round(avgExpense),
  avgNet: Math.round(avgNet),
  monthsOfExpense: avgExpense > 0 ? Math.round(nation.treasury / avgExpense) : null,
  lastReport: report ? {
    income: Math.round(report.income),
    expense: Math.round(report.expense),
    net: Math.round(report.net),
    expenseHoard: Math.round(report.expenseHoard ?? 0),
    expenseArmy: Math.round(report.expenseArmy),
    foodPurchaseSilver: Math.round(report.foodPurchaseSilver ?? 0),
  } : null,
}, null, 2));
