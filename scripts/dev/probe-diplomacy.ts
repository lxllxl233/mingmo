import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { canMarchThrough } from '../../src/engine/rules/access';
import { addAlliance, areAllied, hasMilitaryAccess, removeAlliance } from '../../src/engine/rules/diplomacy';
import { areAtWar, declareWar } from '../../src/engine/rules/war';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING');
console.log(`ally=${addAlliance(state, 'MING', 'MONGOL')} areAllied=${areAllied(state, 'MING', 'MONGOL')} access=${hasMilitaryAccess(state, 'MONGOL', 'MING')} march=${canMarchThrough(state, 'MING', 'chahar')}`);
console.log(`warWhileAllied=${declareWar(state, 'MING', 'MONGOL', 'test', content)?.id ?? 'null'}`);
console.log(`break=${removeAlliance(state, 'MING', 'MONGOL')} warAfter=${declareWar(state, 'MING', 'MONGOL', 'test', content)?.id ?? 'null'}`);

const state2 = createInitialState(content, '1627', 42, 'MING');
addAlliance(state2, 'MONGOL', 'JAPAN');
declareWar(state2, 'MING', 'MONGOL', 'test', content);
console.log(`callToArms MING-JAPAN=${areAtWar(state2, 'MING', 'JAPAN')} wars=${state2.wars.length}`);
