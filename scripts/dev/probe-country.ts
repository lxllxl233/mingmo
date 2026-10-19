/**
 * 单国月度探针：看某国在开局若干月的版图/财政/军队/战争。
 *
 * 用法：pnpm dev:country --scenario 1644 --tag QING --years 2
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { formatDate } from '../../src/engine/core/clock';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const content = loadContentFromDirectory();
const scenarioId = arg('scenario', '1644');
const tag = arg('tag', 'QING');
const years = Number(arg('years', '2'));
const state = createInitialState(content, scenarioId, 42, tag, 'normal', true);

for (let day = 0; day < 365 * years && !state.ended; day += 1) {
  advanceDay(state, content);
  if ((day + 1) % 30 !== 0) continue;
  const country = state.countries[tag];
  if (!country) break;
  const provinces = Object.values(state.provinces).filter(province => province.controller === tag);
  const armies = Object.values(state.armies).filter(army => army.tag === tag);
  const wars = state.wars.filter(war => war.attacker === tag || war.defender === tag);
  const capital = state.provinces[country.capital];
  console.log(`${formatDate(state.day)} prov=${provinces.length} treasury=${Math.round(country.treasury)} arrears=${Math.round(country.arrears)} manpower=${Math.round(country.manpower)} armies=${armies.length} strength=${armies.reduce((sum, army) => sum + army.composition.infantry + army.composition.firearm + army.composition.cavalry + army.composition.artillery + army.composition.naval, 0)} capital=${capital?.controller ?? '?'} wars=${wars.map(war => `${war.attacker}>${war.defender}`).join(',') || 'none'}`);
  const positions = armies.slice(0, 6).map(army => `${content.provinces.get(army.province)?.name ?? army.province}(${army.stance})`).join(' ');
  console.log(`  ${positions}`);
}
