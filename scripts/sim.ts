/**
 * 无头模拟：pnpm sim --years 70 --seed 42 --scenario 1627 --player MING
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceDay } from '../src/engine/tick';
import { chooseEventOption } from '../src/engine/systems/events';
import { formatDate, fromDayIndex, isYearStart } from '../src/engine/core/clock';
import { hashState } from '../src/engine/state/hash';
import type { GameState } from '../src/engine/state/types';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function autoResolvePlayer(state: GameState, content: ReturnType<typeof loadContentFromDirectory>): void {
  for (let guard = 0; guard < 8; guard += 1) {
    const pending = state.pendingEvents.find(event => event.country === state.playerTag);
    if (!pending) return;
    const event = content.events.get(pending.eventId);
    if (!event) {
      state.pendingEvents = state.pendingEvents.filter(entry => entry !== pending);
      continue;
    }
    const option = event.options.find(entry => entry.id === event.aiChoice) ?? event.options[0];
    if (!option) return;
    chooseEventOption(state, content, event.id, option.id);
  }
}

const content = loadContentFromDirectory();
const years = Number(arg('years', '70'));
const seed = Number(arg('seed', '42'));
const scenarioId = arg('scenario', '1627');
const player = arg('player', 'MING');
const outDir = arg('out', 'out');
mkdirSync(outDir, { recursive: true });

const state = createInitialState(content, scenarioId, seed, player);
const rows: string[] = [
  'year,date,tag,provinces,population,treasury,food,stability,mandate,corruption,army_loyalty,arrears,armies,wars,events',
];
const start = Date.now();
let ticks = 0;
const totalDays = Math.min(365 * years, 24837);
for (let index = 0; index < totalDays; index += 1) {
  if (state.ended) break;
  advanceDay(state, content);
  autoResolvePlayer(state, content);
  ticks += 1;
  if (isYearStart(state.day) || index === totalDays - 1) {
    const year = fromDayIndex(state.day).year;
    for (const country of Object.values(state.countries)) {
      if (!country.alive) continue;
      const provinces = Object.values(state.provinces).filter(province => province.owner === country.tag);
      const population = provinces.reduce((sum, province) => sum + province.population, 0);
      const armies = Object.values(state.armies).filter(army => army.tag === country.tag).length;
      const wars = state.wars.filter(war => war.attacker === country.tag || war.defender === country.tag).length;
      rows.push([
        year,
        formatDate(state.day),
        country.tag,
        provinces.length,
        Math.round(population),
        Math.round(country.treasury),
        Math.round(country.food),
        country.stability.toFixed(1),
        country.mandate.toFixed(1),
        country.corruption.toFixed(1),
        country.armyLoyalty.toFixed(1),
        Math.round(country.arrears),
        armies,
        wars,
        country.lastReport ? Math.round(country.lastReport.net) : 0,
      ].join(','));
    }
  }
}
const elapsed = Date.now() - start;
writeFileSync(join(outDir, `sim-${scenarioId}-${player}-${seed}.csv`), `${rows.join('\n')}\n`, 'utf8');

for (const country of Object.values(state.countries)) {
  if (!country.alive) continue;
  for (const value of [country.treasury, country.food, country.stability, country.mandate, country.arrears]) {
    if (!Number.isFinite(value)) throw new Error(`NaN in ${country.tag}`);
  }
  for (const estate of Object.values(country.estates)) {
    if (!Number.isFinite(estate.loyalty) || !Number.isFinite(estate.influence)) {
      throw new Error(`NaN estate in ${country.tag}.${estate.key}`);
    }
  }
}
const ming = state.countries['MING'];
console.log(`scenario=${scenarioId} player=${player} seed=${seed} years=${years} ticks=${ticks} ms=${elapsed}`);
console.log(`date=${formatDate(state.day)} hash=${hashState(state)}`);
console.log(`MING alive=${ming?.alive} provinces=${Object.values(state.provinces).filter(p => p.owner === 'MING').length} treasury=${Math.round(ming?.treasury ?? 0)} arrears=${Math.round(ming?.arrears ?? 0)} stability=${(ming?.stability ?? 0).toFixed(1)}`);
console.log(`wars=${state.wars.length} armies=${Object.keys(state.armies).length} log=${state.log.length}`);
console.log(`csv=${join(outDir, `sim-${scenarioId}-${player}-${seed}.csv`)}`);
