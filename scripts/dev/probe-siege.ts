import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';

const content = loadContentFromDirectory();

function progress(mode: 'siege' | 'assault' | 'bombard' | 'negotiate'): number {
  const state = createInitialState(content, '1627', 42, 'MING');
  const army = Object.values(state.armies).find(entry => entry.tag === 'MING');
  if (!army) throw new Error('missing army');
  for (const [id, entry] of Object.entries(state.armies)) {
    if (entry.tag === 'QING' && entry.province === 'shenyang') delete state.armies[id];
  }
  army.province = 'shenyang';
  army.movePath = [];
  army.stance = 'hold';
  army.organization = 100;
  army.supply = 100;
  army.siegeMode = mode;
  state.countries['MING']!.treasury = 1000000;
  advanceDay(state, content);
  return state.provinces['shenyang']?.siege?.progress ?? 0;
}

console.log(`siege=${progress('siege').toFixed(1)} assault=${progress('assault').toFixed(1)} bombard=${progress('bombard').toFixed(1)} negotiate=${progress('negotiate').toFixed(1)}`);
