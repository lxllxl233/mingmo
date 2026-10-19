import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceCrisis } from '../../src/engine/systems/crisis';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING');
const ming = state.countries['MING'];
if (!ming) throw new Error('missing MING');
ming.fiscalCrisisDays = 730;
ming.treasury = 0;
ming.arrears = 1000000;
advanceCrisis(state, content);
const orphaned = Object.values(state.provinces).filter(province => province.owner === 'MING' || province.controller === 'MING');
console.log(`mingAlive=${ming.alive} smingAlive=${state.countries['SMING']?.alive} orphaned=${orphaned.length}`);
const counts: Record<string, number> = {};
for (const province of Object.values(state.provinces)) counts[province.owner] = (counts[province.owner] ?? 0) + 1;
console.log(JSON.stringify(counts));
