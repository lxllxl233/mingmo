import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { buildingModifiers, startBuilding } from '../../src/engine/systems/buildings';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING');
const provinceId = state.countries['MING']?.capital ?? 'beijing';
const nation = state.countries['MING'];
if (!nation) throw new Error('missing MING');
nation.treasury = 1000000;
nation.food = 1000000;
console.log(`province=${provinceId} controller=${state.provinces[provinceId]?.controller}`);
console.log(`start=${startBuilding(state, content, 'MING', provinceId, 'bld_granary')}`);
const def = content.buildings.get('bld_granary');
for (let day = 0; day < (def?.days ?? 90); day += 1) advanceDay(state, content);
console.log(`buildings=${state.provinces[provinceId]?.buildings.join(',')} building=${state.provinces[provinceId]?.building?.id ?? 'none'}`);
console.log(`modifiers=${JSON.stringify(buildingModifiers(state, content, 'MING'))}`);
