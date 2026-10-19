import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { favorCourtFaction, suppressCourtFaction, topCourtFaction } from '../../src/engine/systems/court';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING');
const ming = state.countries['MING'];
if (!ming) throw new Error('missing MING');
ming.politicalPower = 100;
ming.factions = { donglin: 10, eunuch: 20, imperial: 15, military: 12 };
console.log(`top=${topCourtFaction(state, 'MING')}`);
console.log(`favor=${favorCourtFaction(state, 'MING', 'donglin')} donglin=${ming.factions['donglin']} pp=${ming.politicalPower}`);
console.log(`suppress=${suppressCourtFaction(state, 'MING', 'eunuch')} eunuch=${ming.factions['eunuch']} pp=${ming.politicalPower} stab=${ming.stability}`);
console.log(`topAfter=${topCourtFaction(state, 'MING')}`);
