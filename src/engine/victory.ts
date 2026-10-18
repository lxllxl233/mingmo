import type { ContentIndex } from '../content/types';
import { fromDayIndex } from './core/clock';
import type { GameState, VictoryResult } from './state/types';

const MAJOR_CITIES = ['beijing', 'nanjing', 'xian', 'shenyang', 'guangzhou', 'chengdu'];
const PORTS = ['quanzhou', 'ningbo', 'guangzhou', 'nagasaki', 'anping', 'penghu', 'songjiang'];

function controlledProvinces(state: GameState, tag: string): string[] {
  return Object.values(state.provinces)
    .filter(province => province.controller === tag)
    .map(province => province.id);
}

export function scoreCountry(state: GameState, content: ContentIndex, tag: string): { total: number; breakdown: Record<string, number> } {
  const country = state.countries[tag];
  if (!country) return { total: 0, breakdown: {} };
  const provinces = controlledProvinces(state, tag);
  const population = provinces.reduce((sum, id) => sum + (content.provinces.get(id)?.population ?? 0), 0);
  const breakdown = {
    疆域: provinces.length * 10,
    人口: Math.round(population / 1_000_000),
    财政: Math.max(0, Math.round(country.treasury / 100_000)),
    稳定: Math.round(country.stability),
    科技: country.completedTechs.length * 5,
    国策: country.completedFocuses.length * 2,
  };
  return { total: Object.values(breakdown).reduce((sum, value) => sum + value, 0), breakdown };
}

export function evaluateVictory(state: GameState, content: ContentIndex): VictoryResult {
  const year = fromDayIndex(state.day).year;
  let best: { tag: string; score: number; breakdown: Record<string, number>; reason: string } | null = null;
  for (const country of Object.values(state.countries)) {
    if (!country.alive) continue;
    const provinces = controlledProvinces(state, country.tag);
    const major = MAJOR_CITIES.filter(id => state.provinces[id]?.controller === country.tag);
    const ports = PORTS.filter(id => state.provinces[id]?.controller === country.tag);
    let reason = '';
    if (provinces.length >= 384 && major.length === MAJOR_CITIES.length) reason = '一统天下';
    else if (country.mandate >= 90 && major.includes('beijing') && major.includes('nanjing')) reason = '承天受命';
    else if (year >= 1683 && provinces.length >= 15) reason = '割据一隅';
    else if (ports.length >= 6 && year >= 1683) reason = '海上霸权';
    const scored = scoreCountry(state, content, country.tag);
    if (!best || scored.total > best.score) best = { tag: country.tag, score: scored.total, breakdown: scored.breakdown, reason };
  }
  const player = state.countries[state.playerTag];
  const playerScore = player ? scoreCountry(state, content, state.playerTag) : { total: 0, breakdown: {} };
  const playerProvinces = player ? controlledProvinces(state, state.playerTag) : [];
  const playerMajor = MAJOR_CITIES.filter(id => state.provinces[id]?.controller === state.playerTag);
  const playerPorts = PORTS.filter(id => state.provinces[id]?.controller === state.playerTag);
  const playerReason = !player?.alive
    ? '身死国灭'
    : playerProvinces.length >= 384 && playerMajor.length === MAJOR_CITIES.length
      ? '一统天下'
      : player.mandate >= 90 && playerMajor.includes('beijing') && playerMajor.includes('nanjing')
        ? '承天受命'
        : year >= 1683 && playerPorts.length >= 6
          ? '海上霸权'
          : year >= 1683 && playerProvinces.length >= 15
            ? '割据一隅'
            : '存续';
  return {
    winner: best?.tag ?? null,
    reason: playerReason,
    score: playerScore.total,
    breakdown: playerScore.breakdown,
  };
}
