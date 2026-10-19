import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING', 'normal', true);
for (let year = 1; year <= 5; year += 1) {
  for (let day = 0; day < 365; day += 1) advanceDay(state, content);
  const owned = Object.values(state.provinces).filter(p => p.owner === 'JAPAN').length;
  const controlled = Object.values(state.provinces).filter(p => p.controller === 'JAPAN').length;
  const wars = state.wars.map(w => `${w.attacker}->${w.defender}`).join(',');
  console.log(`year=${year} owned=${owned} ctrl=${controlled} wars=${wars}`);
  if (year === 5) {
    console.log('alliances=', JSON.stringify(state.alliances['JAPAN'] ?? []));
    console.log(state.log.filter(e => e.country === 'JAPAN' && e.category === 'military').slice(-10).map(e => `${e.day}:${e.text}`).join('\n'));
  }
}
