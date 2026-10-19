import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { encodeSave, decodeSave } from '../../src/app/save/save';
import { hashState } from '../../src/engine/state/hash';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING', 'normal', true);
for (let day = 0; day < 365 * 10; day += 1) advanceDay(state, content);
const text = encodeSave(state);
const decoded = decodeSave(text);
console.log(`bytes=${text.length} kb=${(text.length / 1024).toFixed(1)} roundTrip=${hashState(decoded) === hashState(state)}`);
